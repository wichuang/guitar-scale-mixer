/**
 * OCR Module - 光學識別模組
 * 統一匯出 Tab OCR 和 Staff OMR 功能
 */

// Tab OCR
export {
    TabOCR,
    createTabOCR,
    recognizeTabImage
} from './TabOCR.js';

// Staff OMR
export {
    StaffOCR,
    createStaffOCR,
    recognizeStaffImage
} from './StaffOCR.js';

// Image preprocessing utilities
export {
    loadImageToCanvas,
    grayscale,
    binarize,
    adjustContrast,
    sharpen,
    detectHorizontalLines,
    findSixStringLines,
    preprocessTabImage
} from './imagePreprocess.js';

// Staff-specific preprocessing
export {
    detectStaffLines,
    findStaffGroups,
    calculatePitchPosition,
    positionToMidi,
    removeStaffLines,
    preprocessStaffImage
} from './staffPreprocess.js';

// Note detection
export {
    findConnectedComponents,
    classifyComponent,
    detectAccidental,
    detectNotes,
    detectBarlines
} from './noteDetection.js';

// Error handling
export {
    OCRErrorType,
    OCRError,
    validateImage,
    validateImageDimensions,
    analyzeResult,
    formatErrorMessage,
    getErrorSuggestions
} from './errors.js';

/**
 * OCR 類型枚舉
 */
export const OCRType = {
    TAB: 'tab',
    STAFF: 'staff'
};

/**
 * 根據類型創建 OCR 實例
 * @param {string} type - 'tab' | 'staff'
 * @returns {TabOCR|StaffOCR}
 */
export function createOCR(type) {
    switch (type) {
        case OCRType.TAB:
            return createTabOCR();
        case OCRType.STAFF:
            return createStaffOCR();
        default:
            throw new Error(`Unknown OCR type: ${type}`);
    }
}

/**
 * 自動偵測圖片類型並識別
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress
 * @returns {Promise<{type: string, notes: Array, confidence: number}>}
 */
export async function autoRecognize(imageSource, onProgress) {
    // 嘗試兩種方式，選擇信心度較高的
    const results = [];

    try {
        onProgress?.('Trying Tab OCR...', 10);
        const tabResult = await recognizeTabImage(imageSource, (status, percent) => {
            onProgress?.(status, 10 + percent * 0.4);
        });
        if (tabResult.notes.length > 0) {
            results.push({
                type: OCRType.TAB,
                ...tabResult
            });
        }
    } catch (e) {
        console.warn('Tab OCR failed:', e);
    }

    try {
        onProgress?.('Trying Staff OMR...', 50);
        const staffResult = await recognizeStaffImage(imageSource, (status, percent) => {
            onProgress?.(status, 50 + percent * 0.4);
        });
        if (staffResult.notes.length > 0) {
            results.push({
                type: OCRType.STAFF,
                ...staffResult
            });
        }
    } catch (e) {
        console.warn('Staff OMR failed:', e);
    }

    onProgress?.('Complete', 100);

    if (results.length === 0) {
        return {
            type: null,
            notes: [],
            confidence: 0,
            error: 'Could not recognize any notes in the image'
        };
    }

    // 返回信心度最高的結果
    return results.sort((a, b) => b.confidence - a.confidence)[0];
}

export default {
    OCRType,
    createOCR,
    autoRecognize,
    recognizeTabImage,
    recognizeStaffImage
};
