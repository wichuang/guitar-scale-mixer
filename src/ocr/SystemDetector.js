/**
 * SystemDetector.js - Unified System Detection Module
 * Detects all notation systems (staff, tab, staff+tab pairs, jianpu rows) in an image.
 * Returns system boundaries for sequential processing.
 */

import { loadImageToCanvas, grayscale, binarize, adjustContrast, detectHorizontalLines } from './imagePreprocess.js';
import { detectStaffLines } from './staffPreprocess.js';

/**
 * System types
 */
export const SystemType = {
    STAFF: 'staff',           // 5-line staff only
    TAB: 'tab',               // 6-line tab only
    STAFF_TAB: 'staff+tab',   // 5-line staff paired with 6-line tab
    JIANPU: 'jianpu',         // Text-based jianpu row
};

/**
 * SystemDetector class
 */
export class SystemDetector {
    /**
     * Detect all systems in an image
     * @param {File|Blob|string} imageSource
     * @param {Function} onProgress
     * @returns {Promise<{systems: Array, canvas: HTMLCanvasElement, imageData: ImageData, width: number, height: number}>}
     */
    async detectSystems(imageSource, onProgress) {
        onProgress?.('Loading image...', 5);

        // 1. Load and preprocess
        const { canvas, ctx, width, height } = await loadImageToCanvas(imageSource);

        let imageData = ctx.getImageData(0, 0, width, height);
        grayscale(imageData);
        ctx.putImageData(imageData, 0, 0);

        imageData = ctx.getImageData(0, 0, width, height);
        adjustContrast(imageData, 1.3);
        ctx.putImageData(imageData, 0, 0);

        imageData = ctx.getImageData(0, 0, width, height);
        binarize(imageData);
        ctx.putImageData(imageData, 0, 0);

        onProgress?.('Detecting lines...', 20);

        // 2. Detect all horizontal lines
        const allLines = detectStaffLines(imageData, width, height);

        onProgress?.('Classifying line groups...', 40);

        // 3. Find line groups (5-line staff groups and 6-line tab groups)
        const lineGroups = this.classifyLineGroups(allLines);

        onProgress?.('Grouping systems...', 60);

        // 4. Group into systems
        const systems = this.groupSystems(lineGroups, height);

        onProgress?.(`Detected ${systems.length} system(s)`, 80);

        return {
            systems,
            canvas,
            ctx,
            imageData,
            width,
            height,
            allLines,
            lineGroups,
        };
    }

    /**
     * Classify detected lines into staff groups (5-line) and tab groups (6-line)
     * @param {Array} allLines - detected horizontal lines
     * @returns {Array<{type: string, lines: number[], spacing: number, top: number, bottom: number}>}
     */
    classifyLineGroups(allLines) {
        if (allLines.length < 5) return [];

        const sortedLines = [...allLines].sort((a, b) => a.y - b.y);
        const groups = [];
        const usedIndices = new Set();

        // Try to find 6-line groups first (tab), then 5-line groups (staff)
        // This prevents a 6-line tab from being partially matched as a 5-line staff

        // Pass 1: Find 6-line tab groups
        for (let start = 0; start <= sortedLines.length - 6; start++) {
            if (usedIndices.has(start)) continue;

            const candidate = sortedLines.slice(start, start + 6);
            const gaps = [];
            for (let i = 1; i < 6; i++) {
                gaps.push(candidate[i].y - candidate[i - 1].y);
            }

            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
            const stdDev = Math.sqrt(variance);

            if (stdDev < avgGap * 0.2 && avgGap >= 5 && avgGap <= 60) {
                groups.push({
                    type: 'tab-candidate',
                    lines: candidate.map(l => l.y),
                    spacing: avgGap,
                    top: candidate[0].y,
                    bottom: candidate[5].y,
                });
                for (let i = start; i < start + 6; i++) usedIndices.add(i);
                start += 5;
            }
        }

        // Pass 2: Find 5-line staff groups from remaining lines
        for (let start = 0; start <= sortedLines.length - 5; start++) {
            if (usedIndices.has(start)) continue;

            // Check if all 5 consecutive lines are unused
            let allFree = true;
            for (let i = start; i < start + 5; i++) {
                if (usedIndices.has(i)) { allFree = false; break; }
            }
            if (!allFree) continue;

            const candidate = sortedLines.slice(start, start + 5);
            const gaps = [];
            for (let i = 1; i < 5; i++) {
                gaps.push(candidate[i].y - candidate[i - 1].y);
            }

            const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
            const stdDev = Math.sqrt(variance);

            if (stdDev < avgGap * 0.15 && avgGap >= 8 && avgGap <= 60) {
                groups.push({
                    type: 'staff-candidate',
                    lines: candidate.map(l => l.y),
                    spacing: avgGap,
                    top: candidate[0].y,
                    bottom: candidate[4].y,
                });
                for (let i = start; i < start + 5; i++) usedIndices.add(i);
                start += 4;
            }
        }

        // Sort by top position
        groups.sort((a, b) => a.top - b.top);

        return groups;
    }

    /**
     * Group line groups into systems (staff+tab pairs, solo staff, solo tab)
     * @param {Array} lineGroups
     * @param {number} imageHeight
     * @returns {Array<Object>} systems
     */
    groupSystems(lineGroups, imageHeight) {
        const systems = [];
        const usedGroups = new Set();
        let systemIndex = 0;

        for (let i = 0; i < lineGroups.length; i++) {
            if (usedGroups.has(i)) continue;

            const group = lineGroups[i];

            // Check if this staff is paired with a tab below it
            if (group.type === 'staff-candidate') {
                // Look for a tab group immediately below
                let pairedTab = null;
                for (let j = i + 1; j < lineGroups.length; j++) {
                    if (usedGroups.has(j)) continue;
                    const nextGroup = lineGroups[j];
                    if (nextGroup.type === 'tab-candidate') {
                        const gap = nextGroup.top - group.bottom;
                        // Gap should be less than 2x the staff spacing
                        if (gap > 0 && gap < group.spacing * 3) {
                            pairedTab = { index: j, group: nextGroup };
                        }
                    }
                    break; // Only check the immediately following group
                }

                if (pairedTab) {
                    // Staff + Tab pair
                    systems.push({
                        type: SystemType.STAFF_TAB,
                        systemIndex: systemIndex++,
                        topY: group.top,
                        bottomY: pairedTab.group.bottom,
                        staffLines: group.lines,
                        staffSpacing: group.spacing,
                        tabLines: pairedTab.group.lines,
                        tabSpacing: pairedTab.group.spacing,
                    });
                    usedGroups.add(i);
                    usedGroups.add(pairedTab.index);
                } else {
                    // Staff only
                    systems.push({
                        type: SystemType.STAFF,
                        systemIndex: systemIndex++,
                        topY: group.top,
                        bottomY: group.bottom,
                        staffLines: group.lines,
                        staffSpacing: group.spacing,
                    });
                    usedGroups.add(i);
                }
            } else if (group.type === 'tab-candidate') {
                // Tab only (no staff above)
                systems.push({
                    type: SystemType.TAB,
                    systemIndex: systemIndex++,
                    topY: group.top,
                    bottomY: group.bottom,
                    tabLines: group.lines,
                    tabSpacing: group.spacing,
                });
                usedGroups.add(i);
            }
        }

        // Add margins above/below each system for chord symbols and technique marks
        for (let i = 0; i < systems.length; i++) {
            const sys = systems[i];
            const spacing = sys.staffSpacing || sys.tabSpacing || 15;

            // Region above (for chord symbols)
            const prevBottom = i > 0 ? systems[i - 1].bottomY : 0;
            sys.chordRegionTop = Math.max(prevBottom, sys.topY - spacing * 3);
            sys.chordRegionBottom = sys.topY;

            // Region below (for technique marks, only for staff+tab gap)
            if (sys.type === SystemType.STAFF_TAB) {
                sys.techniqueRegionTop = sys.staffLines[sys.staffLines.length - 1];
                sys.techniqueRegionBottom = sys.tabLines[0];
            }
        }

        return systems;
    }

    /**
     * Crop a system region from the canvas
     * @param {HTMLCanvasElement} canvas
     * @param {Object} system
     * @param {number} margin - extra margin in pixels
     * @returns {HTMLCanvasElement}
     */
    cropSystem(canvas, system, margin = 10) {
        const topY = Math.max(0, system.topY - margin);
        const bottomY = Math.min(canvas.height, system.bottomY + margin);
        const cropHeight = bottomY - topY;

        const cropped = document.createElement('canvas');
        cropped.width = canvas.width;
        cropped.height = cropHeight;
        const ctx = cropped.getContext('2d');
        ctx.drawImage(canvas, 0, topY, canvas.width, cropHeight, 0, 0, canvas.width, cropHeight);

        return cropped;
    }

    /**
     * Detect jianpu text rows (for images without staff/tab lines)
     * Uses horizontal black-pixel density to find rows of text
     * @param {ImageData} imageData
     * @param {number} width
     * @param {number} height
     * @returns {Array<{topY: number, bottomY: number, systemIndex: number}>}
     */
    detectJianpuRows(imageData, width, height) {
        const data = imageData.data;
        const rowDensity = [];

        // Calculate row-by-row black pixel density
        for (let y = 0; y < height; y++) {
            let blackCount = 0;
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx] < 128) blackCount++;
            }
            rowDensity.push(blackCount / width);
        }

        // Find rows with significant content (density > threshold)
        const threshold = 0.02;
        const textRegions = [];
        let inRegion = false;
        let regionStart = 0;

        for (let y = 0; y < height; y++) {
            if (rowDensity[y] > threshold && !inRegion) {
                inRegion = true;
                regionStart = y;
            } else if (rowDensity[y] <= threshold && inRegion) {
                inRegion = false;
                const regionHeight = y - regionStart;
                if (regionHeight > 10) { // Ignore very thin regions (noise)
                    textRegions.push({ topY: regionStart, bottomY: y });
                }
            }
        }
        if (inRegion) {
            textRegions.push({ topY: regionStart, bottomY: height });
        }

        // Merge close regions (gap < 15px)
        const mergedRegions = [];
        for (const region of textRegions) {
            if (mergedRegions.length > 0) {
                const last = mergedRegions[mergedRegions.length - 1];
                if (region.topY - last.bottomY < 15) {
                    last.bottomY = region.bottomY;
                    continue;
                }
            }
            mergedRegions.push({ ...region });
        }

        // Convert to system format
        return mergedRegions.map((region, idx) => ({
            type: SystemType.JIANPU,
            systemIndex: idx,
            topY: region.topY,
            bottomY: region.bottomY,
        }));
    }
}

/**
 * Create SystemDetector instance
 */
export function createSystemDetector() {
    return new SystemDetector();
}

export default SystemDetector;
