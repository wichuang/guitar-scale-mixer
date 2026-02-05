/**
 * Note - 統一音符類別
 * 支援多種譜式格式（簡譜、五線譜、六線譜）的統一資料模型
 */

import { NOTES, SCALES, STRING_TUNINGS } from '../../data/scaleData.js';

// Scale type mapping for UI -> internal key
const SCALE_MAPPING = {
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

// Key offset mapping (semitones from C)
const KEY_OFFSETS = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11,
};

/**
 * 統一音符類別
 */
export class Note {
    /**
     * @param {Object} props - 音符屬性
     * @param {number} props.midi - MIDI 音高 (唯一真值)
     * @param {string} props.noteName - 音符名稱 "C", "D#", etc.
     * @param {number} props.octave - 八度 (2-6)
     * @param {number} props.jianpu - 簡譜數字 (1-7)
     * @param {string} props.accidentalStr - 升降號 "#", "b", ""
     * @param {string} props.displayStr - 顯示字串
     * @param {number} props.index - 在樂譜中的位置索引
     * @param {string} props.duration - 時值（未來擴充）
     * @param {string} props.type - 類型: 'note', 'rest', 'extension', 'separator', 'symbol'
     */
    constructor(props = {}) {
        this.midi = props.midi ?? null;
        this.noteName = props.noteName ?? '';
        this.octave = props.octave ?? 4;
        this.jianpu = props.jianpu ?? null;
        this.accidentalStr = props.accidentalStr ?? '';
        this.displayStr = props.displayStr ?? '';
        this.index = props.index ?? 0;
        this.duration = props.duration ?? 'quarter';

        // Type flags
        this._type = props.type ?? 'note';
    }

    // Type getters
    get isNote() { return this._type === 'note'; }
    get isRest() { return this._type === 'rest'; }
    get isExtension() { return this._type === 'extension'; }
    get isSeparator() { return this._type === 'separator'; }
    get isSymbol() { return this._type === 'symbol'; }

    // Backward compatibility: midiNote alias
    get midiNote() { return this.midi; }
    set midiNote(value) { this.midi = value; }

    /**
     * 從 MIDI 音高創建音符
     * @param {number} midiNote - MIDI 音高
     * @param {Object} options - 其他選項
     * @returns {Note}
     */
    static fromMidi(midiNote, options = {}) {
        const noteIndex = ((midiNote % 12) + 12) % 12;
        const noteName = NOTES[noteIndex];
        const octave = Math.floor(midiNote / 12) - 1;

        // Calculate jianpu (in C major by default)
        const key = options.key || 'C';
        const scaleType = options.scaleType || 'Major';
        const keyOffset = KEY_OFFSETS[key] || 0;
        const mappedType = SCALE_MAPPING[scaleType] || 'major';
        const scale = SCALES[mappedType] || SCALES['major'];

        // Find jianpu degree
        const semitoneFromKey = ((noteIndex - keyOffset) % 12 + 12) % 12;
        let jianpu = null;
        let accidentalStr = '';

        for (let i = 0; i < scale.intervals.length; i++) {
            if (scale.intervals[i] === semitoneFromKey) {
                jianpu = i + 1;
                break;
            }
            // Check for accidentals
            if (scale.intervals[i] === semitoneFromKey - 1) {
                jianpu = i + 1;
                accidentalStr = '#';
                break;
            }
            if (scale.intervals[i] === semitoneFromKey + 1) {
                jianpu = i + 1;
                accidentalStr = 'b';
                break;
            }
        }

        // Build display string
        let displayStr = jianpu ? String(jianpu) : noteName;
        if (octave > 4) displayStr += '.'.repeat(octave - 4);
        if (octave === 3) displayStr = '_' + displayStr;
        if (octave === 2) displayStr = '__' + displayStr;
        if (accidentalStr) displayStr += accidentalStr;

        return new Note({
            midi: midiNote,
            noteName: noteName + (accidentalStr === '#' ? '#' : accidentalStr === 'b' ? 'b' : ''),
            octave,
            jianpu,
            accidentalStr,
            displayStr,
            index: options.index ?? 0,
            duration: options.duration ?? 'quarter',
            type: 'note'
        });
    }

    /**
     * 從簡譜創建音符
     * @param {string|number} jianpuNum - 簡譜數字 (1-7, 可含升降號)
     * @param {number} octaveOffset - 八度偏移 (-1=低八度, 0=中央, 1=高八度)
     * @param {string} key - 調號 (預設 'C')
     * @param {string} scaleType - 音階類型 (預設 'Major')
     * @param {Object} options - 其他選項
     * @returns {Note|null}
     */
    static fromJianpu(jianpuNum, octaveOffset = 0, key = 'C', scaleType = 'Major', options = {}) {
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
        const baseSemitone = intervals[cleanNum - 1];
        const keyOffset = KEY_OFFSETS[key] || 0;
        const totalSemitone = baseSemitone + keyOffset + accidental;

        // 中央 C = C4 = MIDI 60
        const baseOctave = 4 + octaveOffset;
        const midiNote = 60 + totalSemitone + (octaveOffset * 12);

        // Calculate Note Name safely
        const noteName = NOTES[(totalSemitone % 12 + 12) % 12];
        const accidentalStr = accidental === 1 ? '#' : (accidental === -1 ? 'b' : '');

        // Build display string
        let displayStr = String(cleanNum);
        if (baseOctave > 4) displayStr += '.'.repeat(baseOctave - 4);
        if (baseOctave === 3) displayStr = '_' + displayStr;
        if (baseOctave === 2) displayStr = '__' + displayStr;
        if (accidentalStr) displayStr += accidentalStr;

        return new Note({
            midi: midiNote,
            noteName,
            octave: baseOctave,
            jianpu: cleanNum,
            accidentalStr,
            displayStr: options.displayStr ?? displayStr,
            index: options.index ?? 0,
            duration: options.duration ?? 'quarter',
            type: 'note'
        });
    }

    /**
     * 從六線譜位置創建音符
     * @param {number} stringIndex - 弦索引 (0=高E, 5=低E)
     * @param {number} fret - 琴格
     * @param {Object} options - 其他選項
     * @returns {Note}
     */
    static fromTab(stringIndex, fret, options = {}) {
        const midiNote = STRING_TUNINGS[stringIndex] + fret;
        return Note.fromMidi(midiNote, {
            ...options,
            stringIndex,
            fret
        });
    }

    /**
     * 創建休止符
     * @param {Object} options
     * @returns {Note}
     */
    static createRest(options = {}) {
        return new Note({
            jianpu: '0',
            displayStr: '0',
            noteName: 'Rest',
            octave: 4,
            index: options.index ?? 0,
            duration: options.duration ?? 'quarter',
            type: 'rest'
        });
    }

    /**
     * 創建延音符號
     * @param {Object} options
     * @returns {Note}
     */
    static createExtension(options = {}) {
        return new Note({
            jianpu: '-',
            displayStr: '-',
            noteName: '-',
            octave: 4,
            index: options.index ?? 0,
            type: 'extension'
        });
    }

    /**
     * 創建分隔符（小節線）
     * @param {Object} options
     * @returns {Note}
     */
    static createSeparator(options = {}) {
        return new Note({
            jianpu: '|',
            displayStr: '|',
            index: options.index ?? 0,
            type: 'separator'
        });
    }

    /**
     * 創建符號
     * @param {string} symbol - 符號字元
     * @param {Object} options
     * @returns {Note}
     */
    static createSymbol(symbol, options = {}) {
        return new Note({
            jianpu: symbol,
            displayStr: symbol,
            octave: 4,
            index: options.index ?? 0,
            type: 'symbol'
        });
    }

    /**
     * 從 plain object 恢復 Note 實例
     * @param {Object} obj
     * @returns {Note}
     */
    static fromObject(obj) {
        // Determine type from flags
        let type = 'note';
        if (obj.isRest) type = 'rest';
        else if (obj.isExtension) type = 'extension';
        else if (obj.isSeparator) type = 'separator';
        else if (obj.isSymbol) type = 'symbol';

        return new Note({
            midi: obj.midiNote ?? obj.midi,
            noteName: obj.noteName,
            octave: obj.octave,
            jianpu: obj.jianpu,
            accidentalStr: obj.accidentalStr,
            displayStr: obj.displayStr,
            index: obj.index,
            duration: obj.duration,
            type
        });
    }

    /**
     * 轉換為 plain object（向後相容格式）
     * @returns {Object}
     */
    toObject() {
        const obj = {
            index: this.index,
            jianpu: this.jianpu,
            displayStr: this.displayStr,
        };

        if (this.isNote) {
            obj.midiNote = this.midi;
            obj.noteName = this.noteName;
            obj.octave = this.octave;
            obj.accidentalStr = this.accidentalStr;
            obj.isNote = true;
        } else if (this.isRest) {
            obj.isRest = true;
            obj.noteName = 'Rest';
            obj.octave = 4;
        } else if (this.isExtension) {
            obj.isExtension = true;
            obj.noteName = '-';
            obj.octave = 4;
        } else if (this.isSeparator) {
            obj.isSeparator = true;
        } else if (this.isSymbol) {
            obj.isSymbol = true;
            obj.octave = 4;
        }

        return obj;
    }

    /**
     * 複製此音符並可覆寫屬性
     * @param {Object} overrides
     * @returns {Note}
     */
    clone(overrides = {}) {
        return new Note({
            midi: overrides.midi ?? this.midi,
            noteName: overrides.noteName ?? this.noteName,
            octave: overrides.octave ?? this.octave,
            jianpu: overrides.jianpu ?? this.jianpu,
            accidentalStr: overrides.accidentalStr ?? this.accidentalStr,
            displayStr: overrides.displayStr ?? this.displayStr,
            index: overrides.index ?? this.index,
            duration: overrides.duration ?? this.duration,
            type: overrides.type ?? this._type
        });
    }
}

export default Note;
