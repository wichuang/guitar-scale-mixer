// 簡譜 (Jianpu) 解析器
// 簡譜使用數字 1-7 表示音符，對應 Do Re Mi Fa Sol La Si

import { NOTES, STRING_TUNINGS, getNoteName } from './scaleData';

/**
 * 簡譜數字轉換對照表 (預設 C 調)
 * 1=C, 2=D, 3=E, 4=F, 5=G, 6=A, 7=B
 */
const JIANPU_TO_SEMITONE = {
    '1': 0,  // C
    '2': 2,  // D
    '3': 4,  // E
    '4': 5,  // F
    '5': 7,  // G
    '6': 9,  // A
    '7': 11, // B
};

/**
 * 根音偏移量 (半音)
 */
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
 * 將簡譜數字轉換為音符名稱
 * @param {string|number} jianpuNum - 簡譜數字 (1-7)
 * @param {number} octaveOffset - 八度偏移 (-1=低八度, 0=中央, 1=高八度)
 * @param {string} key - 調號 (預設 'C')
 * @returns {object|null} - { noteName, octave, midiNote }
 */
export function jianpuToNote(jianpuNum, octaveOffset = 0, key = 'C') {
    const num = String(jianpuNum);
    if (!JIANPU_TO_SEMITONE.hasOwnProperty(num)) {
        return null;
    }

    const baseSemitone = JIANPU_TO_SEMITONE[num];
    const keyOffset = KEY_OFFSETS[key] || 0;
    const totalSemitone = baseSemitone + keyOffset;

    // 中央 C = C4 = MIDI 60
    const baseOctave = 4 + octaveOffset;
    const midiNote = 60 + totalSemitone + (octaveOffset * 12);
    const noteName = NOTES[(totalSemitone % 12 + 12) % 12];

    return {
        noteName,
        octave: baseOctave,
        midiNote,
        jianpu: num,
    };
}

/**
 * 清理 OCR 識別結果，只保留簡譜相關字符
 * @param {string} text - OCR 識別的原始文字
 * @returns {string} - 清理後的文字
 */
export function cleanJianpuText(text) {
    // 第一步：移除常見的非簡譜文字（中文標題、歌詞提示等）
    let cleaned = text
        .replace(/[a-zA-Z]+/g, '') // 移除英文字母
        .replace(/[\u4e00-\u9fff]+/g, '') // 移除中文字
        .replace(/[，。！？、；：""''（）【】《》]/g, '') // 移除中文標點
        .replace(/[,!?;:"'()[\]<>{}]/g, '') // 移除英文標點
        .replace(/[089]/g, '') // 移除 0, 8, 9（簡譜不使用）
        .replace(/\n+/g, ' ') // 換行轉空格
        .replace(/\s+/g, ' ') // 多空格合併
        .trim();

    // 第二步：只保留簡譜相關字符
    // 1-7: 音符
    // .: 高八度標記
    // ·: 高八度標記（全形）
    // _: 低八度標記
    // ̣: 下加點（Unicode）
    // -: 延長音
    // |: 小節線
    // 空格: 分隔
    cleaned = cleaned.replace(/[^1-7\s.·_̣\-|]/g, '');

    return cleaned;
}

/**
 * 解析 OCR 識別的簡譜文字
 * @param {string} text - OCR 識別的文字
 * @param {string} key - 調號 (預設 'C')
 * @returns {Array} - 解析後的音符陣列
 */
export function parseJianpuText(text, key = 'C') {
    const notes = [];
    const cleaned = cleanJianpuText(text);
    const chars = cleaned.split('');
    let i = 0;

    while (i < chars.length) {
        const char = chars[i];

        if (char >= '1' && char <= '7') {
            let octaveOffset = 0;
            let displayStr = char;

            // 檢查前面的低八度標記
            // 底線 _ 或下加點 ̣ 表示低八度
            if (i > 0) {
                const prevChar = chars[i - 1];
                if (prevChar === '_' || prevChar === '̣') {
                    octaveOffset = -1;
                    displayStr = '₋' + char; // 低八度顯示
                }
                // 雙底線表示低兩個八度
                if (i > 1 && chars[i - 2] === '_' && prevChar === '_') {
                    octaveOffset = -2;
                    displayStr = '₌' + char;
                }
            }

            // 檢查後面的高八度標記
            // 點 . 或 · 表示高八度
            if (i + 1 < chars.length) {
                const nextChar = chars[i + 1];
                if (nextChar === '.' || nextChar === '·') {
                    octaveOffset = 1;
                    displayStr = char + '·';
                    i++; // 跳過點

                    // 雙點表示高兩個八度
                    if (i + 1 < chars.length && (chars[i + 1] === '.' || chars[i + 1] === '·')) {
                        octaveOffset = 2;
                        displayStr = char + '··';
                        i++;
                    }
                }
            }

            const note = jianpuToNote(char, octaveOffset, key);
            if (note) {
                notes.push({
                    ...note,
                    index: notes.length,
                    displayStr, // 用於 UI 顯示
                });
            }
        }
        i++;
    }

    return notes;
}

/**
 * 將簡譜陣列轉換為簡單文字表示
 * @param {Array} notes - 音符陣列
 * @returns {string}
 */
export function notesToJianpuString(notes) {
    return notes.map(n => {
        let str = n.jianpu;
        if (n.octave === 5) str += '·'; // 高八度
        if (n.octave === 3) str = '̣' + str; // 低八度 (下加點)
        return str;
    }).join(' ');
}

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
 * @param {number} midiNote - MIDI 音符號
 * @param {number} position - 把位 (1-12)
 * @returns {Array} - 可能的指板位置 [{ string, fret }]
 */
export function getPositionsForNote(midiNote, position = 1) {
    const pos = GUITAR_POSITIONS[position] || GUITAR_POSITIONS[1];
    const positions = [];

    // 遍歷 6 弦找出可能的位置
    STRING_TUNINGS.forEach((openNote, stringIdx) => {
        const fret = midiNote - openNote;

        // 檢查是否在有效範圍內
        if (fret >= 0 && fret <= 22) {
            // 優先選擇在把位範圍內的位置
            const inPosition = fret >= pos.start && fret <= pos.end;
            positions.push({
                string: stringIdx,
                fret,
                inPosition,
                stringName: ['E', 'B', 'G', 'D', 'A', 'E'][stringIdx],
            });
        }
    });

    // 按優先級排序：把位內 > 格數接近把位起點
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
 * @param {number} midiNote - MIDI 音符號
 * @param {number} position - 把位
 * @returns {object|null} - 最佳位置 { string, fret }
 */
export function getBestPosition(midiNote, position = 1) {
    const positions = getPositionsForNote(midiNote, position);
    return positions.length > 0 ? positions[0] : null;
}
