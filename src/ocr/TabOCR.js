/**
 * TabOCR.js - 六線譜圖片 OCR 核心模組
 * 識別 Guitar Tab 圖片中的琴格數字
 */

import Tesseract from 'tesseract.js';
import { preprocessTabImage } from './imagePreprocess.js';
import { Note } from '../core/models/Note.js';

// 標準調音 MIDI 值 (高 E 到低 E)
const STRING_TUNINGS = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2

/**
 * OCR 進度回調類型
 * @callback ProgressCallback
 * @param {string} status - 狀態描述
 * @param {number} progress - 進度 (0-100)
 */

/**
 * TabOCR 類別
 */
export class TabOCR {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
    }

    /**
     * 初始化 Tesseract worker
     * @param {ProgressCallback} onProgress
     */
    async initialize(onProgress) {
        if (this.isInitialized) return;

        onProgress?.('Initializing OCR engine...', 10);

        this.worker = await Tesseract.createWorker('eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    onProgress?.('Recognizing text...', 30 + m.progress * 50);
                }
            }
        });

        // 設定只識別數字和常用 Tab 符號
        await this.worker.setParameters({
            tessedit_char_whitelist: '0123456789-|xXhHpPbB/\\()~',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        });

        this.isInitialized = true;
        onProgress?.('OCR engine ready', 20);
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
     * 識別 Tab 圖片
     * @param {File|Blob|string} imageSource - 圖片來源
     * @param {ProgressCallback} onProgress - 進度回調
     * @param {Object} options - 選項
     * @param {Array<number>} options.tabLines - Pre-detected tab line Y-positions (6 lines)
     * @param {number} options.startNoteIndex - Starting note index for multi-system
     * @returns {Promise<{notes: Array<Note>, rawText: string, confidence: number}>}
     */
    async recognizeTabImage(imageSource, onProgress, options = {}) {
        const {
            useRegionBased = true,
            tabLines = null,
            startNoteIndex = 0,
        } = options;

        // 1. 初始化
        await this.initialize(onProgress);

        // 2. 預處理圖片
        onProgress?.('Preprocessing image...', 25);
        const preprocessed = await preprocessTabImage(imageSource);

        // Use pre-detected lines if provided, otherwise use detected ones
        const stringLines = tabLines || preprocessed.stringLines;

        // 3. 如果偵測到弦線且啟用區域辨識，使用區域式 OCR
        if (useRegionBased && stringLines && stringLines.length === 6) {
            onProgress?.('Using region-based OCR...', 30);
            return await this.recognizeTabImageRegionBased(
                preprocessed.canvas,
                stringLines,
                preprocessed.width,
                onProgress,
                startNoteIndex
            );
        }

        // 4. 回退到傳統整頁 OCR
        onProgress?.('Running OCR...', 30);
        const { data } = await this.worker.recognize(preprocessed.canvas);

        onProgress?.('Parsing results...', 85);

        // 5. 解析結果
        const parseResult = this.parseOCRResult(data.text, startNoteIndex);

        onProgress?.('Complete', 100);

        return {
            notes: parseResult.notes,
            rawText: data.text,
            cleanedText: parseResult.cleanedText,
            confidence: data.confidence,
            stringLines
        };
    }

    /**
     * Per-line Tab recognition - OCR one horizontal strip per string
     * Much more accurate than cell-by-cell: 6 Tesseract calls instead of hundreds,
     * with larger image context for each call.
     * @param {HTMLCanvasElement} canvas - binarized canvas
     * @param {Array<number>} stringLines - 6 string Y positions
     * @param {number} width - image width
     * @param {ProgressCallback} onProgress
     * @param {number} startNoteIndex
     * @returns {Promise<{notes: Array<Note>, rawText: string, confidence: number}>}
     */
    async recognizeTabImageRegionBased(canvas, stringLines, width, onProgress, startNoteIndex = 0) {
        const notes = [];
        let noteIndex = startNoteIndex;
        const spacing = (stringLines[5] - stringLines[0]) / 5;
        const canvasHeight = canvas.height;

        for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
            const lineY = stringLines[stringIdx];

            // Strip extends from midway to previous line to midway to next line
            // Edge strings get full spacing worth of margin for better digit capture
            const stripTop = stringIdx === 0
                ? Math.max(0, lineY - spacing * 0.5)
                : (stringLines[stringIdx - 1] + lineY) / 2;
            const stripBottom = stringIdx === 5
                ? Math.min(canvasHeight, lineY + spacing * 0.5)
                : (lineY + stringLines[stringIdx + 1]) / 2;

            const stripHeight = Math.ceil(stripBottom - stripTop);
            if (stripHeight <= 0) continue;

            // Crop strip
            const stripCanvas = document.createElement('canvas');
            stripCanvas.width = width;
            stripCanvas.height = stripHeight;
            const stripCtx = stripCanvas.getContext('2d');
            stripCtx.drawImage(canvas, 0, Math.floor(stripTop), width, stripHeight, 0, 0, width, stripHeight);

            // Remove the horizontal tab line from the strip
            const imgData = stripCtx.getImageData(0, 0, width, stripHeight);
            this.removeHorizontalTabLine(imgData, width, stripHeight, lineY - stripTop);
            stripCtx.putImageData(imgData, 0, 0);

            // Scale up if too small for Tesseract (80px minimum for reliable digit recognition)
            const minHeight = 80;
            let ocrCanvas = stripCanvas;
            if (stripHeight < minHeight) {
                const scale = Math.ceil(minHeight / stripHeight);
                ocrCanvas = document.createElement('canvas');
                ocrCanvas.width = width * scale;
                ocrCanvas.height = stripHeight * scale;
                const ocrCtx = ocrCanvas.getContext('2d');
                ocrCtx.imageSmoothingEnabled = false; // nearest-neighbor for crisp binarized text
                ocrCtx.drawImage(stripCanvas, 0, 0, ocrCanvas.width, ocrCanvas.height);
            }

            // OCR the strip with digits-only whitelist for higher accuracy
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
                tessedit_char_whitelist: '0123456789 -|',
            });

            try {
                const { data } = await this.worker.recognize(ocrCanvas);
                const rawText = data.text.trim();

                // Debug logging (disabled in production)
                // console.log(`[TabOCR] String ${stringIdx}: text="${rawText}" conf=${data.confidence?.toFixed(0)} stripH=${stripHeight}`);

                // Try word-level bounding boxes first (from data.lines[].words)
                const words = [];
                if (data.lines) {
                    for (const line of data.lines) {
                        if (line.words) words.push(...line.words);
                    }
                }
                // Fall back to top-level data.words
                if (words.length === 0 && data.words?.length > 0) {
                    words.push(...data.words);
                }

                if (words.length > 0) {
                    // Use word bounding boxes for x-positions
                    const scaleX = ocrCanvas.width / width;
                    for (const word of words) {
                        let text = word.text.trim()
                            .replace(/[oO]/g, '0')
                            .replace(/[lI]/g, '1')
                            .replace(/[zZ]/g, '2')
                            .replace(/[sS]/g, '5');

                        const match = text.match(/^(\d{1,2})$/);
                        if (match) {
                            const fret = parseInt(match[1], 10);
                            if (fret >= 0 && fret <= 24) {
                                const midiNote = STRING_TUNINGS[stringIdx] + fret;
                                const xPos = ((word.bbox.x0 + word.bbox.x1) / 2) / scaleX;
                                const note = Note.fromMidi(midiNote, {
                                    index: noteIndex,
                                    stringIndex: stringIdx,
                                    fret,
                                    confidence: word.confidence || data.confidence,
                                    sourceType: 'tab-ocr-line'
                                });
                                note._xPos = xPos;
                                notes.push(note);
                                noteIndex++;
                            }
                        }
                    }
                } else {
                    // Fall back to parsing text directly (no bbox data available)
                    // Clean OCR text and extract digit tokens
                    let cleanText = rawText
                        .replace(/[oO]/g, '0')
                        .replace(/[lI]/g, '1')
                        .replace(/[zZ]/g, '2')
                        .replace(/[sS]/g, '5')
                        .replace(/[|]/g, ' ');

                    // Find all digit tokens with their approximate positions in the text
                    const tokens = [];
                    const digitRegex = /\d{1,2}/g;
                    let m;
                    while ((m = digitRegex.exec(cleanText)) !== null) {
                        tokens.push({
                            fret: parseInt(m[0], 10),
                            textPos: m.index,
                        });
                    }

                    // Estimate x-positions proportionally across the image width
                    const textLen = cleanText.length || 1;
                    for (const token of tokens) {
                        if (token.fret >= 0 && token.fret <= 24) {
                            const midiNote = STRING_TUNINGS[stringIdx] + token.fret;
                            const xPos = (token.textPos / textLen) * width;
                            const note = Note.fromMidi(midiNote, {
                                index: noteIndex,
                                stringIndex: stringIdx,
                                fret: token.fret,
                                confidence: data.confidence || 50,
                                sourceType: 'tab-ocr-line'
                            });
                            note._xPos = xPos;
                            notes.push(note);
                            noteIndex++;
                        }
                    }

                    // console.log(`[TabOCR]   Parsed ${tokens.length} digits from text`);
                }
            } catch (e) {
                console.warn(`[TabOCR] String ${stringIdx} OCR failed:`, e);
            }

            // Restore default parameters
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
                tessedit_char_whitelist: '0123456789-|xXhHpPbB/\\()~',
            });

            onProgress?.(`Processed string ${stringIdx + 1}/6...`, 30 + ((stringIdx + 1) / 6) * 50);
        }

        // Sort notes by x-position for proper ordering, then by string
        notes.sort((a, b) => (a._xPos || 0) - (b._xPos || 0) || a.stringIndex - b.stringIndex);

        // Re-assign indices and clean up temp _xPos
        notes.forEach((note, i) => {
            note.index = startNoteIndex + i;
            delete note._xPos;
        });

        onProgress?.('Complete', 100);

        const avgConf = notes.length > 0
            ? notes.reduce((sum, n) => sum + (n.confidence || 0), 0) / notes.length
            : 0;

        return {
            notes,
            rawText: '',
            cleanedText: '',
            confidence: avgConf,
            stringLines,
        };
    }

    /**
     * Remove horizontal tab line pixels from a strip's ImageData.
     * Only removes pixels that are part of a horizontal line (black neighbors
     * left/right but white 2px above and below).
     * @param {ImageData} imageData
     * @param {number} width
     * @param {number} height
     * @param {number} lineYInStrip - Y position of the tab line within the strip
     */
    removeHorizontalTabLine(imageData, width, height, lineYInStrip) {
        const data = imageData.data;
        const lineY = Math.round(lineYInStrip);

        // Scan ±1 rows around the line position (narrow band to preserve digit strokes)
        for (let dy = -1; dy <= 1; dy++) {
            const y = lineY + dy;
            if (y < 0 || y >= height) continue;

            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx] >= 128) continue; // skip white pixels

                // Check if this pixel is part of a horizontal line (not a digit):
                // Line pixels have no black ink 2+ rows above AND below
                const checkDist = 2;
                const aboveY = y - checkDist;
                const belowY = y + checkDist;
                const above = aboveY >= 0 ? data[(aboveY * width + x) * 4] : 255;
                const below = belowY < height ? data[(belowY * width + x) * 4] : 255;

                if (above >= 128 && below >= 128) {
                    data[idx] = 255;
                    data[idx + 1] = 255;
                    data[idx + 2] = 255;
                }
            }
        }
    }

    /**
     * 辨識單一儲存格
     */
    async recognizeSingleCell(canvas, x, y, width, height) {
        // 確保座標在有效範圍內
        x = Math.max(0, Math.min(x, canvas.width - width));
        y = Math.max(0, Math.min(y, canvas.height - height));
        width = Math.min(width, canvas.width - x);
        height = Math.min(height, canvas.height - y);

        if (width <= 0 || height <= 0) {
            return { digit: null, confidence: 0, text: '' };
        }

        // 裁切區域
        const regionCanvas = document.createElement('canvas');
        regionCanvas.width = Math.max(1, Math.floor(width));
        regionCanvas.height = Math.max(1, Math.floor(height));
        const ctx = regionCanvas.getContext('2d');
        ctx.drawImage(
            canvas,
            Math.floor(x), Math.floor(y),
            Math.floor(width), Math.floor(height),
            0, 0,
            regionCanvas.width, regionCanvas.height
        );

        // 檢查區域是否有足夠的黑色像素（可能有數字）
        const imageData = ctx.getImageData(0, 0, regionCanvas.width, regionCanvas.height);
        const data = imageData.data;
        let blackPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 128) blackPixels++;
        }
        const blackRatio = blackPixels / (regionCanvas.width * regionCanvas.height);

        // 如果黑色像素太少或太多，跳過 OCR
        if (blackRatio < 0.02 || blackRatio > 0.8) {
            return { digit: null, confidence: 0, text: '' };
        }


        try {
            // 使用 SINGLE_WORD 模式辨識單一儲存格
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
            });

            const { data: result } = await this.worker.recognize(regionCanvas);

            // 恢復預設參數
            await this.worker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            });

            // 解析結果
            let text = result.text.trim()
                .replace(/[oO]/g, '0')
                .replace(/[lI]/g, '1')
                .replace(/[zZ]/g, '2')
                .replace(/[sS]/g, '5');

            const match = text.match(/^(\d{1,2})$/);
            if (match) {
                const digit = parseInt(match[1], 10);
                if (digit >= 0 && digit <= 24) {
                    return {
                        digit,
                        confidence: result.confidence,
                        text
                    };
                }
            }

            return { digit: null, confidence: result.confidence, text };
        } catch {
            return { digit: null, confidence: 0, text: '' };
        }
    }

    /**
     * 將儲存格結果轉換為 Tab 字串
     */
    cellsToTabString(cells, numColumns) {
        const lines = Array(6).fill(null).map(() => []);

        for (let col = 0; col < numColumns; col++) {
            for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
                const cell = cells.find(c => c.col === col && c.stringIdx === stringIdx);
                if (cell && cell.digit !== null) {
                    lines[stringIdx].push(cell.digit.toString().padStart(2, '-'));
                } else {
                    lines[stringIdx].push('--');
                }
            }
        }

        const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];
        return lines.map((line, idx) => `${stringNames[idx]}|${line.join('-')}|`).join('\n');
    }

    /**
     * 解析 OCR 結果文字
     * @param {string} text - OCR 識別的文字
     * @returns {{notes: Array<Note>, cleanedText: string}}
     */
    parseOCRResult(text, startNoteIndex = 0) {
        // 清理文字
        let cleanedText = text
            .replace(/[oO]/g, '0')  // 常見誤識別
            .replace(/[lI]/g, '1')
            .replace(/[zZ]/g, '2')
            .replace(/[sS]/g, '5')
            .replace(/[gG]/g, '9')
            .replace(/\s+/g, ' ')
            .trim();

        // 嘗試解析為 Tab 格式
        const lines = cleanedText.split('\n').filter(l => l.trim());

        // 檢查是否為標準 Tab 格式（6 行，每行以弦名開頭）
        const tabLines = this.extractTabLines(lines);

        if (tabLines && tabLines.length === 6) {
            return this.parseStandardTab(tabLines, startNoteIndex);
        }

        // 如果不是標準格式，嘗試簡單解析數字
        return this.parseSimpleNumbers(cleanedText, startNoteIndex);
    }

    /**
     * 從 OCR 結果中提取 Tab 行
     * @param {Array<string>} lines
     * @returns {Array<string>|null}
     */
    extractTabLines(lines) {
        const stringPrefixes = ['e', 'B', 'G', 'D', 'A', 'E'];
        const tabLines = [];

        for (const prefix of stringPrefixes) {
            const line = lines.find(l => {
                const trimmed = l.trim();
                return trimmed.startsWith(prefix + '|') ||
                    trimmed.startsWith(prefix + '-') ||
                    trimmed.startsWith(prefix + ' ');
            });
            if (line) {
                tabLines.push(line);
            }
        }

        // 如果找不到帶前綴的，嘗試找連續的 6 行包含 - 或數字
        if (tabLines.length < 6) {
            const potentialTabLines = lines.filter(l =>
                /[-0-9|]+/.test(l) && l.length > 10
            );
            if (potentialTabLines.length >= 6) {
                return potentialTabLines.slice(0, 6);
            }
        }

        return tabLines.length === 6 ? tabLines : null;
    }

    /**
     * 解析標準 Tab 格式
     * @param {Array<string>} tabLines - 6 行 Tab 文字
     * @returns {{notes: Array<Note>, cleanedText: string}}
     */
    parseStandardTab(tabLines, startNoteIndex = 0) {
        const notes = [];
        let noteIndex = startNoteIndex;

        // 移除弦名前綴，只保留數字部分
        const cleanLines = tabLines.map(line => {
            return line.replace(/^[eBGDAE]\s*[|:]?\s*/, '').replace(/[|]/g, ' | ');
        });

        // 找出最長的行長度
        const maxLength = Math.max(...cleanLines.map(l => l.length));

        // 逐列掃描
        for (let col = 0; col < maxLength; col++) {
            const columnNotes = [];

            for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
                const line = cleanLines[stringIdx];
                if (col >= line.length) continue;

                const char = line[col];

                // 檢查是否為數字
                if (/[0-9]/.test(char)) {
                    // 檢查是否為兩位數
                    let fretStr = char;
                    if (col + 1 < line.length && /[0-9]/.test(line[col + 1])) {
                        fretStr += line[col + 1];
                    }

                    const fret = parseInt(fretStr, 10);
                    if (fret >= 0 && fret <= 24) {
                        const midiNote = STRING_TUNINGS[stringIdx] + fret;
                        const note = Note.fromMidi(midiNote, {
                            index: noteIndex,
                            stringIndex: stringIdx,
                            fret: fret
                        });
                        columnNotes.push(note);
                    }
                }
                // 檢查是否為小節線
                else if (char === '|') {
                    if (stringIdx === 0 && notes.length > 0) {
                        const separator = Note.createSeparator({ index: noteIndex });
                        notes.push(separator);
                        noteIndex++;
                    }
                }
            }

            // 如果這一列有音符，加入結果
            if (columnNotes.length > 0) {
                // 目前只支援單音，取第一個
                notes.push(columnNotes[0]);
                noteIndex++;
            }
        }

        return {
            notes,
            cleanedText: cleanLines.join('\n')
        };
    }

    /**
     * 簡單數字解析（當無法識別 Tab 格式時）
     * @param {string} text
     * @returns {{notes: Array<Note>, cleanedText: string}}
     */
    parseSimpleNumbers(text, startNoteIndex = 0) {
        const notes = [];
        const numbers = text.match(/\d+/g) || [];

        numbers.forEach((numStr, index) => {
            const fret = parseInt(numStr, 10);
            if (fret >= 0 && fret <= 24) {
                // 假設在第 1 弦 (高 E)
                const midiNote = STRING_TUNINGS[0] + fret;
                const note = Note.fromMidi(midiNote, {
                    index,
                    stringIndex: 0,
                    fret
                });
                notes.push(note);
            }
        });

        return { notes, cleanedText: text };
    }

    /**
     * 從圖片區域識別單一數字
     * @param {HTMLCanvasElement} canvas
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {Promise<{digit: number|null, confidence: number}>}
     */
    async recognizeRegion(canvas, x, y, width, height) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // 裁切區域
        const regionCanvas = document.createElement('canvas');
        regionCanvas.width = width;
        regionCanvas.height = height;
        const ctx = regionCanvas.getContext('2d');
        ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

        const { data } = await this.worker.recognize(regionCanvas);

        // 解析數字
        const match = data.text.match(/\d+/);
        const digit = match ? parseInt(match[0], 10) : null;

        return {
            digit: (digit !== null && digit >= 0 && digit <= 24) ? digit : null,
            confidence: data.confidence
        };
    }
}

/**
 * 建立 TabOCR 實例
 */
export function createTabOCR() {
    return new TabOCR();
}

/**
 * 快速識別 Tab 圖片（一次性使用）
 * @param {File|Blob|string} imageSource
 * @param {ProgressCallback} onProgress
 * @returns {Promise<{notes: Array<Note>, rawText: string, confidence: number}>}
 */
export async function recognizeTabImage(imageSource, onProgress) {
    const ocr = new TabOCR();
    try {
        return await ocr.recognizeTabImage(imageSource, onProgress);
    } finally {
        await ocr.terminate();
    }
}

export default TabOCR;
