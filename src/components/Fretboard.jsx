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

// Grayscale colors for disabled/muted scales
const DISABLED_COLORS = [
    { bg: '#cccccc', text: '#333333', border: '#999999' },   // Scale 1 - light gray
    { bg: '#888888', text: '#ffffff', border: '#555555' },   // Scale 2 - mid gray
    { bg: '#444444', text: '#ffffff', border: '#111111' },   // Scale 3 - dark gray
];

// Visible frets (controlled from Settings)
function Fretboard({ scales, guitarType, displayMode, fretCount }) {
    const { playNote, isLoading } = useAudio(guitarType);
    const [activeNote, setActiveNote] = useState(null);
    const scrollRef = useRef(null);
    const containerRef = useRef(null);
    const [fretWidth, setFretWidth] = useState(60);
    const [disabledScales, setDisabledScales] = useState(new Set());

    const isIntervalMode = displayMode === 'intervals';

    // Calculate fret width based on container and visible frets
    useEffect(() => {
        const updateFretWidth = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 32;
                // 確保 fretCount 有效，最小為 12
                const count = Math.max(12, fretCount || 15);
                const width = Math.max(30, Math.floor(containerWidth / (count + 0.5)));
                setFretWidth(width);
            }
        };

        updateFretWidth();
        window.addEventListener('resize', updateFretWidth);
        return () => window.removeEventListener('resize', updateFretWidth);
    }, [fretCount]);

    // Get scale notes for each scale
    const scaleNotesArray = scales.map(s => getScaleNotes(s.root, s.scale));
    const rootNotes = scales.map(s => s.root);

    const handleNoteClick = useCallback((midiNote, stringIdx, noteName) => {
        if (isLoading) return;
        playNote(midiNote, stringIdx);
        setActiveNote(`${stringIdx}-${midiNote}`);
        setTimeout(() => setActiveNote(null), 150);
    }, [playNote, isLoading]);

    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
    const doubleDotFrets = [12, 24];

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
        let interval = getIntervalForNote(noteName, scale.root, scale.scale);

        if (scale.isChord && interval) {
            // Promote diatonic steps to chord extensions
            if (interval === '2') interval = '9';
            if (interval === '♭2') interval = '♭9';
            if (interval === '♯2') interval = '♯9';
            if (interval === '4') interval = '11';
            if (interval === '♯4') interval = '♯11';
            if (interval === '6') interval = '13';
            if (interval === '♭6') interval = '♭13';
        }

        if (interval === '1') return 'R';
        return interval || noteName;
    };

    // Toggle a scale on/off
    const toggleScale = (idx) => {
        setDisabledScales(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    return (
        <div className={`fretboard-container ${isIntervalMode ? 'bw-mode' : ''}`} ref={containerRef}>
            <div className="fretboard-wrapper">
                {/* Header */}
                <div className="fretboard-header">
                    <div className="fretboard-legend">
                        {scales.map((s, idx) => (
                            <div
                                key={idx}
                                className={`legend-item ${disabledScales.has(idx) ? 'disabled' : ''}`}
                                onClick={() => toggleScale(idx)}
                                style={{ cursor: 'pointer', opacity: disabledScales.has(idx) ? 0.6 : 1 }}
                                title="Click to toggle scale visibility"
                            >
                                <div
                                    className="legend-marker"
                                    style={{
                                        backgroundColor: disabledScales.has(idx)
                                            ? DISABLED_COLORS[idx].bg
                                            : SCALE_COLORS[idx].bg,
                                        border: disabledScales.has(idx)
                                            ? `1px solid ${DISABLED_COLORS[idx].border}`
                                            : 'none'
                                    }}
                                />
                                <span style={{ textDecoration: disabledScales.has(idx) ? 'line-through' : 'none' }}>Scale {idx + 1}</span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="legend-item loading">
                                <span>Loading...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fretboard content */}
                <div className="fretboard-main">
                    <div className="fretboard">
                        {/* Fret numbers */}
                        <div className="fret-numbers">
                            {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => (
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

                                    {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => {
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

                                        const isRoot = isRootOf.length > 0;
                                        const inMultiple = enabledInScales.length > 1;

                                        // Generate gradient or solid background
                                        const generateBackground = (colors) => {
                                            if (colors.length === 1) return colors[0];
                                            if (colors.length === 2) return `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`;
                                            if (colors.length === 3) return `linear-gradient(135deg, ${colors[0]} 33.33%, ${colors[1]} 33.33% 66.66%, ${colors[2]} 66.66%)`;
                                            const step = 100 / colors.length;
                                            const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ');
                                            return `linear-gradient(135deg, ${stops})`;
                                        };

                                        let backgroundStyle, textColor, borderColor;

                                        let markerClass = 'note-marker';
                                        if (isActive) markerClass += ' active';
                                        if (isRoot) markerClass += ' root';
                                        if (inMultiple) markerClass += ' multi-scale';

                                        const isFullyDisabled = enabledInScales.every(s => disabledScales.has(s.idx));

                                        // Find visibly active scales for text/root priority
                                        const visibleScales = isFullyDisabled
                                            ? enabledInScales
                                            : enabledInScales.filter(s => !disabledScales.has(s.idx));

                                        const primaryScaleIdx = visibleScales[0].idx;

                                        // Find an active root if any
                                        let activeRootIndex = isRoot ? isRootOf.find(idx => !disabledScales.has(idx)) : undefined;
                                        if (isRoot && activeRootIndex === undefined) activeRootIndex = isRootOf[0]; // fallback

                                        const colors = enabledInScales.map(s => {
                                            return disabledScales.has(s.idx) ? DISABLED_COLORS[s.idx].bg : SCALE_COLORS[s.idx].bg;
                                        });
                                        backgroundStyle = generateBackground(colors);

                                        if (isFullyDisabled) {
                                            textColor = inMultiple ? '#ffffff' : DISABLED_COLORS[primaryScaleIdx].text;
                                        } else {
                                            textColor = '#fff';
                                        }

                                        borderColor = isRoot
                                            ? (disabledScales.has(activeRootIndex) ? DISABLED_COLORS[activeRootIndex].border : SCALE_COLORS[activeRootIndex].border)
                                            : 'transparent';

                                        let displayText;
                                        if (visibleScales.length > 1) {
                                            if (isIntervalMode) {
                                                const intervals = visibleScales.map(s => getDisplayText(noteName, s.idx));
                                                displayText = [...new Set(intervals)].join('/');
                                            } else {
                                                displayText = noteName;
                                            }
                                        } else {
                                            displayText = getDisplayText(noteName, primaryScaleIdx);
                                        }

                                        const isLongText = displayText.length > 3;

                                        return (
                                            <div
                                                key={fret}
                                                className="fret-space"
                                                style={{ width: fretWidth }}
                                            >
                                                <button
                                                    className={markerClass}
                                                    style={{
                                                        background: backgroundStyle,
                                                        borderColor: borderColor,
                                                        color: textColor,
                                                        fontSize: isLongText ? '8px' : undefined,
                                                        lineHeight: isLongText ? '1' : undefined
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
                            {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => (
                                <div
                                    key={fret}
                                    className={`fret-line ${fret === 0 ? 'nut' : ''}`}
                                    style={{ width: fretWidth }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Fretboard;
