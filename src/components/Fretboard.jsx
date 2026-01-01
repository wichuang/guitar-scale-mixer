import { useState, useCallback, useRef, useEffect } from 'react';
import {
    STRING_TUNINGS,
    NUM_FRETS,
    getNoteName,
    getScaleNotes,
    isNoteInScale,
    getIntervalForNote,
} from '../data/scaleData';
import { useAudio } from '../hooks/useAudio';
import './Fretboard.css';

// High contrast scale colors for color mode
const SCALE_COLORS = [
    { bg: '#2196f3', border: '#ffd700' },      // Scale 1 - bright blue with gold root
    { bg: '#ff9800', border: '#00e5ff' },      // Scale 2 - orange with cyan root  
    { bg: '#e91e63', border: '#76ff03' },      // Scale 3 - pink with lime root
];

// Black & white colors for interval mode
const BW_COLORS = [
    { bg: '#ffffff', text: '#000000', border: '#ffd700' },   // Scale 1 - white
    { bg: '#888888', text: '#ffffff', border: '#00e5ff' },   // Scale 2 - gray
    { bg: '#333333', text: '#ffffff', border: '#76ff03' },   // Scale 3 - dark gray
];

// Visible frets options (12-22)
const VISIBLE_FRETS_OPTIONS = [12, 15, 17, 19, 22];

function Fretboard({ scales, guitarType, displayMode }) {
    const { playNote, isLoading } = useAudio(guitarType);
    const [activeNote, setActiveNote] = useState(null);
    const [visibleFrets, setVisibleFrets] = useState(12);
    const scrollRef = useRef(null);
    const containerRef = useRef(null);
    const [fretWidth, setFretWidth] = useState(60);

    const isIntervalMode = displayMode === 'intervals';

    // Calculate fret width based on container and visible frets
    useEffect(() => {
        const updateFretWidth = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 32;
                const width = Math.max(40, Math.floor(containerWidth / visibleFrets));
                setFretWidth(width);
            }
        };

        updateFretWidth();
        window.addEventListener('resize', updateFretWidth);
        return () => window.removeEventListener('resize', updateFretWidth);
    }, [visibleFrets]);

    // Get scale notes for each scale
    const scaleNotesArray = scales.map(s => getScaleNotes(s.root, s.scale));
    const rootNotes = scales.map(s => s.root);

    const handleNoteClick = useCallback((midiNote, stringIdx, noteName) => {
        if (isLoading) return;
        playNote(midiNote, stringIdx);
        setActiveNote(`${stringIdx}-${midiNote}`);
        setTimeout(() => setActiveNote(null), 150);
    }, [playNote, isLoading]);

    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];

    // Check if a note is enabled in a scale
    const isNoteEnabled = (noteName, scaleIdx) => {
        const scale = scales[scaleIdx];
        if (!scale) return false;
        if (scale.enabledNotes === null || scale.enabledNotes === undefined) return true;
        return scale.enabledNotes.includes(noteName);
    };

    // Check which scales contain this note
    const getNoteScaleInfo = (noteName) => {
        const inScales = scaleNotesArray.map((notes, idx) => {
            const inScale = isNoteInScale(noteName, notes);
            const enabled = isNoteEnabled(noteName, idx);
            return inScale ? { idx, enabled } : null;
        }).filter(x => x !== null);

        const isRootOf = rootNotes
            .map((root, idx) => root === noteName ? idx : -1)
            .filter(idx => idx !== -1);

        return { inScales, isRootOf };
    };

    // Get display text for a note
    const getDisplayText = (noteName, scaleIdx) => {
        if (!isIntervalMode) return noteName;
        const scale = scales[scaleIdx];
        if (!scale) return noteName;
        return getIntervalForNote(noteName, scale.root, scale.scale) || noteName;
    };

    return (
        <div className={`fretboard-container ${isIntervalMode ? 'bw-mode' : ''}`} ref={containerRef}>
            <div className="fretboard-wrapper">
                {/* Header */}
                <div className="fretboard-header">
                    <div className="fretboard-legend">
                        {scales.map((s, idx) => (
                            <div key={idx} className="legend-item">
                                <div
                                    className="legend-marker"
                                    style={{
                                        backgroundColor: isIntervalMode ? BW_COLORS[idx].bg : SCALE_COLORS[idx].bg,
                                        border: isIntervalMode ? '1px solid #666' : 'none'
                                    }}
                                />
                                <span>Scale {idx + 1}</span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="legend-item loading">
                                <span>Loading...</span>
                            </div>
                        )}
                    </div>

                    {/* Visible frets selector */}
                    <div className="frets-selector">
                        <span className="selector-label">View:</span>
                        {VISIBLE_FRETS_OPTIONS.map(num => (
                            <button
                                key={num}
                                className={`frets-btn ${visibleFrets === num ? 'active' : ''}`}
                                onClick={() => setVisibleFrets(num)}
                            >
                                {num === 22 ? 'All' : num}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scrollable fretboard */}
                <div className="fretboard-scroll" ref={scrollRef}>
                    <div className="fretboard">
                        {/* Fret numbers */}
                        <div className="fret-numbers">
                            {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => (
                                <div
                                    key={fret}
                                    className="fret-number-cell"
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
                            ))}
                        </div>

                        {/* Strings */}
                        {STRING_TUNINGS.map((openMidi, stringIdx) => {
                            const stringThickness = 1 + (5 - stringIdx) * 0.4;

                            return (
                                <div key={stringIdx} className="string-row">
                                    <div
                                        className="string-line"
                                        style={{ height: `${stringThickness}px` }}
                                    />

                                    {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => {
                                        const midiNote = openMidi + fret;
                                        const noteName = getNoteName(midiNote);
                                        const { inScales, isRootOf } = getNoteScaleInfo(noteName);
                                        const isActive = activeNote === `${stringIdx}-${midiNote}`;

                                        // Filter to only enabled notes
                                        const enabledInScales = inScales.filter(s => s.enabled);

                                        if (enabledInScales.length === 0) {
                                            return (
                                                <div
                                                    key={fret}
                                                    className="fret-space"
                                                    style={{ width: fretWidth }}
                                                />
                                            );
                                        }

                                        const primaryScaleIdx = enabledInScales[0].idx;
                                        const isRoot = isRootOf.length > 0;
                                        const inMultiple = enabledInScales.length > 1;

                                        // Choose colors based on mode
                                        let bgColor, textColor, borderColor;
                                        if (isIntervalMode) {
                                            bgColor = BW_COLORS[primaryScaleIdx].bg;
                                            textColor = BW_COLORS[primaryScaleIdx].text;
                                            borderColor = isRoot ? BW_COLORS[isRootOf[0]].border : 'transparent';
                                        } else {
                                            bgColor = SCALE_COLORS[primaryScaleIdx].bg;
                                            textColor = '#fff';
                                            borderColor = isRoot ? SCALE_COLORS[isRootOf[0]].border : 'transparent';
                                        }

                                        let markerClass = 'note-marker';
                                        if (isActive) markerClass += ' active';
                                        if (isRoot) markerClass += ' root';
                                        if (inMultiple) markerClass += ' multi-scale';

                                        const displayText = getDisplayText(noteName, primaryScaleIdx);

                                        return (
                                            <div
                                                key={fret}
                                                className="fret-space"
                                                style={{ width: fretWidth }}
                                            >
                                                <button
                                                    className={markerClass}
                                                    style={{
                                                        backgroundColor: bgColor,
                                                        borderColor: borderColor,
                                                        color: textColor,
                                                    }}
                                                    onClick={() => handleNoteClick(midiNote, stringIdx, noteName)}
                                                    title={`${noteName} (Fret ${fret})`}
                                                >
                                                    {displayText}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Fret lines */}
                        <div className="fret-lines">
                            {Array.from({ length: NUM_FRETS + 1 }, (_, fret) => (
                                <div
                                    key={fret}
                                    className={`fret-line ${fret === 0 ? 'nut' : ''}`}
                                    style={{ width: fretWidth }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="scroll-hint">
                    ← Scroll for more frets →
                </div>
            </div>
        </div>
    );
}

export default Fretboard;
