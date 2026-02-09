/**
 * HeaderOCR.js - Header/Metadata Recognition Module
 * Extracts song title, key, tempo, time signature, capo, and composer
 * from the header region of a music score image.
 */

import Tesseract from 'tesseract.js';
import { loadImageToCanvas, grayscale, binarize, adjustContrast } from './imagePreprocess.js';
import { detectStaffLines, findStaffGroups } from './staffPreprocess.js';

/**
 * HeaderOCR class - extracts metadata from score image headers
 */
export class HeaderOCR {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Tesseract worker for header text recognition
     * @param {Function} onProgress
     */
    async initialize(onProgress) {
        if (this.isInitialized) return;

        onProgress?.('Initializing Header OCR...', 5);

        this.worker = await Tesseract.createWorker('chi_tra+eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    onProgress?.('Reading header text...', 10 + m.progress * 20);
                }
            }
        });

        await this.worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });

        this.isInitialized = true;
    }

    /**
     * Terminate worker
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }

    /**
     * Extract header metadata from an image
     * @param {File|Blob|string} imageSource
     * @param {Function} onProgress
     * @returns {Promise<Object>} metadata object
     */
    async recognizeHeader(imageSource, onProgress) {
        await this.initialize(onProgress);

        onProgress?.('Preprocessing image...', 15);

        // 1. Load and preprocess the full image
        const { canvas, ctx, width, height } = await loadImageToCanvas(imageSource);

        let imageData = ctx.getImageData(0, 0, width, height);
        grayscale(imageData);
        ctx.putImageData(imageData, 0, 0);

        imageData = ctx.getImageData(0, 0, width, height);
        adjustContrast(imageData, 1.3);
        ctx.putImageData(imageData, 0, 0);

        imageData = ctx.getImageData(0, 0, width, height);
        binarize(imageData);
        ctx.putImageData(imageData, 0, 0);

        // 2. Detect first system's top boundary
        onProgress?.('Finding header region...', 25);
        const allLines = detectStaffLines(imageData, width, height);
        const staffGroups = findStaffGroups(allLines);

        let headerBottomY;
        if (staffGroups.length > 0) {
            // Header is everything above the first staff group
            headerBottomY = Math.max(0, staffGroups[0].top - 5);
        } else {
            // No staff lines detected - use top 25% of image as header
            headerBottomY = Math.floor(height * 0.25);
        }

        // Need at least some header region
        if (headerBottomY < 20) {
            return this.emptyResult();
        }

        // 3. Crop header region
        onProgress?.('Cropping header region...', 30);
        const headerCanvas = document.createElement('canvas');
        headerCanvas.width = width;
        headerCanvas.height = headerBottomY;
        const headerCtx = headerCanvas.getContext('2d', { willReadFrequently: true });
        headerCtx.drawImage(canvas, 0, 0, width, headerBottomY, 0, 0, width, headerBottomY);

        // 4. OCR the header region
        onProgress?.('Reading header text...', 35);
        const { data } = await this.worker.recognize(headerCanvas);

        onProgress?.('Parsing metadata...', 60);

        // 5. Parse metadata from OCR text
        const metadata = this.parseMetadata(data.text);
        metadata.rawText = data.text;
        metadata.confidence = data.confidence;
        metadata.headerHeight = headerBottomY;

        onProgress?.('Header OCR complete', 70);

        return metadata;
    }

    /**
     * Parse metadata fields from OCR text
     * @param {string} text - raw OCR text
     * @returns {Object} parsed metadata
     */
    parseMetadata(text) {
        const result = {
            title: null,
            key: null,
            tempo: null,
            timeSignature: null,
            capo: null,
            composer: null,
            lyricist: null,
        };

        if (!text || text.trim().length === 0) return result;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // --- Tempo ---
        // ♩=83, J=83, ♩ = 83, J =83, Tempo=120, etc.
        const tempoMatch = text.match(/[♩JjＪ]\s*[=＝]\s*(\d{2,3})/);
        if (tempoMatch) {
            result.tempo = parseInt(tempoMatch[1], 10);
        } else {
            const tempoMatch2 = text.match(/[Tt]empo\s*[=:：]\s*(\d{2,3})/);
            if (tempoMatch2) {
                result.tempo = parseInt(tempoMatch2[1], 10);
            }
        }

        // --- Key ---
        // "Key: Fm", "Key:Am", standalone "Am 4/4", "Cm", "1=C" etc.
        const keyPatterns = [
            /[Kk]ey\s*[=:：]\s*([A-Ga-g][#♯b♭]?\s*(?:m(?:in(?:or)?)?|[Mm]aj(?:or)?)?)/,
            /1\s*[=＝]\s*([A-Ga-g][#♯b♭]?)/,
            /\b([A-G][#♯b♭]?)\s*(?:Major|Minor|m(?:aj)?)\b/i,
        ];
        for (const pattern of keyPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.key = this.normalizeKey(match[1].trim());
                break;
            }
        }

        // --- Time Signature ---
        const timeMatch = text.match(/\b(\d)\s*[/／]\s*(\d)\b/);
        if (timeMatch) {
            result.timeSignature = `${timeMatch[1]}/${timeMatch[2]}`;
        }

        // --- Capo ---
        const capoMatch = text.match(/[Cc]apo\s*[=:：]?\s*(\d{1,2})/);
        if (capoMatch) {
            result.capo = parseInt(capoMatch[1], 10);
        }

        // --- Composer / Lyricist ---
        const composerPatterns = [
            { pattern: /作曲\s*[：:]\s*(.+)/u, field: 'composer' },
            { pattern: /曲\s*[：:]\s*(.+)/u, field: 'composer' },
            { pattern: /作詞\s*[：:]\s*(.+)/u, field: 'lyricist' },
            { pattern: /詞\s*[：:]\s*(.+)/u, field: 'lyricist' },
            { pattern: /詞曲\s*[・·：:]\s*(.+)/u, field: 'composer' },
            { pattern: /[Cc]omposer\s*[：:]\s*(.+)/u, field: 'composer' },
        ];
        for (const { pattern, field } of composerPatterns) {
            const match = text.match(pattern);
            if (match) {
                result[field] = match[1].trim();
            }
        }

        // --- Title ---
        // Title is usually the largest/most prominent text, often the first non-metadata line
        result.title = this.extractTitle(lines, result);

        return result;
    }

    /**
     * Extract title from header lines
     * Title is typically the first line that isn't metadata
     * @param {string[]} lines
     * @param {Object} alreadyParsed - already parsed metadata
     * @returns {string|null}
     */
    extractTitle(lines, alreadyParsed) {
        const metadataPatterns = [
            /^[Kk]ey\s*[=:：]/,
            /^[Cc]apo\s*[=:：]?\s*\d/,
            /^[♩JjＪ]\s*[=＝]/,
            /^[Tt]empo/,
            /^作[曲詞]/,
            /^詞曲/,
            /^曲\s*[：:]/,
            /^詞\s*[：:]/,
            /^\d\s*[/／]\s*\d$/,
            /^1\s*[=＝]/,
            /^[Cc]omposer/,
        ];

        for (const line of lines) {
            // Skip lines that are metadata
            const isMetadata = metadataPatterns.some(p => p.test(line));
            if (isMetadata) continue;

            // Skip very short lines (likely noise)
            if (line.length < 2) continue;

            // Skip lines that are just numbers or punctuation
            if (/^[\d\s\-=:.,]+$/.test(line)) continue;

            return line;
        }

        return null;
    }

    /**
     * Normalize key string
     * @param {string} keyStr
     * @returns {string}
     */
    normalizeKey(keyStr) {
        if (!keyStr) return null;

        // Clean up
        let key = keyStr.replace(/\s+/g, '').replace('♯', '#').replace('♭', 'b');

        // Capitalize first letter
        key = key.charAt(0).toUpperCase() + key.slice(1);

        // Normalize minor key format
        key = key.replace(/minor/i, 'm').replace(/min/i, 'm').replace(/Major/i, '').replace(/maj/i, '');

        return key;
    }

    /**
     * Return empty result
     */
    emptyResult() {
        return {
            title: null,
            key: null,
            tempo: null,
            timeSignature: null,
            capo: null,
            composer: null,
            lyricist: null,
            rawText: '',
            confidence: 0,
            headerHeight: 0,
        };
    }
}

/**
 * Create HeaderOCR instance
 */
export function createHeaderOCR() {
    return new HeaderOCR();
}

/**
 * Quick header recognition (one-time use)
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress
 * @returns {Promise<Object>} metadata
 */
export async function recognizeHeader(imageSource, onProgress) {
    const ocr = new HeaderOCR();
    try {
        return await ocr.recognizeHeader(imageSource, onProgress);
    } finally {
        await ocr.terminate();
    }
}

export default HeaderOCR;
