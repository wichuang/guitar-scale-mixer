// Update ReadFretboard.jsx

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import { STRING_TUNINGS, getNoteName, getNoteIndex, getIntervalForNote, getCAGEDFretRange, isInCAGEDPosition, getScaleNotes, SCALE_TYPES } from '../data/scaleData';
import { calculate3NPSPositions, calculateCAGEDPositions, get3NPSInfo, generate3NPSMap } from '../parsers/JianpuParser';
import { getPitchColor } from '../data/pitchColors';
import './ReadFretboard.css';

const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];

function ReadFretboard({ notes, currentNoteIndex, fretCount, onNoteClick, startString = 5, onStartStringChange, rangeOctave = 0, onRangeOctaveChange, cagedPosition = null, musicKey = 'C', scaleType = 'Major', showScaleGuide = false, toolbarExtra }) {
    // CAGED 範圍 — 用於把範圍外的音符變暗
    const cagedRange = useMemo(() => (
        cagedPosition ? getCAGEDFretRange(musicKey, cagedPosition) : null
    ), [musicKey, cagedPosition]);
    const isFretInCAGED = (fret) => !cagedRange || isInCAGEDPosition(fret, cagedRange.startFret, cagedRange.endFret);
    // 1. Calculate Score Note Positions
    const notePositions = useMemo(() => {
        // 選了 CAGED 指型 → 用 CAGED 定位；否則沿用 3NPS（就近取格）
        const positions = cagedPosition
            ? calculateCAGEDPositions(notes, musicKey, cagedPosition)
            : calculate3NPSPositions(notes, startString, musicKey, scaleType, rangeOctave);
        return notes.map((note, idx) => ({
            ...note,
            position: positions[idx],
            index: idx // Keep original index
        })).filter(n => n.position); // Filter out nulls for easier finding
    }, [notes, startString, musicKey, scaleType, rangeOctave, cagedPosition]);

    // 2. Generate Full Scale Map (Background Pattern) — 3NPS 模式用
    const scaleMap = useMemo(() => {
        if (!showScaleGuide || cagedPosition) return []; // CAGED 模式改用 cagedBoxMap
        return generate3NPSMap(startString, musicKey, scaleType);
    }, [startString, musicKey, scaleType, showScaleGuide, cagedPosition]);

    // 所選調的音階音名集合（判斷某音是否為「調外 ghost 音」用）
    const scaleNoteSet = useMemo(() => {
        const arr = getScaleNotes(musicKey, SCALE_TYPES[scaleType] || (scaleType || 'major').toLowerCase());
        return new Set(arr);
    }, [musicKey, scaleType]);

    // 2b. CAGED 模式：只在 box 範圍內顯示「scale 內音（實心）+ 樂譜用到的 ghost 音（空心）」
    // 與 Compose 一致；先讀取整個樂譜取得 ghost 音名。box 外不顯示。
    // 註：選了 CAGED 指型即顯示 box 內 scale/ghost（不受「顯示背景音階」開關影響，
    // 因為這正是 CAGED 模式要呈現的內容）。
    const cagedBoxMap = useMemo(() => {
        if (!cagedPosition || !cagedRange) return null;
        const scoreNames = new Set();
        (notes || []).forEach(n => {
            if (!n) return;
            const m = n.midiNote ?? n.midi;
            if (m != null && !(n.isSeparator || n._type === 'separator')) scoreNames.add(getNoteName(m));
        });
        const map = new Map();
        for (let s = 0; s < 6; s++) {
            for (let f = 0; f <= (fretCount || 19); f++) {
                if (!isInCAGEDPosition(f, cagedRange.startFret, cagedRange.endFret)) continue;
                const name = getNoteName(STRING_TUNINGS[s] + f);
                if (scaleNoteSet.has(name)) map.set(`${s}-${f}`, 'scale');
                else if (scoreNames.has(name)) map.set(`${s}-${f}`, 'ghost');
            }
        }
        return map;
    }, [cagedPosition, cagedRange, scaleNoteSet, notes, fretCount]);

    // 3NPS 模式資訊 - Derive from notePositions (Visible Notes)
    const modeInfo = useMemo(() => {
        const positions = notePositions.map(n => n.position);
        return get3NPSInfo(positions);
    }, [notePositions]);

    // 當前播放音符的位置
    // Fix: Find by matching index (np.index), not array index (notePositions is filtered!)
    const curPosIdx = notePositions.findIndex(np => np.index === currentNoteIndex);
    const currentPosition = curPosIdx >= 0 ? notePositions[curPosIdx].position : null;

    // —— 播放動線：由「上一個有位置的音」→「目前音」的箭頭亮線（取代單點高亮）——
    // notePositions 已過濾掉無位置的音並保留原順序，故前一筆即上一個發聲音
    const prevPosition = curPosIdx > 0 ? notePositions[curPosIdx - 1].position : null;
    const arrowFromKey = prevPosition ? `${prevPosition.string}-${prevPosition.fret}` : null;
    const arrowToKey = currentPosition ? `${currentPosition.string}-${currentPosition.fret}` : null;
    const drawArrow = !!(arrowFromKey && arrowToKey && arrowFromKey !== arrowToKey);

    // 計算格子寬度
    const visibleFrets = fretCount || 19; // Allow wider range
    const fretWidth = Math.max(24, Math.floor((window.innerWidth - 64) / (visibleFrets + 0.5)));

    // 量測箭頭兩端 marker 的位置，畫出單一條箭頭亮線（下一條出現時上一條消失）
    const fretboardRef = useRef(null);
    const [arrowCoords, setArrowCoords] = useState(null);
    useLayoutEffect(() => {
        const fb = fretboardRef.current;
        let next = null;
        if (fb && drawArrow) {
            const fromEl = fb.querySelector(`[data-key="${arrowFromKey}"]`);
            const toEl = fb.querySelector(`[data-key="${arrowToKey}"]`);
            if (fromEl && toEl) {
                const fbRect = fb.getBoundingClientRect();
                const center = (el) => {
                    const r = el.getBoundingClientRect();
                    return { x: r.left - fbRect.left + r.width / 2, y: r.top - fbRect.top + r.height / 2 };
                };
                const p1 = center(fromEl);
                const p2 = center(toEl);
                next = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, w: fb.offsetWidth, h: fb.offsetHeight };
            }
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 量測 DOM marker 後寫回座標是必要的 layout 同步
        setArrowCoords(next);
    }, [arrowFromKey, arrowToKey, drawArrow, fretWidth, notePositions]);

    // 把位標記
    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];

    return (
        <div className="read-fretboard-container">
            {toolbarExtra && (
                <div className="position-indicator" style={{ justifyContent: 'flex-end' }}>
                    {toolbarExtra}
                </div>
            )}

            {/* 指板主體 */}
            <div className="read-fretboard" ref={fretboardRef}>
                {/* 格數標記 */}
                <div className="fret-numbers">
                    <div className="string-gutter spacer">·</div>
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                        const hasScoreNote = notePositions.some(np => np.position?.fret === fret);
                        return (
                            <div
                                key={fret}
                                className={`fret-number-cell ${hasScoreNote ? 'has-note' : ''}`}
                                style={{ width: fretWidth }}
                            >
                                <span className={`fret-number ${fretMarkers.includes(fret) ? 'marked' : ''}`}>
                                    {fret}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 弦 */}
                {STRING_TUNINGS.map((openMidi, stringIdx) => {
                    // Reverse string visual order? 
                    // Usually String 0 (High E) is Top. STRING_TUNINGS is [64, 59...].
                    // ReadMode.jsx Data: STRING_TUNINGS = [64, 59, 55, 50, 45, 40]; (0=HighE)
                    // Visual: Top line is String 0. Correct.

                    const stringThickness = 1 + stringIdx * 0.4;

                    return (
                        <div key={stringIdx} className="string-row">
                            <div className="string-gutter">{STRING_NAMES[stringIdx]}</div>
                            <div
                                className="string-line"
                                style={{ height: `${stringThickness}px` }}
                            />

                            {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                                const midiNote = openMidi + fret;
                                const noteName = getNoteName(midiNote);

                                // 1. Check Score Note (User Melody) - Priority
                                const scoreNote = notePositions.find(
                                    np => np.position?.string === stringIdx && np.position?.fret === fret
                                );

                                // 2. Check Scale Map Note (Background Pattern) - Only if enabled (3NPS 模式)
                                const scaleNote = showScaleGuide ? scaleMap.find(
                                    sm => sm.string === stringIdx && sm.fret === fret
                                ) : null;

                                // 2b. CAGED box 內的背景：'scale'（實心）或 'ghost'（空心）
                                const boxRole = cagedBoxMap ? cagedBoxMap.get(`${stringIdx}-${fret}`) : null;

                                const isCurrent = currentPosition?.string === stringIdx &&
                                    currentPosition?.fret === fret;

                                // If none, return empty
                                if (!scoreNote && !scaleNote && !boxRole && !isCurrent) {
                                    return (
                                        <div
                                            key={fret}
                                            className="fret-space"
                                            style={{ width: fretWidth }}
                                        />
                                    );
                                }

                                // Determine label + role
                                let label = '';
                                let classNames = 'note-marker';
                                const isRoot = scoreNote && (scoreNote.jianpu == '1' || scoreNote.jianpu === 1);
                                // 旋律音以 ghost（空心）顯示的條件：被迫彈在把位外，或本身是「調外音」
                                const scoreGhost = scoreNote &&
                                    (scoreNote.position?.outOfBox || !scaleNoteSet.has(noteName));

                                if (scoreNote) {
                                    label = noteName; // 用音名顯示（與 Scale/Chord 模式一致）
                                    if (scoreGhost) {
                                        classNames += ' score-ghost';
                                    } else {
                                        classNames += ' has-note';
                                        if (isRoot) classNames += ' root-note';
                                    }
                                } else if (scaleNote) {
                                    classNames += ' scale-ghost';
                                    label = noteName;
                                } else if (boxRole === 'scale') {
                                    classNames += ' scale-ghost';
                                    label = noteName;
                                } else if (boxRole === 'ghost') {
                                    classNames += ' score-ghost';
                                    label = noteName;
                                }

                                // 畫箭頭時不再顯示單點高亮；第一個音（無前音）仍以單點高亮
                                if (isCurrent && !drawArrow) classNames += ' current';
                                if (!isFretInCAGED(fret)) classNames += ' caged-dim';

                                if (fret === 0 && stringIdx === 0 && label === 'E') {
                                    label = 'e';
                                }

                                // 套用 12 音名色。scale tone 半實心；ghost（樂譜外音）空心描邊。
                                const pc = getPitchColor(noteName);
                                const markerStyle = scoreNote
                                    ? (scoreGhost
                                        ? { background: 'transparent', color: pc.fg, borderColor: pc.bg, borderWidth: '2px', borderStyle: 'solid' }
                                        : { background: pc.bg, color: pc.fg, borderColor: 'transparent' })
                                    : (scaleNote || boxRole === 'scale')
                                        ? { background: `${pc.bg}aa`, color: pc.fg, borderColor: `${pc.bg}` }
                                        : boxRole === 'ghost'
                                            ? { background: 'transparent', color: pc.fg, borderColor: pc.bg, borderWidth: '2px', borderStyle: 'solid' }
                                            : {};

                                return (
                                    <div
                                        key={fret}
                                        className="fret-space"
                                        style={{ width: fretWidth }}
                                    >
                                        <button
                                            className={classNames}
                                            data-key={`${stringIdx}-${fret}`}
                                            style={markerStyle}
                                            onClick={() => {
                                                if (scoreNote) {
                                                    onNoteClick(scoreNote.index);
                                                }
                                            }}
                                            title={`${noteName} (格 ${fret})`}
                                        >
                                            {label}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {/* 底部把位點 — 3/5/7/9 單點、12 雙點、15+ 單點 */}
                <div className="fret-dots-bottom">
                    <div className="string-gutter spacer">·</div>
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => (
                        <div
                            key={fret}
                            className="fret-dot-cell"
                            style={{ width: fretWidth }}
                        >
                            {fretMarkers.includes(fret) && !doubleDotFrets.includes(fret) && (
                                <div className="fret-dot" />
                            )}
                            {doubleDotFrets.includes(fret) && (
                                <>
                                    <div className="fret-dot" />
                                    <div className="fret-dot" />
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* 播放動線（箭頭亮線）— 由上個音指向目前音 */}
                {arrowCoords && (
                    <svg className="play-arrow-layer" width={arrowCoords.w} height={arrowCoords.h}>
                        <defs>
                            <marker id="read-play-arrowhead" markerWidth="6" markerHeight="6" refX="4.6" refY="3" orient="auto">
                                <path className="play-arrow-head" d="M0,0 L6,3 L0,6 Z" />
                            </marker>
                        </defs>
                        <line
                            className="play-arrow-line"
                            x1={arrowCoords.x1}
                            y1={arrowCoords.y1}
                            x2={arrowCoords.x2}
                            y2={arrowCoords.y2}
                            markerEnd="url(#read-play-arrowhead)"
                        />
                    </svg>
                )}

                {/* 格線 */}
                <div className="fret-lines">
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => (
                        <div
                            key={fret}
                            className={`fret-line ${fret === 0 ? 'nut' : ''}`}
                            style={{ width: fretWidth }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default ReadFretboard;

