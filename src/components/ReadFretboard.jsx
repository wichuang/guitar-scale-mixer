import { useMemo } from 'react';
import { STRING_TUNINGS, getNoteName } from '../data/scaleData';
import { calculate3NPSPositions, get3NPSInfo } from '../utils/get3NPSPositions';
import './ReadFretboard.css';

function ReadFretboard({ notes, currentNoteIndex, fretCount, onNoteClick }) {
    // 使用 3NPS 演算法計算所有音符的指板位置
    const notePositions = useMemo(() => {
        const positions = calculate3NPSPositions(notes);
        return notes.map((note, idx) => ({
            ...note,
            position: positions[idx],
        }));
    }, [notes]);

    // 3NPS 模式資訊
    const positions3NPS = useMemo(() =>
        calculate3NPSPositions(notes), [notes]);
    const modeInfo = useMemo(() =>
        get3NPSInfo(positions3NPS), [positions3NPS]);

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
            {/* 3NPS 模式指示 */}
            <div className="position-indicator mode-3nps">
                <span>🎸 {modeInfo.description}</span>
                <span className="position-range">每弦 3 音</span>
            </div>

            {/* 指板主體 */}
            <div className="read-fretboard">
                {/* 格數標記 */}
                <div className="fret-numbers">
                    {Array.from({ length: visibleFrets + 1 }, (_, fret) => {
                        // 檢查這個格位是否有音符
                        const hasNoteAtFret = notePositions.some(
                            np => np.position?.fret === fret
                        );
                        return (
                            <div
                                key={fret}
                                className={`fret-number-cell ${hasNoteAtFret ? 'has-note' : ''}`}
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

                                // 檢查是否有音符在這個位置
                                const noteAtPosition = notePositions.find(
                                    np => np.position?.string === stringIdx && np.position?.fret === fret
                                );

                                const isCurrent = currentPosition?.string === stringIdx &&
                                    currentPosition?.fret === fret;

                                if (!noteAtPosition && !isCurrent) {
                                    return (
                                        <div
                                            key={fret}
                                            className="fret-space"
                                            style={{ width: fretWidth }}
                                        />
                                    );
                                }

                                return (
                                    <div
                                        key={fret}
                                        className="fret-space"
                                        style={{ width: fretWidth }}
                                    >
                                        <button
                                            className={`note-marker ${isCurrent ? 'current' : ''} ${noteAtPosition ? 'has-note' : ''} ${noteAtPosition?.jianpu === '1' ? 'root-note' : ''}`}
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

