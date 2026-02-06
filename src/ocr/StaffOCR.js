/**
 * StaffOCR.js - 五線譜圖片 OCR 核心模組
 * 識別五線譜圖片中的音符
 */

import { preprocessStaffImage } from './staffPreprocess.js';
import { detectNotes, detectBarlines } from './noteDetection.js';
import { Note } from '../core/models/Note.js';

/**
 * OCR 進度回調類型
 * @callback ProgressCallback
 * @param {string} status - 狀態描述
 * @param {number} progress - 進度 (0-100)
 */

/**
 * StaffOCR 類別
 */
export class StaffOCR {
    constructor() {
        this.isInitialized = false;
    }

    /**
     * 初始化
     * @param {ProgressCallback} onProgress
     */
    async initialize(onProgress) {
        if (this.isInitialized) return;

        onProgress?.('Initializing Staff OCR...', 10);
        this.isInitialized = true;
        onProgress?.('Staff OCR ready', 15);
    }

    /**
     * 識別五線譜圖片
     * @param {File|Blob|string} imageSource - 圖片來源
     * @param {ProgressCallback} onProgress - 進度回調
     * @param {Object} options - 選項
     * @returns {Promise<{notes: Array<Note>, rawData: Object, confidence: number}>}
     */
    async recognizeStaffImage(imageSource, onProgress, options = {}) {
        const {
            clef = 'treble',
            removeLines = true
        } = options;

        // 1. 初始化
        await this.initialize(onProgress);

        // 2. 預處理圖片
        onProgress?.('Preprocessing image...', 20);
        const preprocessed = await preprocessStaffImage(imageSource, { removeLines });

        const { imageData, width, height, staffGroups, canvas } = preprocessed;

        if (staffGroups.length === 0) {
            onProgress?.('No staff lines detected', 100);
            return {
                notes: [],
                rawData: { staffGroups: [], detectedNotes: [] },
                confidence: 0,
                error: 'Could not detect staff lines in the image'
            };
        }

        onProgress?.(`Found ${staffGroups.length} staff group(s)`, 40);

        // 3. 偵測音符
        onProgress?.('Detecting notes...', 50);
        const allDetectedNotes = [];
        const allBarlines = [];

        for (let groupIdx = 0; groupIdx < staffGroups.length; groupIdx++) {
            const group = staffGroups[groupIdx];

            onProgress?.(
                `Processing staff ${groupIdx + 1}/${staffGroups.length}...`,
                50 + (groupIdx / staffGroups.length) * 30
            );

            // 偵測該組五線譜的音符
            const notes = detectNotes(imageData, width, height, group, { clef });
            const barlines = detectBarlines(imageData, width, height, group);

            allDetectedNotes.push({
                staffIndex: groupIdx,
                notes,
                barlines
            });

            allBarlines.push(...barlines.map(x => ({ x, staffIndex: groupIdx })));
        }

        onProgress?.('Converting to notes...', 85);

        // 4. 轉換為 Note 物件
        const notes = this.convertToNotes(allDetectedNotes, allBarlines);

        // 5. 計算信心度
        const avgConfidence = this.calculateConfidence(allDetectedNotes);

        onProgress?.('Complete', 100);

        return {
            notes,
            rawData: {
                staffGroups,
                detectedNotes: allDetectedNotes,
                barlines: allBarlines,
                canvas
            },
            confidence: avgConfidence
        };
    }

    /**
     * 將偵測結果轉換為 Note 陣列
     * @param {Array} detectedNotes
     * @param {Array} barlines
     * @returns {Array<Note>}
     */
    convertToNotes(detectedNotes, barlines) {
        const notes = [];
        let noteIndex = 0;

        // 合併所有五線譜的音符並按 X 座標排序
        const allNotes = [];

        for (const staffData of detectedNotes) {
            for (const note of staffData.notes) {
                allNotes.push({
                    ...note,
                    staffIndex: staffData.staffIndex
                });
            }
        }

        // 按 X 座標排序
        allNotes.sort((a, b) => a.x - b.x);

        // 追蹤小節線位置
        let barlineIdx = 0;
        const sortedBarlines = [...barlines].sort((a, b) => a.x - b.x);

        for (const detectedNote of allNotes) {
            // 檢查是否需要插入小節線
            while (barlineIdx < sortedBarlines.length &&
                sortedBarlines[barlineIdx].x < detectedNote.x) {
                const separator = Note.createSeparator({ index: noteIndex });
                notes.push(separator);
                noteIndex++;
                barlineIdx++;
            }

            // 建立 Note 物件
            const note = Note.fromMidi(detectedNote.midi, {
                index: noteIndex,
                confidence: detectedNote.confidence,
                sourceType: 'staff-ocr',
                position: detectedNote.position,
                onLine: detectedNote.onLine
            });

            // 添加升降記號資訊
            if (detectedNote.accidental) {
                note.accidentalStr = detectedNote.accidental === 'sharp' ? '#' :
                    detectedNote.accidental === 'flat' ? 'b' : '';
            }

            notes.push(note);
            noteIndex++;
        }

        return notes;
    }

    /**
     * 計算整體信心度
     * @param {Array} detectedNotes
     * @returns {number}
     */
    calculateConfidence(detectedNotes) {
        let totalConfidence = 0;
        let count = 0;

        for (const staffData of detectedNotes) {
            for (const note of staffData.notes) {
                totalConfidence += note.confidence || 50;
                count++;
            }
        }

        if (count === 0) return 0;

        return Math.round(totalConfidence / count);
    }

    /**
     * 終止（目前無需清理）
     */
    async terminate() {
        this.isInitialized = false;
    }
}

/**
 * 建立 StaffOCR 實例
 */
export function createStaffOCR() {
    return new StaffOCR();
}

/**
 * 快速識別五線譜圖片（一次性使用）
 * @param {File|Blob|string} imageSource
 * @param {ProgressCallback} onProgress
 * @param {Object} options
 * @returns {Promise<{notes: Array<Note>, rawData: Object, confidence: number}>}
 */
export async function recognizeStaffImage(imageSource, onProgress, options = {}) {
    const ocr = new StaffOCR();
    try {
        return await ocr.recognizeStaffImage(imageSource, onProgress, options);
    } finally {
        await ocr.terminate();
    }
}

export default StaffOCR;
