/**
 * TabOCR.js - 六線譜圖片 OCR 核心模組
 * 識別 Guitar Tab 圖片中的琴格數字
 */

import Tesseract from 'tesseract.js';
import { preprocessTabImage, loadImageToCanvas } from './imagePreprocess.js';
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
     * @returns {Promise<{notes: Array<Note>, rawText: string, confidence: number}>}
     */
    async recognizeTabImage(imageSource, onProgress) {
        // 1. 初始化
        await this.initialize(onProgress);

        // 2. 預處理圖片
        onProgress?.('Preprocessing image...', 25);
        const preprocessed = await preprocessTabImage(imageSource);

        // 3. 執行 OCR
        onProgress?.('Running OCR...', 30);
        const { data } = await this.worker.recognize(preprocessed.canvas);

        onProgress?.('Parsing results...', 85);

        // 4. 解析結果
        const parseResult = this.parseOCRResult(data.text, preprocessed.stringLines);

        onProgress?.('Complete', 100);

        return {
            notes: parseResult.notes,
            rawText: data.text,
            cleanedText: parseResult.cleanedText,
            confidence: data.confidence,
            stringLines: preprocessed.stringLines
        };
    }

    /**
     * 解析 OCR 結果文字
     * @param {string} text - OCR 識別的文字
     * @param {Array<number>|null} stringLines - 弦線位置（如果有的話）
     * @returns {{notes: Array<Note>, cleanedText: string}}
     */
    parseOCRResult(text, stringLines) {
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
            return this.parseStandardTab(tabLines);
        }

        // 如果不是標準格式，嘗試簡單解析數字
        return this.parseSimpleNumbers(cleanedText);
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
    parseStandardTab(tabLines) {
        const notes = [];
        let noteIndex = 0;

        // 移除弦名前綴，只保留數字部分
        const cleanLines = tabLines.map(line => {
            return line.replace(/^[eBGDAE]\s*[\|:]?\s*/, '').replace(/\|/g, ' | ');
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
    parseSimpleNumbers(text) {
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
