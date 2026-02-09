/**
 * imagePreprocess.js - 圖片預處理工具
 * 用於 Tab OCR 的圖片前處理
 */

/**
 * 載入圖片到 Canvas
 * @param {File|Blob|string} source - 圖片來源
 * @returns {Promise<{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number}>}
 */
export async function loadImageToCanvas(source) {
    // Handle Canvas elements directly (used by CombinedSheetOCR for cropped regions)
    if (source instanceof HTMLCanvasElement) {
        const ctx = source.getContext('2d', { willReadFrequently: true });
        return {
            canvas: source,
            ctx,
            width: source.width,
            height: source.height,
            image: null
        };
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            resolve({
                canvas,
                ctx,
                width: img.width,
                height: img.height,
                image: img
            });
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        if (source instanceof File || source instanceof Blob) {
            img.src = URL.createObjectURL(source);
        } else if (typeof source === 'string') {
            img.src = source;
        } else {
            reject(new Error('Invalid image source'));
        }
    });
}

/**
 * 灰階轉換
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function grayscale(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = avg;     // R
        data[i + 1] = avg; // G
        data[i + 2] = avg; // B
        // Alpha 保持不變
    }
    return imageData;
}

/**
 * 二值化（Otsu's method 簡化版）
 * @param {ImageData} imageData
 * @param {number} threshold - 閾值 (0-255)，如果為 null 則自動計算
 * @returns {ImageData}
 */
export function binarize(imageData, threshold = null) {
    const data = imageData.data;

    // 如果沒有提供閾值，計算最佳閾值
    if (threshold === null) {
        threshold = calculateOtsuThreshold(imageData);
    }

    for (let i = 0; i < data.length; i += 4) {
        const value = data[i] > threshold ? 255 : 0;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }

    return imageData;
}

/**
 * 計算 Otsu 閾值
 * @param {ImageData} imageData
 * @returns {number}
 */
function calculateOtsuThreshold(imageData) {
    const data = imageData.data;
    const histogram = new Array(256).fill(0);

    // 建立直方圖
    for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++;
    }

    const total = data.length / 4;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 0;

    for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;

        wF = total - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;

        const variance = wB * wF * (mB - mF) * (mB - mF);
        if (variance > maxVariance) {
            maxVariance = variance;
            threshold = t;
        }
    }

    return threshold;
}

/**
 * 對比度增強
 * @param {ImageData} imageData
 * @param {number} factor - 對比度因子 (1.0 = 不變, >1 增強)
 * @returns {ImageData}
 */
export function adjustContrast(imageData, factor = 1.5) {
    const data = imageData.data;
    const factor255 = (259 * (factor * 255 + 255)) / (255 * (259 - factor * 255));

    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(factor255 * (data[i] - 128) + 128);
        data[i + 1] = clamp(factor255 * (data[i + 1] - 128) + 128);
        data[i + 2] = clamp(factor255 * (data[i + 2] - 128) + 128);
    }

    return imageData;
}

/**
 * 銳化
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @returns {ImageData}
 */
export function sharpen(ctx, width, height) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = new Uint8ClampedArray(data);

    // 銳化卷積核
    const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                        sum += data[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                    }
                }
                output[(y * width + x) * 4 + c] = clamp(sum);
            }
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }

    return imageData;
}

/**
 * Invert image colors (for dark-background images)
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function invertColors(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];         // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
        // Alpha unchanged
    }
    return imageData;
}

/**
 * Detect if an image is dark (inverted) based on average brightness
 * @param {ImageData} imageData
 * @returns {boolean} true if the image is dark (mean brightness < 128)
 */
export function isDarkImage(imageData) {
    const data = imageData.data;
    let sum = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
        sum += data[i]; // Already grayscale, R channel is sufficient
    }
    return (sum / pixelCount) < 128;
}

/**
 * Apply morphological erosion to remove noise
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {number} radius - kernel radius
 * @returns {ImageData}
 */
export function morphologicalOpen(imageData, width, height, radius = 1) {
    const data = imageData.data;
    const temp = new Uint8ClampedArray(data);

    // Erosion pass (shrink black regions, removing small noise)
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const idx = (y * width + x) * 4;
            let allBlack = true;
            for (let dy = -radius; dy <= radius && allBlack; dy++) {
                for (let dx = -radius; dx <= radius && allBlack; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    if (data[nIdx] >= 128) allBlack = false;
                }
            }
            temp[idx] = temp[idx + 1] = temp[idx + 2] = allBlack ? 0 : 255;
        }
    }

    // Dilation pass (restore original shapes)
    const result = new Uint8ClampedArray(temp);
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const idx = (y * width + x) * 4;
            let anyBlack = false;
            for (let dy = -radius; dy <= radius && !anyBlack; dy++) {
                for (let dx = -radius; dx <= radius && !anyBlack; dx++) {
                    const nIdx = ((y + dy) * width + (x + dx)) * 4;
                    if (temp[nIdx] < 128) anyBlack = true;
                }
            }
            result[idx] = result[idx + 1] = result[idx + 2] = anyBlack ? 0 : 255;
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = result[i];
    }
    return imageData;
}

/**
 * 限制數值範圍
 */
function clamp(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * 偵測水平線（用於找出六條弦線）
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {number} minLineLength - 最小線長度比例 (0-1)
 * @returns {Array<{y: number, strength: number}>} 水平線位置
 */
export function detectHorizontalLines(imageData, width, height, minLineLength = 0.5) {
    const data = imageData.data;
    const lines = [];

    for (let y = 0; y < height; y++) {
        let consecutiveBlack = 0;
        let maxConsecutive = 0;
        let totalBlack = 0;

        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const isBlack = data[idx] < 128;

            if (isBlack) {
                consecutiveBlack++;
                totalBlack++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveBlack);
            } else {
                consecutiveBlack = 0;
            }
        }

        const lineRatio = maxConsecutive / width;
        const totalRatio = totalBlack / width;

        // Detect lines by either method:
        // 1. Long consecutive run (for uninterrupted lines) - original method
        // 2. High total black pixel ratio (for lines interrupted by fret numbers/noteheads)
        //    Tab lines are typically >40% black even with number interruptions
        if (lineRatio > minLineLength || totalRatio > 0.4) {
            lines.push({ y, strength: Math.max(lineRatio, totalRatio) });
        }
    }

    // 合併相鄰的線
    const mergedLines = [];
    let currentGroup = [];

    for (const line of lines) {
        if (currentGroup.length === 0) {
            currentGroup.push(line);
        } else {
            const lastLine = currentGroup[currentGroup.length - 1];
            if (line.y - lastLine.y <= 3) {
                currentGroup.push(line);
            } else {
                // 取平均值
                const avgY = Math.round(
                    currentGroup.reduce((sum, l) => sum + l.y, 0) / currentGroup.length
                );
                const maxStrength = Math.max(...currentGroup.map(l => l.strength));
                mergedLines.push({ y: avgY, strength: maxStrength });
                currentGroup = [line];
            }
        }
    }

    if (currentGroup.length > 0) {
        const avgY = Math.round(
            currentGroup.reduce((sum, l) => sum + l.y, 0) / currentGroup.length
        );
        const maxStrength = Math.max(...currentGroup.map(l => l.strength));
        mergedLines.push({ y: avgY, strength: maxStrength });
    }

    return mergedLines;
}

/**
 * 找出六條弦線（Tab 專用）
 * @param {Array<{y: number, strength: number}>} allLines
 * @returns {Array<number>|null} 六條弦線的 Y 座標，或 null 如果找不到
 */
export function findSixStringLines(allLines) {
    if (allLines.length < 6) return null;

    // 嘗試找出間距相近的 6 條線
    const sortedLines = [...allLines].sort((a, b) => a.y - b.y);

    // 計算所有可能的 6 條線組合的間距變異數
    let bestCombination = null;
    let bestVariance = Infinity;

    for (let start = 0; start <= sortedLines.length - 6; start++) {
        const group = sortedLines.slice(start, start + 6);
        const gaps = [];
        for (let i = 1; i < group.length; i++) {
            gaps.push(group[i].y - group[i - 1].y);
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((sum, g) => sum + (g - avgGap) ** 2, 0) / gaps.length;

        if (variance < bestVariance && avgGap > 5) { // 間距至少 5px
            bestVariance = variance;
            bestCombination = group.map(l => l.y);
        }
    }

    return bestCombination;
}

/**
 * 預處理完整流程
 * @param {File|Blob|string} source
 * @param {Object} options
 * @returns {Promise<{canvas: HTMLCanvasElement, stringLines: Array<number>|null}>}
 */
export async function preprocessTabImage(source, options = {}) {
    const {
        contrast = 1.3,
        sharpenImage = true
    } = options;

    const { canvas, ctx, width, height } = await loadImageToCanvas(source);

    // 1. 灰階
    let imageData = ctx.getImageData(0, 0, width, height);
    grayscale(imageData);
    ctx.putImageData(imageData, 0, 0);

    // 2. 對比度增強
    imageData = ctx.getImageData(0, 0, width, height);
    adjustContrast(imageData, contrast);
    ctx.putImageData(imageData, 0, 0);

    // 3. 銳化（可選）
    if (sharpenImage) {
        imageData = sharpen(ctx, width, height);
        ctx.putImageData(imageData, 0, 0);
    }

    // 4. 二值化
    imageData = ctx.getImageData(0, 0, width, height);
    binarize(imageData);
    ctx.putImageData(imageData, 0, 0);

    // 4b. Fix inverted binarization (dark background → invert back)
    imageData = ctx.getImageData(0, 0, width, height);
    if (isDarkImage(imageData)) {
        invertColors(imageData);
        ctx.putImageData(imageData, 0, 0);
    }

    // 5. 偵測弦線
    const allLines = detectHorizontalLines(imageData, width, height, 0.3);
    const stringLines = findSixStringLines(allLines);

    return {
        canvas,
        ctx,
        width,
        height,
        imageData,
        stringLines,
        allDetectedLines: allLines
    };
}

export default {
    loadImageToCanvas,
    grayscale,
    binarize,
    adjustContrast,
    sharpen,
    invertColors,
    isDarkImage,
    morphologicalOpen,
    detectHorizontalLines,
    findSixStringLines,
    preprocessTabImage
};
