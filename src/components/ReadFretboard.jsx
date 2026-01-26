import { useMemo } from 'react';
import { STRING_TUNINGS, getNoteName } from '../data/scaleData';
import { getBestPosition, GUITAR_POSITIONS } from '../data/jianpuParser';
import './ReadFretboard.css';

function ReadFretboard({ notes, currentNoteIndex, position, fretCount, onNoteClick }) {
    const positionInfo = GUITAR_POSITIONS[position] || GUITAR_POSITIONS[1];

    // 計算所有音符的指板位置
    const notePositions = useMemo(() => {
        return notes.map(note => ({
            ...note,
            position: getBestPosition(note.midiNote, position),
        }));
    }, [notes, position]);

    // 當前播放音符的位置
    const currentPosition = currentNoteIndex >= 0 && currentNoteIndex < notePositions.length
        ? notePositions[currentNoteIndex].position
        : null;

    // 計算格子寬度
    const visibleFrets = fretCount || 15;
    const fretWidth = Math.max(30, Math.floor((window.innerWidth - 64) / (visibleFrets + 0.5)));

    // 把位標記
    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];

    return (
        <div className="read-fretboard-container">
            {/* 把位指示 */}
            <div className="position-indicator">
                <span>🎸 {positionInfo.name}</span>
                <span className="position-range">格 {positionInfo.start} - {positionInfo.end}</span>
            </div>

            {/* 指板主體 */}
            <div className="read-fretboard">
                {/* 格數標記 */}
                <div className="fret-numbers">
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                        const inPosition = fret >= positionInfo.start && fret <= positionInfo.end;
                        return (
                            <div
                                key={fret}
                                className={`fret-number-cell ${inPosition ? 'in-position' : ''}`}
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
                    const stringThickness = 1 + (5 - stringIdx) * 0.4;

                    return (
                        <div key={stringIdx} className="string-row">
                            <div
                                className="string-line"
                                style={{ height: `${stringThickness}px` }}
                            />

                            {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                                const midiNote = openMidi + fret;
                                const noteName = getNoteName(midiNote);

                                // 檢查是否有音符在這個位置
                                const noteAtPosition = notePositions.find(
                                    np => np.position?.string === stringIdx && np.position?.fret === fret
                                );

                                const isCurrent = currentPosition?.string === stringIdx &&
                                    currentPosition?.fret === fret;

                                const inPosition = fret >= positionInfo.start && fret <= positionInfo.end;

                                if (!noteAtPosition && !isCurrent) {
                                    return (
                                        <div
                                            key={fret}
                                            className={`fret-space ${inPosition ? 'in-position' : ''}`}
                                            style={{ width: fretWidth }}
                                        />
                                    );
                                }

                                return (
                                    <div
                                        key={fret}
                                        className={`fret-space ${inPosition ? 'in-position' : ''}`}
                                        style={{ width: fretWidth }}
                                    >
                                        <button
                                            className={`note-marker ${isCurrent ? 'current' : ''} ${noteAtPosition ? 'has-note' : ''}`}
                                            onClick={() => {
                                                if (noteAtPosition) {
                                                    onNoteClick(noteAtPosition.index);
                                                }
                                            }}
                                            title={`${noteName} (格 ${fret})`}
                                        >
                                            {noteAtPosition?.jianpu || noteName}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}

                {/* 格線 */}
                <div className="fret-lines">
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                        const inPosition = fret >= positionInfo.start && fret <= positionInfo.end;
                        return (
                            <div
                                key={fret}
                                className={`fret-line ${fret === 0 ? 'nut' : ''} ${inPosition ? 'in-position' : ''}`}
                                style={{ width: fretWidth }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default ReadFretboard;
