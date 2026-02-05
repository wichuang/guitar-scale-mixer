/**
 * StaffParser - 五線譜解析器
 * 支援 ABC Notation 格式和基本 MusicXML 匯入
 */

import { ParserInterface } from '../core/interfaces/ParserInterface.js';
import { Note } from '../core/models/Note.js';
import { NOTES } from '../data/scaleData.js';

// ABC Notation 音符對應
const ABC_NOTES = {
    // 低八度 (大寫 + 逗號)
    'C,': { note: 'C', octave: 3 },
    'D,': { note: 'D', octave: 3 },
    'E,': { note: 'E', octave: 3 },
    'F,': { note: 'F', octave: 3 },
    'G,': { note: 'G', octave: 3 },
    'A,': { note: 'A', octave: 3 },
    'B,': { note: 'B', octave: 3 },
    // 中央八度 (大寫)
    'C': { note: 'C', octave: 4 },
    'D': { note: 'D', octave: 4 },
    'E': { note: 'E', octave: 4 },
    'F': { note: 'F', octave: 4 },
    'G': { note: 'G', octave: 4 },
    'A': { note: 'A', octave: 4 },
    'B': { note: 'B', octave: 4 },
    // 高八度 (小寫)
    'c': { note: 'C', octave: 5 },
    'd': { note: 'D', octave: 5 },
    'e': { note: 'E', octave: 5 },
    'f': { note: 'F', octave: 5 },
    'g': { note: 'G', octave: 5 },
    'a': { note: 'A', octave: 5 },
    'b': { note: 'B', octave: 5 },
    // 更高八度 (小寫 + 撇號)
    "c'": { note: 'C', octave: 6 },
    "d'": { note: 'D', octave: 6 },
    "e'": { note: 'E', octave: 6 },
    "f'": { note: 'F', octave: 6 },
    "g'": { note: 'G', octave: 6 },
    "a'": { note: 'A', octave: 6 },
    "b'": { note: 'B', octave: 6 },
};

// ABC 時值對應
const ABC_DURATIONS = {
    '': 1,      // 預設
    '2': 2,     // 二分音符
    '3': 3,
    '4': 4,     // 全音符
    '/2': 0.5,  // 八分音符
    '/4': 0.25, // 十六分音符
    '/': 0.5,   // 簡寫八分
};

// 調號對應
const KEY_SIGNATURES = {
    'C': { sharps: [], flats: [] },
    'G': { sharps: ['F'], flats: [] },
    'D': { sharps: ['F', 'C'], flats: [] },
    'A': { sharps: ['F', 'C', 'G'], flats: [] },
    'E': { sharps: ['F', 'C', 'G', 'D'], flats: [] },
    'B': { sharps: ['F', 'C', 'G', 'D', 'A'], flats: [] },
    'F#': { sharps: ['F', 'C', 'G', 'D', 'A', 'E'], flats: [] },
    'F': { sharps: [], flats: ['B'] },
    'Bb': { sharps: [], flats: ['B', 'E'] },
    'Eb': { sharps: [], flats: ['B', 'E', 'A'] },
    'Ab': { sharps: [], flats: ['B', 'E', 'A', 'D'] },
    'Db': { sharps: [], flats: ['B', 'E', 'A', 'D', 'G'] },
    'Gb': { sharps: [], flats: ['B', 'E', 'A', 'D', 'G', 'C'] },
    // Minor keys
    'Am': { sharps: [], flats: [] },
    'Em': { sharps: ['F'], flats: [] },
    'Bm': { sharps: ['F', 'C'], flats: [] },
    'Dm': { sharps: [], flats: ['B'] },
    'Gm': { sharps: [], flats: ['B', 'E'] },
};

/**
 * StaffParser 類別
 * @extends ParserInterface
 */
export class StaffParser extends ParserInterface {
    constructor() {
        super();
        this.key = 'C';
        this.timeSignature = '4/4';
        this.tempo = 120;
        this.title = '';
    }

    get name() {
        return 'StaffParser';
    }

    get description() {
        return '五線譜解析器 - ABC Notation / MusicXML';
    }

    /**
     * 解析輸入（自動偵測格式）
     * @param {string} input
     * @param {Object} options
     * @returns {Array<Note>}
     */
    parse(input, options = {}) {
        const trimmed = input.trim();

        // 偵測 MusicXML
        if (trimmed.startsWith('<?xml') || trimmed.startsWith('<score-partwise') || trimmed.startsWith('<music')) {
            return this.parseMusicXML(input, options);
        }

        // 預設為 ABC Notation
        return this.parseABC(input, options);
    }

    /**
     * 將音符轉換為 ABC Notation
     * @param {Array<Note>} notes
     * @param {Object} options
     * @returns {string}
     */
    stringify(notes, options = {}) {
        const {
            title = 'Untitled',
            key = 'C',
            meter = '4/4',
            tempo = 120
        } = options;

        let abc = '';
        abc += `X:1\n`;
        abc += `T:${title}\n`;
        abc += `M:${meter}\n`;
        abc += `L:1/4\n`;
        abc += `Q:1/4=${tempo}\n`;
        abc += `K:${key}\n`;

        let measureCount = 0;
        const beatsPerMeasure = parseInt(meter.split('/')[0]) || 4;

        for (const note of notes) {
            if (note.isSeparator) {
                abc += ' | ';
                measureCount = 0;
                continue;
            }

            if (note.isRest) {
                abc += 'z ';
                measureCount++;
                continue;
            }

            if (note.isExtension) {
                abc += '- ';
                continue;
            }

            if (note.isSymbol) {
                continue; // Skip symbols in ABC
            }

            const abcNote = this._noteToABC(note);
            abc += abcNote + ' ';
            measureCount++;

            if (measureCount >= beatsPerMeasure) {
                abc += '| ';
                measureCount = 0;
            }
        }

        // 結尾雙小節線
        if (!abc.trim().endsWith('|')) {
            abc += '|';
        }
        abc += ']';

        return abc;
    }

    /**
     * 清理輸入文字
     * @param {string} text
     * @returns {string}
     */
    clean(text) {
        // 移除註解
        let cleaned = text.replace(/%.*$/gm, '');
        // 正規化空白
        cleaned = cleaned.replace(/\s+/g, ' ');
        return cleaned.trim();
    }

    /**
     * 驗證格式
     * @param {string} text
     * @returns {boolean}
     */
    validate(text) {
        const trimmed = text.trim();
        // ABC Notation 通常有 X: 或 K: 標頭
        if (/^X:\d+/m.test(trimmed) || /^K:[A-Ga-g]/m.test(trimmed)) {
            return true;
        }
        // MusicXML
        if (trimmed.startsWith('<?xml') || trimmed.includes('<score-partwise')) {
            return true;
        }
        // 簡單 ABC（只有音符）
        if (/^[A-Ga-g,'=_\^\d\/\|\s\[\]]+$/.test(trimmed)) {
            return true;
        }
        return false;
    }

    /**
     * 解析 ABC Notation
     * @param {string} text
     * @param {Object} options
     * @returns {Array<Note>}
     */
    parseABC(text, options = {}) {
        const lines = text.split('\n');
        const notes = [];
        let noteIndex = 0;
        let currentKey = options.key || 'C';
        let inBody = false;

        for (const line of lines) {
            const trimmed = line.trim();

            // 解析標頭
            if (trimmed.startsWith('X:')) {
                continue; // 參考編號
            }
            if (trimmed.startsWith('T:')) {
                this.title = trimmed.substring(2).trim();
                continue;
            }
            if (trimmed.startsWith('M:')) {
                this.timeSignature = trimmed.substring(2).trim();
                continue;
            }
            if (trimmed.startsWith('Q:')) {
                const tempoMatch = trimmed.match(/=(\d+)/);
                if (tempoMatch) {
                    this.tempo = parseInt(tempoMatch[1]);
                }
                continue;
            }
            if (trimmed.startsWith('K:')) {
                currentKey = trimmed.substring(2).trim().split(' ')[0];
                this.key = currentKey;
                inBody = true; // K: 之後是音樂內容
                continue;
            }
            if (trimmed.startsWith('L:') || trimmed.startsWith('C:') || trimmed.startsWith('W:')) {
                continue; // 其他標頭
            }

            // 解析音樂內容
            if (!inBody && !trimmed.match(/^[A-Ga-g,'=_\^\d\/\|\s\[\]z]+$/)) {
                continue;
            }
            inBody = true;

            const parsedNotes = this._parseABCLine(trimmed, currentKey, noteIndex);
            notes.push(...parsedNotes);
            noteIndex = notes.length;
        }

        return notes;
    }

    /**
     * 解析單行 ABC
     * @private
     */
    _parseABCLine(line, key, startIndex) {
        const notes = [];
        let noteIndex = startIndex;

        // ABC 正規表達式
        const noteRegex = /([_=^]*)([A-Ga-g])([,']*)([\d\/]*)/g;
        const restRegex = /z([\d\/]*)/g;
        const barRegex = /\|+:?|:\|+|\[\||\|\]/g;

        let pos = 0;
        while (pos < line.length) {
            // 跳過空白
            if (/\s/.test(line[pos])) {
                pos++;
                continue;
            }

            // 檢查小節線
            const barMatch = line.slice(pos).match(/^(\|+:?|:\|+|\[\||\|\])/);
            if (barMatch) {
                notes.push(Note.createSeparator({ index: noteIndex++ }));
                pos += barMatch[0].length;
                continue;
            }

            // 檢查休止符
            const restMatch = line.slice(pos).match(/^z([\d\/]*)/);
            if (restMatch) {
                const duration = this._parseDuration(restMatch[1]);
                const rest = Note.createRest({ index: noteIndex++, duration });
                notes.push(rest);
                pos += restMatch[0].length;
                continue;
            }

            // 檢查音符
            const noteMatch = line.slice(pos).match(/^([_=^]*)([A-Ga-g])([,']*)([\d\/]*)/);
            if (noteMatch) {
                const [full, accidentals, noteLetter, octaveMarkers, durationStr] = noteMatch;

                const note = this._parseABCNote(accidentals, noteLetter, octaveMarkers, durationStr, key, noteIndex);
                if (note) {
                    notes.push(note);
                    noteIndex++;
                }
                pos += full.length;
                continue;
            }

            // 跳過無法識別的字元
            pos++;
        }

        return notes;
    }

    /**
     * 解析 ABC 音符
     * @private
     */
    _parseABCNote(accidentals, noteLetter, octaveMarkers, durationStr, key, index) {
        // 決定基本音高
        let noteName = noteLetter.toUpperCase();
        let octave = noteLetter === noteLetter.toUpperCase() ? 4 : 5;

        // 處理八度標記
        for (const marker of octaveMarkers) {
            if (marker === ',') octave--;
            if (marker === "'") octave++;
        }

        // 處理升降記號
        let accidentalStr = '';
        if (accidentals.includes('^')) {
            accidentalStr = '#';
        } else if (accidentals.includes('_')) {
            accidentalStr = 'b';
        } else if (accidentals.includes('=')) {
            accidentalStr = ''; // 還原記號
        } else {
            // 使用調號的升降
            const keySig = KEY_SIGNATURES[key] || KEY_SIGNATURES['C'];
            if (keySig.sharps.includes(noteName)) {
                accidentalStr = '#';
            } else if (keySig.flats.includes(noteName)) {
                accidentalStr = 'b';
            }
        }

        // 計算 MIDI 音高
        const noteIndex = NOTES.indexOf(noteName);
        if (noteIndex === -1) return null;

        let midi = (octave + 1) * 12 + noteIndex;
        if (accidentalStr === '#') midi++;
        if (accidentalStr === 'b') midi--;

        // 時值
        const duration = this._parseDuration(durationStr);

        // 建立顯示字串
        const displayStr = noteName + accidentalStr + octave;

        return new Note({
            midi,
            noteName: noteName + accidentalStr,
            octave,
            accidentalStr,
            displayStr,
            index,
            duration: this._durationToName(duration),
            type: 'note'
        });
    }

    /**
     * 解析時值
     * @private
     */
    _parseDuration(str) {
        if (!str || str === '') return 1;
        if (ABC_DURATIONS[str] !== undefined) {
            return ABC_DURATIONS[str];
        }
        // 處理數字
        if (/^\d+$/.test(str)) {
            return parseInt(str);
        }
        // 處理分數
        const fracMatch = str.match(/^(\d*)\/(\d*)$/);
        if (fracMatch) {
            const num = fracMatch[1] ? parseInt(fracMatch[1]) : 1;
            const den = fracMatch[2] ? parseInt(fracMatch[2]) : 2;
            return num / den;
        }
        return 1;
    }

    /**
     * 時值轉名稱
     * @private
     */
    _durationToName(duration) {
        if (duration >= 4) return 'whole';
        if (duration >= 2) return 'half';
        if (duration >= 1) return 'quarter';
        if (duration >= 0.5) return 'eighth';
        if (duration >= 0.25) return 'sixteenth';
        return 'thirty-second';
    }

    /**
     * 音符轉 ABC
     * @private
     */
    _noteToABC(note) {
        const noteName = (note.noteName || 'C').replace(/[#b]/, '');
        const accidental = note.accidentalStr || '';
        const octave = note.octave || 4;

        let abc = '';

        // 升降記號
        if (accidental === '#') abc += '^';
        if (accidental === 'b') abc += '_';

        // 音符字母
        if (octave <= 4) {
            abc += noteName.toUpperCase();
        } else {
            abc += noteName.toLowerCase();
        }

        // 八度標記
        if (octave <= 3) {
            abc += ','.repeat(4 - octave);
        } else if (octave >= 6) {
            abc += "'".repeat(octave - 5);
        }

        return abc;
    }

    /**
     * 解析 MusicXML
     * @param {string} xml
     * @param {Object} options
     * @returns {Array<Note>}
     */
    parseMusicXML(xml, options = {}) {
        const notes = [];
        let noteIndex = 0;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'application/xml');

            // 檢查解析錯誤
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                console.error('MusicXML parse error:', parseError.textContent);
                return notes;
            }

            // 解析 part
            const parts = doc.querySelectorAll('part');

            for (const part of parts) {
                const measures = part.querySelectorAll('measure');

                for (const measure of measures) {
                    const noteElements = measure.querySelectorAll('note');

                    for (const noteEl of noteElements) {
                        // 檢查是否為休止符
                        const restEl = noteEl.querySelector('rest');
                        if (restEl) {
                            notes.push(Note.createRest({ index: noteIndex++ }));
                            continue;
                        }

                        // 解析音高
                        const pitchEl = noteEl.querySelector('pitch');
                        if (pitchEl) {
                            const step = pitchEl.querySelector('step')?.textContent || 'C';
                            const octave = parseInt(pitchEl.querySelector('octave')?.textContent || '4');
                            const alter = parseInt(pitchEl.querySelector('alter')?.textContent || '0');

                            const noteIdx = NOTES.indexOf(step);
                            if (noteIdx === -1) continue;

                            const midi = (octave + 1) * 12 + noteIdx + alter;
                            const accidentalStr = alter > 0 ? '#' : (alter < 0 ? 'b' : '');

                            const note = new Note({
                                midi,
                                noteName: step + accidentalStr,
                                octave,
                                accidentalStr,
                                displayStr: step + accidentalStr + octave,
                                index: noteIndex++,
                                type: 'note'
                            });
                            notes.push(note);
                        }
                    }

                    // 小節結束加入分隔符
                    if (Array.from(measures).indexOf(measure) < measures.length - 1) {
                        notes.push(Note.createSeparator({ index: noteIndex++ }));
                    }
                }
            }
        } catch (error) {
            console.error('MusicXML parsing error:', error);
        }

        return notes;
    }
}

// 匯出常量
export { ABC_NOTES, ABC_DURATIONS, KEY_SIGNATURES };

export default StaffParser;
