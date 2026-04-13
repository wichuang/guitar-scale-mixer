/**
 * NoteEditor - 音符編輯元件
 * 包含編輯面板和音符列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import { jianpuToNote, notesToJianpuString } from '../../parsers/JianpuParser.js';
import { CHORD_ROOTS, CHORD_QUALITIES, getChordNotes } from '../../data/chordData.js';
import { STRING_TUNINGS, NOTES } from '../../data/scaleData.js';
const formatPlayTime = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

/**
 * 解析和弦名稱 → { root, quality, extension }
 * 支援: C, Am, F#m7, Bb, Gdim, Dsus4, E7, Cmaj7, A#m9 ...
 */
function parseChordName(name) {
    if (!name) return null;
    const str = name.trim();
    // 提取根音 (C, C#, Db, etc.)
    let root = '';
    if (str.length >= 2 && (str[1] === '#' || str[1] === 'b')) {
        root = str[0].toUpperCase() + str[1];
        if (root.endsWith('b')) {
            // 將降號轉為等音的升號: Db→C#, Eb→D#, Gb→F#, Ab→G#, Bb→A#
            const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };
            root = flatMap[root] || root;
        }
    } else {
        root = str[0].toUpperCase();
    }
    if (!CHORD_ROOTS.includes(root)) return null;

    const rest = str.slice(root === str[0] ? 1 : 2).toLowerCase();

    let quality = 'Major';
    let extension = 3;

    if (rest.startsWith('dim')) { quality = 'Dim'; }
    else if (rest.startsWith('aug') || rest.startsWith('+')) { quality = 'Aug'; }
    else if (rest.startsWith('sus2')) { quality = 'Sus2'; }
    else if (rest.startsWith('sus4')) { quality = 'Sus4'; }
    else if (rest.startsWith('m') && !rest.startsWith('maj')) { quality = 'Minor'; }
    else if (rest.startsWith('maj')) { quality = 'Major'; }

    // 提取數字延伸
    const numMatch = rest.match(/(\d+)/);
    if (numMatch) {
        const num = parseInt(numMatch[1]);
        if ([6, 7, 9, 11, 13].includes(num)) extension = num;
    }
    // 特殊: "7" without m/maj → Dominant 7
    if (extension >= 7 && quality === 'Major' && !rest.includes('maj')) {
        quality = 'Dominant';
    }
    // "m7" → Minor 7 (quality already Minor)
    // "maj7" → Major 7 (quality stays Major)

    return { root, quality, extension };
}

/**
 * 常見和弦指法表（開放把位）
 * key = "Root Quality Ext"，value = [string0fret, ..., string5fret]，-1 = 不彈
 */
const COMMON_VOICINGS = {
    'C Major 3': [-1, 0, 1, 0, 2, 3], 'C Major 7': [-1, 0, 0, 0, 2, 3],
    'D Major 3': [2, 3, 2, 0, -1, -1], 'D Minor 3': [1, 3, 2, 0, -1, -1],
    'D Dominant 7': [2, 1, 2, 0, -1, -1],
    'E Major 3': [0, 0, 1, 2, 2, 0], 'E Minor 3': [0, 0, 0, 2, 2, 0],
    'E Dominant 7': [0, 0, 1, 0, 2, 0],
    'F Major 3': [1, 1, 2, 3, 3, 1], 'F Minor 3': [1, 1, 1, 3, 3, 1],
    'G Major 3': [3, 0, 0, 0, 2, 3], 'G Dominant 7': [1, 0, 0, 0, 2, 3],
    'A Major 3': [0, 2, 2, 2, 0, -1], 'A Minor 3': [0, 1, 2, 2, 0, -1],
    'A Dominant 7': [0, 2, 0, 2, 0, -1],
    'B Dominant 7': [2, 0, 2, 1, 2, -1], 'B Minor 3': [2, 3, 4, 4, 2, -1],
};

/**
 * 從和弦名稱產生 chordFrets
 */
function chordToFrets(chordSymbol) {
    const parsed = parseChordName(chordSymbol);
    if (!parsed) return [];

    const { root, quality, extension } = parsed;
    const voicingKey = `${root} ${quality} ${extension}`;

    // 1. 查詢常用指法表
    if (COMMON_VOICINGS[voicingKey]) {
        const v = COMMON_VOICINGS[voicingKey];
        const frets = [];
        v.forEach((f, s) => { if (f >= 0) frets.push({ string: s, fret: f }); });
        return frets;
    }

    // 2. 自動計算: 找每根弦上最近根音位置的和弦音
    const chordNotes = getChordNotes(root, quality, extension);
    if (chordNotes.length === 0) return [];

    const rootIdx = NOTES.indexOf(root);
    // 找低把位根音 (從第5弦或第6弦)
    let rootFret = -1;
    for (let s = 5; s >= 4; s--) {
        for (let f = 0; f <= 5; f++) {
            const midi = STRING_TUNINGS[s] + f;
            if (NOTES[midi % 12] === root) { rootFret = f; break; }
        }
        if (rootFret >= 0) break;
    }
    if (rootFret < 0) rootFret = 0;

    const frets = [];
    for (let s = 0; s < 6; s++) {
        let best = -1;
        let bestDist = 999;
        for (let f = Math.max(0, rootFret - 1); f <= rootFret + 4; f++) {
            const midi = STRING_TUNINGS[s] + f;
            const noteName = NOTES[midi % 12];
            if (chordNotes.includes(noteName)) {
                const dist = Math.abs(f - rootFret);
                if (dist < bestDist) { bestDist = dist; best = f; }
            }
        }
        if (best >= 0) frets.push({ string: s, fret: best });
    }
    return frets;
}

/**
 * 取得時值底線數量
 */
function getUnderlineCount(duration) {
    if (!duration) return 0;
    if (duration.includes('32') || duration.includes('thirty')) return 3;
    if (duration.includes('16') || duration.includes('sixteenth')) return 2;
    if (duration.includes('eighth') || duration === '8th' || duration === '8') return 1;
    return 0;
}

/**
 * 技巧縮寫
 */
const TECHNIQUE_LABELS = {
    'slide': 'sl.',
    'hammer-on': 'H',
    'pull-off': 'P',
    'bend': 'B',
    'vibrato': '~',
    'mute': 'x',
    'harmonic': 'har.'
};

/**
 * 單個音符渲染元件 — 模仿標準簡譜排版
 *
 * 結構（由上到下）:
 *   技巧標記 (sl. / P / H ...)
 *   升降號 # / b（顯示在數字上方）
 *   高八度點
 *   音符數字（含附點）
 *   低八度點
 *   時值底線 (八分1條 / 十六分2條 / 三十二分3條)
 *   Tab fret
 */
function JianpuNoteCell({ note, idx, isActive, isSelected, onNoteSelect, showChords = true, showTab = true }) {
    const isRest = note.isRest || note._type === 'rest';
    const isExtension = note.isExtension || note._type === 'extension';
    const isSymbol = note.isSymbol || note._type === 'symbol';
    const isSpecial = isRest || isExtension || isSymbol;

    // 簡譜數字（不含升降號）
    let num = '';
    if (isRest) num = '0';
    else if (isExtension) num = '–';
    else if (isSymbol) num = note.displayStr || note.jianpu || '?';
    else num = String(note.jianpu || '?').replace(/[^0-9]/g, '') || String(note.jianpu || '?');

    // 升降號（獨立顯示在數字上方）
    const acc = note.accidentalStr || '';

    const octDiff = isSpecial ? 0 : ((note.octave || 4) + (note.displayOctaveShift || 0) - 4);
    const underlines = getUnderlineCount(note.duration);
    const isHalf = note.duration === 'half';
    const isWhole = note.duration === 'whole';
    const dotted = note.dotted || 0;
    const technique = note.technique ? (TECHNIQUE_LABELS[note.technique] || note.technique) : '';
    const hasFret = typeof note.fret === 'number' && typeof note.stringIndex === 'number';

    // Tab 位置：優先使用 chordFrets（和弦全部位置），否則用單音的 string/fret
    const tabPositions = note.chordFrets && note.chordFrets.length > 0
        ? note.chordFrets
        : (hasFret ? [{ string: note.stringIndex, fret: note.fret }] : []);

    const color = isActive ? '#4caf50' : '#eee';
    const dimColor = isActive ? '#4caf50' : '#777';
    const hasTie = note.tieStart;

    const chordSymbol = note.chordSymbol || '';

    return (
        <div
            data-active={isActive}
            onClick={(e) => onNoteSelect(idx, e)}
            title={note.noteName ? `${note.noteName}${note.octave}${technique ? ' ' + technique : ''}${hasTie ? ' (tie)' : ''}${chordSymbol ? ' [' + chordSymbol + ']' : ''}` : num}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '26px',
                padding: '0 1px',
                cursor: 'pointer',
                borderRadius: '3px',
                background: isSelected ? 'rgba(33,150,243,0.2)' : 'transparent',
                outline: isSelected ? '2px solid #2196F3' : 'none',
                position: 'relative',
            }}
        >
            {/* 和弦名稱 (Chord symbol) */}
            {showChords && (
                <div style={{ height: '14px', fontSize: '10px', fontWeight: 'bold', color: chordSymbol ? '#ff9800' : 'transparent', lineHeight: '14px', whiteSpace: 'nowrap' }}>
                    {chordSymbol || '\u00A0'}
                </div>
            )}

            {/* 技巧標記 */}
            <div style={{ height: '13px', fontSize: '9px', color: dimColor, lineHeight: '13px', whiteSpace: 'nowrap' }}>
                {technique || '\u00A0'}
            </div>

            {/* 升降號 (顯示在數字上方，如標準簡譜) */}
            <div style={{ height: '14px', fontSize: '13px', fontWeight: 'bold', color, lineHeight: '14px' }}>
                {!isSpecial && acc ? acc : '\u00A0'}
            </div>

            {/* 高八度點 */}
            <div style={{ height: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                {octDiff > 0 && Array.from({ length: octDiff }).map((_, i) => (
                    <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: color }} />
                ))}
            </div>

            {/* 音符數字 + 附點 */}
            <div style={{
                fontSize: '22px',
                fontWeight: 'bold',
                lineHeight: '1',
                color,
                textShadow: isActive ? '0 0 8px rgba(76,175,80,0.5)' : 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'baseline'
            }}>
                <span style={{ textDecoration: (isHalf || isWhole) && !isSpecial ? 'underline' : 'none', textUnderlineOffset: '4px' }}>
                    {num}
                </span>
                {dotted > 0 && (
                    <span style={{ fontSize: '16px', marginLeft: '1px', lineHeight: '1' }}>
                        {'·'.repeat(dotted)}
                    </span>
                )}
            </div>

            {/* 低八度點 */}
            <div style={{ height: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                {octDiff < 0 && Array.from({ length: Math.abs(octDiff) }).map((_, i) => (
                    <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: color }} />
                ))}
            </div>

            {/* 時值底線 (八分/十六分/三十二分) */}
            <div style={{ height: '10px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'flex-start' }}>
                {underlines > 0 && Array.from({ length: underlines }).map((_, i) => (
                    <div key={i} style={{ height: '2px', background: color, borderRadius: '1px' }} />
                ))}
            </div>

            {/* 延音線弧線 (Tie arc) — 顯示在音符上方 */}
            {hasTie && (
                <svg
                    style={{
                        position: 'absolute',
                        top: '12px',
                        left: '50%',
                        width: '28px',
                        height: '10px',
                        overflow: 'visible',
                        pointerEvents: 'none'
                    }}
                    viewBox="0 0 28 10"
                >
                    <path
                        d="M 0 10 Q 14 0 28 10"
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                    />
                </svg>
            )}

            {/* Tab 六線譜 (6 strings with fret numbers) */}
            {showTab && (
                <div style={{
                    width: '100%',
                    height: '46px',
                    position: 'relative',
                    marginTop: '3px'
                }}>
                    {/* 6 弦線 */}
                    {[0, 1, 2, 3, 4, 5].map(s => (
                        <div key={s} style={{
                            position: 'absolute',
                            top: `${s * 8 + 2}px`,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: '#444'
                        }} />
                    ))}
                    {/* Fret 數字（顯示所有和弦位置） */}
                    {!isRest && tabPositions.map((pos, pi) => (
                        <span key={pi} style={{
                            position: 'absolute',
                            top: `${pos.string * 8 - 4}px`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: isActive ? '#4caf50' : '#ccc',
                            background: '#111',
                            padding: '0 2px',
                            lineHeight: '1',
                            zIndex: 1
                        }}>
                            {pos.fret}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * 連音符號元件 — 在一組連音上方顯示括號和數字（不影響佈局）
 */
function TupletBracket({ num }) {
    return (
        <div style={{
            position: 'absolute',
            top: '-2px',
            left: '2px',
            right: '2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 2
        }}>
            <span style={{ fontSize: '9px', color: '#ffb74d', fontWeight: 'bold', lineHeight: '1', background: '#111', padding: '0 2px' }}>{num}</span>
            <div style={{
                width: '100%',
                height: '3px',
                borderLeft: '1px solid #ffb74d',
                borderRight: '1px solid #ffb74d',
                borderTop: '1px solid #ffb74d',
                borderRadius: '2px 2px 0 0',
                marginTop: '-1px'
            }} />
        </div>
    );
}

/**
 * 將小節內的音符按連音分組
 * 回傳 groups: [{ type: 'normal'|'tuplet', items, tupletNum }]
 */
function groupByTuplet(measureNotes) {
    const groups = [];
    let i = 0;
    while (i < measureNotes.length) {
        const { note } = measureNotes[i];
        if (note.tuplet && note.tuplet.num) {
            const tupletNum = note.tuplet.num;
            const tupletDen = note.tuplet.den;
            const items = [];
            while (i < measureNotes.length) {
                const cn = measureNotes[i].note;
                if (cn.tuplet && cn.tuplet.num === tupletNum && cn.tuplet.den === tupletDen) {
                    items.push(measureNotes[i]);
                    i++;
                } else {
                    break;
                }
            }
            groups.push({ type: 'tuplet', items, tupletNum });
        } else {
            groups.push({ type: 'normal', items: [measureNotes[i]] });
            i++;
        }
    }
    return groups;
}

/**
 * JianpuScoreView - 簡譜樂譜排版元件
 * 以小節為單位排列，含連音括號、時值、Tab，可捲動
 */
function JianpuScoreView({ notes, currentNoteIndex, selectedNoteIndex, onNoteSelect, showChords, showTab }) {
    const measures = React.useMemo(() => {
        const result = [];
        let current = [];
        let measureNum = 1;
        let pendingSepType = null; // 前一個分隔符號類型

        notes.forEach((note, idx) => {
            if (note.isSeparator || note._type === 'separator') {
                if (current.length > 0) {
                    result.push({ notes: current, number: measureNum++, startSep: pendingSepType, endSep: note.displayStr || '|' });
                    current = [];
                    pendingSepType = note.displayStr || '|';
                } else {
                    // 連續分隔符號（如 :| 後接 |:）
                    pendingSepType = note.displayStr || '|';
                }
            } else {
                current.push({ note, idx });
            }
        });
        if (current.length > 0) {
            result.push({ notes: current, number: measureNum, startSep: pendingSepType, endSep: null });
        }
        return result;
    }, [notes]);

    const scrollRef = React.useRef(null);

    React.useEffect(() => {
        if (currentNoteIndex >= 0 && scrollRef.current) {
            const activeEl = scrollRef.current.querySelector('[data-active="true"]');
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [currentNoteIndex]);

    const barLineStyle = { width: '2px', background: '#555', flexShrink: 0, alignSelf: 'stretch' };

    // 根據分隔類型渲染小節線
    const renderBarLine = (sepType) => {
        if (!sepType || sepType === '|') {
            return <div style={barLineStyle} />;
        }
        if (sepType === '||') {
            return (
                <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignSelf: 'stretch' }}>
                    <div style={{ width: '2px', background: '#888' }} />
                    <div style={{ width: '3px', background: '#ccc' }} />
                </div>
            );
        }
        if (sepType === '|:') {
            return (
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0, alignSelf: 'stretch', position: 'relative' }}>
                    <div style={{ width: '3px', background: '#ccc', alignSelf: 'stretch' }} />
                    <div style={{ width: '2px', background: '#888', alignSelf: 'stretch' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '2px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ff9800' }} />
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ff9800' }} />
                    </div>
                </div>
            );
        }
        if (sepType === ':|') {
            return (
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0, alignSelf: 'stretch', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginRight: '2px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ff9800' }} />
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ff9800' }} />
                    </div>
                    <div style={{ width: '2px', background: '#888', alignSelf: 'stretch' }} />
                    <div style={{ width: '3px', background: '#ccc', alignSelf: 'stretch' }} />
                </div>
            );
        }
        // 方向記號 (D.C., D.S., Coda, Fine, Segno, To Coda)
        const directionMarkers = ['D.C.', 'D.S.', 'Coda', 'Fine', 'Segno', 'To Coda', 'D.C. al Fine', 'D.S. al Coda'];
        if (directionMarkers.includes(sepType)) {
            return (
                <div style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0, padding: '0 2px' }}>
                    <div style={barLineStyle} />
                    <span style={{ fontSize: '9px', color: '#ff9800', fontWeight: 'bold', fontStyle: 'italic', marginLeft: '3px', whiteSpace: 'nowrap' }}>
                        {sepType === 'Coda' ? '𝄌' : sepType === 'Segno' ? '𝄋' : sepType}
                    </span>
                </div>
            );
        }
        return <div style={barLineStyle} />;
    };

    return (
        <div
            ref={scrollRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                background: '#111',
                borderRadius: '8px',
                border: '1px solid #333'
            }}
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0' }}>
                {measures.map((measure) => {
                    const groups = groupByTuplet(measure.notes);

                    return (
                        <div
                            key={measure.number}
                            style={{
                                display: 'flex',
                                alignItems: 'stretch',
                                marginBottom: '6px'
                            }}
                        >
                            {/* 小節號（每小節都顯示，確保換行起始可見） */}
                            <span style={{
                                fontSize: '10px',
                                color: '#555',
                                alignSelf: 'flex-start',
                                marginRight: '2px',
                                marginTop: '2px',
                                userSelect: 'none',
                                minWidth: '16px',
                                textAlign: 'right'
                            }}>
                                {measure.number}
                            </span>

                            {renderBarLine(measure.startSep || '|')}

                            {/* 小節內音符（按連音分組） */}
                            <div style={{ display: 'flex', alignItems: 'stretch', padding: '0 4px' }}>
                                {groups.map((group, gi) => {
                                    if (group.type === 'tuplet') {
                                        return (
                                            <div key={gi} style={{ display: 'flex', position: 'relative' }}>
                                                <TupletBracket num={group.tupletNum} />
                                                {group.items.map(({ note, idx }) => (
                                                    <JianpuNoteCell
                                                        key={idx}
                                                        note={note}
                                                        idx={idx}
                                                        isActive={idx === currentNoteIndex}
                                                        isSelected={idx === selectedNoteIndex}
                                                        onNoteSelect={onNoteSelect}
                                                        showChords={showChords}
                                                        showTab={showTab}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    }
                                    const { note, idx } = group.items[0];
                                    return (
                                        <JianpuNoteCell
                                            key={idx}
                                            note={note}
                                            idx={idx}
                                            isActive={idx === currentNoteIndex}
                                            isSelected={idx === selectedNoteIndex}
                                            onNoteSelect={onNoteSelect}
                                            showChords={showChords}
                                            showTab={showTab}
                                        />
                                    );
                                })}
                            </div>

                            {renderBarLine(measure.endSep || '|')}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function NoteEditor({
    notes,
    notePositions,
    currentNoteIndex,
    selectedNoteIndex,
    isPlaying,
    playTime,
    audioLoading,
    musicKey,
    scaleType,
    tempo,
    onTempoChange,
    onNotesChange,
    onTextChange,
    onSelectedNoteChange,
    onNoteSelect,
    onTogglePlay,
    playNote
}) {
    const [hoverInfo, setHoverInfo] = useState('');
    const [editPanelOpen, setEditPanelOpen] = useState(false);
    const [showChords, setShowChords] = useState(true);
    const [showTab, setShowTab] = useState(true);
    const [fullscreen, setFullscreen] = useState(false);

    /**
     * 同步更新 editableText
     */
    const syncEditableText = useCallback((newNotes) => {
        onTextChange(notesToJianpuString(newNotes));
    }, [onTextChange]);

    /**
     * 刪除音符
     */
    const handleDeleteNote = () => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;

        const deletedIndex = selectedNoteIndex;
        const newNotes = notes.filter((_, idx) => idx !== deletedIndex);
        onNotesChange(newNotes);
        syncEditableText(newNotes);

        if (newNotes.length === 0) {
            onSelectedNoteChange(-1);
        } else if (deletedIndex >= newNotes.length) {
            onSelectedNoteChange(-1);
        } else {
            onSelectedNoteChange(-1);
            setTimeout(() => onSelectedNoteChange(deletedIndex), 0);
        }
    };

    /**
     * 調整八度 (Relative)
     */
    const handleShiftOctave = (direction) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const oldOctave = currentNote.octave || 4;
        const newOctave = Math.max(2, Math.min(6, oldOctave + direction));

        if (newOctave === oldOctave) return;

        let newDisplay = String(currentNote.jianpu);
        if (newOctave >= 5) newDisplay = newDisplay + '.'.repeat(newOctave - 4);
        if (newOctave === 3) newDisplay = '_' + newDisplay;
        if (newOctave === 2) newDisplay = '__' + newDisplay;

        const oldDisplay = currentNote.displayStr || String(currentNote.jianpu);
        if (oldDisplay.includes('#')) newDisplay += '#';
        else if (oldDisplay.includes('b')) newDisplay += 'b';

        newNotes[selectedNoteIndex] = {
            ...currentNote,
            octave: newOctave,
            midiNote: currentNote.midiNote + (newOctave - oldOctave) * 12,
            displayStr: newDisplay,
            accidentalStr: oldDisplay.includes('#') ? '#' : (oldDisplay.includes('b') ? 'b' : '')
        };
        onNotesChange(newNotes);
        syncEditableText(newNotes);
    };

    /**
     * 全曲升降八度
     */
    const handleShiftAllOctaves = (direction) => {
        const newNotes = notes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension || note.isSymbol) return note;

            const oldOctave = note.octave || 4;
            const newOctave = Math.max(2, Math.min(6, oldOctave + direction));

            if (newOctave === oldOctave) return note;

            let newDisplay = String(note.jianpu);
            if (newOctave >= 5) newDisplay = newDisplay + '.'.repeat(newOctave - 4);
            if (newOctave === 3) newDisplay = '_' + newDisplay;
            if (newOctave === 2) newDisplay = '__' + newDisplay;

            if (note.accidentalStr) newDisplay += note.accidentalStr;
            else if (note.displayStr?.includes('#')) newDisplay += '#';
            else if (note.displayStr?.includes('b')) newDisplay += 'b';

            return {
                ...note,
                octave: newOctave,
                midiNote: note.midiNote + (newOctave - oldOctave) * 12,
                displayStr: newDisplay
            };
        });
        onNotesChange(newNotes);
        syncEditableText(newNotes);
    };

    /**
     * 插入符號
     */
    const handleInsertSymbol = (symbol, position = 'after') => {
        if (selectedNoteIndex < 0) return;

        let newNote = null;
        if (symbol === '0') {
            newNote = {
                jianpu: '0',
                displayStr: '0',
                isRest: true,
                _type: 'rest',
                octave: 4,
                index: 0
            };
        } else if (symbol === '-') {
            newNote = {
                jianpu: '-',
                displayStr: '-',
                isExtension: true,
                _type: 'extension',
                octave: 4,
                index: 0
            };
        } else if (symbol === '|' || symbol === '||' || symbol === '|:' || symbol === ':|') {
            newNote = {
                jianpu: symbol,
                displayStr: symbol,
                isSeparator: true,
                _type: 'separator',
                octave: 4,
                index: 0
            };
        } else if (['D.C.', 'D.S.', 'Fine', 'Segno', 'Coda', 'To Coda', 'D.C. al Fine', 'D.S. al Coda'].includes(symbol)) {
            newNote = {
                jianpu: symbol,
                displayStr: symbol,
                isSeparator: true,
                _type: 'separator',
                octave: 4,
                index: 0
            };
        } else {
            newNote = {
                jianpu: symbol,
                displayStr: symbol,
                isSymbol: true,
                _type: 'symbol',
                octave: 4,
                index: 0
            };
        }

        if (newNote) {
            const newNotes = [...notes];
            const insertIndex = position === 'after' ? selectedNoteIndex + 1 : selectedNoteIndex;
            newNotes.splice(insertIndex, 0, newNote);
            onNotesChange(newNotes);
            syncEditableText(newNotes);
            onSelectedNoteChange(insertIndex);
        }
    };

    /**
     * 切換升降記號
     */
    const handleToggleAccidental = (type) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const hasSharp = currentNote.noteName?.includes('#');
        const hasFlat = currentNote.noteName?.includes('b');

        if (type === 'sharp') {
            if (hasSharp) {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote - 1,
                    noteName: currentNote.noteName.replace('#', ''),
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', ''),
                    accidentalStr: ''
                };
            } else {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote + (hasFlat ? 2 : 1),
                    noteName: currentNote.noteName.replace('b', '') + '#',
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', '') + '#',
                    accidentalStr: '#'
                };
            }
        } else if (type === 'flat') {
            if (hasFlat) {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote + 1,
                    noteName: currentNote.noteName.replace('b', ''),
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', ''),
                    accidentalStr: ''
                };
            } else {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote - (hasSharp ? 2 : 1),
                    noteName: currentNote.noteName.replace('#', '') + 'b',
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', '') + 'b',
                    accidentalStr: 'b'
                };
            }
        }

        onNotesChange(newNotes);
        syncEditableText(newNotes);
    };

    /**
     * 鍵盤輸入處理
     */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // 1-7: Change Pitch
            if (e.key >= '1' && e.key <= '7') {
                if (selectedNoteIndex >= 0) {
                    const oldNote = notes[selectedNoteIndex];
                    if (oldNote.isSeparator || oldNote.isExtension) return;

                    // 從舊音符的 MIDI 值推算八度偏移，避免 octave 屬性不一致的問題
                    let octaveOffset = (oldNote.octave || 4) - 4;
                    const oldMidi = oldNote.midiNote ?? oldNote.midi;
                    if (oldMidi != null && oldNote.jianpu >= 1 && oldNote.jianpu <= 7) {
                        const baseData = jianpuToNote(String(oldNote.jianpu), 0, musicKey, scaleType);
                        if (baseData) {
                            octaveOffset = Math.round((oldMidi - baseData.midiNote) / 12);
                        }
                    }

                    const noteData = jianpuToNote(e.key, octaveOffset, musicKey, scaleType);
                    if (noteData) {
                        const newNotes = [...notes];
                        let ds = e.key;
                        const dispOct = noteData.octave;
                        if (dispOct === 5) ds += '·';
                        if (dispOct === 6) ds += '··';
                        if (dispOct === 3) ds = '₋' + ds;
                        if (dispOct === 2) ds = '₌' + ds;

                        newNotes[selectedNoteIndex] = {
                            ...oldNote,
                            ...noteData,
                            jianpu: e.key,
                            displayStr: ds,
                            _type: 'note',
                            isNote: true,
                            isRest: false,
                            isExtension: false,
                            isSymbol: false
                        };
                        onNotesChange(newNotes);
                        syncEditableText(newNotes);
                    }
                }
            }

            // 0: Change to Rest
            if (e.key === '0') {
                if (selectedNoteIndex >= 0) {
                    const newNotes = [...notes];
                    newNotes[selectedNoteIndex] = {
                        jianpu: '0',
                        displayStr: '0',
                        _type: 'rest',
                        isRest: true,
                        isNote: false,
                        isExtension: false,
                        isSymbol: false,
                        octave: 4,
                        index: selectedNoteIndex
                    };
                    onNotesChange(newNotes);
                    syncEditableText(newNotes);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNoteIndex, notes, musicKey, scaleType, onNotesChange, syncEditableText]);

    /**
     * 選擇音符進行編輯
     */
    const handleNoteItemSelect = (index, e) => {
        e.stopPropagation();
        // 讓焦點離開 INPUT/TEXTAREA，以便鍵盤快捷鍵（數字 0-7）可正常運作
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
        }
        onSelectedNoteChange(selectedNoteIndex === index ? -1 : index);

        // 播放選中的音符
        const note = notes[index];
        if (note && !note.isSeparator) {
            const pos = notePositions[index];
            if (pos && !audioLoading && playNote) {
                playNote(note.midiNote, pos.string);
            }
        }
    };

    /**
     * 修改選中音符的屬性
     */
    const handleUpdateNoteProperty = useCallback((prop, value) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const newNotes = [...notes];
        newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], [prop]: value };
        onNotesChange(newNotes);
        syncEditableText(newNotes);
    }, [selectedNoteIndex, notes, onNotesChange, syncEditableText]);

    /**
     * 設定選中音符的時值
     */
    const handleSetDuration = useCallback((duration) => {
        handleUpdateNoteProperty('duration', duration);
    }, [handleUpdateNoteProperty]);

    /**
     * 切換附點
     */
    const handleToggleDotted = useCallback(() => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const current = notes[selectedNoteIndex].dotted || 0;
        // 循環: 0 → 1 → 2 → 0
        handleUpdateNoteProperty('dotted', current >= 2 ? 0 : current + 1);
    }, [selectedNoteIndex, notes, handleUpdateNoteProperty]);

    /**
     * 設定連音符
     */
    const handleSetTuplet = useCallback((tuplet) => {
        handleUpdateNoteProperty('tuplet', tuplet);
    }, [handleUpdateNoteProperty]);

    /**
     * 切換延音線 (Tie)
     * 將選中音符標記為延音開始，下一個相同音高的音符為延音結束
     */
    const handleToggleTie = useCallback(() => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator || note.isRest || note.isExtension || note.isSymbol) return;

        const newNotes = [...notes];
        const currentTie = note.tieStart || false;
        newNotes[selectedNoteIndex] = { ...note, tieStart: !currentTie };

        // 更新下一個非分隔音符的 tieEnd 狀態
        if (!currentTie) {
            // 開啟 tie：找下一個可用音符設為 tieEnd
            for (let i = selectedNoteIndex + 1; i < newNotes.length; i++) {
                const n = newNotes[i];
                if (n.isSeparator || n.isSymbol) continue;
                newNotes[i] = { ...n, tieEnd: true };
                break;
            }
        } else {
            // 關閉 tie：清除下一個音符的 tieEnd
            for (let i = selectedNoteIndex + 1; i < newNotes.length; i++) {
                const n = newNotes[i];
                if (n.isSeparator || n.isSymbol) continue;
                newNotes[i] = { ...n, tieEnd: false };
                break;
            }
        }

        onNotesChange(newNotes);
        syncEditableText(newNotes);
    }, [selectedNoteIndex, notes, onNotesChange, syncEditableText]);

    /**
     * 設定段落速度
     */
    const handleSetBeatTempo = useCallback((value) => {
        const tempo = value === '' ? null : Number(value);
        handleUpdateNoteProperty('beatTempo', (tempo != null && tempo > 0) ? tempo : null);
    }, [handleUpdateNoteProperty]);

    const selectedNote = selectedNoteIndex >= 0 && selectedNoteIndex < notes.length ? notes[selectedNoteIndex] : null;
    const isNoteEditable = selectedNoteIndex >= 0 && selectedNote && !selectedNote.isSeparator && !selectedNote.isSymbol;

    // 時值 SVG 圖示（跨平台一致顯示）
    const NoteSvg = ({ filled = true, stem = true, flags = 0, size = 20 }) => (
        <svg width={size} height={size} viewBox="0 0 20 24" style={{ display: 'block' }}>
            {/* 符頭 */}
            <ellipse cx="8" cy="18" rx="5" ry="3.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" transform="rotate(-20,8,18)" />
            {/* 符桿 */}
            {stem && <line x1="12.5" y1="17" x2="12.5" y2="3" stroke="currentColor" strokeWidth="1.5" />}
            {/* 符尾 */}
            {flags >= 1 && <path d="M12.5 3 Q16 6 13 10" stroke="currentColor" strokeWidth="1.3" fill="none" />}
            {flags >= 2 && <path d="M12.5 7 Q16 10 13 14" stroke="currentColor" strokeWidth="1.3" fill="none" />}
            {flags >= 3 && <path d="M12.5 11 Q16 14 13 18" stroke="currentColor" strokeWidth="1.3" fill="none" />}
        </svg>
    );

    const DURATION_OPTIONS = [
        { value: 'whole',    icon: <NoteSvg filled={false} stem={false} />,  title: '全音符 (4 beats)' },
        { value: 'half',     icon: <NoteSvg filled={false} stem={true} />,   title: '二分音符 (2 beats)' },
        { value: 'quarter',  icon: <NoteSvg filled={true} stem={true} />,    title: '四分音符 (1 beat)' },
        { value: 'eighth',   icon: <NoteSvg filled={true} flags={1} />,      title: '八分音符 (1/2 beat)' },
        { value: '16th',     icon: <NoteSvg filled={true} flags={2} />,      title: '十六分音符 (1/4 beat)' },
        { value: '32nd',     icon: <NoteSvg filled={true} flags={3} />,      title: '三十二分音符 (1/8 beat)' },
    ];

    // 連音符選項
    const TUPLET_OPTIONS = [
        { value: null,            label: '無',  title: '無連音' },
        { value: { num: 3, den: 2 }, label: '3',   title: '三連音 (3:2)' },
        { value: { num: 5, den: 4 }, label: '5',   title: '五連音 (5:4)' },
        { value: { num: 6, den: 4 }, label: '6',   title: '六連音 (6:4)' },
        { value: { num: 7, den: 4 }, label: '7',   title: '七連音 (7:4)' },
    ];

    return (
        <div className="note-editor-area">
            {/* 左側：編輯面板（可收合） */}
            <div className="editor-panel" style={editPanelOpen ? {} : { width: 'auto', minWidth: '40px', padding: '8px', gap: '8px' }}>
                <h4
                    onClick={() => setEditPanelOpen(prev => !prev)}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <span style={{
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: editPanelOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        fontSize: '12px'
                    }}>&#9654;</span>
                    {editPanelOpen ? 'Edit Panel' : 'Edit'}
                </h4>

                {!editPanelOpen && selectedNote && !selectedNote.isSeparator && (
                    <div style={{ writingMode: 'vertical-rl', fontSize: '13px', color: '#4caf50', whiteSpace: 'nowrap' }}>
                        {selectedNote.displayStr || selectedNote.jianpu}({selectedNote.noteName}{selectedNote.octave})
                    </div>
                )}

                {editPanelOpen && <>
                {/* ── 選中音符 ── */}
                <div className="selected-note-info">
                    <span className="selected-label">選中：</span>
                    <span className="selected-value">
                        {selectedNote
                            ? (selectedNote.isSeparator
                                ? '| 小節線'
                                : `${selectedNote.displayStr || selectedNote.jianpu} (${selectedNote.noteName}${selectedNote.octave})`)
                            : '未選擇'}
                    </span>
                </div>

                {/* ── 音高 ── */}
                <div className="editor-group">
                    <span className="editor-label">音高</span>
                    <div className="editor-buttons">
                        <button className={`editor-btn ${selectedNote?.accidentalStr === '#' ? 'active' : ''}`} onClick={() => handleToggleAccidental('sharp')} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('升記號 #')} onMouseLeave={() => setHoverInfo('')}>#</button>
                        <button className={`editor-btn ${selectedNote?.accidentalStr === 'b' ? 'active' : ''}`} onClick={() => handleToggleAccidental('flat')} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('降記號 b')} onMouseLeave={() => setHoverInfo('')}>b</button>
                        <button className="editor-btn" onClick={() => handleShiftOctave(1)} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('升八度')} onMouseLeave={() => setHoverInfo('')}>+8ve</button>
                        <button className="editor-btn" onClick={() => handleShiftOctave(-1)} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('降八度')} onMouseLeave={() => setHoverInfo('')}>-8ve</button>
                    </div>
                    <div className="editor-buttons" style={{ marginTop: '4px' }}>
                        <button className="editor-btn secondary" onClick={() => handleShiftAllOctaves(1)} onMouseEnter={() => setHoverInfo('全曲升八度')} onMouseLeave={() => setHoverInfo('')}>全+8</button>
                        <button className="editor-btn secondary" onClick={() => handleShiftAllOctaves(-1)} onMouseEnter={() => setHoverInfo('全曲降八度')} onMouseLeave={() => setHoverInfo('')}>全-8</button>
                    </div>
                </div>

                {/* ── 時值 ── */}
                <div className="editor-group">
                    <span className="editor-label">時值</span>
                    <div className="editor-buttons" style={{ flexWrap: 'wrap', gap: '4px' }}>
                        {DURATION_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                className={`editor-btn small ${(selectedNote?.duration || 'quarter') === opt.value ? 'active' : ''}`}
                                onClick={() => handleSetDuration(opt.value)}
                                disabled={!isNoteEditable}
                                title={opt.title}
                                onMouseEnter={() => setHoverInfo(opt.title)}
                                onMouseLeave={() => setHoverInfo('')}
                                style={{ minWidth: '32px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '4px' }}
                            >{opt.icon}</button>
                        ))}
                    </div>
                    {/* 附點 + 連音 (同一區塊) */}
                    <div className="editor-buttons" style={{ marginTop: '6px', gap: '4px' }}>
                        <button
                            className={`editor-btn ${(selectedNote?.dotted || 0) >= 1 ? 'active' : ''}`}
                            onClick={handleToggleDotted}
                            disabled={!isNoteEditable}
                            onMouseEnter={() => setHoverInfo('附點：無→單(×1.5)→複(×1.75)→無')}
                            onMouseLeave={() => setHoverInfo('')}
                            style={{ flex: 1 }}
                        >{(selectedNote?.dotted || 0) === 0 ? '· 無' : (selectedNote?.dotted || 0) === 1 ? '· 單附點' : '·· 複附點'}</button>
                    </div>
                    <div className="editor-buttons" style={{ marginTop: '4px', gap: '4px' }}>
                        {TUPLET_OPTIONS.map((opt, i) => {
                            const ct = selectedNote?.tuplet;
                            const active = opt.value === null ? !ct : (ct?.num === opt.value?.num && ct?.den === opt.value?.den);
                            return (
                                <button key={i} className={`editor-btn small ${active ? 'active' : ''}`} onClick={() => handleSetTuplet(opt.value)} disabled={!isNoteEditable} title={opt.title} onMouseEnter={() => setHoverInfo(opt.title)} onMouseLeave={() => setHoverInfo('')}>{opt.label}</button>
                            );
                        })}
                    </div>
                    {/* 延音線 (Tie) */}
                    <div className="editor-buttons" style={{ marginTop: '6px', gap: '4px' }}>
                        <button
                            className={`editor-btn ${selectedNote?.tieStart ? 'active' : ''}`}
                            onClick={handleToggleTie}
                            disabled={!isNoteEditable}
                            onMouseEnter={() => setHoverInfo('延音線：將此音符與下一音符連結（不重新起音）')}
                            onMouseLeave={() => setHoverInfo('')}
                            style={{ flex: 1 }}
                        >{selectedNote?.tieStart ? '⌢ 延音 ON' : '⌢ 延音'}</button>
                    </div>
                </div>

                {/* ── 和弦 ── */}
                <div className="editor-group">
                    <span className="editor-label">和弦</span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <select
                            value={selectedNote?.chordSymbol ?? ''}
                            onChange={(e) => {
                                const chord = e.target.value || null;
                                if (!chord) {
                                    // 清除和弦 + TAB
                                    const newNotes = [...notes];
                                    newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], chordSymbol: null, chordFrets: [], stringIndex: undefined, fret: undefined };
                                    onNotesChange(newNotes);
                                    syncEditableText(newNotes);
                                } else {
                                    // 設定和弦 + 自動產生 TAB
                                    const frets = chordToFrets(chord);
                                    const newNotes = [...notes];
                                    newNotes[selectedNoteIndex] = {
                                        ...newNotes[selectedNoteIndex],
                                        chordSymbol: chord,
                                        chordFrets: frets,
                                        stringIndex: frets.length > 0 ? frets[0].string : undefined,
                                        fret: frets.length > 0 ? frets[0].fret : undefined
                                    };
                                    onNotesChange(newNotes);
                                    syncEditableText(newNotes);
                                }
                            }}
                            disabled={!isNoteEditable}
                            style={{ flex: 1, padding: '4px 6px', background: '#333', color: '#ff9800', border: '1px solid #555', borderRadius: '4px', fontSize: '13px' }}
                        >
                            <option value="">-- 無 --</option>
                            {CHORD_ROOTS.map(root => (
                                <React.Fragment key={root}>
                                    <option value={root}>{root}</option>
                                    <option value={`${root}m`}>{root}m</option>
                                    <option value={`${root}7`}>{root}7</option>
                                    <option value={`${root}m7`}>{root}m7</option>
                                    <option value={`${root}maj7`}>{root}maj7</option>
                                    <option value={`${root}dim`}>{root}dim</option>
                                    <option value={`${root}aug`}>{root}aug</option>
                                    <option value={`${root}sus2`}>{root}sus2</option>
                                    <option value={`${root}sus4`}>{root}sus4</option>
                                </React.Fragment>
                            ))}
                        </select>
                        {selectedNote?.chordSymbol && (
                            <button className="editor-btn small" onClick={() => {
                                const newNotes = [...notes];
                                newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], chordSymbol: null, chordFrets: [], stringIndex: undefined, fret: undefined };
                                onNotesChange(newNotes);
                                syncEditableText(newNotes);
                            }} title="清除">✕</button>
                        )}
                    </div>
                </div>

                {/* ── TAB 指法 ── */}
                <div className="editor-group">
                    <span className="editor-label">TAB</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 6px', alignItems: 'center', fontSize: '12px' }}>
                        {['e', 'B', 'G', 'D', 'A', 'E'].map((name, s) => {
                            const currentFrets = selectedNote?.chordFrets || [];
                            const existingPos = currentFrets.find(p => p.string === s);
                            const singleMatch = (selectedNote?.stringIndex === s) ? selectedNote?.fret : undefined;
                            const fretVal = existingPos ? existingPos.fret : (singleMatch !== undefined ? singleMatch : '');
                            return (
                                <React.Fragment key={s}>
                                    <span style={{ color: '#888', textAlign: 'right' }}>{name}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="24"
                                        placeholder="–"
                                        value={fretVal}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const newFrets = (selectedNote?.chordFrets || []).filter(p => p.string !== s);
                                            if (val !== '') {
                                                newFrets.push({ string: s, fret: parseInt(val) || 0 });
                                                newFrets.sort((a, b) => a.string - b.string);
                                            }
                                            if (newFrets.length === 0) {
                                                // 清除所有 tab 資料
                                                const newNotes = [...notes];
                                                newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], chordFrets: [], stringIndex: undefined, fret: undefined };
                                                onNotesChange(newNotes);
                                                syncEditableText(newNotes);
                                            } else if (newFrets.length === 1) {
                                                // 單音：同時設 stringIndex/fret 和 chordFrets
                                                const newNotes = [...notes];
                                                newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], chordFrets: newFrets, stringIndex: newFrets[0].string, fret: newFrets[0].fret };
                                                onNotesChange(newNotes);
                                                syncEditableText(newNotes);
                                            } else {
                                                // 多音：用 chordFrets
                                                const newNotes = [...notes];
                                                newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], chordFrets: newFrets, stringIndex: newFrets[0].string, fret: newFrets[0].fret };
                                                onNotesChange(newNotes);
                                                syncEditableText(newNotes);
                                            }
                                        }}
                                        disabled={!isNoteEditable}
                                        style={{ width: '44px', padding: '2px 4px', background: '#333', color: '#ccc', border: '1px solid #555', borderRadius: '3px', fontSize: '12px', textAlign: 'center' }}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </div>
                    {isNoteEditable && (selectedNote?.chordFrets?.length > 0 || typeof selectedNote?.fret === 'number') && (
                        <button
                            className="editor-btn small"
                            onClick={() => {
                                const newNotes = [...notes];
                                newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], chordFrets: [], stringIndex: undefined, fret: undefined };
                                onNotesChange(newNotes);
                                syncEditableText(newNotes);
                            }}
                            style={{ marginTop: '4px', width: '100%' }}
                            onMouseEnter={() => setHoverInfo('清除所有 TAB 指法')}
                            onMouseLeave={() => setHoverInfo('')}
                        >清除 TAB</button>
                    )}
                </div>

                {/* ── 符號/插入 ── */}
                <div className="editor-group">
                    <span className="editor-label">插入</span>
                    <div className="editor-buttons">
                        <button className="editor-btn" onClick={() => handleInsertSymbol('0', 'before')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('前方插入休止符')} onMouseLeave={() => setHoverInfo('')}>前</button>
                        <button className="editor-btn" onClick={() => handleInsertSymbol('0', 'after')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('後方插入休止符')} onMouseLeave={() => setHoverInfo('')}>後</button>
                    </div>
                    <div className="editor-insert-row" style={{ marginTop: '6px' }}>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('0')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('休止符 0')} onMouseLeave={() => setHoverInfo('')}>0</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('-')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('延音線 –')} onMouseLeave={() => setHoverInfo('')}>–</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('|')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('小節線 |')} onMouseLeave={() => setHoverInfo('')}>|</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('>')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('重音')} onMouseLeave={() => setHoverInfo('')}>&gt;</button>
                    </div>

                    {/* 小節線類型 */}
                    <span className="editor-label" style={{ marginTop: '6px' }}>小節線</span>
                    <div className="editor-insert-row">
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('||')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('雙小節線')} onMouseLeave={() => setHoverInfo('')}>&#x2016;</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('|:')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('反覆開始 |:')} onMouseLeave={() => setHoverInfo('')}>|:</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol(':|')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('反覆結束 :|')} onMouseLeave={() => setHoverInfo('')}>:|</button>
                    </div>

                    {/* 方向記號 */}
                    <span className="editor-label" style={{ marginTop: '6px' }}>方向</span>
                    <div className="editor-insert-row">
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('D.C.')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('Da Capo — 從頭反覆')} onMouseLeave={() => setHoverInfo('')}>D.C.</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('D.S.')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('Dal Segno — 從 Segno 記號反覆')} onMouseLeave={() => setHoverInfo('')}>D.S.</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('Fine')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('Fine — 結束')} onMouseLeave={() => setHoverInfo('')}>Fine</button>
                    </div>
                    <div className="editor-insert-row" style={{ marginTop: '4px' }}>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('Segno')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('Segno 記號 𝄋')} onMouseLeave={() => setHoverInfo('')}>𝄋</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('Coda')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('Coda 記號 𝄌')} onMouseLeave={() => setHoverInfo('')}>𝄌</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('To Coda')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('To Coda — 跳到 Coda')} onMouseLeave={() => setHoverInfo('')}>To 𝄌</button>
                    </div>
                </div>

                {/* 說明 + 刪除 */}
                <div className="editor-info-bar" style={{ minHeight: '22px', padding: '4px 8px', background: '#333', borderRadius: '4px', color: '#4caf50', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                    {hoverInfo || '滑鼠移至按鈕可查看說明'}
                </div>
                <button className="delete-note-btn" onClick={handleDeleteNote} disabled={selectedNoteIndex < 0}>
                    刪除此{selectedNote?.isSeparator ? '區隔線' : '音符'}
                </button>
                </>}
            </div>

            {/* 右側：簡譜樂譜顯示 */}
            <div className="notes-list-area">
                <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3>Notes ({notes.filter(n => !n.isSeparator).length})</h3>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            className={`editor-btn small ${showChords ? 'active' : ''}`}
                            onClick={() => setShowChords(v => !v)}
                            style={{ fontSize: '11px', padding: '2px 6px' }}
                        >Chord</button>
                        <button
                            className={`editor-btn small ${showTab ? 'active' : ''}`}
                            onClick={() => setShowTab(v => !v)}
                            style={{ fontSize: '11px', padding: '2px 6px' }}
                        >TAB</button>
                    </div>
                </div>
                <JianpuScoreView
                    notes={notes}
                    currentNoteIndex={currentNoteIndex}
                    selectedNoteIndex={selectedNoteIndex}
                    onNoteSelect={handleNoteItemSelect}
                    showChords={showChords}
                    showTab={showTab}
                />

                {/* Play Controls */}
                <div className="controls-bar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px', gap: '8px' }}>
                    {/* Tempo slider */}
                    {onTempoChange && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
                            <input type="range" min="40" max="240" value={tempo || 120} onChange={(e) => onTempoChange(Number(e.target.value))} style={{ width: '80px' }} />
                            <span style={{ fontSize: '12px', color: '#aaa', minWidth: '50px' }}>{tempo || 120} BPM</span>
                        </div>
                    )}
                    <div style={{
                        background: '#111', padding: '6px 12px', borderRadius: '6px',
                        fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold',
                        color: isPlaying ? '#4caf50' : '#666', border: '1px solid #333',
                        minWidth: '90px', textAlign: 'center'
                    }}>
                        {formatPlayTime(playTime)}
                    </div>
                    <button
                        onClick={onTogglePlay} disabled={audioLoading}
                        style={{ padding: '6px 18px', fontSize: '14px', background: isPlaying ? '#f44336' : '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >{audioLoading ? '...' : (isPlaying ? 'Stop' : 'Play')}</button>
                    <button
                        onClick={() => setFullscreen(true)}
                        style={{ padding: '6px 10px', fontSize: '14px', background: '#333', color: '#ccc', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}
                        title="全螢幕播放"
                    >⛶</button>
                </div>
            </div>

            {/* 全螢幕播放模式 */}
            {fullscreen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: '#000', zIndex: 9999,
                    display: 'flex', flexDirection: 'column'
                }}>
                    {/* 頂部控制列 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: '#111', borderBottom: '1px solid #333' }}>
                        <button onClick={() => setFullscreen(false)} style={{ padding: '6px 14px', fontSize: '14px', background: '#333', color: '#ccc', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>✕ 關閉</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input type="range" min="40" max="240" value={tempo || 120} onChange={(e) => onTempoChange && onTempoChange(Number(e.target.value))} style={{ width: '120px' }} />
                            <span style={{ fontSize: '14px', color: '#aaa', minWidth: '60px' }}>{tempo || 120} BPM</span>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button className={`editor-btn small ${showChords ? 'active' : ''}`} onClick={() => setShowChords(v => !v)} style={{ fontSize: '11px', padding: '4px 8px' }}>Chord</button>
                                <button className={`editor-btn small ${showTab ? 'active' : ''}`} onClick={() => setShowTab(v => !v)} style={{ fontSize: '11px', padding: '4px 8px' }}>TAB</button>
                            </div>
                            <div style={{
                                background: '#111', padding: '8px 16px', borderRadius: '6px',
                                fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold',
                                color: isPlaying ? '#4caf50' : '#666', border: '1px solid #333',
                                minWidth: '110px', textAlign: 'center'
                            }}>
                                {formatPlayTime(playTime)}
                            </div>
                            <button
                                onClick={onTogglePlay} disabled={audioLoading}
                                style={{ padding: '8px 28px', fontSize: '18px', background: isPlaying ? '#f44336' : '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                            >{audioLoading ? '...' : (isPlaying ? 'Stop' : 'Play')}</button>
                        </div>
                    </div>
                    {/* 樂譜區域 */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <JianpuScoreView
                            notes={notes}
                            currentNoteIndex={currentNoteIndex}
                            selectedNoteIndex={selectedNoteIndex}
                            onNoteSelect={handleNoteItemSelect}
                            showChords={showChords}
                            showTab={showTab}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default NoteEditor;
