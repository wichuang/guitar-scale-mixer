/**
 * TabParser - 六線譜 (Guitar Tab) 解析器
 * 解析標準 ASCII Tab 格式，轉換為統一 Note 物件
 */

import { ParserInterface } from '../core/interfaces/ParserInterface.js';
import { Note } from '../core/models/Note.js';
import { STRING_TUNINGS, NOTES } from '../data/scaleData.js';

// 標準吉他調弦名稱 (由高到低)
const STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];

// 常見調弦設定 (MIDI values, high to low)
const TUNINGS = {
    standard: [64, 59, 55, 50, 45, 40],      // E A D G B e
    dropD: [64, 59, 55, 50, 45, 38],         // D A D G B e
    halfStepDown: [63, 58, 54, 49, 44, 39],  // Eb Ab Db Gb Bb eb
    openG: [62, 59, 55, 50, 43, 38],         // D G D G B D
    openD: [62, 57, 54, 50, 45, 38],         // D A D F# A D
    DADGAD: [62, 57, 55, 50, 45, 38],        // D A D G A D
};

// Tab 技巧符號
const TECHNIQUES = {
    'h': 'hammer-on',
    'p': 'pull-off',
    'b': 'bend',
    'r': 'release',
    '/': 'slide-up',
    '\\': 'slide-down',
    '~': 'vibrato',
    'x': 'mute',
    '*': 'harmonic',
    't': 'tap',
};

/**
 * TabParser 類別
 * @extends ParserInterface
 */
export class TabParser extends ParserInterface {
    constructor(tuning = 'standard') {
        super();
        this.tuning = TUNINGS[tuning] || TUNINGS.standard;
        this.tuningName = tuning;
    }

    get name() {
        return 'TabParser';
    }

    get description() {
        return '六線譜 (Guitar Tab) 解析器 - ASCII Tab 格式';
    }

    /**
     * 設定調弦
     * @param {string|number[]} tuning
     */
    setTuning(tuning) {
        if (typeof tuning === 'string') {
            this.tuning = TUNINGS[tuning] || TUNINGS.standard;
            this.tuningName = tuning;
        } else if (Array.isArray(tuning)) {
            this.tuning = tuning;
            this.tuningName = 'custom';
        }
    }

    /**
     * 解析 Tab 文字
     * @param {string} text - ASCII Tab 文字
     * @param {Object} options
     * @returns {Array<Note>}
     */
    parse(text, options = {}) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const tabLines = this._extractTabLines(lines);

        if (tabLines.length === 0) {
            return [];
        }

        return this._parseTabLines(tabLines, options);
    }

    /**
     * 將音符陣列轉換為 Tab 文字
     * @param {Array<Note>} notes
     * @param {Object} options
     * @returns {string}
     */
    stringify(notes, options = {}) {
        const { measuresPerLine = 4, beatsPerMeasure = 4 } = options;

        if (!notes || notes.length === 0) {
            return this._createEmptyTab();
        }

        return this._notesToTab(notes, measuresPerLine, beatsPerMeasure);
    }

    /**
     * 清理 Tab 文字
     * @param {string} text
     * @returns {string}
     */
    clean(text) {
        // 移除非 Tab 相關的行
        const lines = text.split('\n');
        const tabLines = lines.filter(line => {
            const trimmed = line.trim();
            // Tab 行通常以弦名開頭或包含 |---
            return /^[eEbBgGdDaA]\|/.test(trimmed) ||
                   /^\|?[-0-9hpbr\/\\~x*t|]+\|?$/.test(trimmed);
        });
        return tabLines.join('\n');
    }

    /**
     * 驗證 Tab 格式
     * @param {string} text
     * @returns {boolean}
     */
    validate(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const tabLines = this._extractTabLines(lines);
        return tabLines.length >= 1 && tabLines[0].length === 6;
    }

    /**
     * 自動偵測調弦
     * @param {string} text
     * @returns {string}
     */
    detectTuning(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        // 檢查是否有調弦標記
        for (const line of lines) {
            const match = line.match(/tuning\s*[:=]\s*(\w+)/i);
            if (match) {
                const tuningName = match[1].toLowerCase();
                if (TUNINGS[tuningName]) {
                    return tuningName;
                }
            }

            // 檢查 Drop D 標記
            if (/drop\s*d/i.test(line)) {
                return 'dropD';
            }
        }

        // 檢查弦名來判斷調弦
        for (const line of lines) {
            if (/^D\|/i.test(line) && lines.some(l => /^A\|/i.test(l))) {
                // 可能是 Drop D 或 DADGAD
                return 'dropD';
            }
        }

        return 'standard';
    }

    /**
     * 提取 Tab 行組
     * @private
     */
    _extractTabLines(lines) {
        const tabGroups = [];
        let currentGroup = [];

        for (const line of lines) {
            // 檢查是否為 Tab 行
            if (this._isTabLine(line)) {
                currentGroup.push(line);

                // 如果收集到 6 條弦，則為完整的一組
                if (currentGroup.length === 6) {
                    tabGroups.push([...currentGroup]);
                    currentGroup = [];
                }
            } else if (currentGroup.length > 0) {
                // 遇到非 Tab 行，如果有未完成的組則嘗試補齊或清除
                if (currentGroup.length >= 4) {
                    // 可能是不完整的 Tab（只顯示部分弦）
                    tabGroups.push([...currentGroup]);
                }
                currentGroup = [];
            }
        }

        // 處理最後一組
        if (currentGroup.length >= 4) {
            tabGroups.push(currentGroup);
        }

        return tabGroups;
    }

    /**
     * 判斷是否為 Tab 行
     * @private
     */
    _isTabLine(line) {
        const trimmed = line.trim();
        // 匹配模式：e|---0---2---| 或 |---0---2---|
        return /^[eEbBgGdDaA]?\|?[-0-9hpbr\/\\~x*t\s|]+\|?$/.test(trimmed) &&
               /[0-9]/.test(trimmed); // 必須包含數字
    }

    /**
     * 解析 Tab 行組
     * @private
     */
    _parseTabLines(tabGroups, options) {
        const notes = [];
        let noteIndex = 0;

        for (const group of tabGroups) {
            // 正規化每一行
            const normalizedLines = this._normalizeTabGroup(group);
            if (normalizedLines.length === 0) continue;

            // 找出最長行的長度
            const maxLength = Math.max(...normalizedLines.map(l => l.length));

            // 逐列解析
            for (let col = 0; col < maxLength; col++) {
                const columnNotes = this._parseColumn(normalizedLines, col, noteIndex);

                if (columnNotes.length > 0) {
                    // 如果同一列有多個音符，視為和弦
                    if (columnNotes.length === 1) {
                        notes.push(columnNotes[0]);
                    } else {
                        // 標記為和弦的一部分
                        columnNotes.forEach((note, i) => {
                            note.isChord = true;
                            note.chordPosition = i;
                            notes.push(note);
                        });
                    }
                    noteIndex++;
                }
            }

            // 在 Tab 組之間加入分隔符
            if (tabGroups.indexOf(group) < tabGroups.length - 1) {
                notes.push(Note.createSeparator({ index: noteIndex++ }));
            }
        }

        return notes;
    }

    /**
     * 正規化 Tab 組
     * @private
     */
    _normalizeTabGroup(group) {
        return group.map(line => {
            // 移除弦名前綴
            let normalized = line.replace(/^[eEbBgGdDaA]\|/, '|');
            // 移除結尾的 |
            normalized = normalized.replace(/\|$/, '');
            // 移除開頭的 |
            normalized = normalized.replace(/^\|/, '');
            return normalized;
        });
    }

    /**
     * 解析單列
     * @private
     */
    _parseColumn(lines, col, baseIndex) {
        const notes = [];

        for (let stringIdx = 0; stringIdx < Math.min(lines.length, 6); stringIdx++) {
            const line = lines[stringIdx];
            if (col >= line.length) continue;

            const char = line[col];

            // 檢查是否為琴格數字
            if (/[0-9]/.test(char)) {
                // 處理兩位數琴格（如 10, 12, 15）
                let fretStr = char;
                if (col + 1 < line.length && /[0-9]/.test(line[col + 1])) {
                    // 檢查下一個字元是否也是數字
                    fretStr += line[col + 1];
                }

                const fret = parseInt(fretStr);
                const midi = this.tuning[stringIdx] + fret;

                // 檢查技巧符號
                let technique = null;
                if (col + fretStr.length < line.length) {
                    const nextChar = line[col + fretStr.length];
                    if (TECHNIQUES[nextChar]) {
                        technique = TECHNIQUES[nextChar];
                    }
                }

                const note = Note.fromMidi(midi, { index: baseIndex });
                note.stringIndex = stringIdx;
                note.fret = fret;
                note.technique = technique;
                note.tabPosition = { string: stringIdx, fret, column: col };

                notes.push(note);
            } else if (char === 'x' || char === 'X') {
                // 悶音
                const note = new Note({
                    index: baseIndex,
                    type: 'mute',
                    stringIndex: stringIdx,
                    displayStr: 'x'
                });
                note.stringIndex = stringIdx;
                note.technique = 'mute';
                notes.push(note);
            }
        }

        return notes;
    }

    /**
     * 將音符轉換為 Tab 格式
     * @private
     */
    _notesToTab(notes, measuresPerLine, beatsPerMeasure) {
        const lines = ['', '', '', '', '', ''];
        const stringNames = ['e', 'B', 'G', 'D', 'A', 'E'];

        // 初始化每條弦
        for (let i = 0; i < 6; i++) {
            lines[i] = stringNames[i] + '|';
        }

        let beatCount = 0;
        let measureCount = 0;

        for (const note of notes) {
            if (note.isSeparator) {
                // 加入小節線
                for (let i = 0; i < 6; i++) {
                    lines[i] += '|';
                }
                measureCount++;
                beatCount = 0;

                // 換行
                if (measureCount >= measuresPerLine) {
                    for (let i = 0; i < 6; i++) {
                        lines[i] += '\n' + stringNames[i] + '|';
                    }
                    measureCount = 0;
                }
                continue;
            }

            // 找出音符在指板上的位置
            const position = this._findBestPosition(note);

            if (position) {
                const fretStr = position.fret.toString().padStart(2, '-');
                for (let i = 0; i < 6; i++) {
                    if (i === position.string) {
                        lines[i] += fretStr + '-';
                    } else {
                        lines[i] += '---';
                    }
                }
            } else {
                // 找不到位置，跳過
                for (let i = 0; i < 6; i++) {
                    lines[i] += '---';
                }
            }

            beatCount++;
            if (beatCount >= beatsPerMeasure) {
                for (let i = 0; i < 6; i++) {
                    lines[i] += '|';
                }
                beatCount = 0;
                measureCount++;
            }
        }

        // 結尾
        for (let i = 0; i < 6; i++) {
            if (!lines[i].endsWith('|')) {
                lines[i] += '|';
            }
        }

        return lines.join('\n');
    }

    /**
     * 找出音符在指板上的最佳位置
     * @private
     */
    _findBestPosition(note) {
        if (note.stringIndex !== undefined && note.fret !== undefined) {
            return { string: note.stringIndex, fret: note.fret };
        }

        const midi = note.midi || note.midiNote;
        if (!midi) return null;

        // 在所有弦上找可能的位置
        const positions = [];
        for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
            const fret = midi - this.tuning[stringIdx];
            if (fret >= 0 && fret <= 24) {
                positions.push({ string: stringIdx, fret });
            }
        }

        if (positions.length === 0) return null;

        // 優先選擇琴格較低的位置
        positions.sort((a, b) => a.fret - b.fret);
        return positions[0];
    }

    /**
     * 建立空白 Tab
     * @private
     */
    _createEmptyTab() {
        return [
            'e|------------|',
            'B|------------|',
            'G|------------|',
            'D|------------|',
            'A|------------|',
            'E|------------|'
        ].join('\n');
    }
}

// 匯出常量
export { TUNINGS, TECHNIQUES, STRING_NAMES };

export default TabParser;
