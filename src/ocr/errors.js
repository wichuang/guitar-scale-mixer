/**
 * OCR Error Handling - 錯誤處理與訊息
 */

/**
 * OCR 錯誤類型
 */
export const OCRErrorType = {
    INVALID_IMAGE: 'INVALID_IMAGE',
    IMAGE_TOO_SMALL: 'IMAGE_TOO_SMALL',
    IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
    NO_LINES_DETECTED: 'NO_LINES_DETECTED',
    NO_NOTES_DETECTED: 'NO_NOTES_DETECTED',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    UNKNOWN: 'UNKNOWN'
};

/**
 * 錯誤訊息對照表
 */
const ERROR_MESSAGES = {
    [OCRErrorType.INVALID_IMAGE]: {
        zh: '無效的圖片格式，請選擇 JPG、PNG 或 GIF 圖片',
        suggestion: '確保檔案是有效的圖片格式'
    },
    [OCRErrorType.IMAGE_TOO_SMALL]: {
        zh: '圖片太小，無法進行有效辨識',
        suggestion: '建議使用至少 200x100 像素的圖片'
    },
    [OCRErrorType.IMAGE_TOO_LARGE]: {
        zh: '圖片太大，可能導致處理緩慢',
        suggestion: '建議將圖片縮小至 2000 像素以下'
    },
    [OCRErrorType.NO_LINES_DETECTED]: {
        zh: '無法偵測到譜線',
        suggestion: '確保圖片中的譜線清晰可見，對比度足夠'
    },
    [OCRErrorType.NO_NOTES_DETECTED]: {
        zh: '無法識別任何音符',
        suggestion: '嘗試調整圖片亮度/對比度，或使用更清晰的圖片'
    },
    [OCRErrorType.LOW_CONFIDENCE]: {
        zh: '辨識信心度較低，結果可能不準確',
        suggestion: '建議仔細檢查辨識結果並手動校正'
    },
    [OCRErrorType.PROCESSING_ERROR]: {
        zh: '處理過程中發生錯誤',
        suggestion: '請稍後重試，或嘗試不同的圖片'
    },
    [OCRErrorType.NETWORK_ERROR]: {
        zh: '網路連線問題',
        suggestion: '請檢查網路連線後重試'
    },
    [OCRErrorType.UNKNOWN]: {
        zh: '發生未知錯誤',
        suggestion: '請稍後重試'
    }
};

/**
 * OCR 錯誤類別
 */
export class OCRError extends Error {
    constructor(type, details = null) {
        const errorInfo = ERROR_MESSAGES[type] || ERROR_MESSAGES[OCRErrorType.UNKNOWN];
        super(errorInfo.zh);

        this.name = 'OCRError';
        this.type = type;
        this.suggestion = errorInfo.suggestion;
        this.details = details;
    }

    /**
     * 取得完整錯誤訊息
     */
    getFullMessage() {
        return `${this.message}\n建議：${this.suggestion}`;
    }

    /**
     * 轉換為使用者友好的物件
     */
    toUserFriendly() {
        return {
            message: this.message,
            suggestion: this.suggestion,
            type: this.type,
            details: this.details
        };
    }
}

/**
 * 驗證圖片
 * @param {File|Blob} file
 * @returns {{valid: boolean, error?: OCRError}}
 */
export function validateImage(file) {
    if (!file) {
        return { valid: false, error: new OCRError(OCRErrorType.INVALID_IMAGE) };
    }

    // 檢查檔案類型
    if (file.type && !file.type.startsWith('image/')) {
        return { valid: false, error: new OCRError(OCRErrorType.INVALID_IMAGE) };
    }

    // 檢查檔案大小 (最大 20MB)
    if (file.size > 20 * 1024 * 1024) {
        return {
            valid: false,
            error: new OCRError(OCRErrorType.IMAGE_TOO_LARGE, { size: file.size })
        };
    }

    return { valid: true };
}

/**
 * 驗證圖片尺寸
 * @param {number} width
 * @param {number} height
 * @returns {{valid: boolean, error?: OCRError, warning?: OCRError}}
 */
export function validateImageDimensions(width, height) {
    const result = { valid: true };

    // 最小尺寸
    if (width < 100 || height < 50) {
        return {
            valid: false,
            error: new OCRError(OCRErrorType.IMAGE_TOO_SMALL, { width, height })
        };
    }

    // 大圖片警告
    if (width > 3000 || height > 3000) {
        result.warning = new OCRError(OCRErrorType.IMAGE_TOO_LARGE, { width, height });
    }

    return result;
}

/**
 * 根據辨識結果產生適當的錯誤或警告
 * @param {Object} result - OCR 結果
 * @returns {{error?: OCRError, warning?: OCRError}}
 */
export function analyzeResult(result) {
    const response = {};

    if (!result.notes || result.notes.length === 0) {
        response.error = new OCRError(OCRErrorType.NO_NOTES_DETECTED);
    } else if (result.confidence < 30) {
        response.warning = new OCRError(OCRErrorType.LOW_CONFIDENCE, {
            confidence: result.confidence
        });
    }

    return response;
}

/**
 * 格式化錯誤訊息供 UI 顯示
 * @param {Error|OCRError} error
 * @returns {string}
 */
export function formatErrorMessage(error) {
    if (error instanceof OCRError) {
        return error.message;
    }

    // 處理一般錯誤
    const message = error.message || '發生未知錯誤';

    // 常見錯誤訊息轉換
    if (message.includes('Failed to load image')) {
        return '無法載入圖片，請確認檔案格式正確';
    }
    if (message.includes('network') || message.includes('fetch')) {
        return '網路連線問題，請檢查網路後重試';
    }

    return message;
}

/**
 * 取得錯誤的建議操作
 * @param {Error|OCRError} error
 * @returns {string[]}
 */
export function getErrorSuggestions(error) {
    if (error instanceof OCRError) {
        return [error.suggestion];
    }

    // 一般建議
    return [
        '確保圖片清晰可見',
        '嘗試調整圖片對比度',
        '使用白底黑字的樂譜圖片'
    ];
}

export default {
    OCRErrorType,
    OCRError,
    validateImage,
    validateImageDimensions,
    analyzeResult,
    formatErrorMessage,
    getErrorSuggestions
};
