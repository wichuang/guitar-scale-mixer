import { getNoteIndex, getNoteName } from './scaleData';

export const CHORD_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHORD_EXTENSIONS = [3, 6, 7, 9, 11, 13];
export const CHORD_QUALITIES = ['Major', 'Minor', 'Dominant', 'Aug', 'Dim', 'HalfDim', 'Sus2', 'Sus4'];

// Detailed formulas in semitones from root
// For each quality, define the triad, and how to add 7, 9, 11, 13
const FORMULAS = {
    'Major': { triad: [0, 4, 7], 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 }, // Maj6, Maj7, Maj9, etc.
    'Minor': { triad: [0, 3, 7], 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 }, // m6, m7, m9, etc.
    'Dominant': { triad: [0, 4, 7], 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 }, // 6, 7, 9, 11, 13
    'Aug': { triad: [0, 4, 8], 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 }, // Aug6, Aug7 (7#5)
    'Dim': { triad: [0, 3, 6], 6: 9, 7: 9, 9: 14, 11: 17, 13: 21 }, // Dim triad, Dim7 (bb7)
    'HalfDim': { triad: [0, 3, 6], 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 }, // m6b5, m7b5
    'Sus2': { triad: [0, 2, 7], 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 }, // 6sus2, 7sus2
    'Sus4': { triad: [0, 5, 7], 6: 9, 7: 10, 9: 14, 11: 17, 13: 21 } // 6sus4, 7sus4
};

export function getChordIntervals(quality = 'Major', extensionLevel = 3) {
    const formula = FORMULAS[quality];
    if (!formula) return [];

    const intervals = [...formula.triad];

    // Add extensions based on level
    if (extensionLevel == 6) {
        intervals.push(formula[6]);
    } else {
        if (extensionLevel >= 7) intervals.push(formula[7]);
        if (extensionLevel >= 9) intervals.push(formula[9]);
        if (extensionLevel >= 11) intervals.push(formula[11]);
        if (extensionLevel >= 13) intervals.push(formula[13]);
    }

    // Normalize to 1 octave (0-11) by modulo and remove duplicates
    const normalized = [...new Set(intervals.map(i => i % 12))];
    return normalized.sort((a, b) => a - b);
}

export function getChordNotes(root, quality, extensionLevel) {
    const rootIndex = getNoteIndex(root);
    if (rootIndex === -1) return [];

    const intervals = getChordIntervals(quality, Number(extensionLevel));
    return intervals.map(interval => getNoteName(rootIndex + interval));
}
