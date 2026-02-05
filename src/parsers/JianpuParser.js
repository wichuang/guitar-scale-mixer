/**
 * JianpuParser - 簡譜解析器
 * 實作 ParserInterface，提供簡譜的解析與轉換功能
 *
 * 簡譜使用數字 1-7 表示音符，對應 Do Re Mi Fa Sol La Si
 */

import { ParserInterface } from '../core/interfaces/ParserInterface.js';
import { Note } from '../core/models/Note.js';
import { NOTES, STRING_TUNINGS, SCALES } from '../data/scaleData.js';

// Map UI Scale Types to SCALES keys
export const SCALE_MAPPING = {
    'Major': 'major',
    'Minor': 'aeolian',
    'HarmonicMinor': 'harmonic-minor',
    'MelodicMinor': 'melodic-minor',
    'Dorian': 'dorian',
    'Phrygian': 'phrygian',
    'Lydian': 'lydian',
    'Mixolydian': 'mixolydian',
    'Locrian': 'locrian'
};

/**
 * 根音偏移量 (半音)
 */
export const KEY_OFFSETS = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11,
};

/**
 * JianpuParser 類別
 * @extends ParserInterface
 */
export class JianpuParser extends ParserInterface {
    get name() {
        return 'JianpuParser';
    }

    get description() {
        return '簡譜 (Jianpu) 解析器 - 數字記譜法';
    }

    /**
     * 解析簡譜文字
     * @param {string} text
     * @param {Object} options
     * @returns {Array<Note>}
     */
    parse(text, options = {}) {
        return parseJianpuText(
            text,
            options.key || 'C',
            options.scaleType || 'Major',
            options.octaveOffset || 0
        );
    }

    /**
     * 將音符陣列轉換為簡譜文字
     * @param {Array} notes
     * @returns {string}
     */
    stringify(notes) {
        return notesToJianpuString(notes);
    }

    /**
     * 清理 OCR 識別結果
     * @param {string} text
     * @returns {string}
     */
    clean(text) {
        return cleanJianpuText(text);
    }

    /**
     * 驗證簡譜格式
     * @param {string} text
     * @returns {boolean}
     */
    validate(text) {
        const cleaned = cleanJianpuText(text);
        // Check if there are valid jianpu digits
        return /[0-7]/.test(cleaned);
    }
}

// ============================================
// 向後相容的獨立函數（保留原有 API）
// ============================================

/**
 * 將簡譜數字轉換為音符名稱
 * @param {string|number} jianpuNum - 簡譜數字 (1-7)
 * @param {number} octaveOffset - 八度偏移 (-1=低八度, 0=中央, 1=高八度)
 * @param {string} key - 調號 (預設 'C')
 * @param {string} scaleType - 音階類型 (預設 'Major')
 * @returns {object|null} - { noteName, octave, midiNote }
 */
export function jianpuToNote(jianpuNum, octaveOffset = 0, key = 'C', scaleType = 'Major') {
    const str = String(jianpuNum);
    let accidental = 0;
    if (str.includes('#') || str.includes('♯')) accidental = 1;
    if (str.includes('b') || str.includes('♭')) accidental = -1;

    const cleanNum = parseInt(str.replace(/[#b♯♭]/g, ''));
    if (isNaN(cleanNum) || cleanNum < 1 || cleanNum > 7) {
        return null;
    }

    const mappedType = SCALE_MAPPING[scaleType] || 'major';
    const scale = SCALES[mappedType] || SCALES['major'];
    const intervals = scale.intervals;
    const baseSemitone = intervals[cleanNum - 1]; // 0-based index
    const keyOffset = KEY_OFFSETS[key] || 0;
    const totalSemitone = baseSemitone + keyOffset + accidental;

    // 中央 C = C4 = MIDI 60
    const baseOctave = 4 + octaveOffset;
    const midiNote = 60 + totalSemitone + (octaveOffset * 12);

    // Calculate Note Name safely
    const noteName = NOTES[(totalSemitone % 12 + 12) % 12];

    return {
        noteName,
        octave: baseOctave,
        midiNote,
        jianpu: cleanNum,
        accidentalStr: accidental === 1 ? '#' : (accidental === -1 ? 'b' : '')
    };
}

/**
 * 清理 OCR 識別結果，只保留簡譜相關字符
 */
export function cleanJianpuText(text) {
    let cleaned = text
        .replace(/[a-ac-zA-Z]+/g, '')
        .replace(/[\u4e00-\u9fff]+/g, '')
        .replace(/[，。！？、；：""''（）【】《》]/g, '')
        .replace(/[,!?;:"'()[\]<>{}]/g, '')
        .replace(/[89]/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    cleaned = cleaned.replace(/[^0-7\s.·_̣\-|#b♯♭()[\]{}:=>]/g, '');
    return cleaned;
}

/**
 * 解析 OCR 識別的簡譜文字
 */
export function parseJianpuText(text, key = 'C', scaleType = 'Major', globalOctaveOffset = 0) {
    const notes = [];
    const cleaned = cleanJianpuText(text);
    const chars = cleaned.split('');
    let i = 0;

    while (i < chars.length) {
        const char = chars[i];

        if (char >= '1' && char <= '7') {
            let octaveOffset = 0;
            let displayStr = char;

            if (i > 0) {
                const prevChar = chars[i - 1];
                if (prevChar === '_' || prevChar === '̣') {
                    octaveOffset = -1;
                    displayStr = '₋' + char;
                }
                if (i > 1 && chars[i - 2] === '_' && prevChar === '_') {
                    octaveOffset = -2;
                    displayStr = '₌' + char;
                }
            }

            if (i + 1 < chars.length) {
                const nextChar = chars[i + 1];
                if (nextChar === '.' || nextChar === '·') {
                    octaveOffset = 1;
                    displayStr = char + '·';
                    i++;
                    if (i + 1 < chars.length && (chars[i + 1] === '.' || chars[i + 1] === '·')) {
                        octaveOffset = 2;
                        displayStr = char + '··';
                        i++;
                    }
                }
            }

            if (i + 1 < chars.length) {
                const charNext = chars[i + 1];
                if (['#', 'b', '♯', '♭'].includes(charNext)) {
                    const normalized = (charNext === '♯') ? '#' : ((charNext === '♭') ? 'b' : charNext);
                    displayStr += normalized;
                    i++;
                }
            }

            const finalOctaveOffset = octaveOffset + globalOctaveOffset;
            const noteInput = displayStr.replace(/[._₋₌·]/g, '');
            const note = jianpuToNote(noteInput, finalOctaveOffset, key, scaleType);
            if (note) {
                notes.push({
                    ...note,
                    index: notes.length,
                    displayStr,
                    isNote: true
                });
            }
        } else if (char === '0') {
            notes.push({
                index: notes.length,
                jianpu: '0',
                displayStr: '0',
                isRest: true,
                noteName: 'Rest',
                octave: 4
            });
        } else if (char === '-') {
            notes.push({
                index: notes.length,
                jianpu: '-',
                displayStr: '-',
                isExtension: true,
                noteName: '-',
                octave: 4
            });
        } else if (char === '|') {
            notes.push({
                index: notes.length,
                isSeparator: true,
                displayStr: '|',
                jianpu: '|'
            });
        } else if (['(', ')', '[', ']', '{', '}', ':', '=', '>', '_'].includes(char)) {
            notes.push({
                index: notes.length,
                isSymbol: true,
                displayStr: char,
                jianpu: char
            });
        }
        i++;
    }
    return notes;
}

/**
 * 將音符陣列轉換為簡譜文字
 */
export function notesToJianpuString(notes) {
    return notes.map(n => {
        if (n.isSeparator) return '|';
        if (n.isRest) return '0';
        if (n.isExtension) return '-';
        if (n.isSymbol) return n.displayStr;
        if (n.displayStr) return n.displayStr;

        let str = n.jianpu || '';
        if (n.octave === 5) str = str + '.';
        if (n.octave === 6) str = str + '..';
        if (n.octave === 3) str = '_' + str;
        if (n.octave === 2) str = '__' + str;
        if (n.accidentalStr) str += n.accidentalStr;
        return str;
    }).join(' ');
}

// ============================================
// 3NPS 相關函數（重新匯出）
// ============================================

/**
 * 吉他把位定義
 */
export const GUITAR_POSITIONS = {
    1: { start: 0, end: 4, name: '第 1 把位 (開放)' },
    2: { start: 2, end: 5, name: '第 2 把位' },
    3: { start: 3, end: 6, name: '第 3 把位' },
    4: { start: 4, end: 7, name: '第 4 把位' },
    5: { start: 5, end: 8, name: '第 5 把位' },
    6: { start: 6, end: 9, name: '第 6 把位' },
    7: { start: 7, end: 10, name: '第 7 把位' },
    8: { start: 8, end: 11, name: '第 8 把位' },
    9: { start: 9, end: 12, name: '第 9 把位' },
    10: { start: 10, end: 13, name: '第 10 把位' },
    11: { start: 11, end: 14, name: '第 11 把位' },
    12: { start: 12, end: 15, name: '第 12 把位' },
};

/**
 * 計算音符在指定把位的指板位置
 */
export function getPositionsForNote(midiNote, position = 1) {
    const pos = GUITAR_POSITIONS[position] || GUITAR_POSITIONS[1];
    const positions = [];

    STRING_TUNINGS.forEach((openNote, stringIdx) => {
        const fret = midiNote - openNote;
        if (fret >= 0 && fret <= 22) {
            const inPosition = fret >= pos.start && fret <= pos.end;
            positions.push({
                string: stringIdx,
                fret,
                inPosition,
                stringName: ['E', 'B', 'G', 'D', 'A', 'E'][stringIdx], // 0=HighE
            });
        }
    });

    positions.sort((a, b) => {
        if (a.inPosition !== b.inPosition) {
            return a.inPosition ? -1 : 1;
        }
        return Math.abs(a.fret - pos.start) - Math.abs(b.fret - pos.start);
    });

    return positions;
}

/**
 * 獲取音符在指板上的最佳位置
 */
export function getBestPosition(midiNote, position = 1) {
    const positions = getPositionsForNote(midiNote, position);
    return positions.length > 0 ? positions[0] : null;
}

/**
 * 計算 3NPS (每弦三音) 系統的指板位置
 */
export function calculate3NPSPositions(notes, startStringIdx = 5, key = 'C', scaleType = 'Major', userOctaveShift = 0) {
    if (!notes || notes.length === 0) return [];

    // Generate Static Map
    const map = generate3NPSMap(startStringIdx, key, scaleType);
    if (!map || map.length === 0) return notes.map(() => null);

    // --- Smart Octave Alignment ---
    const firstNote = notes.find(n => n && !n.isSeparator && n.midiNote);

    let octaveShift = 0;

    if (firstNote) {
        const inputMidi = firstNote.midiNote;
        const mapStartMidi = map[0].midi;

        // Auto-align input to map
        const diff = mapStartMidi - inputMidi;
        octaveShift = Math.round(diff / 12) * 12;
    }

    // Apply User Manual Shift (in octaves * 12)
    if (userOctaveShift) {
        octaveShift += (userOctaveShift * 12);
    }

    // Find Root Fret to keep "center of gravity" for fallback
    const rootEntry = map[0];
    const targetCenterFret = rootEntry ? rootEntry.fret + 2 : 5;

    return notes.map((note) => {
        if (!note || note.isSeparator) return null;
        if (!note.midiNote) return null;

        // Apply shift
        const targetMidi = note.midiNote + octaveShift;

        // 1. Try exact match in Map
        const match = map.find(m => m.midi === targetMidi);
        if (match) {
            return { string: match.string, fret: match.fret, midi: targetMidi };
        }

        // 2. Fallback: Find closest position for shifted midi
        let bestPos = null;
        let minDist = 999;

        for (let s = 0; s < 6; s++) {
            const f = targetMidi - STRING_TUNINGS[s];
            if (f >= 0 && f <= 24) {
                const dist = Math.abs(f - targetCenterFret);
                if (dist < minDist) {
                    minDist = dist;
                    bestPos = { string: s, fret: f, midi: targetMidi };
                }
            }
        }

        return bestPos;
    });
}

/**
 * 獲取 3NPS 模式資訊
 */
export function get3NPSInfo(positions) {
    if (!positions || positions.length === 0) return { description: '3NPS' };
    const valid = positions.filter(p => p !== null && p.fret !== undefined);
    if (valid.length === 0) return { description: '3NPS' };

    const frets = valid.map(p => p.fret);
    const min = Math.min(...frets);
    const max = Math.max(...frets);
    return { minFret: min, maxFret: max, description: `3NPS (Range: ${min}-${max})` };
}

/**
 * Generate 3NPS Scale Map for background display
 */
export function generate3NPSMap(startStringIdx = 5, key = 'C', scaleType = 'Major') {
    const map = [];
    const openMidi = STRING_TUNINGS[startStringIdx];

    // Safety check for invalid string index
    if (openMidi === undefined) return [];

    const keyIndex = NOTES.indexOf(key);
    if (keyIndex === -1) return [];

    const openName = NOTES[((openMidi % 12) + 12) % 12];
    const openIndex = NOTES.indexOf(openName);

    let diff = keyIndex - openIndex;
    if (diff < 0) diff += 12;

    const rootOnStringMidi = openMidi + diff;

    const mappedType = SCALE_MAPPING[scaleType] || 'major';
    const scale = SCALES[mappedType] || SCALES['major'];
    if (!scale) return [];

    const intervals = scale.intervals;

    // 1. Iterate through strings from bottom (StartString) UP to top (0)
    let scaleDegreeIndex = 0;
    for (let s = startStringIdx; s >= 0; s--) {
        const stringOpenMidi = STRING_TUNINGS[s];

        for (let n = 0; n < 3; n++) {
            const loopDegree = scaleDegreeIndex % 7;
            const octaves = Math.floor(scaleDegreeIndex / 7);
            const inte = intervals[loopDegree];

            const targetMidi = rootOnStringMidi + inte + (octaves * 12);
            const fret = targetMidi - stringOpenMidi;

            if (fret >= 0 && fret <= 24) {
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

    // 2. Lower Extension
    scaleDegreeIndex = -1;
    for (let s = startStringIdx + 1; s <= 5; s++) {
        const stringOpenMidi = STRING_TUNINGS[s];

        let stringNotes = [];
        for (let n = 0; n < 3; n++) {
            const positiveIndex = ((scaleDegreeIndex % 7) + 7) % 7;
            const octaves = Math.floor(scaleDegreeIndex / 7);

            const inte = intervals[positiveIndex];
            const targetMidi = rootOnStringMidi + inte + (octaves * 12);
            const fret = targetMidi - stringOpenMidi;

            if (fret >= 0 && fret <= 24) {
                stringNotes.push({
                    string: s,
                    fret: fret,
                    midi: targetMidi,
                    isMap: true
                });
            }
            scaleDegreeIndex--;
        }
        map.push(...stringNotes);
    }

    return map;
}

// Default export: the parser class
export default JianpuParser;
