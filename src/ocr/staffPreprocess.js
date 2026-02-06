/**
 * staffPreprocess.js - 五線譜圖片預處理工具
 * 專門處理五線譜的線條偵測和音符位置計算
 */

import { loadImageToCanvas, grayscale, binarize, adjustContrast } from './imagePreprocess.js';

/**
 * 偵測五線譜的水平線
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {Array<{y: number, strength: number, thickness: number}>}
 */
export function detectStaffLines(imageData, width, height) {
    const data = imageData.data;
    const lines = [];

    // 計算每一行的黑色像素密度
    for (let y = 0; y < height; y++) {
        let blackCount = 0;
        let consecutiveBlack = 0;
        let maxConsecutive = 0;

        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const isBlack = data[idx] < 128;

            if (isBlack) {
                blackCount++;
                consecutiveBlack++;
                maxConsecutive = Math.max(maxConsecutive, consecutiveBlack);
            } else {
                consecutiveBlack = 0;
            }
        }

        const density = blackCount / width;
        const lineRatio = maxConsecutive / width;

        // 五線譜的線條特徵：高連續性、適中密度
        if (lineRatio > 0.6 && density > 0.1 && density < 0.8) {
            lines.push({
                y,
                strength: lineRatio,
                density
            });
        }
    }

    return mergeAdjacentLines(lines);
}

/**
 * 合併相鄰的線條（處理粗線條）
 * @param {Array} lines
 * @returns {Array}
 */
function mergeAdjacentLines(lines) {
    if (lines.length === 0) return [];

    const merged = [];
    let group = [lines[0]];

    for (let i = 1; i < lines.length; i++) {
        const current = lines[i];
        const last = group[group.length - 1];

        if (current.y - last.y <= 3) {
            group.push(current);
        } else {
            // 合併群組
            const avgY = Math.round(group.reduce((sum, l) => sum + l.y, 0) / group.length);
            const maxStrength = Math.max(...group.map(l => l.strength));
            merged.push({
                y: avgY,
                strength: maxStrength,
                thickness: group.length
            });
            group = [current];
        }
    }

    // 處理最後一組
    if (group.length > 0) {
        const avgY = Math.round(group.reduce((sum, l) => sum + l.y, 0) / group.length);
        const maxStrength = Math.max(...group.map(l => l.strength));
        merged.push({
            y: avgY,
            strength: maxStrength,
            thickness: group.length
        });
    }

    return merged;
}

/**
 * 從偵測到的線條中找出五線譜組
 * 五線譜特徵：5條等距的水平線
 * @param {Array} allLines
 * @returns {Array<{lines: number[], spacing: number, top: number, bottom: number}>} 五線譜組
 */
export function findStaffGroups(allLines) {
    if (allLines.length < 5) return [];

    const sortedLines = [...allLines].sort((a, b) => a.y - b.y);
    const staffGroups = [];

    // 嘗試找出所有可能的五線譜組
    for (let start = 0; start <= sortedLines.length - 5; start++) {
        const candidate = sortedLines.slice(start, start + 5);
        const gaps = [];

        for (let i = 1; i < 5; i++) {
            gaps.push(candidate[i].y - candidate[i - 1].y);
        }

        // 計算間距的一致性
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
        const stdDev = Math.sqrt(variance);

        // 間距應該一致（標準差小）且合理（10-50 像素）
        if (stdDev < avgGap * 0.15 && avgGap >= 8 && avgGap <= 60) {
            staffGroups.push({
                lines: candidate.map(l => l.y),
                spacing: avgGap,
                top: candidate[0].y,
                bottom: candidate[4].y,
                startIndex: start
            });
            // 跳過已使用的線
            start += 4;
        }
    }

    return staffGroups;
}

/**
 * 根據 Y 座標計算音高位置
 * @param {number} y - Y 座標
 * @param {Array<number>} staffLines - 五條線的 Y 座標
 * @param {number} spacing - 線距
 * @returns {{position: number, onLine: boolean}} position: 0=最下線, 每半格+1
 */
export function calculatePitchPosition(y, staffLines, spacing) {
    const bottomLine = staffLines[4]; // 最下面的線
    const halfSpacing = spacing / 2;

    // 計算相對於最下線的位置（向上為正）
    const relativeY = bottomLine - y;
    const position = Math.round(relativeY / halfSpacing);

    // 判斷是否在線上
    const nearestLineDistance = Math.min(
        ...staffLines.map(lineY => Math.abs(y - lineY))
    );
    const onLine = nearestLineDistance < spacing * 0.2;

    return { position, onLine };
}

/**
 * 將五線譜位置轉換為 MIDI 音高
 * 預設以高音譜號為基準：最下線 E4 (MIDI 64)
 * @param {number} position - 位置 (0=E4, 2=G4, 4=B4, 6=D5, 8=F5)
 * @param {string} clef - 譜號 ('treble' | 'bass')
 * @returns {number} MIDI 音高
 */
export function positionToMidi(position, clef = 'treble') {
    // 高音譜號：最下線 E4 (64)
    // 低音譜號：最下線 G2 (43)
    const baseMidi = clef === 'treble' ? 64 : 43;

    // 每個位置對應半格，音階間隔為 [2,2,1,2,2,2,1] (C大調)
    // 簡化處理：每個位置約等於一個全音階音程
    const scaleSteps = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];

    // position 0 = E4, 需要映射到正確的音階
    // E4 在 C 大調中是第 4 個音 (C=0, D=1, E=2...)
    const baseScalePosition = 4; // E 在音階中的位置

    const scalePosition = baseScalePosition + position;

    if (scalePosition < 0) {
        // 處理低於基準的音
        const octaveDown = Math.floor(Math.abs(scalePosition) / 7) + 1;
        const posInOctave = ((scalePosition % 7) + 7) % 7;
        return baseMidi - (octaveDown * 12) + (scaleSteps[posInOctave] - scaleSteps[baseScalePosition]);
    }

    const octave = Math.floor(scalePosition / 7);
    const posInOctave = scalePosition % 7;

    return baseMidi + (octave * 12) + (scaleSteps[posInOctave] - scaleSteps[baseScalePosition]);
}

/**
 * 移除五線譜線條（保留音符）
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {Array<number>} staffLines
 * @param {number} lineThickness
 * @returns {ImageData}
 */
export function removeStaffLines(imageData, width, height, staffLines, lineThickness = 2) {
    const data = imageData.data;
    const output = new Uint8ClampedArray(data);

    for (const lineY of staffLines) {
        for (let dy = -lineThickness; dy <= lineThickness; dy++) {
            const y = lineY + dy;
            if (y < 0 || y >= height) continue;

            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                // 檢查是否只是線條（上下沒有連接的黑色像素）
                let hasVerticalConnection = false;

                // 檢查上下各 3 像素
                for (let checkDy = -lineThickness - 3; checkDy <= lineThickness + 3; checkDy++) {
                    if (checkDy >= -lineThickness && checkDy <= lineThickness) continue;

                    const checkY = lineY + checkDy;
                    if (checkY < 0 || checkY >= height) continue;

                    const checkIdx = (checkY * width + x) * 4;
                    if (data[checkIdx] < 128) {
                        hasVerticalConnection = true;
                        break;
                    }
                }

                // 如果沒有垂直連接，則視為純線條，移除
                if (!hasVerticalConnection && data[idx] < 128) {
                    output[idx] = 255;
                    output[idx + 1] = 255;
                    output[idx + 2] = 255;
                }
            }
        }
    }

    for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
    }

    return imageData;
}

/**
 * 五線譜圖片預處理完整流程
 * @param {File|Blob|string} source
 * @param {Object} options
 * @returns {Promise<{canvas, staffGroups, imageData}>}
 */
export async function preprocessStaffImage(source, options = {}) {
    const {
        contrast = 1.4,
        removeLines = true
    } = options;

    // 1. 載入圖片
    const { canvas, ctx, width, height } = await loadImageToCanvas(source);

    // 2. 灰階
    let imageData = ctx.getImageData(0, 0, width, height);
    grayscale(imageData);
    ctx.putImageData(imageData, 0, 0);

    // 3. 對比度增強
    imageData = ctx.getImageData(0, 0, width, height);
    adjustContrast(imageData, contrast);
    ctx.putImageData(imageData, 0, 0);

    // 4. 二值化
    imageData = ctx.getImageData(0, 0, width, height);
    binarize(imageData);
    ctx.putImageData(imageData, 0, 0);

    // 5. 偵測五線譜
    const allLines = detectStaffLines(imageData, width, height);
    const staffGroups = findStaffGroups(allLines);

    // 6. 可選：移除五線譜線條
    if (removeLines && staffGroups.length > 0) {
        for (const group of staffGroups) {
            removeStaffLines(imageData, width, height, group.lines, 2);
        }
        ctx.putImageData(imageData, 0, 0);
    }

    return {
        canvas,
        ctx,
        width,
        height,
        imageData,
        staffGroups,
        allDetectedLines: allLines
    };
}

export default {
    detectStaffLines,
    findStaffGroups,
    calculatePitchPosition,
    positionToMidi,
    removeStaffLines,
    preprocessStaffImage
};
