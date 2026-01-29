/**
 * 3NPS (Three Notes Per String) 位置計算器
 * Refactored to support Scale Patterns and Start String selection
 */

import { STRING_TUNINGS, SCALES, getNoteIndex } from '../data/scaleData';
// KEY_OFFSETS import removed as we use getNoteIndex logic in getRootMidi
// Actually KEY_OFFSETS is in jianpuParser.js but not exported?
// Wait, check jianpuParser.js. It IS NOT exported?
// I added imports in View File step 997. It was LOCAL const.
// I'll need to duplicate KEY_OFFSETS or export it.
// Simpler to duplicate or use getNoteIndex arithmetic.

// Helper to get MIDI root from Key Name
function getRootMidi(keyName, openMidi) {
    const keyIndex = getNoteIndex(keyName); // 0-11
    // OpenMidi e.g. 40 (E). E is index 4.
    const openIndex = (openMidi % 12); // 40%12 = 4 (E)

    let diff = keyIndex - openIndex;
    if (diff < 0) diff += 12;

    // Root is on fret 'diff'. 
    // e.g. Key A (9), Open E (4). diff = 5. Fret 5.
    return openMidi + diff;
}

// Map ReadMode scale types to scaleData keys
const SCALE_TYPE_MAP = {
    'Major': 'major',
    'Minor': 'aeolian', // Map Minor to Natural Minor (Aeolian)
    'HarmonicMinor': 'harmonic-minor',
    'MelodicMinor': 'melodic-minor'
};

/**
 * Generate ideal 3NPS positions for the scale
 */
function generate3NPSMap(startStringIdx, key, scaleType) {
    const map = [];
    const mappedType = SCALE_TYPE_MAP[scaleType] || scaleType.toLowerCase();
    const scale = SCALES[mappedType] || SCALES['major']; // Fallback to major, not 'Major'
    const intervals = scale.intervals; // [0, 2, 4...]

    // 1. Determine Root Note on Start String
    // Low E = 40. StartStringIdx=5 (LowE).
    const openMidi = STRING_TUNINGS[startStringIdx];
    let currentMidiVal = getRootMidi(key, openMidi);

    // Ensure we are inside 0-15 fret range if possible.
    // If calculated root is very high (e.g. >15), maybe drop octave?
    // Usually Root is found at 0-11. (diff is 0-11). So it's safe.

    // 2. Distribute 3 notes per string
    let scaleDegreeIndex = 0; // 0 = Root

    // Iterate from Start String UP to String 1 (Index 0)
    for (let s = startStringIdx; s >= 0; s--) {
        const stringOpenMidi = STRING_TUNINGS[s];

        for (let n = 0; n < 3; n++) {
            // currentMidiVal corresponds to current scaleDegreeIndex
            // Calculate actual midi value
            // We derive it from Root? 
            // Formula: RootMidi + ScaleInterval(degree) + Octave(degree/7)*12
            const loopDegree = scaleDegreeIndex % 7;
            const octaves = Math.floor(scaleDegreeIndex / 7);
            const inte = intervals[loopDegree];

            // Base Root Midi is starting point.
            // But wait, the "currentMidiVal" initial calculation was just the Root.
            // We need valid midi for this degree.
            // Let's rely on Relative calculation from the VERY FIRST note (Root).

            // Root Note (Midi)
            const rootMidi = getRootMidi(key, STRING_TUNINGS[startStringIdx]);

            const targetMidi = rootMidi + inte + (octaves * 12);

            // Calculate Fret
            const fret = targetMidi - stringOpenMidi;

            if (fret >= 0 && fret <= 24) { // Allow up to 24
                map.push({
                    string: s,
                    fret: fret,
                    midi: targetMidi,
                    isMap: true
                });
            }

            scaleDegreeIndex++;
        }
    }

    // 3. Handle Lower extensions? 
    // If melody goes below Root.
    // We can generate backwards on Start String? Or lower strings?
    // If Start String is 5 (Low E), there are no lower strings.
    // We can put lower notes on same string (extended)?
    // For now, Strict 3NPS usually implies "ascending pattern".
    // I will stick to mapping strictly 3 notes/string upwards.
    // Fallback logic handles the rest.

    return map;
}

export function calculate3NPSPositions(notes, startStringIdx = 5, key = 'C', scaleType = 'Major') {
    if (!notes || notes.length === 0) return [];

    // Generate Static Map
    const map = generate3NPSMap(startStringIdx, key, scaleType);

    // Find Root Fret to keep "center of gravity"
    const rootEntry = map[0]; // First note is Root
    const targetCenterFret = rootEntry ? rootEntry.fret + 2 : 5; // Approx center

    return notes.map((note) => {
        if (!note || note.isSeparator) return null;
        if (!note.midiNote) return null;

        // 1. Try exact match in Map
        const match = map.find(m => m.midi === note.midiNote);
        if (match) {
            return { string: match.string, fret: match.fret };
        }

        // 2. Fallback: Find any position closest to Center Fret
        // Using existing logic concept
        let bestPos = null;
        let minDist = 999;

        for (let s = 0; s < 6; s++) {
            const f = note.midiNote - STRING_TUNINGS[s];
            if (f >= 0 && f <= 22) {
                const dist = Math.abs(f - targetCenterFret);
                // Tie-breaker: prefer startString or adjacent?
                // Prefer strings closer to startStringIdx?
                // weight the distance slightly for string difference?

                if (dist < minDist) {
                    minDist = dist;
                    bestPos = { string: s, fret: f };
                }
            }
        }

        return bestPos;
    });
}

// Keep export for info, maybe updated?
export function get3NPSInfo(positions) {
    if (!positions || positions.length === 0) return { description: '3NPS' };
    const valid = positions.filter(p => p !== null);
    if (valid.length === 0) return { description: '3NPS' };

    const frets = valid.map(p => p.fret);
    const min = Math.min(...frets);
    const max = Math.max(...frets);
    return { minFret: min, maxFret: max, description: `3NPS (格 ${min}-${max})` };
}
