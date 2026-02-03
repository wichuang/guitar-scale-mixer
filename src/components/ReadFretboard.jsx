// Update ReadFretboard.jsx

import { useMemo } from 'react';
import { STRING_TUNINGS, getNoteName, getNoteIndex, getIntervalForNote } from '../data/scaleData';
import { calculate3NPSPositions, get3NPSInfo, generate3NPSMap } from '../data/jianpuParser';
import './ReadFretboard.css';

function ReadFretboard({ notes, currentNoteIndex, fretCount, onNoteClick, startString = 5, onStartStringChange, rangeOctave = 0, onRangeOctaveChange, musicKey = 'C', scaleType = 'Major', showScaleGuide = false }) {
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
    const fretWidth = Math.max(35, Math.floor((window.innerWidth - 64) / (visibleFrets + 0.5)));

    // 把位標記
    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];

    return (
        <div className="read-fretboard-container">
            {/* 3NPS 模式指示 */}
            <div className="position-indicator mode-3nps">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🎸 {modeInfo.description}</span>

                    {/* Start String Selector */}
                    <select
                        value={startString}
                        onChange={(e) => onStartStringChange && onStartStringChange(Number(e.target.value))}
                        title="起始弦"
                        style={{
                            padding: '2px 4px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value={5}>Start: 6th (E)</option>
                        <option value={4}>Start: 5th (A)</option>
                        <option value={3}>Start: 4th (D)</option>
                    </select>

                    {/* Range/Octave Selector */}
                    <select
                        value={rangeOctave}
                        onChange={(e) => onRangeOctaveChange && onRangeOctaveChange(Number(e.target.value))}
                        title="高低八度偏移"
                        style={{
                            padding: '2px 4px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.5)',
                            color: 'white',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value={0}>Range: Normal</option>
                        <option value={1}>Range: High (+8ve)</option>
                        <option value={-1}>Range: Low (-8ve)</option>
                    </select>
                </div>
                <span className="position-range">每弦 3 音 {showScaleGuide ? '(背景顯示全音階)' : ''}</span>
            </div>

            {/* 指板主體 */}
            <div className="read-fretboard">
                {/* 格數標記 */}
                <div className="fret-numbers">
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                        // Check if score note exists
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
                                {fretMarkers.includes(fret) && !doubleDotFrets.includes(fret) && (
                                    <div className="fret-dot" />
                                )}
                                {doubleDotFrets.includes(fret) && (
                                    <div className="fret-dots-double">
                                        <div className="fret-dot" />
                                        <div className="fret-dot" />
                                    </div>
                                )}
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

                                // Determine Label
                                // If Score Note, use its label (Jianpu + Octave/Accidental)
                                // If Scale Note only, use Degree/NoteName
                                let label = '';
                                let classNames = 'note-marker';

                                if (scoreNote) {
                                    label = scoreNote.displayStr || scoreNote.jianpu || noteName;
                                    classNames += ' has-note';
                                    if (scoreNote.jianpu == '1') classNames += ' root-note';
                                    // Handle accidentals in class?
                                    if (scoreNote.noteName?.includes('#')) classNames += ' sharp';
                                    if (scoreNote.noteName?.includes('b')) classNames += ' flat';
                                } else if (scaleNote) {
                                    // Ghost Note - Use Degree Label (1, 2, b3, etc.)
                                    classNames += ' scale-ghost';
                                    // Use getIntervalForNote logic mapping midiNote to relative interval
                                    // We need NoteName for getIntervalForNote
                                    const intervalLabel = getIntervalForNote(noteName, musicKey, scaleType);
                                    label = intervalLabel || noteName; // Fallback to note name if parsing fails
                                }

                                if (isCurrent) classNames += ' current';

                                return (
                                    <div
                                        key={fret}
                                        className="fret-space"
                                        style={{ width: fretWidth }}
                                    >
                                        <button
                                            className={classNames}
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

