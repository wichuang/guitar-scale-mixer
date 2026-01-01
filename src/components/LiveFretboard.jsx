import { useRef, useEffect, useState } from 'react';
import {
    STRING_TUNINGS,
    NUM_FRETS,
    getNoteName,
} from '../data/scaleData';
import './LiveFretboard.css';

function LiveFretboard({ detectedNote, noteHistory, isListening }) {
    const containerRef = useRef(null);
    const [fretWidth, setFretWidth] = useState(50);

    // Calculate fret width based on container
    useEffect(() => {
        const updateFretWidth = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 32;
                const width = Math.max(35, Math.floor(containerWidth / 22));
                setFretWidth(width);
            }
        };

        updateFretWidth();
        window.addEventListener('resize', updateFretWidth);
        return () => window.removeEventListener('resize', updateFretWidth);
    }, []);

    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];

    // Get recent notes for trail effect
    const recentNotes = noteHistory.slice(0, 5).map(h => h.note);

    return (
        <div className={`live-fretboard-container ${isListening ? 'active' : ''}`} ref={containerRef}>
            <div className="live-fretboard-header">
                <span className="live-label">
                    🎸 Live Detection
                    {isListening && <span className="live-dot" />}
                </span>
                {detectedNote && (
                    <span className="current-note">{detectedNote}</span>
                )}
            </div>

            <div className="live-fretboard-scroll">
                <div className="live-fretboard">
                    {/* Fret numbers */}
                    <div className="live-fret-numbers">
                        {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => (
                            <div
                                key={fret}
                                className="live-fret-number-cell"
                                style={{ width: fretWidth }}
                            >
                                <span className={`live-fret-number ${fretMarkers.includes(fret) ? 'marked' : ''}`}>
                                    {fret}
                                </span>
                                {fretMarkers.includes(fret) && !doubleDotFrets.includes(fret) && (
                                    <div className="live-fret-dot" />
                                )}
                                {doubleDotFrets.includes(fret) && (
                                    <div className="live-fret-dots-double">
                                        <div className="live-fret-dot" />
                                        <div className="live-fret-dot" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Strings */}
                    {STRING_TUNINGS.map((openMidi, stringIdx) => {
                        const stringThickness = 1 + (5 - stringIdx) * 0.3;

                        return (
                            <div key={stringIdx} className="live-string-row">
                                <div
                                    className="live-string-line"
                                    style={{ height: `${stringThickness}px` }}
                                />

                                {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => {
                                    const midiNote = openMidi + fret;
                                    const noteName = getNoteName(midiNote);

                                    const isDetected = detectedNote && noteName === detectedNote;
                                    const trailIndex = recentNotes.indexOf(noteName);
                                    const isInTrail = trailIndex > 0;

                                    if (!isDetected && !isInTrail) {
                                        return (
                                            <div
                                                key={fret}
                                                className="live-fret-space"
                                                style={{ width: fretWidth }}
                                            />
                                        );
                                    }

                                    return (
                                        <div
                                            key={fret}
                                            className="live-fret-space"
                                            style={{ width: fretWidth }}
                                        >
                                            <div
                                                className={`live-note-marker ${isDetected ? 'detected' : ''} ${isInTrail ? 'trail' : ''}`}
                                                style={{
                                                    opacity: isDetected ? 1 : (1 - trailIndex * 0.2)
                                                }}
                                            >
                                                {noteName}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Fret lines */}
                    <div className="live-fret-lines">
                        {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => (
                            <div
                                key={fret}
                                className={`live-fret-line ${fret === 0 ? 'nut' : ''}`}
                                style={{ width: fretWidth }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LiveFretboard;
