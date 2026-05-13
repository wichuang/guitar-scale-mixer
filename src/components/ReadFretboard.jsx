// Update ReadFretboard.jsx

import { useMemo } from 'react';
import { STRING_TUNINGS, getNoteName, getNoteIndex, getIntervalForNote, getCAGEDFretRange, isInCAGEDPosition } from '../data/scaleData';
import { calculate3NPSPositions, get3NPSInfo, generate3NPSMap } from '../parsers/JianpuParser';
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
        const positions = calculate3NPSPositions(notes, startString, musicKey, scaleType, rangeOctave);
        return notes.map((note, idx) => ({
            ...note,
            position: positions[idx],
            index: idx // Keep original index
        })).filter(n => n.position); // Filter out nulls for easier finding
    }, [notes, startString, musicKey, scaleType, rangeOctave]);

    // 2. Generate Full Scale Map (Background Pattern)
    const scaleMap = useMemo(() => {
        if (!showScaleGuide) return []; // Don't compute if hidden
        return generate3NPSMap(startString, musicKey, scaleType);
    }, [startString, musicKey, scaleType, showScaleGuide]);

    // 3NPS 模式資訊 - Derive from notePositions (Visible Notes)
    const modeInfo = useMemo(() => {
        const positions = notePositions.map(n => n.position);
        return get3NPSInfo(positions);
    }, [notePositions]);

    // 當前播放音符的位置
    // Fix: Find by matching index (np.index), not array index (notePositions is filtered!)
    const currentNoteObj = notePositions.find(np => np.index === currentNoteIndex);
    const currentPosition = currentNoteObj ? currentNoteObj.position : null;

    // 計算格子寬度
    const visibleFrets = fretCount || 19; // Allow wider range
    const fretWidth = Math.max(24, Math.floor((window.innerWidth - 64) / (visibleFrets + 0.5)));

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
            <div className="read-fretboard">
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

                                // 2. Check Scale Map Note (Background Pattern) - Only if enabled
                                const scaleNote = showScaleGuide ? scaleMap.find(
                                    sm => sm.string === stringIdx && sm.fret === fret
                                ) : null;

                                const isCurrent = currentPosition?.string === stringIdx &&
                                    currentPosition?.fret === fret;

                                // If neither, return empty
                                if (!scoreNote && !scaleNote && !isCurrent) {
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

                                if (scoreNote) {
                                    label = noteName; // 用音名顯示（與 Scale/Chord 模式一致）
                                    classNames += ' has-note';
                                    if (isRoot) classNames += ' root-note';
                                } else if (scaleNote) {
                                    classNames += ' scale-ghost';
                                    label = noteName;
                                }

                                if (isCurrent) classNames += ' current';
                                if (!isFretInCAGED(fret)) classNames += ' caged-dim';

                                if (fret === 0 && stringIdx === 0 && label === 'E') {
                                    label = 'e';
                                }

                                // 套用 12 音名色（scale ghost 用較淡）
                                const pc = getPitchColor(noteName);
                                const markerStyle = scoreNote
                                    ? { background: pc.bg, color: pc.fg, borderColor: 'transparent' }
                                    : scaleNote
                                        ? { background: `${pc.bg}66`, color: pc.fg, borderColor: `${pc.bg}aa` }
                                        : {};

                                return (
                                    <div
                                        key={fret}
                                        className="fret-space"
                                        style={{ width: fretWidth }}
                                    >
                                        <button
                                            className={classNames}
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

