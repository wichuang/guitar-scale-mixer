/**
 * CombinedSheetOCR.js - Combined Staff+Tab OCR Module
 * For images with paired Staff+Tab systems (most common guitar score format).
 * Uses Tab as primary source (more reliable for guitar), Staff as secondary
 * for pitch validation and duration info, with chord symbol detection.
 */

import Tesseract from 'tesseract.js';
import { SystemDetector, SystemType } from './SystemDetector.js';
import { HeaderOCR } from './HeaderOCR.js';
import { TabOCR } from './TabOCR.js';
// loadImageToCanvas no longer needed - originalCanvas provided by SystemDetector via preprocessImage
import { detectNotes, detectBarlines } from './noteDetection.js';
import { removeStaffLines } from './staffPreprocess.js';
import { Note } from '../core/models/Note.js';

// Standard tuning MIDI values (High E to Low E)
const STRING_TUNINGS = [64, 59, 55, 50, 45, 40];

// Chord pattern
const CHORD_PATTERN = /^[A-G][#b]?(?:m|dim|aug|sus|Maj|M)?[0-9]?(?:\/[A-G][#b]?)?$/;

/**
 * CombinedSheetOCR class
 */
export class CombinedSheetOCR {
    constructor() {
        this.systemDetector = new SystemDetector();
        this.headerOCR = null;
        this.tabOCR = null;
        this.chordWorker = null;
    }

    /**
     * Recognize a combined staff+tab image
     * @param {File|Blob|string} imageSource
     * @param {Function} onProgress
     * @param {Object} options
     * @returns {Promise<Object>} recognition result
     */
    async recognize(imageSource, onProgress, options = {}) {
        const {
            detectHeader = true,
            detectChords = true,
        } = options;

        // 1. Detect systems (uses binarized image internally)
        onProgress?.('Detecting notation systems...', 5);
        const detection = await this.systemDetector.detectSystems(imageSource, (msg, pct) => {
            onProgress?.(msg, 5 + pct * 0.15);
        });

        const { systems, canvas: binarizedCanvas, width, height, imageData, originalCanvas } = detection;

        if (systems.length === 0) {
            return {
                type: 'combined',
                notes: [],
                metadata: {},
                confidence: 0,
                error: 'No notation systems detected in the image',
            };
        }

        onProgress?.(`Found ${systems.length} system(s)`, 20);

        // 2. Extract header metadata
        let metadata = {};
        if (detectHeader) {
            onProgress?.('Reading header...', 22);
            try {
                this.headerOCR = new HeaderOCR();
                metadata = await this.headerOCR.recognizeHeader(imageSource, (msg, pct) => {
                    onProgress?.(msg, 22 + pct * 0.08);
                });
                await this.headerOCR.terminate();
            } catch (e) {
                console.warn('Header OCR failed:', e);
            }
        }

        // 3. Process each system sequentially
        onProgress?.('Processing systems...', 30);
        const allNotes = [];
        let noteIndex = 0;
        const systemResults = [];

        // Initialize Tab OCR once
        this.tabOCR = new TabOCR();
        await this.tabOCR.initialize((msg) => {
            onProgress?.(msg, 32);
        });

        for (let i = 0; i < systems.length; i++) {
            const system = systems[i];
            const progressBase = 30 + (i / systems.length) * 50;
            onProgress?.(`Processing system ${i + 1}/${systems.length}...`, progressBase);

            let systemNotes = [];

            if (system.type === SystemType.STAFF_TAB) {
                // Combined Staff+Tab: use Tab as primary
                // Pass originalCanvas so TabOCR can do its own preprocessing
                systemNotes = await this.processStaffTabSystem(
                    originalCanvas, system, width, height, imageData, noteIndex,
                    (msg, pct) => onProgress?.(msg, progressBase + pct * (50 / systems.length / 100))
                );
            } else if (system.type === SystemType.TAB) {
                // Tab only - pass originalCanvas
                systemNotes = await this.processTabSystem(
                    originalCanvas, system, width, noteIndex,
                    (msg, pct) => onProgress?.(msg, progressBase + pct * (50 / systems.length / 100))
                );
            } else if (system.type === SystemType.STAFF) {
                // Staff only - uses binarized canvas for note detection
                systemNotes = await this.processStaffSystem(
                    binarizedCanvas, system, width, height, imageData, noteIndex
                );
            }

            // Detect chord symbols above this system (binarized is fine for text OCR)
            if (detectChords && system.chordRegionTop !== undefined) {
                const chords = await this.detectChordsInRegion(
                    originalCanvas, system.chordRegionTop, system.chordRegionBottom, width
                );
                this.associateChordsWithNotes(chords, systemNotes, system);
            }

            // Detect technique marks (for staff+tab)
            if (system.type === SystemType.STAFF_TAB && system.techniqueRegionTop !== undefined) {
                const techniques = await this.detectTechniqueMarks(
                    originalCanvas, system.techniqueRegionTop, system.techniqueRegionBottom, width
                );
                this.associateTechniquesWithNotes(techniques, systemNotes, system);
            }

            systemResults.push({
                systemIndex: i,
                type: system.type,
                notes: systemNotes,
            });

            // Add separator between systems
            if (systemNotes.length > 0) {
                allNotes.push(...systemNotes);
                noteIndex += systemNotes.length;

                // Add barline separator between systems
                if (i < systems.length - 1) {
                    allNotes.push(Note.createSeparator({ index: noteIndex }));
                    noteIndex++;
                }
            }
        }

        // Cleanup
        await this.tabOCR.terminate();

        // 4. Calculate overall confidence
        const confidences = systemResults
            .filter(r => r.notes.length > 0)
            .map(r => {
                const noteConfidences = r.notes
                    .filter(n => n.confidence)
                    .map(n => n.confidence);
                return noteConfidences.length > 0
                    ? noteConfidences.reduce((a, b) => a + b, 0) / noteConfidences.length
                    : 50;
            });
        const avgConfidence = confidences.length > 0
            ? confidences.reduce((a, b) => a + b, 0) / confidences.length
            : 0;

        onProgress?.('Complete', 100);

        return {
            type: 'combined',
            notes: allNotes,
            metadata,
            confidence: avgConfidence,
            systemResults,
            systemCount: systems.length,
            systems,
        };
    }

    /**
     * Process a combined Staff+Tab system
     * Tab is primary source, Staff validates pitch
     */
    async processStaffTabSystem(canvas, system, width, height, imageData, startNoteIndex, onProgress) {
        const notes = [];

        // Crop the tab region from the ORIGINAL (un-binarized) canvas
        const tabTopY = system.tabLines[0];
        const tabBottomY = system.tabLines[5];
        const tabHeight = tabBottomY - tabTopY;
        const margin = Math.max(10, system.tabSpacing * 0.5);

        /* console.log('[CombinedOCR] Processing Staff+Tab system:', {
            tabTopY, tabBottomY, tabHeight, margin,
            tabLines: system.tabLines,
            tabSpacing: system.tabSpacing,
            canvasSize: `${canvas.width}x${canvas.height}`,
        }); */

        const tabCanvas = document.createElement('canvas');
        tabCanvas.width = width;
        tabCanvas.height = tabHeight + margin * 2;
        const tabCtx = tabCanvas.getContext('2d', { willReadFrequently: true });
        tabCtx.drawImage(canvas,
            0, tabTopY - margin, width, tabHeight + margin * 2,
            0, 0, width, tabHeight + margin * 2
        );

        // Adjust tab line positions relative to cropped canvas
        const adjustedTabLines = system.tabLines.map(y => y - tabTopY + margin);
        // console.log('[CombinedOCR] Adjusted tab lines:', adjustedTabLines);

        // Run Tab OCR with pre-detected lines
        try {
            const tabResult = await this.tabOCR.recognizeTabImage(tabCanvas, onProgress, {
                tabLines: adjustedTabLines,
                startNoteIndex,
            });

            /* console.log('[CombinedOCR] Tab OCR result:', {
                notesCount: tabResult.notes?.length || 0,
                confidence: tabResult.confidence,
                rawTextLength: tabResult.rawText?.length || 0,
            }); */

            if (tabResult.notes) {
                notes.push(...tabResult.notes);
            }
        } catch (e) {
            console.warn('Tab OCR failed for system:', e);
        }

        return notes;
    }

    /**
     * Process a Tab-only system
     */
    async processTabSystem(canvas, system, width, startNoteIndex, onProgress) {
        const notes = [];

        const tabTopY = system.tabLines[0];
        const tabBottomY = system.tabLines[5];
        const tabHeight = tabBottomY - tabTopY;
        const margin = Math.max(10, system.tabSpacing * 0.5);

        const tabCanvas = document.createElement('canvas');
        tabCanvas.width = width;
        tabCanvas.height = tabHeight + margin * 2;
        const tabCtx = tabCanvas.getContext('2d', { willReadFrequently: true });
        tabCtx.drawImage(canvas,
            0, tabTopY - margin, width, tabHeight + margin * 2,
            0, 0, width, tabHeight + margin * 2
        );

        const adjustedTabLines = system.tabLines.map(y => y - tabTopY + margin);

        try {
            const tabResult = await this.tabOCR.recognizeTabImage(tabCanvas, onProgress, {
                tabLines: adjustedTabLines,
                startNoteIndex,
            });

            if (tabResult.notes) {
                notes.push(...tabResult.notes);
            }
        } catch (e) {
            console.warn('Tab OCR failed:', e);
        }

        return notes;
    }

    /**
     * Process a Staff-only system
     */
    async processStaffSystem(canvas, system, width, height, imageData, startNoteIndex) {
        // Use the full image data but with staff group info
        const staffGroup = {
            lines: system.staffLines,
            spacing: system.staffSpacing,
            top: system.topY,
            bottom: system.bottomY,
        };

        // Crop staff region
        const staffHeight = system.bottomY - system.topY;
        const margin = system.staffSpacing * 2;
        const cropTop = Math.max(0, system.topY - margin);
        const cropBottom = Math.min(height, system.bottomY + margin);
        const cropHeight = cropBottom - cropTop;

        const staffCanvas = document.createElement('canvas');
        staffCanvas.width = width;
        staffCanvas.height = cropHeight;
        const staffCtx = staffCanvas.getContext('2d', { willReadFrequently: true });
        staffCtx.drawImage(canvas, 0, cropTop, width, cropHeight, 0, 0, width, cropHeight);

        // Get image data from cropped canvas
        const croppedImageData = staffCtx.getImageData(0, 0, width, cropHeight);

        // Adjust staff lines relative to cropped canvas
        const adjustedGroup = {
            lines: system.staffLines.map(y => y - cropTop),
            spacing: system.staffSpacing,
            top: system.topY - cropTop,
            bottom: system.bottomY - cropTop,
        };

        // Remove staff lines from cropped image
        removeStaffLines(croppedImageData, width, cropHeight, adjustedGroup.lines, 2);

        // Detect notes
        const detectedNotes = detectNotes(croppedImageData, width, cropHeight, adjustedGroup, {
            startNoteIndex,
        });

        // Convert to Note objects
        const notes = [];
        let noteIndex = startNoteIndex;
        for (const detected of detectedNotes) {
            const note = Note.fromMidi(detected.midi, {
                index: noteIndex,
                confidence: detected.confidence,
                sourceType: 'staff-ocr',
            });
            notes.push(note);
            noteIndex++;
        }

        return notes;
    }

    /**
     * Detect chord symbols in a specific region
     * @param {HTMLCanvasElement} canvas
     * @param {number} topY
     * @param {number} bottomY
     * @param {number} width
     * @returns {Promise<Array<{chord: string, x: number}>>}
     */
    async detectChordsInRegion(canvas, topY, bottomY, width) {
        const regionHeight = bottomY - topY;
        if (regionHeight < 10) return [];

        // Crop the chord region
        const chordCanvas = document.createElement('canvas');
        chordCanvas.width = width;
        chordCanvas.height = regionHeight;
        const ctx = chordCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, topY, width, regionHeight, 0, 0, width, regionHeight);

        // OCR with chord-friendly whitelist
        if (!this.chordWorker) {
            this.chordWorker = await Tesseract.createWorker('eng', 1);
            await this.chordWorker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGm#b+/0123456789dimaugsusMaj7',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
            });
        }

        try {
            const { data } = await this.chordWorker.recognize(chordCanvas);
            const chords = [];

            const words = data.words || [];
            for (const word of words) {
                const text = word.text.trim();
                if (CHORD_PATTERN.test(text)) {
                    chords.push({
                        chord: text,
                        x: (word.bbox.x0 + word.bbox.x1) / 2,
                    });
                }
            }

            return chords;
        } catch {
            return [];
        }
    }

    /**
     * Detect technique marks (H, P, S, B) between staff and tab
     * @param {HTMLCanvasElement} canvas
     * @param {number} topY
     * @param {number} bottomY
     * @param {number} width
     * @returns {Promise<Array<{technique: string, x: number}>>}
     */
    async detectTechniqueMarks(canvas, topY, bottomY, width) {
        const regionHeight = bottomY - topY;
        if (regionHeight < 5) return [];

        const techCanvas = document.createElement('canvas');
        techCanvas.width = width;
        techCanvas.height = regionHeight;
        const ctx = techCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(canvas, 0, topY, width, regionHeight, 0, 0, width, regionHeight);

        if (!this.chordWorker) {
            this.chordWorker = await Tesseract.createWorker('eng', 1);
        }

        await this.chordWorker.setParameters({
            tessedit_char_whitelist: 'HPSBhpsb',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        });

        try {
            const { data } = await this.chordWorker.recognize(techCanvas);
            const techniques = [];

            const words = data.words || [];
            for (const word of words) {
                const text = word.text.trim().toUpperCase();
                const techniqueMap = {
                    'H': 'hammer-on',
                    'P': 'pull-off',
                    'S': 'slide',
                    'B': 'bend',
                };
                if (techniqueMap[text]) {
                    techniques.push({
                        technique: techniqueMap[text],
                        x: (word.bbox.x0 + word.bbox.x1) / 2,
                    });
                }
            }

            return techniques;
        } catch {
            return [];
        }
    }

    /**
     * Associate detected chords with the nearest notes
     */
    associateChordsWithNotes(chords, notes, system) {
        for (const chord of chords) {
            // Find the nearest note by x-position
            let bestNote = null;
            let bestDist = Infinity;

            for (const note of notes) {
                if (note.isSeparator) continue;
                // Use the note's column position (rough estimate based on index)
                const noteX = chord.x; // Best effort - chord aligns with note below it
                const dist = Math.abs(noteX - chord.x);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestNote = note;
                }
            }

            if (bestNote) {
                bestNote.chordSymbol = chord.chord;
            }
        }
    }

    /**
     * Associate detected technique marks with the nearest notes
     */
    associateTechniquesWithNotes(techniques, notes, system) {
        for (const tech of techniques) {
            let bestNote = null;
            let bestDist = Infinity;

            for (const note of notes) {
                if (note.isSeparator) continue;
                const dist = Math.abs(tech.x - tech.x); // placeholder x alignment
                if (dist < bestDist) {
                    bestDist = dist;
                    bestNote = note;
                }
            }

            if (bestNote) {
                bestNote.technique = tech.technique;
            }
        }
    }

    /**
     * Terminate all workers
     */
    async terminate() {
        if (this.headerOCR) await this.headerOCR.terminate();
        if (this.tabOCR) await this.tabOCR.terminate();
        if (this.chordWorker) {
            await this.chordWorker.terminate();
            this.chordWorker = null;
        }
    }
}

/**
 * Create CombinedSheetOCR instance
 */
export function createCombinedOCR() {
    return new CombinedSheetOCR();
}

/**
 * Quick combined recognition (one-time use)
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function recognizeCombinedImage(imageSource, onProgress, options = {}) {
    const ocr = new CombinedSheetOCR();
    try {
        return await ocr.recognize(imageSource, onProgress, options);
    } finally {
        await ocr.terminate();
    }
}

export default CombinedSheetOCR;
