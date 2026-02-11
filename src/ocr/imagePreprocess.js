/**
 * imagePreprocess.js - 圖片預處理工具
 * 用於 Tab OCR 的圖片前處理
 *
 * Phase 7A: Unified preprocessing pipeline with adaptive binarization,
 * smart scaling, Gaussian blur, deskew, and image quality detection.
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
export function calculateOtsuThreshold(imageData) {
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

    // Linear contrast scaling around midpoint 128.
    // factor=1.0: no change, factor=1.3: 30% more contrast, factor=0.5: 50% less contrast.
    for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp((data[i] - 128) * factor + 128);
        data[i + 1] = clamp((data[i + 1] - 128) * factor + 128);
        data[i + 2] = clamp((data[i + 2] - 128) * factor + 128);
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
 * Sharpen operating directly on ImageData (no ctx read needed)
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {ImageData}
 */
export function sharpenImageData(imageData, width, height) {
    const data = imageData.data;
    const output = new Uint8ClampedArray(data);

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

// ============================================================
// Phase 7A: New unified preprocessing functions
// ============================================================

/**
 * Build a grayscale histogram from imageData (assumes already grayscale)
 * @param {ImageData} imageData
 * @returns {Uint32Array} histogram with 256 bins
 */
export function buildHistogram(imageData) {
    const data = imageData.data;
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
        histogram[data[i]]++;
    }
    return histogram;
}

/**
 * Detect image quality based on histogram entropy and noise level
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {'scan'|'photo'|'screenshot'}
 */
export function detectImageQuality(imageData, width, height) {
    const histogram = buildHistogram(imageData);
    const total = width * height;

    // Calculate histogram entropy
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
        if (histogram[i] > 0) {
            const p = histogram[i] / total;
            entropy -= p * Math.log2(p);
        }
    }

    // Estimate noise level by computing local variance on a sample grid
    const data = imageData.data;
    let noiseSum = 0;
    let noiseSamples = 0;
    const step = Math.max(4, Math.floor(Math.min(width, height) / 100));
    for (let y = 1; y < height - 1; y += step) {
        for (let x = 1; x < width - 1; x += step) {
            const idx = (y * width + x) * 4;
            const center = data[idx];
            const left = data[idx - 4];
            const right = data[idx + 4];
            const up = data[((y - 1) * width + x) * 4];
            const down = data[((y + 1) * width + x) * 4];
            const diff = Math.abs(center - left) + Math.abs(center - right) +
                         Math.abs(center - up) + Math.abs(center - down);
            noiseSum += diff / 4;
            noiseSamples++;
        }
    }
    const avgNoise = noiseSamples > 0 ? noiseSum / noiseSamples : 0;

    // Count distinct intensity peaks (bimodal = scan, smooth = screenshot, noisy = photo)
    const smoothed = new Float64Array(256);
    for (let i = 0; i < 256; i++) {
        let sum = 0, cnt = 0;
        for (let j = Math.max(0, i - 5); j <= Math.min(255, i + 5); j++) {
            sum += histogram[j];
            cnt++;
        }
        smoothed[i] = sum / cnt;
    }
    let peaks = 0;
    for (let i = 1; i < 255; i++) {
        if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1] &&
            smoothed[i] > total * 0.005) {
            peaks++;
        }
    }

    // Classification heuristics:
    // Screenshot: low entropy (<4), low noise (<3), typically bimodal (sharp black/white)
    // Scan: moderate entropy (4-6), low-moderate noise (<8), often bimodal
    // Photo: high entropy (>5), high noise (>8), or many histogram peaks
    if (entropy < 4.0 && avgNoise < 3) {
        return 'screenshot';
    } else if (avgNoise > 8 || (entropy > 5.5 && peaks > 3)) {
        return 'photo';
    } else {
        return 'scan';
    }
}

/**
 * Improved dark image detection using center 60% region sampling
 * with median + histogram peak analysis
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
export function isDarkImageImproved(imageData, width, height) {
    const data = imageData.data;
    // Sample only center 60% to avoid white borders
    const x0 = Math.floor(width * 0.2);
    const x1 = Math.floor(width * 0.8);
    const y0 = Math.floor(height * 0.2);
    const y1 = Math.floor(height * 0.8);

    const values = [];
    // Sample every 3rd pixel for speed
    for (let y = y0; y < y1; y += 3) {
        for (let x = x0; x < x1; x += 3) {
            values.push(data[(y * width + x) * 4]);
        }
    }

    if (values.length === 0) return false;

    // Sort for median
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];

    // Build mini histogram to find dominant peak
    const hist = new Uint32Array(256);
    for (const v of values) hist[v]++;

    let peakBin = 0, peakCount = 0;
    // Smooth with window of 10 for peak detection
    for (let i = 0; i < 256; i++) {
        let sum = 0;
        for (let j = Math.max(0, i - 5); j <= Math.min(255, i + 5); j++) {
            sum += hist[j];
        }
        if (sum > peakCount) {
            peakCount = sum;
            peakBin = i;
        }
    }

    // Dark if both median and dominant peak are below 128
    return median < 128 && peakBin < 128;
}

/**
 * Smart scaling: resize large images down and small images up
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {Object} options
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number, scale: number}}
 */
export function smartScale(canvas, ctx, width, height, options = {}) {
    const {
        maxDimension = 3000,
        minDimension = 500,
    } = options;

    const maxDim = Math.max(width, height);
    let scale = 1;

    if (maxDim > maxDimension) {
        scale = maxDimension / maxDim;
    } else if (maxDim < minDimension) {
        scale = minDimension / maxDim;
    }

    if (Math.abs(scale - 1) < 0.05) {
        return { canvas, ctx, width, height, scale: 1 };
    }

    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    const newCanvas = document.createElement('canvas');
    newCanvas.width = newWidth;
    newCanvas.height = newHeight;
    const newCtx = newCanvas.getContext('2d', { willReadFrequently: true });

    // Use high quality scaling
    newCtx.imageSmoothingEnabled = true;
    newCtx.imageSmoothingQuality = 'high';
    newCtx.drawImage(canvas, 0, 0, width, height, 0, 0, newWidth, newHeight);

    return {
        canvas: newCanvas,
        ctx: newCtx,
        width: newWidth,
        height: newHeight,
        scale,
    };
}

/**
 * Gaussian blur using separable 1D convolutions for noise reduction
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {number} radius - blur radius (typically 1-3)
 * @returns {ImageData}
 */
export function gaussianBlur(imageData, width, height, radius = 1) {
    if (radius < 1) return imageData;

    const data = imageData.data;
    const size = radius * 2 + 1;

    // Build 1D Gaussian kernel
    const kernel = new Float64Array(size);
    const sigma = radius / 2;
    let kernelSum = 0;
    for (let i = 0; i < size; i++) {
        const x = i - radius;
        kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
        kernelSum += kernel[i];
    }
    for (let i = 0; i < size; i++) kernel[i] /= kernelSum;

    // Temporary buffer for horizontal pass
    const temp = new Float64Array(width * height * 3);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let k = -radius; k <= radius; k++) {
                const sx = Math.min(width - 1, Math.max(0, x + k));
                const idx = (y * width + sx) * 4;
                const w = kernel[k + radius];
                r += data[idx] * w;
                g += data[idx + 1] * w;
                b += data[idx + 2] * w;
            }
            const ti = (y * width + x) * 3;
            temp[ti] = r;
            temp[ti + 1] = g;
            temp[ti + 2] = b;
        }
    }

    // Vertical pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let k = -radius; k <= radius; k++) {
                const sy = Math.min(height - 1, Math.max(0, y + k));
                const ti = (sy * width + x) * 3;
                const w = kernel[k + radius];
                r += temp[ti] * w;
                g += temp[ti + 1] * w;
                b += temp[ti + 2] * w;
            }
            const idx = (y * width + x) * 4;
            data[idx] = clamp(r);
            data[idx + 1] = clamp(g);
            data[idx + 2] = clamp(b);
        }
    }

    return imageData;
}

/**
 * Sauvola adaptive binarization using integral images
 * Superior to global Otsu for uneven lighting (phone photos)
 * @param {ImageData} imageData
 * @param {number} windowSize - local window size (default: auto-computed)
 * @param {number} k - Sauvola parameter (default: 0.2, range 0.1-0.5)
 * @param {number} R - dynamic range of standard deviation (default: 128)
 * @returns {ImageData}
 */
export function binarizeSauvola(imageData, windowSize = 0, k = 0.2, R = 128) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const pixelCount = width * height;

    // Auto window size: ~1/8 of smaller dimension, must be odd
    if (windowSize <= 0) {
        windowSize = Math.max(15, Math.floor(Math.min(width, height) / 8) | 1);
    }
    if (windowSize % 2 === 0) windowSize++;

    const half = Math.floor(windowSize / 2);

    // Build integral image and integral of squares (grayscale channel only)
    const integralSum = new Float64Array((width + 1) * (height + 1));
    const integralSqSum = new Float64Array((width + 1) * (height + 1));

    for (let y = 0; y < height; y++) {
        let rowSum = 0;
        let rowSqSum = 0;
        for (let x = 0; x < width; x++) {
            const val = data[(y * width + x) * 4];
            rowSum += val;
            rowSqSum += val * val;

            const idx = (y + 1) * (width + 1) + (x + 1);
            integralSum[idx] = rowSum + integralSum[y * (width + 1) + (x + 1)];
            integralSqSum[idx] = rowSqSum + integralSqSum[y * (width + 1) + (x + 1)];
        }
    }

    // Helper to compute sum in rectangle (x0, y0) to (x1, y1) inclusive
    const rectSum = (integral, x0, y0, x1, y1) => {
        const w1 = width + 1;
        return integral[(y1 + 1) * w1 + (x1 + 1)]
             - integral[y0 * w1 + (x1 + 1)]
             - integral[(y1 + 1) * w1 + x0]
             + integral[y0 * w1 + x0];
    };

    // Apply Sauvola threshold per pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x0 = Math.max(0, x - half);
            const y0 = Math.max(0, y - half);
            const x1 = Math.min(width - 1, x + half);
            const y1 = Math.min(height - 1, y + half);
            const count = (x1 - x0 + 1) * (y1 - y0 + 1);

            const sum = rectSum(integralSum, x0, y0, x1, y1);
            const sqSum = rectSum(integralSqSum, x0, y0, x1, y1);

            const mean = sum / count;
            const variance = (sqSum / count) - (mean * mean);
            const stddev = Math.sqrt(Math.max(0, variance));

            const threshold = mean * (1 + k * (stddev / R - 1));

            const idx = (y * width + x) * 4;
            const value = data[idx] > threshold ? 255 : 0;
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
        }
    }

    return imageData;
}

/**
 * Adaptive binarization: auto-selects Otsu or Sauvola based on histogram bimodality
 * Bimodal histograms (clean scans) work well with Otsu.
 * Unimodal or noisy histograms (photos) benefit from Sauvola.
 * @param {ImageData} imageData
 * @returns {ImageData}
 */
export function binarizeAdaptive(imageData) {
    const histogram = buildHistogram(imageData);
    const total = imageData.width * imageData.height;

    // Smooth histogram
    const smoothed = new Float64Array(256);
    for (let i = 0; i < 256; i++) {
        let sum = 0, cnt = 0;
        for (let j = Math.max(0, i - 3); j <= Math.min(255, i + 3); j++) {
            sum += histogram[j];
            cnt++;
        }
        smoothed[i] = sum / cnt;
    }

    // Count significant peaks
    let peaks = 0;
    const peakPositions = [];
    for (let i = 2; i < 254; i++) {
        if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1] &&
            smoothed[i] > smoothed[i - 2] && smoothed[i] > smoothed[i + 2] &&
            smoothed[i] > total * 0.01) {
            peaks++;
            peakPositions.push(i);
        }
    }

    // Check bimodality: two well-separated peaks indicate good global threshold
    const isBimodal = peaks === 2 && peakPositions.length === 2 &&
                      Math.abs(peakPositions[1] - peakPositions[0]) > 60;

    if (isBimodal) {
        return binarize(imageData);
    } else {
        return binarizeSauvola(imageData);
    }
}

/**
 * Deskew an image by detecting and correcting rotation angle
 * Uses horizontal line angle detection (median angle approach)
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {Object} options
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, imageData: ImageData, angle: number, wasRotated: boolean}}
 */
export function deskewImage(canvas, ctx, imageData, width, height, options = {}) {
    const {
        minAngle = 0.3,   // degrees - minimum angle to correct
        maxAngle = 5.0,    // degrees - maximum angle to correct
    } = options;

    const data = imageData.data;

    // Detect horizontal line segments and measure their angles
    // Sample rows at regular intervals looking for long black runs
    const angles = [];
    const sampleStep = Math.max(2, Math.floor(height / 100));

    for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
        // Find start and end of long black runs
        let runStart = -1;
        let consecutiveBlack = 0;

        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx] < 128) {
                if (runStart === -1) runStart = x;
                consecutiveBlack++;
            } else {
                if (consecutiveBlack > width * 0.3) {
                    // Found a long horizontal segment; measure angle by checking
                    // if the same run shifts vertically at start vs end
                    const midX = runStart + Math.floor(consecutiveBlack / 2);
                    const endX = runStart + consecutiveBlack - 1;

                    // Find the vertical center of the line at start and end
                    let startCenterY = findLineCenter(data, width, height, runStart, y);
                    let endCenterY = findLineCenter(data, width, height, endX, y);

                    if (startCenterY !== null && endCenterY !== null) {
                        const dx = endX - runStart;
                        const dy = endCenterY - startCenterY;
                        if (dx > 0) {
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            angles.push(angle);
                        }
                    }
                }
                runStart = -1;
                consecutiveBlack = 0;
            }
        }
        // Check last run in row
        if (consecutiveBlack > width * 0.3 && runStart !== -1) {
            const endX = runStart + consecutiveBlack - 1;
            let startCenterY = findLineCenter(data, width, height, runStart, y);
            let endCenterY = findLineCenter(data, width, height, endX, y);
            if (startCenterY !== null && endCenterY !== null) {
                const dx = endX - runStart;
                const dy = endCenterY - startCenterY;
                if (dx > 0) {
                    angles.push(Math.atan2(dy, dx) * (180 / Math.PI));
                }
            }
        }
    }

    if (angles.length === 0) {
        return { canvas, ctx, imageData, angle: 0, wasRotated: false };
    }

    // Use median angle for robustness
    angles.sort((a, b) => a - b);
    const medianAngle = angles[Math.floor(angles.length / 2)];
    const absAngle = Math.abs(medianAngle);

    if (absAngle < minAngle || absAngle > maxAngle) {
        return { canvas, ctx, imageData, angle: medianAngle, wasRotated: false };
    }

    // Rotate the canvas to correct the skew
    const radians = -medianAngle * (Math.PI / 180);
    const newCanvas = document.createElement('canvas');
    newCanvas.width = width;
    newCanvas.height = height;
    const newCtx = newCanvas.getContext('2d', { willReadFrequently: true });

    newCtx.translate(width / 2, height / 2);
    newCtx.rotate(radians);
    newCtx.translate(-width / 2, -height / 2);
    newCtx.drawImage(canvas, 0, 0);

    // Reset transform
    newCtx.setTransform(1, 0, 0, 1, 0, 0);
    const newImageData = newCtx.getImageData(0, 0, width, height);

    return {
        canvas: newCanvas,
        ctx: newCtx,
        imageData: newImageData,
        angle: medianAngle,
        wasRotated: true,
    };
}

/**
 * Find the vertical center of a line at a given x position
 * Looks in a small vertical window around the expected y position
 */
function findLineCenter(data, width, height, x, expectedY) {
    const searchRadius = 5;
    const minY = Math.max(0, expectedY - searchRadius);
    const maxY = Math.min(height - 1, expectedY + searchRadius);

    let sumY = 0, count = 0;
    for (let y = minY; y <= maxY; y++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) {
            sumY += y;
            count++;
        }
    }

    return count > 0 ? sumY / count : null;
}

/**
 * Unified preprocessing pipeline
 * Integrates all preprocessing steps with minimal canvas read/write operations.
 * Returns both the processed canvas and the original (unprocessed) canvas.
 *
 * @param {File|Blob|string|HTMLCanvasElement} source - image source
 * @param {Object} options - preprocessing options
 * @param {number} options.maxDimension - max image dimension (default: 3000)
 * @param {number} options.minDimension - min image dimension (default: 500)
 * @param {number} options.contrast - contrast factor (default: auto based on quality)
 * @param {boolean} options.doSharpen - apply sharpening (default: true for scan/photo)
 * @param {boolean} options.doBlur - apply Gaussian blur (default: auto for photo)
 * @param {number} options.blurRadius - Gaussian blur radius (default: 1)
 * @param {string} options.binarizeMethod - 'otsu'|'sauvola'|'adaptive' (default: 'adaptive')
 * @param {boolean} options.autoInvert - auto-invert dark images (default: true)
 * @param {boolean} options.doDeskew - apply deskew correction (default: false)
 * @param {boolean} options.doMorphOpen - apply morphological opening (default: false)
 * @param {boolean} options.doScale - apply smart scaling (default: true)
 * @param {boolean} options.autoQuality - auto-detect quality and adjust params (default: true)
 * @returns {Promise<Object>} preprocessed result
 */
export async function preprocessImage(source, options = {}) {
    // 1. Load image
    let { canvas, ctx, width, height } = await loadImageToCanvas(source);

    // Save original canvas before any processing
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = width;
    originalCanvas.height = height;
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    originalCtx.drawImage(canvas, 0, 0);

    // 2. Smart scale (before pixel operations for speed)
    const doScale = options.doScale !== false;
    let scale = 1;
    if (doScale) {
        const scaled = smartScale(canvas, ctx, width, height, {
            maxDimension: options.maxDimension || 3000,
            minDimension: options.minDimension || 500,
        });
        canvas = scaled.canvas;
        ctx = scaled.ctx;
        width = scaled.width;
        height = scaled.height;
        scale = scaled.scale;
    }

    // 3. Get imageData once for all pixel operations
    let imageData = ctx.getImageData(0, 0, width, height);

    // 4. Grayscale
    grayscale(imageData);

    // 5. Detect quality (on grayscale data, before other transforms)
    let quality = 'scan';
    const autoQuality = options.autoQuality !== false;
    if (autoQuality) {
        quality = detectImageQuality(imageData, width, height);
    }

    // 6. Resolve options with quality-based defaults
    const resolvedContrast = options.contrast ??
        (quality === 'photo' ? 1.4 : quality === 'scan' ? 1.3 : 1.1);
    const doSharpen = options.doSharpen ??
        (quality !== 'screenshot');
    const doBlur = options.doBlur ??
        (quality === 'photo');
    const blurRadius = options.blurRadius ?? 1;
    const binarizeMethod = options.binarizeMethod ??
        (quality === 'photo' ? 'sauvola' : 'adaptive');
    const autoInvert = options.autoInvert !== false;
    const doDeskew = options.doDeskew ?? false;
    const doMorphOpen = options.doMorphOpen ?? false;

    // 7. Auto-invert dark images (before contrast/binarization)
    let wasInverted = false;
    if (autoInvert && isDarkImageImproved(imageData, width, height)) {
        invertColors(imageData);
        wasInverted = true;
    }

    // 8. Gaussian blur (noise reduction, before contrast enhancement)
    if (doBlur) {
        gaussianBlur(imageData, width, height, blurRadius);
    }

    // 9. Contrast enhancement
    if (resolvedContrast > 1.0) {
        adjustContrast(imageData, resolvedContrast);
    }

    // 10. Sharpen
    if (doSharpen) {
        sharpenImageData(imageData, width, height);
    }

    // 11. Write back for potential deskew (needs canvas)
    ctx.putImageData(imageData, 0, 0);

    // 12. Deskew (operates on canvas level)
    let deskewAngle = 0;
    let wasDeskewed = false;
    if (doDeskew) {
        // Need to binarize temporarily for line detection, then deskew original
        const tempData = ctx.getImageData(0, 0, width, height);
        const tempBinarized = new ImageData(
            new Uint8ClampedArray(tempData.data),
            width, height
        );
        binarize(tempBinarized);

        const deskewResult = deskewImage(canvas, ctx, tempBinarized, width, height);
        if (deskewResult.wasRotated) {
            canvas = deskewResult.canvas;
            ctx = deskewResult.ctx;
            deskewAngle = deskewResult.angle;
            wasDeskewed = true;
            // Re-read imageData from deskewed canvas
            imageData = ctx.getImageData(0, 0, width, height);
        }
    }

    // 13. Binarize
    if (binarizeMethod === 'sauvola') {
        binarizeSauvola(imageData);
    } else if (binarizeMethod === 'adaptive') {
        binarizeAdaptive(imageData);
    } else {
        binarize(imageData);
    }

    // 14. Post-binarization invert check
    if (autoInvert && isDarkImage(imageData)) {
        invertColors(imageData);
        wasInverted = true;
    }

    // 15. Morphological opening (noise removal)
    if (doMorphOpen) {
        morphologicalOpen(imageData, width, height, 1);
    }

    // 16. Single putImageData at the end
    ctx.putImageData(imageData, 0, 0);

    return {
        canvas,
        ctx,
        width,
        height,
        imageData,
        originalCanvas,
        scale,
        quality,
        wasInverted,
        wasDeskewed,
        deskewAngle,
    };
}

/**
 * 預處理完整流程 (Tab OCR)
 * Now uses the unified preprocessImage() pipeline internally
 * @param {File|Blob|string} source
 * @param {Object} options
 * @returns {Promise<{canvas: HTMLCanvasElement, stringLines: Array<number>|null}>}
 */
export async function preprocessTabImage(source, options = {}) {
    const {
        contrast = 1.3,
        sharpenImage = true
    } = options;

    const result = await preprocessImage(source, {
        contrast,
        doSharpen: sharpenImage,
        binarizeMethod: 'adaptive',
        autoInvert: true,
        doScale: true,
        doDeskew: false,
        doMorphOpen: false,
    });

    // Detect string lines (same as before)
    const allLines = detectHorizontalLines(result.imageData, result.width, result.height, 0.3);
    const stringLines = findSixStringLines(allLines);

    return {
        canvas: result.canvas,
        ctx: result.ctx,
        width: result.width,
        height: result.height,
        imageData: result.imageData,
        stringLines,
        allDetectedLines: allLines,
        originalCanvas: result.originalCanvas,
    };
}

export default {
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
};
