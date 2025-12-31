// Music Theory Data for Guitar Scale Mixer

// All 12 chromatic notes
export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Note colors for visual distinction
export const NOTE_COLORS = {
    'C': '#e57373', 'C#': '#f06292', 'D': '#00897b', 'D#': '#4db6ac',
    'E': '#ffb74d', 'F': '#ba68c8', 'F#': '#9575cd', 'G': '#616161',
    'G#': '#90a4ae', 'A': '#ffffff', 'A#': '#a1887f', 'B': '#1976d2'
};

// Scale intervals (semitones from root) - Music Theory Correct!
export const SCALES = {
    // Major Modes
    'major': { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'], intervalNames: ['1P', '2M', '3M', '4P', '5P', '6M', '7M'] },
    'dorian': { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10], degrees: ['I', 'II', 'bIII', 'IV', 'V', 'VI', 'bVII'], intervalNames: ['1P', '2M', '3m', '4P', '5P', '6M', '7m'] },
    'phrygian': { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10], degrees: ['I', 'bII', 'bIII', 'IV', 'V', 'bVI', 'bVII'], intervalNames: ['1P', '2m', '3m', '4P', '5P', '6m', '7m'] },
    'lydian': { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11], degrees: ['I', 'II', 'III', '#IV', 'V', 'VI', 'VII'], intervalNames: ['1P', '2M', '3M', '4A', '5P', '6M', '7M'] },
    'mixolydian': { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], degrees: ['I', 'II', 'III', 'IV', 'V', 'VI', 'bVII'], intervalNames: ['1P', '2M', '3M', '4P', '5P', '6M', '7m'] },
    'aeolian': { name: 'Natural Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'bVII'], intervalNames: ['1P', '2M', '3m', '4P', '5P', '6m', '7m'] },
    'locrian': { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10], degrees: ['I', 'bII', 'bIII', 'IV', 'bV', 'bVI', 'bVII'], intervalNames: ['1P', '2m', '3m', '4P', '5d', '6m', '7m'] },

    // Minor Variants
    'harmonic-minor': { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11], degrees: ['I', 'II', 'bIII', 'IV', 'V', 'bVI', 'VII'], intervalNames: ['1P', '2M', '3m', '4P', '5P', '6m', '7M'] },
    'melodic-minor': { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11], degrees: ['I', 'II', 'bIII', 'IV', 'V', 'VI', 'VII'], intervalNames: ['1P', '2M', '3m', '4P', '5P', '6M', '7M'] },

    // Pentatonic & Blues
    'major-pentatonic': { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9], degrees: ['I', 'II', 'III', 'V', 'VI'], intervalNames: ['1P', '2M', '3M', '5P', '6M'] },
    'minor-pentatonic': { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10], degrees: ['I', 'bIII', 'IV', 'V', 'bVII'], intervalNames: ['1P', '3m', '4P', '5P', '7m'] },
    'blues': { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], degrees: ['I', 'bIII', 'IV', 'b5', 'V', 'bVII'], intervalNames: ['1P', '3m', '4P', '5d', '5P', '7m'] },

    // Symmetric Scales
    'whole-tone': { name: 'Whole Tone', intervals: [0, 2, 4, 6, 8, 10], degrees: ['I', 'II', 'III', '#IV', '#V', '#VI'], intervalNames: ['1P', '2M', '3M', '4A', '5A', '6A'] },
    'diminished-hw': { name: 'Diminished (Half-Whole)', intervals: [0, 1, 3, 4, 6, 7, 9, 10], degrees: ['I', 'bII', 'bIII', 'III', 'b5', 'V', 'VI', 'bVII'], intervalNames: ['1P', '2m', '3m', '3M', '5d', '5P', '6M', '7m'] },
    'diminished-wh': { name: 'Diminished (Whole-Half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11], degrees: ['I', 'II', 'bIII', 'IV', 'b5', 'bVI', 'VI', 'VII'], intervalNames: ['1P', '2M', '3m', '4P', '5d', '6m', '6M', '7M'] },
    'chromatic': { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], degrees: ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'b5', 'V', 'bVI', 'VI', 'bVII', 'VII'], intervalNames: ['1P', '2m', '2M', '3m', '3M', '4P', '5d', '5P', '6m', '6M', '7m', '7M'] },

    // Exotic / World Scales
    'phrygian-dominant': { name: 'Phrygian Dominant', intervals: [0, 1, 4, 5, 7, 8, 10], degrees: ['I', 'bII', 'III', 'IV', 'V', 'bVI', 'bVII'], intervalNames: ['1P', '2m', '3M', '4P', '5P', '6m', '7m'] },
    'hungarian-minor': { name: 'Hungarian Minor', intervals: [0, 2, 3, 6, 7, 8, 11], degrees: ['I', 'II', 'bIII', '#IV', 'V', 'bVI', 'VII'], intervalNames: ['1P', '2M', '3m', '4A', '5P', '6m', '7M'] },
    'japanese': { name: 'Japanese (In Sen)', intervals: [0, 1, 5, 7, 8], degrees: ['I', 'bII', 'IV', 'V', 'bVI'], intervalNames: ['1P', '2m', '4P', '5P', '6m'] },
    'arabic': { name: 'Arabic (Double Harmonic)', intervals: [0, 1, 4, 5, 7, 8, 11], degrees: ['I', 'bII', 'III', 'IV', 'V', 'bVI', 'VII'], intervalNames: ['1P', '2m', '3M', '4P', '5P', '6m', '7M'] }
};

// Standard guitar tuning - MIDI note numbers (High E to Low E)
// E4=64, B3=59, G3=55, D3=50, A2=45, E2=40
export const STRING_TUNINGS = [64, 59, 55, 50, 45, 40];
export const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];
export const NUM_FRETS = 22;

// Helper functions
export function getNoteIndex(noteName) {
    return NOTES.indexOf(noteName);
}

export function getNoteName(index) {
    return NOTES[((index % 12) + 12) % 12];
}

export function getScaleNotes(root, scaleType) {
    const rootIndex = getNoteIndex(root);
    const scale = SCALES[scaleType];
    if (!scale) return [];

    return scale.intervals.map(interval => getNoteName(rootIndex + interval));
}

export function isNoteInScale(noteName, scaleNotes) {
    return scaleNotes.includes(noteName);
}

export function getNoteColor(noteName) {
    return NOTE_COLORS[noteName] || '#666';
}

export function getNoteTextColor(noteName) {
    return ['A', 'E', 'C', 'D#', 'F#'].includes(noteName) ? '#000' : '#fff';
}
