/**
 * OCR Module - 光學識別模組
 * 統一匯出 Tab OCR、Staff OMR、Jianpu OCR、Combined OCR、Header OCR 和 SystemDetector
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

// Jianpu OCR
export {
    JianpuOCR,
    createJianpuOCR,
    recognizeJianpuImage
} from './JianpuOCR.js';

// Header OCR (Phase 6A)
export {
    HeaderOCR,
    createHeaderOCR,
    recognizeHeader
} from './HeaderOCR.js';

// System Detector (Phase 6B)
export {
    SystemDetector,
    SystemType,
    createSystemDetector
} from './SystemDetector.js';

// Combined Staff+Tab OCR (Phase 6C)
export {
    CombinedSheetOCR,
    createCombinedOCR,
    recognizeCombinedImage
} from './CombinedSheetOCR.js';

// Image preprocessing utilities
export {
    loadImageToCanvas,
    grayscale,
    binarize,
    adjustContrast,
    sharpen,
    sharpenImageData,
    invertColors,
    isDarkImage,
    isDarkImageImproved,
    morphologicalOpen,
    detectHorizontalLines,
    findSixStringLines,
    preprocessTabImage,
    preprocessImage,
    buildHistogram,
    detectImageQuality,
    smartScale,
    gaussianBlur,
    binarizeSauvola,
    binarizeAdaptive,
    deskewImage,
    calculateOtsuThreshold,
} from './imagePreprocess.js';

// Staff-specific preprocessing
export {
    detectStaffLines,
    findStaffGroups,
    findTabGroups,
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
    STAFF: 'staff',
    JIANPU: 'jianpu',
    COMBINED: 'combined',
};

/**
 * 根據類型創建 OCR 實例
 * @param {string} type - 'tab' | 'staff' | 'jianpu' | 'combined'
 * @returns {TabOCR|StaffOCR|JianpuOCR|CombinedSheetOCR}
 */
export function createOCR(type) {
    switch (type) {
        case OCRType.TAB:
            return createTabOCR();
        case OCRType.STAFF:
            return createStaffOCR();
        case OCRType.JIANPU:
            return createJianpuOCR();
        case OCRType.COMBINED:
            return createCombinedOCR();
        default:
            throw new Error(`Unknown OCR type: ${type}`);
    }
}

/**
 * 自動偵測圖片類型並識別
 * Enhanced with SystemDetector for auto-detection and header OCR
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress
 * @returns {Promise<{type: string, notes: Array, confidence: number, metadata?: Object}>}
 */
export async function autoRecognize(imageSource, onProgress) {
    // First, try Combined OCR (detects systems automatically)
    try {
        onProgress?.('Analyzing image structure...', 3);
        const detector = new SystemDetector();
        const detection = await detector.detectSystems(imageSource, () => {});

        // If we find staff+tab or tab systems, use Combined OCR
        if (detection.systems.length > 0) {
            const hasStaffTab = detection.systems.some(s => s.type === SystemType.STAFF_TAB);
            const hasTab = detection.systems.some(s => s.type === SystemType.TAB);

            if (hasStaffTab || hasTab) {
                onProgress?.('Using Combined Staff+Tab OCR...', 5);
                const result = await recognizeCombinedImage(imageSource, (status, percent) => {
                    onProgress?.(status, 5 + percent * 0.6);
                });
                if (result.notes.length > 0) {
                    onProgress?.('Complete', 100);
                    return {
                        type: OCRType.COMBINED,
                        ...result
                    };
                }
            }
        }
    } catch (e) {
        console.warn('Combined OCR auto-detect failed:', e);
    }

    // Fallback: try each OCR type
    const results = [];

    try {
        onProgress?.('Trying Tab OCR...', 5);
        const tabResult = await recognizeTabImage(imageSource, (status, percent) => {
            onProgress?.(status, 5 + percent * 0.3);
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
        onProgress?.('Trying Staff OMR...', 35);
        const staffResult = await recognizeStaffImage(imageSource, (status, percent) => {
            onProgress?.(status, 35 + percent * 0.3);
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

    try {
        onProgress?.('Trying Jianpu OCR...', 65);
        const jianpuResult = await recognizeJianpuImage(imageSource, (status, percent) => {
            onProgress?.(status, 65 + percent * 0.3);
        });
        if (jianpuResult.notes.length > 0) {
            results.push({
                type: OCRType.JIANPU,
                ...jianpuResult
            });
        }
    } catch (e) {
        console.warn('Jianpu OCR failed:', e);
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
    recognizeStaffImage,
    recognizeJianpuImage,
    recognizeCombinedImage,
    recognizeHeader,
};
