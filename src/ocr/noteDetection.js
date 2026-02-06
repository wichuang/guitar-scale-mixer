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
 * @returns {{isNoteHead: boolean, type: string, confidence: number}}
 */
export function classifyComponent(component, staffSpacing) {
    const { bounds, area } = component;
    const aspectRatio = bounds.width / bounds.height;

    // 音符頭的預期尺寸（基於五線譜間距）
    const expectedSize = staffSpacing * 0.8;
    const minSize = expectedSize * 0.5;
    const maxSize = expectedSize * 2.5;

    // 檢查尺寸
    if (bounds.width < minSize || bounds.height < minSize) {
        return { isNoteHead: false, type: 'too_small', confidence: 0 };
    }

    if (bounds.width > maxSize || bounds.height > maxSize) {
        return { isNoteHead: false, type: 'too_large', confidence: 0 };
    }

    // 音符頭通常是橢圓形，寬高比約 1.0-1.8
    if (aspectRatio < 0.5 || aspectRatio > 2.5) {
        return { isNoteHead: false, type: 'wrong_aspect', confidence: 0 };
    }

    // 計算填充率（實際像素 / 邊界框面積）
    const boundingArea = bounds.width * bounds.height;
    const fillRatio = area / boundingArea;

    // 實心音符頭填充率高，空心音符頭填充率較低
    let type = 'unknown';
    let confidence = 0;

    if (fillRatio > 0.6) {
        type = 'filled'; // 四分音符或更短
        confidence = Math.min(fillRatio * 100, 95);
    } else if (fillRatio > 0.3) {
        type = 'hollow'; // 二分音符或全音符
        confidence = fillRatio * 150;
    } else {
        return { isNoteHead: false, type: 'too_sparse', confidence: 0 };
    }

    // 額外檢查：圓形度
    const circularity = calculateCircularity(component);
    if (circularity < 0.4) {
        return { isNoteHead: false, type: 'not_round', confidence: 0 };
    }

    confidence = confidence * circularity;

    return { isNoteHead: true, type, confidence };
}

/**
 * 計算區域的圓形度
 * @param {Object} component
 * @returns {number} 0-1, 1 為完美圓形
 */
function calculateCircularity(component) {
    const { bounds, area } = component;

    // 使用等效圓的方式計算
    const radius = Math.sqrt(area / Math.PI);
    const expectedPerimeter = 2 * Math.PI * radius;

    // 估算周長（簡化：使用邊界框周長的一半）
    const estimatedPerimeter = Math.PI * (bounds.width + bounds.height) / 2;

    // 圓形度 = 4π * 面積 / 周長²
    const circularity = (4 * Math.PI * area) / (estimatedPerimeter * estimatedPerimeter);

    return Math.min(circularity, 1);
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
    const searchLeft = noteHead.centroid.x - staffSpacing * 2;
    const searchRight = noteHead.centroid.x - staffSpacing * 0.3;
    const searchTop = noteHead.centroid.y - staffSpacing;
    const searchBottom = noteHead.centroid.y + staffSpacing;

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

    // 簡單分類（基於形狀特徵）
    for (const candidate of candidates) {
        const aspectRatio = candidate.bounds.width / candidate.bounds.height;

        // 升記號 (#)：較高，寬高比 < 1
        if (aspectRatio < 0.8 && candidate.bounds.height > staffSpacing) {
            return { type: 'sharp', confidence: 60 };
        }

        // 降記號 (b)：高且窄
        if (aspectRatio < 0.6 && candidate.bounds.height > staffSpacing * 1.2) {
            return { type: 'flat', confidence: 60 };
        }
    }

    return { type: null, confidence: 0 };
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
    const { clef = 'treble' } = options;
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
    const { lines, top, bottom } = staffGroup;
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
