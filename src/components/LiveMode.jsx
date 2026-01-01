import { useRef, useEffect, useState } from 'react';
import {
    STRING_TUNINGS,
    NUM_FRETS,
    getNoteName,
    NOTES,
} from '../data/scaleData';
import './LiveMode.css';

function LiveMode({ pitchDetection, displayMode, onDisplayModeChange, scales }) {
    const {
        isListening, devices, selectedDevice, setSelectedDevice,
        detectedNote, detectedOctave, detectedFrequency, centsDeviation, volume, noteHistory,
        startListening, stopListening, refreshDevices, clearHistory
    } = pitchDetection;

    const containerRef = useRef(null);
    const [fretWidth, setFretWidth] = useState(45);
    const [liveRoot, setLiveRoot] = useState(scales.length > 0 ? scales[0].root : 'A');

    useEffect(() => {
        const updateFretWidth = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 24;
                const width = Math.max(32, Math.floor(containerWidth / 22));
                setFretWidth(width);
            }
        };
        updateFretWidth();
        window.addEventListener('resize', updateFretWidth);
        return () => window.removeEventListener('resize', updateFretWidth);
    }, []);

    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];
    const recentNotes = noteHistory.slice(0, 5).map(h => h.note);

    // Calculate interval from liveRoot
    const NOTES_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const INTERVAL_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

    const getInterval = (noteName) => {
        const rootIdx = NOTES_ORDER.indexOf(liveRoot);
        const noteIdx = NOTES_ORDER.indexOf(noteName);
        if (rootIdx === -1 || noteIdx === -1) return '?';
        const semitones = (noteIdx - rootIdx + 12) % 12;
        return INTERVAL_NAMES[semitones];
    };

    return (
        <div className="live-mode" ref={containerRef}>
            {/* Audio Controls - Only device and listen button */}
            <div className="audio-controls">
                <select
                    className="device-select"
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    disabled={isListening}
                >
                    {devices.length === 0 ? (
                        <option value="">No devices</option>
                    ) : (
                        devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Input ${d.deviceId.slice(0, 6)}`}
                            </option>
                        ))
                    )}
                </select>

                <button className="ref-btn" onClick={refreshDevices} disabled={isListening}>↻</button>

                <button
                    className={`listen-btn ${isListening ? 'active' : ''}`}
                    onClick={isListening ? stopListening : startListening}
                >
                    {isListening ? '⏹ Stop' : '▶ Listen'}
                </button>

                {noteHistory.length > 0 && (
                    <button className="clear-btn" onClick={clearHistory}>Clear</button>
                )}
            </div>

            {/* Detection Display - Fixed height structure */}
            <div className={`detection-box ${isListening ? 'active' : ''}`}>
                {isListening ? (
                    <>
                        <div className="vol-indicator">
                            <div className="vol-fill" style={{ width: `${volume * 100}%` }} />
                        </div>

                        {/* Always same structure to prevent height jump */}
                        <div className="detected-info">
                            <div className="note-display">
                                <span className={`big-note ${!detectedNote ? 'placeholder' : ''}`}>
                                    {detectedNote ? (
                                        <>{detectedNote}<sub className="octave">{detectedOctave}</sub></>
                                    ) : '—'}
                                </span>
                                <span className={`interval-badge ${!detectedNote ? 'placeholder' : ''}`}>
                                    {detectedNote ? getInterval(detectedNote) : '—'}
                                </span>
                            </div>
                            <div className="note-details">
                                <span className="freq">{detectedNote ? `${detectedFrequency} Hz` : 'Play a note...'}</span>
                                {detectedNote && (
                                    <span className={`cents ${centsDeviation > 10 ? 'sharp' : centsDeviation < -10 ? 'flat' : 'tune'}`}>
                                        {centsDeviation > 0 ? '+' : ''}{centsDeviation}¢
                                    </span>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="inactive-msg">
                        Click <strong>▶ Listen</strong> to start detecting notes
                    </div>
                )}
            </div>

            {/* Note History - Always visible to prevent layout jump */}
            <div className="history-row">
                <span className="hist-label">Recent:</span>
                {noteHistory.length > 0 ? (
                    noteHistory.slice(0, 12).map((h, i) => (
                        <span
                            key={h.time}
                            className={`hist-note ${i === 0 ? 'latest' : ''}`}
                            style={{ opacity: 1 - i * 0.06 }}
                        >
                            {h.fullNote || h.note}
                        </span>
                    ))
                ) : (
                    <span className="hist-placeholder">—</span>
                )}
            </div>

            {/* Fretboard Section with its own controls */}
            {isListening && (
                <div className="fretboard-section">
                    {/* Fretboard Controls - Root and Display Mode */}
                    <div className="fretboard-controls">
                        <div className="fb-control-group">
                            <label className="fb-label">Root:</label>
                            <select
                                className="root-select"
                                value={liveRoot}
                                onChange={(e) => setLiveRoot(e.target.value)}
                            >
                                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>

                        <div className="fb-control-group">
                            <label className="fb-label">Display:</label>
                            <div className="display-toggle">
                                <button
                                    className={`dt-btn ${displayMode === 'notes' ? 'active' : ''}`}
                                    onClick={() => onDisplayModeChange('notes')}
                                >ABC</button>
                                <button
                                    className={`dt-btn ${displayMode === 'intervals' ? 'active' : ''}`}
                                    onClick={() => onDisplayModeChange('intervals')}
                                >123</button>
                            </div>
                        </div>
                    </div>

                    {/* Live Fretboard */}
                    <div className="live-fretboard">
                        {/* Fret numbers */}
                        <div className="lf-numbers">
                            {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => (
                                <div key={fret} className="lf-num" style={{ width: fretWidth }}>
                                    <span className={fretMarkers.includes(fret) ? 'marked' : ''}>{fret}</span>
                                    {fretMarkers.includes(fret) && !doubleDotFrets.includes(fret) && <div className="dot" />}
                                    {doubleDotFrets.includes(fret) && <div className="dots"><div className="dot" /><div className="dot" /></div>}
                                </div>
                            ))}
                        </div>

                        {/* Strings */}
                        {STRING_TUNINGS.map((openMidi, stringIdx) => {
                            const thickness = 1 + (5 - stringIdx) * 0.3;
                            return (
                                <div key={stringIdx} className="lf-string">
                                    <div className="string-line" style={{ height: thickness }} />
                                    {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => {
                                        const midiNote = openMidi + fret;
                                        const noteName = getNoteName(midiNote);
                                        const isDetected = detectedNote === noteName;
                                        const trailIdx = recentNotes.indexOf(noteName);
                                        const isTrail = trailIdx > 0;

                                        if (!isDetected && !isTrail) {
                                            return <div key={fret} className="lf-cell" style={{ width: fretWidth }} />;
                                        }

                                        const displayText = displayMode === 'intervals' ? getInterval(noteName) : noteName;

                                        return (
                                            <div key={fret} className="lf-cell" style={{ width: fretWidth }}>
                                                <div
                                                    className={`lf-marker ${isDetected ? 'detected' : 'trail'}`}
                                                    style={{ opacity: isDetected ? 1 : (1 - trailIdx * 0.2) }}
                                                >
                                                    {displayText}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Fret lines */}
                        <div className="lf-lines">
                            {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => (
                                <div key={fret} className={`lf-line ${fret === 0 ? 'nut' : ''}`} style={{ width: fretWidth }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LiveMode;
