/**
 * SystemDetector.js - Unified System Detection Module
 * Detects all notation systems (staff, tab, staff+tab pairs, jianpu rows) in an image.
 * Returns system boundaries for sequential processing.
 */

import { loadImageToCanvas, grayscale, binarize, adjustContrast, detectHorizontalLines, isDarkImage, invertColors } from './imagePreprocess.js';

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

        // Check if binarization inverted the image (dark background)
        // If so, invert it back so lines are black on white
        imageData = ctx.getImageData(0, 0, width, height);
        if (isDarkImage(imageData)) {
            // console.log('[SystemDetector] Image is dark after binarization, inverting...');
            invertColors(imageData);
            ctx.putImageData(imageData, 0, 0);
        }

        onProgress?.('Detecting lines...', 20);

        // 2. Detect all horizontal lines
        // Use low threshold 0.15 for consecutive check (tab lines are interrupted by fret numbers)
        // detectHorizontalLines also uses totalRatio > 0.4 as secondary detection
        const allLines = detectHorizontalLines(imageData, width, height, 0.15);

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
     * Classify detected lines into staff groups (5-line) and tab groups (6-line).
     * Uses a cluster-based grid-fitting approach that tolerates missing lines
     * (common in real scanned/photographed sheet music).
     * @param {Array} allLines - detected horizontal lines
     * @returns {Array<{type: string, lines: number[], spacing: number, top: number, bottom: number}>}
     */
    classifyLineGroups(allLines) {
        if (allLines.length < 3) return [];

        const sortedLines = [...allLines].sort((a, b) => a.y - b.y);

        // Step 1: Cluster nearby lines (gap < 30px between consecutive lines)
        // 30px separates staff groups (~6px spacing) and tab groups (~9px spacing)
        // from the staff-tab gap (~35-45px) and inter-system gaps (~80px)
        const clusters = [];
        let currentCluster = [sortedLines[0]];
        for (let i = 1; i < sortedLines.length; i++) {
            if (sortedLines[i].y - currentCluster[currentCluster.length - 1].y < 30) {
                currentCluster.push(sortedLines[i]);
            } else {
                if (currentCluster.length >= 3) clusters.push(currentCluster);
                currentCluster = [sortedLines[i]];
            }
        }
        if (currentCluster.length >= 3) clusters.push(currentCluster);

        // Step 2: For each cluster, try to fit regular grids (5-line staff or 6-line tab)
        const groups = [];
        for (const cluster of clusters) {
            const fit = this.fitGridToCluster(cluster);
            if (fit) groups.push(fit);
        }

        // Sort by top position
        groups.sort((a, b) => a.top - b.top);
        return groups;
    }

    /**
     * Try to fit a regular 5-line or 6-line grid to a cluster of detected lines.
     * Handles missing lines by finding the fundamental spacing from pairwise gaps.
     * @param {Array} cluster - array of line objects {y, strength}
     * @returns {Object|null} matched group or null
     */
    fitGridToCluster(cluster) {
        const ys = cluster.map(l => l.y);
        const totalSpan = ys[ys.length - 1] - ys[0];

        // Compute all consecutive gaps
        const gaps = [];
        for (let i = 1; i < ys.length; i++) {
            gaps.push(ys[i] - ys[i - 1]);
        }

        // Find the fundamental spacing: the smallest frequent gap
        // In real images, some lines are missed, so gaps can be 1x, 2x, 3x the real spacing
        // Use GCD-like approach: find the smallest gap that divides most other gaps
        const candidateSpacings = this.findCandidateSpacings(gaps);

        let bestResult = null;
        let bestScore = -Infinity;

        for (const spacing of candidateSpacings) {
            if (spacing < 4 || spacing > 60) continue;

            // Try both 5-line (staff) and 6-line (tab) grids
            for (const numLines of [6, 5]) {
                const expectedSpan = spacing * (numLines - 1);

                // Try each detected line as a potential starting line (any of the numLines positions)
                for (let startLineIdx = 0; startLineIdx < numLines; startLineIdx++) {
                    for (const anchor of ys) {
                        const gridStart = anchor - startLineIdx * spacing;
                        const expectedYs = Array.from({ length: numLines }, (_, i) => gridStart + i * spacing);

                        // Count matches: each expected Y must be close to a detected line
                        let matched = 0;
                        const matchedYs = [];
                        for (const ey of expectedYs) {
                            const closest = ys.find(y => Math.abs(y - ey) <= Math.max(2, spacing * 0.15));
                            if (closest !== undefined) {
                                matched++;
                                matchedYs.push(closest);
                            } else {
                                matchedYs.push(Math.round(ey)); // infer missing line position
                            }
                        }

                        // Require at least 60% of expected lines detected
                        const matchRatio = matched / numLines;
                        if (matchRatio < 0.6) continue;

                        // Score: prioritize match ratio, with spacing-based bias
                        // Staff lines typically have 5-8px spacing, tab lines 8-15px
                        let spacingBias = 0;
                        if (numLines === 5 && spacing <= 8) spacingBias = 50;      // staff likely
                        else if (numLines === 5 && spacing > 8) spacingBias = -100; // staff unlikely with wide spacing
                        else if (numLines === 6 && spacing >= 7) spacingBias = 50;  // tab likely
                        else if (numLines === 6 && spacing < 7) spacingBias = -100; // tab unlikely with narrow spacing

                        const score = matchRatio * 1000 + matched * 10 + spacingBias;

                        if (score > bestScore) {
                            bestScore = score;
                            bestResult = {
                                type: numLines === 6 ? 'tab-candidate' : 'staff-candidate',
                                lines: matchedYs,
                                spacing,
                                top: matchedYs[0],
                                bottom: matchedYs[matchedYs.length - 1],
                                matchRatio,
                            };
                        }
                    }
                }
            }
        }

        return bestResult;
    }

    /**
     * Find candidate spacings from a set of gaps.
     * Looks for the fundamental spacing that explains most gaps as integer multiples.
     * @param {number[]} gaps
     * @returns {number[]} candidate spacings sorted by likelihood
     */
    findCandidateSpacings(gaps) {
        if (gaps.length === 0) return [];

        const candidates = new Map(); // spacing -> count of gaps it explains

        // Try each gap and its divisors as candidate spacings
        for (const gap of gaps) {
            // gap itself is a candidate
            for (let divisor = 1; divisor <= 4; divisor++) {
                const spacing = Math.round(gap / divisor);
                if (spacing < 4) continue;

                // Count how many gaps this spacing explains (within tolerance)
                let explains = 0;
                for (const g of gaps) {
                    const ratio = g / spacing;
                    const roundedRatio = Math.round(ratio);
                    if (roundedRatio >= 1 && roundedRatio <= 6 &&
                        Math.abs(ratio - roundedRatio) < 0.25) {
                        explains++;
                    }
                }

                const existing = candidates.get(spacing) || 0;
                candidates.set(spacing, Math.max(existing, explains));
            }
        }

        // Sort by how many gaps each spacing explains (descending)
        return [...candidates.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([spacing]) => spacing);
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
                        // Gap between staff and tab is typically 30-60px
                        // Use the larger of the two spacings * 8 as threshold, with minimum 60px
                        const maxGap = Math.max(60, Math.max(group.spacing, nextGroup.spacing) * 8);
                        if (gap > 0 && gap < maxGap) {
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
        const ctx = cropped.getContext('2d', { willReadFrequently: true });
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
