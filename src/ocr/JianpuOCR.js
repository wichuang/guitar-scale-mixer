/**
 * JianpuOCR.js - 簡譜圖片 OCR 核心模組
 * 識別簡譜（數字記譜法）圖片中的音符
 *
 * 簡譜特徵：
 * - 數字 1-7 代表 Do Re Mi Fa Sol La Si
 * - 數字上方加點 = 高八度
 * - 數字下方加點 = 低八度
 * - 下劃線 = 時值縮短（一條線=八分音符，兩條線=十六分音符）
 * - 0 = 休止符
 * - - = 延音
 *
 * Phase 6D Improvements:
 * - Adaptive preprocessing for inverted/dark images
 * - Word-level bbox spatial matching (replaces crude x-position estimate)
 * - Improved underline detection via full-image scan
 * - Morphological noise filtering for dot detection
 * - Chord symbol recognition
 */

import Tesseract from 'tesseract.js';
import { loadImageToCanvas, grayscale, binarize, adjustContrast, invertColors, isDarkImage, morphologicalOpen, preprocessImage } from './imagePreprocess.js';
import { Note } from '../core/models/Note.js';

// 簡譜數字對應的音程（相對於 Do）
const JIANPU_INTERVALS = {
    1: 0,   // Do
    2: 2,   // Re
    3: 4,   // Mi
    4: 5,   // Fa
    5: 7,   // Sol
    6: 9,   // La
    7: 11,  // Si
};

// 調號對應的 MIDI 基準（C4 = 60）
const KEY_BASE_MIDI = {
    'C': 60, 'C#': 61, 'Db': 61,
    'D': 62, 'D#': 63, 'Eb': 63,
    'E': 64, 'Fb': 64,
    'F': 65, 'F#': 66, 'Gb': 66,
    'G': 67, 'G#': 68, 'Ab': 68,
    'A': 69, 'A#': 70, 'Bb': 70,
    'B': 71, 'Cb': 71,
};

// Chord pattern for recognition
const CHORD_PATTERN = /^[A-G][#b]?(?:m|dim|aug|sus|Maj|M)?[0-9]?(?:\/[A-G][#b]?)?$/;

/**
 * JianpuOCR 類別
 */
export class JianpuOCR {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    /**
     * 初始化 Tesseract worker
     * @param {Function} onProgress
     */
    async initialize(onProgress) {
        if (this.isInitialized) return;

        onProgress?.('初始化 OCR 引擎...', 10);

        this.worker = await Tesseract.createWorker('chi_sim+eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    onProgress?.('辨識中...', 30 + m.progress * 40);
                }
            }
        });

        // 設定只識別簡譜相關字符
        await this.worker.setParameters({
            tessedit_char_whitelist: '0123456789-|.·()[]#b♯♭',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });

        this.isInitialized = true;
        onProgress?.('OCR 引擎就緒', 20);
    }

    /**
     * 終止 worker
     */
    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }

    /**
     * 識別簡譜圖片
     * @param {File|Blob|string} imageSource - 圖片來源
     * @param {Function} onProgress - 進度回調
     * @param {Object} options - 選項
     * @returns {Promise<{notes: Array<Note>, rawText: string, confidence: number}>}
     */
    async recognizeJianpuImage(imageSource, onProgress, options = {}) {
        const {
            key = 'C',
            scaleType = 'Major',
            detectOctaveDots = true,
            detectDurationLines = true,
            startNoteIndex = 0,
        } = options;

        // 1. 初始化
        await this.initialize(onProgress);

        // 2. 預處理圖片 (with adaptive inversion)
        onProgress?.('預處理圖片...', 25);
        const preprocessed = await this.preprocessJianpuImage(imageSource);

        // 3. 執行 OCR
        onProgress?.('執行 OCR 辨識...', 30);
        const { data } = await this.worker.recognize(preprocessed.canvas);

        onProgress?.('分析辨識結果...', 75);

        // 4. Extract word-level bounding boxes for spatial matching
        const wordBboxes = this.extractDigitBboxes(data);

        // 5. 分析圖片中的八度點和時值線
        let octaveInfo = {};
        let durationInfo = {};

        if (detectOctaveDots) {
            onProgress?.('偵測八度標記...', 80);
            octaveInfo = this.detectOctaveDots(
                preprocessed.imageData,
                preprocessed.width,
                preprocessed.height,
                wordBboxes
            );
        }

        if (detectDurationLines) {
            onProgress?.('偵測時值標記...', 85);
            durationInfo = this.detectDurationLinesImproved(
                preprocessed.imageData,
                preprocessed.width,
                preprocessed.height,
                wordBboxes
            );
        }

        // 6. Detect chord symbols
        onProgress?.('偵測和弦符號...', 88);
        const chordInfo = await this.detectChordSymbols(preprocessed.canvas, wordBboxes);

        // 7. 解析結果 (using bbox-based matching)
        onProgress?.('轉換為音符...', 90);
        const parseResult = this.parseOCRResultWithBboxes(
            wordBboxes,
            data.text,
            key,
            scaleType,
            octaveInfo,
            durationInfo,
            chordInfo,
            startNoteIndex
        );

        onProgress?.('完成', 100);

        return {
            notes: parseResult.notes,
            rawText: data.text,
            cleanedText: parseResult.cleanedText,
            confidence: data.confidence,
            octaveInfo,
            durationInfo,
            chordInfo,
            preprocessedCanvas: preprocessed.canvas,
            wasInverted: preprocessed.wasInverted,
        };
    }

    /**
     * 預處理簡譜圖片 (with adaptive inversion for dark images)
     * Now uses the unified preprocessImage() pipeline
     * @param {File|Blob|string} source
     * @returns {Promise<Object>}
     */
    async preprocessJianpuImage(source) {
        const result = await preprocessImage(source, {
            contrast: 1.5,
            doSharpen: false,
            binarizeMethod: 'adaptive',
            autoInvert: true,
            doScale: true,
            doDeskew: false,
            doMorphOpen: true,
        });

        return {
            canvas: result.canvas,
            ctx: result.ctx,
            width: result.width,
            height: result.height,
            imageData: result.imageData,
            wasInverted: result.wasInverted,
        };
    }

    /**
     * Extract digit word bounding boxes from Tesseract result
     * Returns array of {text, centerX, bbox} for each recognized digit
     * @param {Object} data - Tesseract recognition data
     * @returns {Array<{text: string, centerX: number, centerY: number, bbox: Object}>}
     */
    extractDigitBboxes(data) {
        const results = [];
        const words = data.words || [];

        for (const word of words) {
            const text = word.text.trim();
            if (!text) continue;

            const bbox = word.bbox;
            results.push({
                text,
                centerX: (bbox.x0 + bbox.x1) / 2,
                centerY: (bbox.y0 + bbox.y1) / 2,
                bbox,
                charWidth: bbox.x1 - bbox.x0,
                charHeight: bbox.y1 - bbox.y0,
            });
        }

        // Sort by x-position (left to right) then by y-position (top to bottom)
        results.sort((a, b) => {
            const rowDiff = Math.floor(a.centerY / 30) - Math.floor(b.centerY / 30);
            if (rowDiff !== 0) return rowDiff;
            return a.centerX - b.centerX;
        });

        return results;
    }

    /**
     * 偵測八度點（使用 word-level bbox 精確匹配）
     * @param {ImageData} imageData
     * @param {number} width
     * @param {number} height
     * @param {Array} wordBboxes - word-level bounding boxes
     * @returns {Object} centerX -> octaveOffset mapping
     */
    detectOctaveDots(imageData, width, height, wordBboxes) {
        const data = imageData.data;
        const octaveMap = {};

        for (const word of wordBboxes) {
            if (!/^[1-7]$/.test(word.text)) continue;

            const bbox = word.bbox;
            const centerX = word.centerX;
            const charHeight = word.charHeight;

            // Search above for dots (high octave)
            const dotsAbove = this.countDotsInRegion(
                data, width, height,
                centerX - charHeight / 2,
                bbox.y0 - charHeight,
                charHeight,
                charHeight
            );

            // Search below for dots (low octave) - skip underline region
            const dotsBelow = this.countDotsInRegion(
                data, width, height,
                centerX - charHeight / 2,
                bbox.y1 + charHeight * 0.5, // skip underlines
                charHeight,
                charHeight * 0.8
            );

            let octaveOffset = 0;
            if (dotsAbove > 0) {
                octaveOffset = Math.min(dotsAbove, 2); // cap at 2 octaves
            } else if (dotsBelow > 0) {
                octaveOffset = -Math.min(dotsBelow, 2);
            }

            if (octaveOffset !== 0) {
                octaveMap[`${Math.round(centerX)}`] = octaveOffset;
            }
        }

        return octaveMap;
    }

    /**
     * 計算區域內的點數量 (with improved noise filtering)
     */
    countDotsInRegion(data, width, height, x, y, w, h) {
        let dotCount = 0;

        const minX = Math.max(0, Math.floor(x));
        const maxX = Math.min(width, Math.ceil(x + w));
        const minY = Math.max(0, Math.floor(y));
        const maxY = Math.min(height, Math.ceil(y + h));

        const visited = new Set();

        for (let py = minY; py < maxY; py++) {
            for (let px = minX; px < maxX; px++) {
                const idx = (py * width + px) * 4;
                const key = `${px},${py}`;

                if (data[idx] < 128 && !visited.has(key)) {
                    const region = this.floodFillCount(data, width, height, px, py, minX, maxX, minY, maxY, visited);

                    // Dot characteristics: small area, roughly square
                    const maxDotArea = (w * 0.4) * (w * 0.4);
                    const minDotArea = Math.max(2, (w * 0.02) * (w * 0.02));

                    if (region.area >= minDotArea &&
                        region.area <= maxDotArea &&
                        region.aspectRatio > 0.3 && region.aspectRatio < 3.0) {
                        dotCount++;
                    }
                }
            }
        }

        return dotCount;
    }

    /**
     * Flood fill 計算連通區域
     */
    floodFillCount(data, width, height, startX, startY, minX, maxX, minY, maxY, visited) {
        const stack = [[startX, startY]];
        let area = 0;
        let sumX = 0, sumY = 0;
        let regionMinX = startX, regionMaxX = startX;
        let regionMinY = startY, regionMaxY = startY;

        while (stack.length > 0) {
            const [x, y] = stack.pop();
            const key = `${x},${y}`;

            if (visited.has(key)) continue;
            if (x < minX || x >= maxX || y < minY || y >= maxY) continue;

            const idx = (y * width + x) * 4;
            if (data[idx] >= 128) continue;

            visited.add(key);
            area++;
            sumX += x;
            sumY += y;
            regionMinX = Math.min(regionMinX, x);
            regionMaxX = Math.max(regionMaxX, x);
            regionMinY = Math.min(regionMinY, y);
            regionMaxY = Math.max(regionMaxY, y);

            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        const regionWidth = regionMaxX - regionMinX + 1;
        const regionHeight = regionMaxY - regionMinY + 1;

        return {
            area,
            centroid: { x: area > 0 ? sumX / area : startX, y: area > 0 ? sumY / area : startY },
            aspectRatio: regionHeight > 0 ? regionWidth / regionHeight : 1
        };
    }

    /**
     * Improved duration line detection
     * Scans the full image for horizontal line segments below each digit row
     * and properly counts stacked underlines
     * @param {ImageData} imageData
     * @param {number} width
     * @param {number} height
     * @param {Array} wordBboxes
     * @returns {Object} centerX -> lineCount mapping
     */
    detectDurationLinesImproved(imageData, width, height, wordBboxes) {
        const data = imageData.data;
        const durationMap = {};

        // Group digits by approximate row (y-position)
        const digitWords = wordBboxes.filter(w => /^[0-7]$/.test(w.text));
        if (digitWords.length === 0) return durationMap;

        // For each digit, scan below its bbox for horizontal line segments
        for (const word of digitWords) {
            if (word.text === '0') continue; // rests don't have underlines

            const bbox = word.bbox;
            const charWidth = bbox.x1 - bbox.x0;
            const charHeight = bbox.y1 - bbox.y0;

            // Scan region: from just below the digit to charHeight below
            const scanStartY = bbox.y1 + 1;
            const scanEndY = Math.min(height, bbox.y1 + charHeight * 1.2);
            // Widen scan region horizontally to catch connecting underlines
            const scanStartX = Math.max(0, bbox.x0 - charWidth * 0.3);
            const scanEndX = Math.min(width, bbox.x1 + charWidth * 0.3);
            const scanWidth = scanEndX - scanStartX;

            let lineCount = 0;
            let lastLineY = -10;

            for (let y = scanStartY; y < scanEndY; y++) {
                let blackCount = 0;

                for (let x = scanStartX; x < scanEndX; x++) {
                    const idx = (y * width + Math.floor(x)) * 4;
                    if (data[idx] < 128) {
                        blackCount++;
                    }
                }

                const lineRatio = blackCount / scanWidth;

                // If >50% black pixels and not too close to previous line
                if (lineRatio > 0.5 && y - lastLineY > 3) {
                    lineCount++;
                    lastLineY = y;
                }
            }

            if (lineCount > 0) {
                const centerX = Math.round(word.centerX);
                durationMap[`${centerX}`] = lineCount;
            }
        }

        return durationMap;
    }

    /**
     * Detect chord symbols above jianpu rows
     * @param {HTMLCanvasElement} canvas
     * @param {Array} wordBboxes
     * @returns {Array<{chord: string, x: number, y: number}>}
     */
    async detectChordSymbols(canvas, wordBboxes) {
        // Look for chord-like patterns in the already-recognized text
        const chords = [];

        for (const word of wordBboxes) {
            const text = word.text.trim();
            if (CHORD_PATTERN.test(text)) {
                chords.push({
                    chord: text,
                    x: word.centerX,
                    y: word.centerY,
                    bbox: word.bbox,
                });
            }
        }

        return chords;
    }

    /**
     * Parse OCR results using word-level bounding boxes for accurate spatial matching
     * @param {Array} wordBboxes - word-level bounding boxes with text
     * @param {string} rawText - full OCR text
     * @param {string} key
     * @param {string} scaleType
     * @param {Object} octaveInfo - centerX -> octaveOffset
     * @param {Object} durationInfo - centerX -> lineCount
     * @param {Array} chordInfo - chord symbols with positions
     * @param {number} startNoteIndex
     * @returns {{notes: Array<Note>, cleanedText: string}}
     */
    parseOCRResultWithBboxes(wordBboxes, rawText, key, scaleType, octaveInfo, durationInfo, chordInfo, startNoteIndex = 0) {
        const notes = [];
        const baseMidi = KEY_BASE_MIDI[key] || 60;
        let noteIndex = startNoteIndex;

        // Process each word bbox
        for (const word of wordBboxes) {
            const text = word.text.trim();

            // Process each character in the word
            for (let ci = 0; ci < text.length; ci++) {
                const char = text[ci];
                // Approximate per-character center X within the word
                const perCharWidth = word.charWidth / text.length;
                const charCenterX = word.bbox.x0 + perCharWidth * (ci + 0.5);

                // 1-7: note
                if (char >= '1' && char <= '7') {
                    const digit = parseInt(char, 10);
                    const interval = JIANPU_INTERVALS[digit];

                    // Look up octave offset using actual centerX
                    let octaveOffset = 0;
                    const xKey = this.findClosestKey(octaveInfo, charCenterX);
                    if (xKey) {
                        octaveOffset = octaveInfo[xKey];
                    }

                    // Look up duration using actual centerX
                    let duration = 'quarter';
                    const dKey = this.findClosestKey(durationInfo, charCenterX);
                    if (dKey) {
                        const lineCount = durationInfo[dKey];
                        if (lineCount === 1) duration = 'eighth';
                        else if (lineCount === 2) duration = '16th';
                        else if (lineCount >= 3) duration = '32nd';
                    }

                    // Check for accidentals
                    let accidental = 0;
                    if (ci + 1 < text.length) {
                        const nextChar = text[ci + 1];
                        if (nextChar === '#' || nextChar === '♯') {
                            accidental = 1;
                            ci++;
                        } else if (nextChar === 'b' || nextChar === '♭') {
                            accidental = -1;
                            ci++;
                        }
                    }

                    // Calculate MIDI pitch
                    const midiNote = baseMidi + interval + (octaveOffset * 12) + accidental;

                    const note = Note.fromMidi(midiNote, {
                        index: noteIndex,
                        duration,
                        jianpu: digit,
                        octaveOffset,
                        accidental: accidental === 1 ? 'sharp' : (accidental === -1 ? 'flat' : null),
                        sourceType: 'jianpu-ocr'
                    });

                    // Associate chord symbol if one is near this position
                    const nearChord = chordInfo.find(c =>
                        Math.abs(c.x - charCenterX) < word.charWidth * 1.5 &&
                        c.y < word.bbox.y0  // chord should be above the digit
                    );
                    if (nearChord) {
                        note.chordSymbol = nearChord.chord;
                    }

                    notes.push(note);
                    noteIndex++;
                }
                // 0: rest
                else if (char === '0') {
                    notes.push(Note.createRest({ index: noteIndex }));
                    noteIndex++;
                }
                // -: extension
                else if (char === '-') {
                    notes.push(Note.createExtension({ index: noteIndex }));
                    noteIndex++;
                }
                // |: barline
                else if (char === '|') {
                    notes.push(Note.createSeparator({ index: noteIndex }));
                    noteIndex++;
                }
            }
        }

        // Build cleaned text
        const cleanedText = rawText
            .replace(/[oO]/g, '0')
            .replace(/[lI]/g, '1')
            .replace(/[a-zA-Z]+/g, '')
            .replace(/[\u4e00-\u9fff]+/g, '')
            .replace(/[，。！？、；：""''（）【】《》]/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return { notes, cleanedText };
    }

    /**
     * Legacy: Parse OCR result from text (fallback)
     */
    parseOCRResult(text, key, scaleType, octaveInfo, durationInfo) {
        const notes = [];

        let cleanedText = text
            .replace(/[oO]/g, '0')
            .replace(/[lI]/g, '1')
            .replace(/[zZ]/g, '2')
            .replace(/[sS]/g, '5')
            .replace(/[gG]/g, '9')
            .replace(/[a-zA-Z]+/g, '')
            .replace(/[\u4e00-\u9fff]+/g, '')
            .replace(/[，。！？、；：""''（）【】《》]/g, '')
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const baseMidi = KEY_BASE_MIDI[key] || 60;
        let noteIndex = 0;
        let xPosition = 0;

        const chars = cleanedText.split('');

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            xPosition += 10;

            if (char >= '1' && char <= '7') {
                const digit = parseInt(char, 10);
                const interval = JIANPU_INTERVALS[digit];

                let octaveOffset = 0;
                const xKey = this.findClosestKey(octaveInfo, xPosition);
                if (xKey) {
                    octaveOffset = octaveInfo[xKey];
                }

                let duration = 'quarter';
                const dKey = this.findClosestKey(durationInfo, xPosition);
                if (dKey) {
                    const lineCount = durationInfo[dKey];
                    if (lineCount === 1) duration = 'eighth';
                    else if (lineCount === 2) duration = '16th';
                    else if (lineCount >= 3) duration = '32nd';
                }

                let accidental = 0;
                if (i + 1 < chars.length) {
                    const nextChar = chars[i + 1];
                    if (nextChar === '#' || nextChar === '♯') {
                        accidental = 1;
                        i++;
                    } else if (nextChar === 'b' || nextChar === '♭') {
                        accidental = -1;
                        i++;
                    }
                }

                const midiNote = baseMidi + interval + (octaveOffset * 12) + accidental;

                const note = Note.fromMidi(midiNote, {
                    index: noteIndex,
                    duration,
                    jianpu: digit,
                    octaveOffset,
                    accidental: accidental === 1 ? 'sharp' : (accidental === -1 ? 'flat' : null),
                    sourceType: 'jianpu-ocr'
                });

                notes.push(note);
                noteIndex++;
            } else if (char === '0') {
                notes.push(Note.createRest({ index: noteIndex }));
                noteIndex++;
            } else if (char === '-') {
                notes.push(Note.createExtension({ index: noteIndex }));
                noteIndex++;
            } else if (char === '|') {
                notes.push(Note.createSeparator({ index: noteIndex }));
                noteIndex++;
            }
        }

        return { notes, cleanedText };
    }

    /**
     * Find closest key in a map (for position matching)
     * Uses word-level bbox tolerance when available
     */
    findClosestKey(map, targetX, tolerance = 50) {
        const keys = Object.keys(map).map(Number);
        if (keys.length === 0) return null;

        let closest = null;
        let minDist = Infinity;

        for (const key of keys) {
            const dist = Math.abs(key - targetX);
            if (dist < minDist && dist < tolerance) {
                minDist = dist;
                closest = key;
            }
        }

        return closest;
    }
}

/**
 * 建立 JianpuOCR 實例
 */
export function createJianpuOCR() {
    return new JianpuOCR();
}

/**
 * 快速識別簡譜圖片（一次性使用）
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress
 * @param {Object} options
 * @returns {Promise<{notes: Array<Note>, rawText: string, confidence: number}>}
 */
export async function recognizeJianpuImage(imageSource, onProgress, options = {}) {
    const ocr = new JianpuOCR();
    try {
        return await ocr.recognizeJianpuImage(imageSource, onProgress, options);
    } finally {
        await ocr.terminate();
    }
}

export default JianpuOCR;
