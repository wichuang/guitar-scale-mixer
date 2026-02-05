/**
 * NoteConverter - 譜式轉換核心
 * 在簡譜、五線譜、六線譜之間轉換
 */

import { Note } from '../core/models/Note.js';
import { NOTES, SCALES, STRING_TUNINGS } from '../data/scaleData.js';

// Scale type mapping
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

// Key offsets (semitones from C)
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
 * NoteConverter 類別
 * 提供不同譜式間的轉換功能
 */
export class NoteConverter {
    /**
     * 通用轉換方法
     * @param {Array<Note>} notes - 來源音符陣列
     * @param {string} fromFormat - 來源格式 ('jianpu' | 'staff' | 'tab')
     * @param {string} toFormat - 目標格式 ('jianpu' | 'staff' | 'tab')
     * @param {Object} options - 轉換選項
     * @returns {Array<Note>}
     */
    static convert(notes, fromFormat, toFormat, options = {}) {
        if (fromFormat === toFormat) {
            return notes.map(n => n.clone ? n.clone() : { ...n });
        }

        // 確保所有音符都有 MIDI 值
        const normalizedNotes = notes.map(n => {
            if (n.isSeparator || n.isRest || n.isExtension || n.isSymbol) {
                return n;
            }
            if (!n.midi && !n.midiNote) {
                // 嘗試從其他屬性計算 MIDI
                return this._ensureMidi(n, options);
            }
            return n;
        });

        // 執行轉換
        switch (`${fromFormat}->${toFormat}`) {
            case 'jianpu->staff':
                return this._jianpuToStaff(normalizedNotes, options);
            case 'jianpu->tab':
                return this._jianpuToTab(normalizedNotes, options);
            case 'staff->jianpu':
                return this._staffToJianpu(normalizedNotes, options);
            case 'staff->tab':
                return this._staffToTab(normalizedNotes, options);
            case 'tab->jianpu':
                return this._tabToJianpu(normalizedNotes, options);
            case 'tab->staff':
                return this._tabToStaff(normalizedNotes, options);
            default:
                console.warn(`Unknown conversion: ${fromFormat} -> ${toFormat}`);
                return normalizedNotes;
        }
    }

    /**
     * 單一音符轉換為簡譜格式
     * @param {Note} note
     * @param {string} key - 調號
     * @param {string} scaleType - 音階類型
     * @returns {Object}
     */
    static toJianpu(note, key = 'C', scaleType = 'Major') {
        if (!note || note.isSeparator || note.isRest || note.isExtension || note.isSymbol) {
            return note;
        }

        const midi = note.midi || note.midiNote;
        if (!midi) return note;

        const keyOffset = KEY_OFFSETS[key] || 0;
        const mappedType = SCALE_MAPPING[scaleType] || 'major';
        const scale = SCALES[mappedType] || SCALES['major'];
        const intervals = scale.intervals;

        // 計算相對於調號根音的半音數
        const noteIndex = ((midi % 12) - keyOffset + 12) % 12;

        // 找出對應的簡譜數字
        let jianpu = null;
        let accidentalStr = '';

        for (let i = 0; i < intervals.length; i++) {
            if (intervals[i] === noteIndex) {
                jianpu = i + 1;
                break;
            }
            // 檢查升記號
            if (intervals[i] === noteIndex - 1) {
                jianpu = i + 1;
                accidentalStr = '#';
                break;
            }
            // 檢查降記號
            if (intervals[i] === noteIndex + 1) {
                jianpu = i + 1;
                accidentalStr = 'b';
                break;
            }
        }

        if (jianpu === null) {
            // 找不到匹配，使用最接近的
            jianpu = Math.round((noteIndex / 12) * 7) + 1;
            if (jianpu > 7) jianpu = 7;
            if (jianpu < 1) jianpu = 1;
        }

        // 計算八度
        const octave = Math.floor(midi / 12) - 1;

        // 建立顯示字串
        let displayStr = String(jianpu);
        if (octave > 4) displayStr += '.'.repeat(octave - 4);
        if (octave === 3) displayStr = '₋' + displayStr;
        if (octave === 2) displayStr = '₌' + displayStr;
        if (accidentalStr) displayStr += accidentalStr;

        return {
            ...note,
            jianpu,
            octave,
            accidentalStr,
            displayStr,
            format: 'jianpu'
        };
    }

    /**
     * 單一音符轉換為五線譜格式
     * @param {Note} note
     * @returns {Object}
     */
    static toStaff(note) {
        if (!note || note.isSeparator || note.isRest || note.isExtension || note.isSymbol) {
            return note;
        }

        const midi = note.midi || note.midiNote;
        if (!midi) return note;

        const noteIndex = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        const noteName = NOTES[noteIndex];

        // 建立五線譜顯示資訊
        const staffInfo = {
            noteName,
            octave,
            // 計算在五線譜上的位置 (以中央 C 為基準)
            staffPosition: this._calculateStaffPosition(noteName, octave),
            // 是否需要加線
            ledgerLines: this._calculateLedgerLines(noteName, octave),
            // ABC Notation 表示
            abcNotation: this._noteToABC(noteName, octave)
        };

        return {
            ...note,
            ...staffInfo,
            displayStr: noteName + octave,
            format: 'staff'
        };
    }

    /**
     * 單一音符轉換為六線譜格式
     * @param {Note} note
     * @param {Object} options
     * @returns {Object}
     */
    static toTab(note, options = {}) {
        if (!note || note.isSeparator || note.isRest || note.isExtension || note.isSymbol) {
            return note;
        }

        const midi = note.midi || note.midiNote;
        if (!midi) return note;

        const { tuning = STRING_TUNINGS, preferredPosition = 'low' } = options;

        // 找出所有可能的位置
        const positions = [];
        for (let stringIdx = 0; stringIdx < tuning.length; stringIdx++) {
            const fret = midi - tuning[stringIdx];
            if (fret >= 0 && fret <= 24) {
                positions.push({
                    string: stringIdx,
                    fret,
                    stringName: ['e', 'B', 'G', 'D', 'A', 'E'][stringIdx]
                });
            }
        }

        // 選擇最佳位置
        let bestPosition = null;
        if (positions.length > 0) {
            if (preferredPosition === 'low') {
                // 優先選擇低把位
                positions.sort((a, b) => a.fret - b.fret);
            } else if (preferredPosition === 'high') {
                // 優先選擇高把位
                positions.sort((a, b) => b.fret - a.fret);
            }
            bestPosition = positions[0];
        }

        return {
            ...note,
            stringIndex: bestPosition?.string,
            fret: bestPosition?.fret,
            stringName: bestPosition?.stringName,
            allPositions: positions,
            displayStr: bestPosition ? `${bestPosition.stringName}:${bestPosition.fret}` : '?',
            format: 'tab'
        };
    }

    // ==================== Private Methods ====================

    /**
     * 確保音符有 MIDI 值
     * @private
     */
    static _ensureMidi(note, options = {}) {
        const { key = 'C', scaleType = 'Major' } = options;

        // 如果有簡譜資訊
        if (note.jianpu && note.octave !== undefined) {
            const keyOffset = KEY_OFFSETS[key] || 0;
            const mappedType = SCALE_MAPPING[scaleType] || 'major';
            const scale = SCALES[mappedType] || SCALES['major'];
            const intervals = scale.intervals;

            let accidentalOffset = 0;
            if (note.accidentalStr === '#') accidentalOffset = 1;
            if (note.accidentalStr === 'b') accidentalOffset = -1;

            const jianpuIdx = parseInt(note.jianpu) - 1;
            if (jianpuIdx >= 0 && jianpuIdx < intervals.length) {
                const semitone = intervals[jianpuIdx] + keyOffset + accidentalOffset;
                const midi = (note.octave + 1) * 12 + semitone;
                return { ...note, midi };
            }
        }

        // 如果有 Tab 資訊
        if (note.stringIndex !== undefined && note.fret !== undefined) {
            const tuning = options.tuning || STRING_TUNINGS;
            const midi = tuning[note.stringIndex] + note.fret;
            return { ...note, midi };
        }

        // 如果有音符名稱
        if (note.noteName && note.octave !== undefined) {
            const baseName = note.noteName.replace(/[#b]/, '');
            const noteIdx = NOTES.indexOf(baseName);
            if (noteIdx !== -1) {
                let midi = (note.octave + 1) * 12 + noteIdx;
                if (note.noteName.includes('#') || note.accidentalStr === '#') midi++;
                if (note.noteName.includes('b') || note.accidentalStr === 'b') midi--;
                return { ...note, midi };
            }
        }

        return note;
    }

    /**
     * 簡譜轉五線譜
     * @private
     */
    static _jianpuToStaff(notes, options) {
        return notes.map(note => this.toStaff(note));
    }

    /**
     * 簡譜轉六線譜
     * @private
     */
    static _jianpuToTab(notes, options) {
        return notes.map(note => this.toTab(note, options));
    }

    /**
     * 五線譜轉簡譜
     * @private
     */
    static _staffToJianpu(notes, options) {
        const { key = 'C', scaleType = 'Major' } = options;
        return notes.map(note => this.toJianpu(note, key, scaleType));
    }

    /**
     * 五線譜轉六線譜
     * @private
     */
    static _staffToTab(notes, options) {
        return notes.map(note => this.toTab(note, options));
    }

    /**
     * 六線譜轉簡譜
     * @private
     */
    static _tabToJianpu(notes, options) {
        const { key = 'C', scaleType = 'Major' } = options;
        return notes.map(note => this.toJianpu(note, key, scaleType));
    }

    /**
     * 六線譜轉五線譜
     * @private
     */
    static _tabToStaff(notes, options) {
        return notes.map(note => this.toStaff(note));
    }

    /**
     * 計算五線譜位置
     * @private
     */
    static _calculateStaffPosition(noteName, octave) {
        // C4 (中央 C) 在高音譜表第一線下方
        // 位置以半音階計算，0 = 中央 C
        const noteOrder = { 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6 };
        const baseName = noteName.replace(/[#b]/, '');
        const basePosition = noteOrder[baseName] || 0;
        const octaveOffset = (octave - 4) * 7;
        return basePosition + octaveOffset;
    }

    /**
     * 計算加線數量
     * @private
     */
    static _calculateLedgerLines(noteName, octave) {
        const position = this._calculateStaffPosition(noteName, octave);
        // 高音譜表範圍約 -2 (E3) 到 10 (F5)
        if (position < -1) {
            return { below: Math.ceil((-1 - position) / 2) };
        }
        if (position > 9) {
            return { above: Math.ceil((position - 9) / 2) };
        }
        return { below: 0, above: 0 };
    }

    /**
     * 音符轉 ABC Notation
     * @private
     */
    static _noteToABC(noteName, octave) {
        const baseName = noteName.replace(/[#b]/, '');
        let abc = '';

        // 升降記號
        if (noteName.includes('#')) abc += '^';
        if (noteName.includes('b')) abc += '_';

        // 音符字母
        if (octave <= 4) {
            abc += baseName.toUpperCase();
        } else {
            abc += baseName.toLowerCase();
        }

        // 八度標記
        if (octave <= 3) {
            abc += ','.repeat(4 - octave);
        } else if (octave >= 6) {
            abc += "'".repeat(octave - 5);
        }

        return abc;
    }
}

export default NoteConverter;
