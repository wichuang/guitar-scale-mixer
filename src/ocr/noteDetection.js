/**
 * noteDetection.js - 音符偵測模組
 * 從預處理後的五線譜圖片中偵測音符位置
 */

import { calculatePitchPosition, positionToMidi } from './staffPreprocess.js';

/**
 * 連通區域標記 (Connected Component Labeling)
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @returns {Array<{id, pixels, bounds, centroid}>}
 */
export function findConnectedComponents(imageData, width, height) {
    const data = imageData.data;
    const labels = new Int32Array(width * height);
    let currentLabel = 0;

    // 第一遍：標記連通區域
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pixelIdx = idx * 4;

            // 跳過白色像素
            if (data[pixelIdx] > 128) continue;

            // 檢查左邊和上面的鄰居
            const leftLabel = x > 0 ? labels[idx - 1] : 0;
            const topLabel = y > 0 ? labels[idx - width] : 0;

            if (leftLabel === 0 && topLabel === 0) {
                // 新區域
                currentLabel++;
                labels[idx] = currentLabel;
            } else if (leftLabel !== 0 && topLabel === 0) {
                labels[idx] = leftLabel;
            } else if (leftLabel === 0 && topLabel !== 0) {
                labels[idx] = topLabel;
            } else {
                // 兩個鄰居都有標籤，使用較小的
                labels[idx] = Math.min(leftLabel, topLabel);

                // 如果標籤不同，需要合併（簡化處理：直接使用較小的）
                if (leftLabel !== topLabel) {
                    const minLabel = Math.min(leftLabel, topLabel);
                    const maxLabel = Math.max(leftLabel, topLabel);
                    // 將所有 maxLabel 替換為 minLabel
                    for (let i = 0; i < idx; i++) {
                        if (labels[i] === maxLabel) {
                            labels[i] = minLabel;
                        }
                    }
                }
            }
        }
    }

    // 收集每個區域的資訊
    const regions = new Map();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const label = labels[idx];

            if (label === 0) continue;

            if (!regions.has(label)) {
                regions.set(label, {
                    id: label,
                    pixels: [],
                    minX: x,
                    maxX: x,
                    minY: y,
                    maxY: y,
                    sumX: 0,
                    sumY: 0
                });
            }

            const region = regions.get(label);
            region.pixels.push({ x, y });
            region.minX = Math.min(region.minX, x);
            region.maxX = Math.max(region.maxX, x);
            region.minY = Math.min(region.minY, y);
            region.maxY = Math.max(region.maxY, y);
            region.sumX += x;
            region.sumY += y;
        }
    }

    // 轉換為輸出格式
    return Array.from(regions.values()).map(region => ({
        id: region.id,
        pixels: region.pixels,
        bounds: {
            x: region.minX,
            y: region.minY,
            width: region.maxX - region.minX + 1,
            height: region.maxY - region.minY + 1
        },
        centroid: {
            x: region.sumX / region.pixels.length,
            y: region.sumY / region.pixels.length
        },
        area: region.pixels.length
    }));
}

/**
 * 判斷區域是否為音符頭
 * @param {Object} component - 連通區域
 * @param {number} staffSpacing - 五線譜間距
 * @returns {{isNoteHead: boolean, type: string, confidence: number, details: Object}}
 */
export function classifyComponent(component, staffSpacing) {
    const { bounds, area } = component;
    const aspectRatio = bounds.width / bounds.height;

    // 音符頭的預期尺寸（基於五線譜間距）
    const expectedSize = staffSpacing * 0.8;
    const minSize = expectedSize * 0.4;  // 放寬最小尺寸
    const maxSize = expectedSize * 3.0;  // 放寬最大尺寸

    const details = {
        aspectRatio,
        fillRatio: 0,
        circularity: 0,
        ellipticity: 0,
        compactness: 0
    };

    // 檢查尺寸
    if (bounds.width < minSize || bounds.height < minSize) {
        return { isNoteHead: false, type: 'too_small', confidence: 0, details };
    }

    if (bounds.width > maxSize || bounds.height > maxSize) {
        return { isNoteHead: false, type: 'too_large', confidence: 0, details };
    }

    // 音符頭通常是橢圓形，寬高比約 0.6-2.0
    if (aspectRatio < 0.4 || aspectRatio > 2.5) {
        return { isNoteHead: false, type: 'wrong_aspect', confidence: 0, details };
    }

    // 計算填充率（實際像素 / 邊界框面積）
    const boundingArea = bounds.width * bounds.height;
    const fillRatio = area / boundingArea;
    details.fillRatio = fillRatio;

    // 計算圓形度
    const circularity = calculateCircularity(component);
    details.circularity = circularity;

    // 計算橢圓度（音符頭通常是傾斜的橢圓）
    const ellipticity = calculateEllipticity(component);
    details.ellipticity = ellipticity;

    // 計算緊湊度（周長與面積的關係）
    const compactness = calculateCompactness(component);
    details.compactness = compactness;

    // 綜合評分
    let type = 'unknown';
    let confidence = 0;

    // 實心音符頭：高填充率，高緊湊度
    if (fillRatio > 0.55) {
        type = 'filled';
        // 結合多個因子計算信心度
        confidence = (
            fillRatio * 40 +
            circularity * 30 +
            ellipticity * 20 +
            (1 - Math.abs(aspectRatio - 1.2) / 1.2) * 10
        );
    }
    // 空心音符頭：中等填充率，有環形特徵
    else if (fillRatio > 0.25 && fillRatio <= 0.55) {
        type = 'hollow';
        // 空心音符需要檢查環形特徵
        const hasRing = detectRingShape(component);
        if (hasRing) {
            confidence = (
                (1 - fillRatio) * 30 +  // 填充率低一點更好
                circularity * 30 +
                ellipticity * 25 +
                15  // 環形加分
            );
        } else {
            confidence = fillRatio * 80;
        }
    } else {
        return { isNoteHead: false, type: 'too_sparse', confidence: 0, details };
    }

    // 圓形度過低的不是音符頭
    if (circularity < 0.3) {
        return { isNoteHead: false, type: 'not_round', confidence: 0, details };
    }

    // 信心度上限
    confidence = Math.min(confidence, 95);

    return { isNoteHead: true, type, confidence, details };
}

/**
 * 計算區域的圓形度
 * @param {Object} component
 * @returns {number} 0-1, 1 為完美圓形
 */
function calculateCircularity(component) {
    const { bounds, area } = component;

    // 估算周長（簡化：使用邊界框周長的一半）
    const estimatedPerimeter = Math.PI * (bounds.width + bounds.height) / 2;

    // 圓形度 = 4π * 面積 / 周長²
    const circularity = (4 * Math.PI * area) / (estimatedPerimeter * estimatedPerimeter);

    return Math.min(circularity, 1);
}

/**
 * 計算橢圓度（基於主軸和次軸的比例）
 * @param {Object} component
 * @returns {number} 0-1, 橢圓越接近 1
 */
function calculateEllipticity(component) {
    const { bounds, pixels } = component;

    if (!pixels || pixels.length === 0) {
        return 0.5; // 預設值
    }

    // 計算中心
    const cx = component.centroid?.x || (bounds.x + bounds.width / 2);
    const cy = component.centroid?.y || (bounds.y + bounds.height / 2);

    // 計算二階矩（簡化版）
    let sumXX = 0, sumYY = 0, sumXY = 0;
    for (const p of pixels) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        sumXX += dx * dx;
        sumYY += dy * dy;
        sumXY += dx * dy;
    }
    sumXX /= pixels.length;
    sumYY /= pixels.length;
    sumXY /= pixels.length;

    // 計算主軸方向（特徵值）
    const trace = sumXX + sumYY;
    const det = sumXX * sumYY - sumXY * sumXY;
    const lambda1 = trace / 2 + Math.sqrt(trace * trace / 4 - det);
    const lambda2 = trace / 2 - Math.sqrt(trace * trace / 4 - det);

    if (lambda1 <= 0) return 0.5;

    // 橢圓度 = 次軸/主軸
    const ellipticity = Math.sqrt(lambda2 / lambda1);

    // 音符頭的橢圓度通常在 0.5-0.9 之間
    if (ellipticity >= 0.5 && ellipticity <= 0.95) {
        return 1 - Math.abs(ellipticity - 0.7) / 0.4;  // 0.7 附近最佳
    }
    return ellipticity;
}

/**
 * 計算緊湊度
 * @param {Object} component
 * @returns {number} 0-1
 */
function calculateCompactness(component) {
    const { bounds, area } = component;

    // 緊湊度 = 4 * π * A / P²
    // 估算周長
    const perimeter = 2 * (bounds.width + bounds.height);
    const compactness = (4 * Math.PI * area) / (perimeter * perimeter);

    return Math.min(compactness, 1);
}

/**
 * 偵測環形特徵（用於空心音符）
 * @param {Object} component
 * @returns {boolean}
 */
function detectRingShape(component) {
    const { bounds, pixels } = component;

    if (!pixels || pixels.length === 0) return false;

    const cx = component.centroid?.x || (bounds.x + bounds.width / 2);
    const cy = component.centroid?.y || (bounds.y + bounds.height / 2);

    // 計算像素到中心的距離分佈
    const distances = pixels.map(p => {
        const dx = p.x - cx;
        const dy = p.y - cy;
        return Math.sqrt(dx * dx + dy * dy);
    });

    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDist = Math.max(...distances);
    const minDist = Math.min(...distances);

    // 環形特徵：距離分佈相對集中
    const distVariance = distances.reduce((sum, d) => sum + (d - avgDist) ** 2, 0) / distances.length;
    const distStdDev = Math.sqrt(distVariance);
    const cv = distStdDev / avgDist; // 變異係數

    // 環形的 CV 應該較小（像素集中在環上）
    // 並且最小距離不應該太接近 0（否則是實心）
    return cv < 0.4 && minDist > maxDist * 0.3;
}

/**
 * 偵測升降記號
 * @param {Array} components - 所有連通區域
 * @param {Object} noteHead - 音符頭
 * @param {number} staffSpacing
 * @returns {{type: 'sharp'|'flat'|'natural'|null, confidence: number}}
 */
export function detectAccidental(components, noteHead, staffSpacing) {
    // 在音符頭左側尋找升降記號
    const searchLeft = noteHead.centroid.x - staffSpacing * 2.5;
    const searchRight = noteHead.centroid.x - staffSpacing * 0.2;
    const searchTop = noteHead.centroid.y - staffSpacing * 1.5;
    const searchBottom = noteHead.centroid.y + staffSpacing * 1.5;

    const candidates = components.filter(c =>
        c.centroid.x >= searchLeft &&
        c.centroid.x <= searchRight &&
        c.centroid.y >= searchTop &&
        c.centroid.y <= searchBottom &&
        c.id !== noteHead.id
    );

    if (candidates.length === 0) {
        return { type: null, confidence: 0 };
    }

    // 分析每個候選區域
    const results = candidates.map(candidate => analyzeAccidentalCandidate(candidate, staffSpacing));

    // 選擇信心度最高的
    results.sort((a, b) => b.confidence - a.confidence);
    return results[0] || { type: null, confidence: 0 };
}

/**
 * 分析升降記號候選區域
 * @param {Object} candidate - 候選連通區域
 * @param {number} staffSpacing
 * @returns {{type: 'sharp'|'flat'|'natural'|null, confidence: number}}
 */
function analyzeAccidentalCandidate(candidate, staffSpacing) {
    const { bounds, area, pixels } = candidate;
    const aspectRatio = bounds.width / bounds.height;
    const fillRatio = area / (bounds.width * bounds.height);

    // 特徵分析
    const features = {
        aspectRatio,
        fillRatio,
        height: bounds.height / staffSpacing,
        width: bounds.width / staffSpacing,
        hasVerticalLines: false,
        hasHorizontalLines: false,
        hasCurve: false,
        horizontalLineCount: 0,
        verticalLineCount: 0
    };

    // 分析像素分佈（如果有像素資料）
    if (pixels && pixels.length > 0) {
        const lineAnalysis = analyzeLineStructure(pixels, bounds);
        features.hasVerticalLines = lineAnalysis.verticalLines > 0;
        features.hasHorizontalLines = lineAnalysis.horizontalLines > 0;
        features.horizontalLineCount = lineAnalysis.horizontalLines;
        features.verticalLineCount = lineAnalysis.verticalLines;
        features.hasCurve = lineAnalysis.hasCurve;
    }

    // 升記號 (#) 特徵：
    // - 較高（height > 1.5 * spacing）
    // - 寬高比約 0.4-0.8
    // - 有交叉的線條（2 條垂直 + 2 條水平）
    // - 填充率較低（因為是線條構成）
    const sharpScore = calculateSharpScore(features);

    // 降記號 (♭) 特徵：
    // - 高且窄
    // - 上半部是垂直線
    // - 下半部有圓弧
    const flatScore = calculateFlatScore(features);

    // 還原記號 (♮) 特徵：
    // - 類似升記號但更窄
    // - 兩條垂直線錯開
    const naturalScore = calculateNaturalScore(features);

    // 選擇最高分
    if (sharpScore > flatScore && sharpScore > naturalScore && sharpScore > 30) {
        return { type: 'sharp', confidence: sharpScore };
    }
    if (flatScore > sharpScore && flatScore > naturalScore && flatScore > 30) {
        return { type: 'flat', confidence: flatScore };
    }
    if (naturalScore > 30) {
        return { type: 'natural', confidence: naturalScore };
    }

    return { type: null, confidence: 0 };
}

/**
 * 分析線條結構
 */
function analyzeLineStructure(pixels, bounds) {
    const result = {
        verticalLines: 0,
        horizontalLines: 0,
        hasCurve: false
    };

    // 建立像素圖
    const grid = new Map();
    for (const p of pixels) {
        const key = `${p.x},${p.y}`;
        grid.set(key, true);
    }

    // 檢測垂直線（沿 Y 軸連續的像素）
    const verticalRuns = new Map();
    for (const p of pixels) {
        const x = p.x;
        if (!verticalRuns.has(x)) {
            verticalRuns.set(x, []);
        }
        verticalRuns.get(x).push(p.y);
    }

    for (const [, ys] of verticalRuns) {
        ys.sort((a, b) => a - b);
        let maxRun = 1, currentRun = 1;
        for (let i = 1; i < ys.length; i++) {
            if (ys[i] - ys[i - 1] <= 2) {
                currentRun++;
            } else {
                maxRun = Math.max(maxRun, currentRun);
                currentRun = 1;
            }
        }
        maxRun = Math.max(maxRun, currentRun);
        if (maxRun > bounds.height * 0.5) {
            result.verticalLines++;
        }
    }

    // 檢測水平線
    const horizontalRuns = new Map();
    for (const p of pixels) {
        const y = p.y;
        if (!horizontalRuns.has(y)) {
            horizontalRuns.set(y, []);
        }
        horizontalRuns.get(y).push(p.x);
    }

    for (const [, xs] of horizontalRuns) {
        xs.sort((a, b) => a - b);
        let maxRun = 1, currentRun = 1;
        for (let i = 1; i < xs.length; i++) {
            if (xs[i] - xs[i - 1] <= 2) {
                currentRun++;
            } else {
                maxRun = Math.max(maxRun, currentRun);
                currentRun = 1;
            }
        }
        maxRun = Math.max(maxRun, currentRun);
        if (maxRun > bounds.width * 0.4) {
            result.horizontalLines++;
        }
    }

    // 檢測曲線（通過分析像素分佈的變化率）
    const bottomHalf = pixels.filter(p => p.y > bounds.y + bounds.height / 2);
    if (bottomHalf.length > 0) {
        const xCoords = bottomHalf.map(p => p.x);
        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords);
        if (maxX - minX > bounds.width * 0.3) {
            result.hasCurve = true;
        }
    }

    return result;
}

/**
 * 計算升記號分數
 */
function calculateSharpScore(features) {
    let score = 0;

    // 高度特徵
    if (features.height > 1.2 && features.height < 3.0) {
        score += 25;
    }

    // 寬高比
    if (features.aspectRatio > 0.3 && features.aspectRatio < 0.9) {
        score += 20;
    }

    // 填充率（線條構成，較低）
    if (features.fillRatio > 0.15 && features.fillRatio < 0.5) {
        score += 15;
    }

    // 垂直線
    if (features.verticalLineCount >= 2) {
        score += 25;
    } else if (features.verticalLineCount >= 1) {
        score += 10;
    }

    // 水平線
    if (features.horizontalLineCount >= 2) {
        score += 15;
    }

    return Math.min(score, 95);
}

/**
 * 計算降記號分數
 */
function calculateFlatScore(features) {
    let score = 0;

    // 高度特徵（較高）
    if (features.height > 1.5 && features.height < 3.5) {
        score += 25;
    }

    // 寬高比（窄）
    if (features.aspectRatio > 0.3 && features.aspectRatio < 0.7) {
        score += 20;
    }

    // 填充率
    if (features.fillRatio > 0.25 && features.fillRatio < 0.6) {
        score += 15;
    }

    // 垂直線（上半部）
    if (features.verticalLineCount >= 1) {
        score += 15;
    }

    // 曲線（下半部）
    if (features.hasCurve) {
        score += 20;
    }

    return Math.min(score, 95);
}

/**
 * 計算還原記號分數
 */
function calculateNaturalScore(features) {
    let score = 0;

    // 高度特徵
    if (features.height > 1.3 && features.height < 3.0) {
        score += 20;
    }

    // 寬高比（比升記號更窄）
    if (features.aspectRatio > 0.2 && features.aspectRatio < 0.6) {
        score += 20;
    }

    // 填充率
    if (features.fillRatio > 0.1 && features.fillRatio < 0.4) {
        score += 15;
    }

    // 垂直線
    if (features.verticalLineCount >= 2) {
        score += 25;
    }

    // 少量水平線
    if (features.horizontalLineCount >= 1 && features.horizontalLineCount <= 2) {
        score += 15;
    }

    return Math.min(score, 90);
}

/**
 * 從預處理後的圖片偵測所有音符
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {Object} staffGroup - 五線譜組資訊
 * @param {Object} options
 * @returns {Array<{x, y, midi, position, type, accidental, confidence}>}
 */
export function detectNotes(imageData, width, height, staffGroup, options = {}) {
    const { clef = 'treble', startNoteIndex = 0 } = options;
    const { lines, spacing } = staffGroup;

    // 1. 找出所有連通區域
    const components = findConnectedComponents(imageData, width, height);

    // 2. 過濾出可能的音符頭
    const noteHeads = [];

    for (const component of components) {
        const classification = classifyComponent(component, spacing);

        if (classification.isNoteHead) {
            // 計算音高位置
            const pitchInfo = calculatePitchPosition(
                component.centroid.y,
                lines,
                spacing
            );

            // 檢查升降記號
            const accidental = detectAccidental(components, component, spacing);

            // 計算 MIDI 音高
            let midi = positionToMidi(pitchInfo.position, clef);

            // 根據升降記號調整
            if (accidental.type === 'sharp') {
                midi += 1;
            } else if (accidental.type === 'flat') {
                midi -= 1;
            }

            noteHeads.push({
                x: component.centroid.x,
                y: component.centroid.y,
                midi,
                position: pitchInfo.position,
                onLine: pitchInfo.onLine,
                type: classification.type,
                accidental: accidental.type,
                confidence: (classification.confidence + accidental.confidence) / 2 || classification.confidence,
                bounds: component.bounds
            });
        }
    }

    // 3. 按 X 座標排序
    noteHeads.sort((a, b) => a.x - b.x);

    // 4. 合併和弦（同一 X 位置的多個音符）
    const mergedNotes = [];
    let lastX = -Infinity;
    const chordThreshold = spacing * 0.5;

    for (const note of noteHeads) {
        if (note.x - lastX < chordThreshold && mergedNotes.length > 0) {
            // 屬於和弦，加到前一組
            const lastGroup = mergedNotes[mergedNotes.length - 1];
            if (Array.isArray(lastGroup)) {
                lastGroup.push(note);
            } else {
                mergedNotes[mergedNotes.length - 1] = [lastGroup, note];
            }
        } else {
            mergedNotes.push(note);
        }
        lastX = note.x;
    }

    // 5. 展平結果（暫時只取單音）
    return mergedNotes.map(item => {
        if (Array.isArray(item)) {
            // 和弦：取最高音
            return item.sort((a, b) => b.midi - a.midi)[0];
        }
        return item;
    });
}

/**
 * 偵測小節線
 * @param {ImageData} imageData
 * @param {number} width
 * @param {number} height
 * @param {Object} staffGroup
 * @returns {Array<number>} 小節線的 X 座標
 */
export function detectBarlines(imageData, width, height, staffGroup) {
    const data = imageData.data;
    const { top, bottom } = staffGroup;
    const staffHeight = bottom - top;

    const barlines = [];

    // 掃描每一列，尋找貫穿五線譜的垂直線
    for (let x = 0; x < width; x++) {
        let blackCount = 0;

        for (let y = top; y <= bottom; y++) {
            const idx = (y * width + x) * 4;
            if (data[idx] < 128) {
                blackCount++;
            }
        }

        const coverage = blackCount / staffHeight;

        // 小節線應該貫穿整個五線譜
        if (coverage > 0.7) {
            // 避免重複標記相鄰的列
            if (barlines.length === 0 || x - barlines[barlines.length - 1] > 5) {
                barlines.push(x);
            }
        }
    }

    return barlines;
}

export default {
    findConnectedComponents,
    classifyComponent,
    detectAccidental,
    detectNotes,
    detectBarlines
};
