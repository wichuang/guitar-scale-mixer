/**
 * GuitarProParser - Guitar Pro (.gp, .gpx, .gp5, .gp4, .gp3) 解析器
 * 解析 Guitar Pro 二進位檔案，轉換為統一 Note 物件
 */

import { ParserInterface } from '../core/interfaces/ParserInterface.js';
import { Note } from '../core/models/Note.js';
import { parseTabFile } from 'guitarpro-parser';

export class GuitarProParser extends ParserInterface {
    constructor() {
        super();
        this._title = '';
        this._artist = '';
    }

    get name() {
        return 'GuitarProParser';
    }

    get description() {
        return 'Guitar Pro (.gp, .gp5, .gp4, .gp3) 解析器';
    }

    get title() { return this._title; }
    get artist() { return this._artist; }

    /**
     * 解析 Guitar Pro 二進位檔案
     * @param {Uint8Array} data - Guitar Pro 檔案位元組資料
     * @param {string} fileName - 用於輔助判斷格式的檔案名稱
     * @param {Object} options
     * @returns {Array<Note>}
     */
    parseBinary(data, fileName, options = {}) {
        try {
            const song = parseTabFile(data, fileName);
            this._title = song.title || '';
            this._artist = song.artist || '';

            return this._convertToNotes(song, options);
        } catch (err) {
            console.error('GuitarProParser parse error:', err);
            throw new Error(`無法解析 Guitar Pro 檔案: ${err.message}`);
        }
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

        // 我們目前只取第一個音軌(Track)的資料
        if (!song.tracks || song.tracks.length === 0) {
            return notes;
        }

        // 以第一個吉他音軌為主
        const track = song.tracks[0];

        let measureCount = 0;

        for (const bar of track.bars) {
            // 加入小節線
            if (measureCount > 0) {
                notes.push(Note.createSeparator({ index: noteIndex++ }));
            }
            measureCount++;

            for (const beat of bar.beats) {
                // 如果是休止符，我們還是加上一個代表時間長度的符號或忽略
                // 目前系統不一定會完全渲染休止符，但以防萬一
                if (beat.isRest) {
                    notes.push(Note.createRest({
                        index: noteIndex++,
                        duration: beat.duration
                    }));
                    continue;
                }

                // 處理這個 beat 下的所有音符
                const beatNotes = [];
                for (const beatNote of beat.notes) {
                    // beatNote.string 是 0-based，0 表示最細那根弦 (high E)
                    // 本系統的 stringIndex 也是 0=高E，因此直接對應
                    let technique = null;
                    if (beatNote.bend) technique = 'bend';
                    else if (beatNote.slide) technique = 'slide';
                    else if (beatNote.hammerOn) technique = 'hammer-on';
                    else if (beatNote.pullOff) technique = 'pull-off';
                    else if (beatNote.vibrato) technique = 'vibrato';
                    else if (beatNote.palmMute) technique = 'mute';
                    else if (beatNote.harmonic) technique = 'harmonic';

                    // 找出這個 string 在 tuning 中的對應 midi
                    // guitarpro-parser 中: tuning 是從低音到高音 (0=最低音弦)
                    // 所以 string = 0 (在 gp 中是最細的弦) 等於 tuning 中 index = tuning.length - 1

                    // track.tuningMidi 是由低到高（例如 Drop D：38, 45, 50, 55, 59, 64）
                    // 我們的 stringIndex 0 是高音弦 (64)，剛好對應 tuningMidi 的最後一個
                    const gpStringIdx = (track.tuningMidi.length - 1) - beatNote.string;
                    const baseMidi = track.tuningMidi[gpStringIdx] !== undefined
                        ? track.tuningMidi[gpStringIdx]
                        : (64 - beatNote.string * 5); // Fallback assumption (standard tuning rough offset)

                    const midiNode = baseMidi + beatNote.fret + (track.capoFret || 0);

                    const note = Note.fromMidi(midiNode, {
                        index: noteIndex,
                        duration: beat.duration,
                        stringIndex: beatNote.string,
                        fret: beatNote.fret,
                        technique,
                        format: 'guitarpro'
                    });

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
