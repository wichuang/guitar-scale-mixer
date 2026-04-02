/**
 * GuitarProParser - Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3) 解析器
 * 解析 Guitar Pro 二進位檔案，轉換為統一 Note 物件
 */

import { ParserInterface } from '../core/interfaces/ParserInterface.js';
import { Note } from '../core/models/Note.js';
import { parseTabFile } from 'guitarpro-parser';

/**
 * 根據升降記號數量推測調號
 * GP 檔案的 bar.keySignature 格式: 正數=升號數, 負數=降號數
 * 例: 3 = A major / F# minor, -2 = Bb major / G minor
 */
// 使用 sharp 等價名稱以配合 UI 的 NOTES 列表
const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_KEYS  = ['C', 'F', 'A#', 'D#', 'G#', 'C#', 'F#', 'B'];

/**
 * 從音符的 pitch class 統計推測調號 (Krumhansl-Schmuckler 簡化版)
 * 統計各 pitch class 的出現次數，找出最吻合大調音階的根音
 */
function detectKeyFromNotes(midiNotes) {
    if (!midiNotes || midiNotes.length === 0) return 'C';

    // 統計 pitch class (0-11)
    const counts = new Array(12).fill(0);
    for (const midi of midiNotes) {
        counts[midi % 12]++;
    }

    // Major scale intervals: [0, 2, 4, 5, 7, 9, 11]
    const majorIntervals = [0, 2, 4, 5, 7, 9, 11];
    // 使用 sharp 等價名稱以配合 UI
    const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    let bestKey = 0;
    let bestScore = -1;

    for (let root = 0; root < 12; root++) {
        let score = 0;
        for (const interval of majorIntervals) {
            score += counts[(root + interval) % 12];
        }
        // 加權：根音出現次數額外加分
        score += counts[root] * 0.5;

        if (score > bestScore) {
            bestScore = score;
            bestKey = root;
        }
    }

    return KEY_NAMES[bestKey];
}

export class GuitarProParser extends ParserInterface {
    constructor() {
        super();
        this._title = '';
        this._artist = '';
        this._tempo = 120;
        this._timeSignature = '4/4';
        this._key = 'C';
        this._song = null;
    }

    get name() {
        return 'GuitarProParser';
    }

    get description() {
        return 'Guitar Pro (.gp, .gp5, .gp4, .gp3) 解析器';
    }

    get title() { return this._title; }
    get artist() { return this._artist; }
    get tempo() { return this._tempo; }
    get timeSignature() { return this._timeSignature; }
    get key() { return this._key; }

    /**
     * 解析 Guitar Pro 二進位檔案並取得音軌清單
     * @param {Uint8Array} data
     * @param {string} fileName
     * @returns {{ tracks: Array<{ index: number, name: string, noteCount: number }>, song: Object }}
     */
    parseSong(data, fileName) {
        const song = parseTabFile(data, fileName);
        this._song = song;
        this._title = song.title || '';
        this._artist = song.artist || '';
        this._tempo = song.tempo || 120;

        // 從第一個小節取得拍號
        const firstTrack = song.tracks[0];
        if (firstTrack && firstTrack.bars.length > 0) {
            const ts = firstTrack.bars[0].timeSignature;
            if (ts) {
                this._timeSignature = `${ts.numerator}/${ts.denominator}`;
            }
        }

        // 調號偵測在 convertTrack 時按選定的音軌進行
        this._key = 'C';

        // 建立音軌清單
        const tracks = song.tracks.map((t, i) => {
            let noteCount = 0;
            for (const bar of t.bars) {
                for (const beat of bar.beats) {
                    if (!beat.isRest) {
                        noteCount += beat.notes.length;
                    }
                }
            }
            return {
                index: i,
                name: t.name || `Track ${i + 1}`,
                noteCount,
                bars: t.bars.length,
                tuning: t.tuning ? t.tuning.map(n => n.noteName || n).join(' ') : '',
                capo: t.capoFret || 0
            };
        });

        return { tracks, song };
    }

    /**
     * 解析 Guitar Pro 二進位檔案
     * @param {Uint8Array} data - Guitar Pro 檔案位元組資料
     * @param {string} fileName - 用於輔助判斷格式的檔案名稱
     * @param {Object} options
     * @param {number} options.trackIndex - 指定音軌索引
     * @returns {Array<Note>}
     */
    parseBinary(data, fileName, options = {}) {
        try {
            // 如果還沒解析過，先解析
            if (!this._song) {
                this.parseSong(data, fileName);
            }

            return this.convertTrack(options.trackIndex, options);
        } catch (err) {
            console.error('GuitarProParser parse error:', err);
            throw new Error(`無法解析 Guitar Pro 檔案: ${err.message}`);
        }
    }

    /**
     * 將指定音軌轉換為 Note 陣列
     * @param {number} trackIndex - 音軌索引（undefined 時自動選擇）
     * @param {Object} options
     * @returns {Array<Note>}
     */
    convertTrack(trackIndex, options = {}) {
        if (!this._song) {
            throw new Error('請先呼叫 parseSong() 或 parseBinary()');
        }

        // 決定要分析的音軌
        const song = this._song;
        let track;
        if (typeof trackIndex === 'number' && trackIndex < song.tracks.length) {
            track = song.tracks[trackIndex];
        } else {
            track = song.tracks[0];
            let maxNotes = 0;
            for (let i = 0; i < song.tracks.length; i++) {
                let nc = 0;
                for (const bar of song.tracks[i].bars) {
                    for (const beat of bar.beats) {
                        if (!beat.isRest) nc += beat.notes.length;
                    }
                }
                if (i === 0 && nc > 0) { track = song.tracks[0]; break; }
                if (nc > maxNotes) { maxNotes = nc; track = song.tracks[i]; }
            }
        }

        // 從選定音軌的 bar.keySignature 偵測調號
        let detectedKey = null;
        if (track.bars.length > 0) {
            const ks = track.bars[0].keySignature;
            if (typeof ks === 'number' && ks !== 0) {
                if (ks > 0 && ks <= 7) detectedKey = SHARP_KEYS[ks];
                else if (ks < 0 && ks >= -7) detectedKey = FLAT_KEYS[-ks];
            }
        }

        // 若無 keySignature，從此音軌的音符統計推測
        if (!detectedKey) {
            const trackMidi = [];
            for (const bar of track.bars) {
                for (const beat of bar.beats) {
                    if (!beat.isRest) {
                        for (const n of beat.notes) {
                            const gpIdx = n.string;
                            const baseMidi = track.tuningMidi[gpIdx] !== undefined
                                ? track.tuningMidi[gpIdx] : (64 - n.string * 5);
                            trackMidi.push(baseMidi + n.fret + (track.capoFret || 0));
                        }
                    }
                }
            }
            detectedKey = detectKeyFromNotes(trackMidi);
        }
        this._key = detectedKey || 'C';

        return this._convertToNotes(song, { ...options, trackIndex });
    }

    // ParserInterface 要求實作的 parse 方法，但不適用於純文字
    parse(text, options = {}) {
        throw new Error('GuitarProParser requires binary data. Use parseBinary() instead.');
    }

    /**
     * 將 Guitar Pro Song 物件轉換為 Note 陣列
     * @private
     */
    _convertToNotes(song, options = {}) {
        const notes = [];
        let noteIndex = 0;

        let track;

        if (typeof options.trackIndex === 'number' && options.trackIndex < song.tracks.length) {
            // 使用指定的音軌
            track = song.tracks[options.trackIndex];
        } else {
            // 自動選擇：預設取第一軌，若第一軌無音符則取音符最多的軌
            track = song.tracks[0];
            let track0HasNotes = false;
            let maxNotes = 0;
            let bestFallbackTrack = track;

            for (let i = 0; i < song.tracks.length; i++) {
                const t = song.tracks[i];
                let noteCount = 0;
                for (const bar of t.bars) {
                    for (const beat of bar.beats) {
                        if (!beat.isRest) {
                            noteCount += beat.notes.length;
                        }
                    }
                }

                if (i === 0 && noteCount > 0) {
                    track0HasNotes = true;
                }

                if (noteCount > maxNotes) {
                    maxNotes = noteCount;
                    bestFallbackTrack = t;
                }
            }

            if (!track0HasNotes) {
                track = bestFallbackTrack;
            }
        }

        let measureCount = 0;

        for (const bar of track.bars) {
            // 加入小節線
            if (measureCount > 0) {
                notes.push(Note.createSeparator({ index: noteIndex++ }));
            }
            measureCount++;

            for (const beat of bar.beats) {
                // 如果是休止符，加入帶有時值資訊的休止符
                if (beat.isRest) {
                    const rest = Note.createRest({
                        index: noteIndex++,
                        duration: beat.duration
                    });
                    rest.dotted = beat.dotted || 0;
                    rest.tuplet = beat.tuplet || null;
                    rest.beatTempo = beat.tempo || null;
                    notes.push(rest);
                    continue;
                }

                // 處理這個 beat 下的所有音符
                const beatNotes = [];
                for (const beatNote of beat.notes) {
                    let technique = null;
                    if (beatNote.bend) technique = 'bend';
                    else if (beatNote.slide) technique = 'slide';
                    else if (beatNote.hammerOn) technique = 'hammer-on';
                    else if (beatNote.pullOff) technique = 'pull-off';
                    else if (beatNote.vibrato) technique = 'vibrato';
                    else if (beatNote.palmMute) technique = 'mute';
                    else if (beatNote.harmonic) technique = 'harmonic';

                    const gpStringIdx = beatNote.string;
                    const baseMidi = track.tuningMidi[gpStringIdx] !== undefined
                        ? track.tuningMidi[gpStringIdx]
                        : (64 - beatNote.string * 5);

                    const midiNode = baseMidi + beatNote.fret + (track.capoFret || 0);

                    const note = Note.fromMidi(midiNode, {
                        index: noteIndex,
                        duration: beat.duration,
                        stringIndex: beatNote.string,
                        fret: beatNote.fret,
                        technique,
                        format: 'guitarpro',
                        key: this._key,
                        scaleType: 'Major'
                    });

                    // 儲存額外的節拍資訊，供播放引擎使用
                    note.dotted = beat.dotted || 0;
                    note.tuplet = beat.tuplet || null;
                    note.beatTempo = beat.tempo || null;

                    beatNotes.push(note);
                }

                // 如果同一個 beat 有多個音符，將它們視為和弦
                if (beatNotes.length === 1) {
                    notes.push(beatNotes[0]);
                    noteIndex++;
                } else if (beatNotes.length > 1) {
                    beatNotes.forEach((n, i) => {
                        n.isChord = true;
                        n.chordPosition = i;
                        notes.push(n);
                    });
                    noteIndex++;
                }
            }
        }

        return notes;
    }
}

export default GuitarProParser;
