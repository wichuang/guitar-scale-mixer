import { useState, useCallback, useRef, useEffect } from 'react';
import {
    STRING_TUNINGS,
    NUM_FRETS,
    getNoteName,
    getScaleNotes,
    isNoteInScale,
    getIntervalForNote,
    getCAGEDFretRange,
    isInCAGEDPosition,
} from '../data/scaleData';
import { useAudio } from '../hooks/useAudio';
import { useDrawingCanvas, HIGHLIGHTER_COLORS, BRUSH_SIZES } from '../hooks/useDrawingCanvas';
import { getPitchColor } from '../data/pitchColors';
import './Fretboard.css';
import './DrawingOverlay.css';

// High contrast scale colors for color mode
const SCALE_COLORS = [
    { bg: '#4A90D9', border: '#8AB8F0' },      // Scale 1 - vivid blue
    { bg: '#E8943A', border: '#F5C078' },      // Scale 2 - vivid orange
    { bg: '#D94A7B', border: '#F08AAB' },      // Scale 3 - vivid rose
];

// Grayscale colors for disabled/muted scales
const DISABLED_COLORS = [
    { bg: '#cccccc', text: '#333333', border: '#999999' },   // Scale 1 - light gray
    { bg: '#888888', text: '#ffffff', border: '#555555' },   // Scale 2 - mid gray
    { bg: '#444444', text: '#ffffff', border: '#111111' },   // Scale 3 - dark gray
];

// 6 弦音名（高 E 到低 E，配合 STRING_TUNINGS 順序）
const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];

// Visible frets (controlled from Settings)
function Fretboard({ scales, guitarType, displayMode, fretCount, cagedPosition, colorOffset = 0, disabledFrets: extDisabledFrets, onToggleFret: extOnToggleFret }) {
    const { playNote, isLoading } = useAudio(guitarType);
    const [activeNote, setActiveNote] = useState(null);
    const scrollRef = useRef(null);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const fretboardRef = useRef(null);
    const [fretWidth, setFretWidth] = useState(60);
    const [disabledScales, setDisabledScales] = useState(new Set());
    const [localDisabledFrets, setLocalDisabledFrets] = useState(new Set());

    // 受控（從上層傳入）優先；無 prop 時 fallback 用本地 state
    const disabledFrets = extDisabledFrets !== undefined ? extDisabledFrets : localDisabledFrets;
    const toggleFret = (fret) => {
        if (fret <= 0) return; // open string 不可 toggle
        if (extOnToggleFret) {
            extOnToggleFret(fret);
            return;
        }
        setLocalDisabledFrets(prev => {
            const next = new Set(prev);
            if (next.has(fret)) next.delete(fret);
            else next.add(fret);
            return next;
        });
    };

    const {
        drawingEnabled,
        currentColor,
        setCurrentColor,
        brushSize,
        setBrushSize,
        strokeHistory,
        toggleDrawing,
        startStroke,
        continueStroke,
        endStroke,
        undo,
        clearAll,
    } = useDrawingCanvas(canvasRef, fretboardRef);

    const isIntervalMode = displayMode === 'intervals';

    // CAGED position fret range
    const cagedRange = cagedPosition && scales.length > 0
        ? getCAGEDFretRange(scales[0].root, cagedPosition)
        : null;

    // Calculate fret width based on container and visible frets
    useEffect(() => {
        const updateFretWidth = () => {
            if (containerRef.current) {
                // 扣除外層 padding 32 + 左側 string-gutter 28
                const containerWidth = containerRef.current.offsetWidth - 32 - 28;
                const count = fretCount || 15;
                const width = Math.max(28, Math.floor(containerWidth / (count + 0.5)));
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
        // Only look at scales up to current scales.length
        const inScales = [];
        for (let i = 0; i < scales.length; i++) {
            const notes = scaleNotesArray[i];
            if (!notes) continue;

            const inScale = isNoteInScale(noteName, notes);
            const enabled = isNoteEnabled(noteName, i);
            if (inScale) {
                inScales.push({ idx: i, enabled });
            }
        }

        const isRootOf = [];
        for (let i = 0; i < scales.length; i++) {
            if (rootNotes[i] === noteName) {
                isRootOf.push(i);
            }
        }

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
                                            ? DISABLED_COLORS[(idx + colorOffset) % DISABLED_COLORS.length].bg
                                            : SCALE_COLORS[(idx + colorOffset) % SCALE_COLORS.length].bg,
                                        border: disabledScales.has(idx)
                                            ? `1px solid ${DISABLED_COLORS[(idx + colorOffset) % DISABLED_COLORS.length].border}`
                                            : 'none'
                                    }}
                                />
                                <span style={{ textDecoration: disabledScales.has(idx) ? 'line-through' : 'none' }}>Scale {idx + colorOffset + 1}</span>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="legend-item loading">
                                <span>Loading...</span>
                            </div>
                        )}
                    </div>

                    {/* Drawing toolbar */}
                    <div className="drawing-toolbar">
                        <button
                            className={`draw-toggle ${drawingEnabled ? 'active' : ''}`}
                            onClick={toggleDrawing}
                            title={drawingEnabled ? 'Disable drawing' : 'Enable drawing'}
                        >
                            ✏
                        </button>
                        {drawingEnabled && (
                            <>
                                <div className="color-swatches">
                                    {HIGHLIGHTER_COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            className={`color-swatch ${currentColor === c.value ? 'selected' : ''}`}
                                            style={{ backgroundColor: c.display }}
                                            onClick={() => setCurrentColor(c.value)}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                                <div className="brush-sizes">
                                    {BRUSH_SIZES.map(s => (
                                        <button
                                            key={s.name}
                                            className={`brush-size-btn ${brushSize === s.value ? 'selected' : ''}`}
                                            onClick={() => setBrushSize(s.value)}
                                            title={s.name}
                                        >
                                            <span
                                                className="brush-size-dot"
                                                style={{ width: s.value, height: s.value }}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="draw-action"
                                    onClick={undo}
                                    disabled={strokeHistory.length === 0}
                                    title="Undo"
                                >
                                    ↩
                                </button>
                                <button
                                    className="draw-action"
                                    onClick={clearAll}
                                    disabled={strokeHistory.length === 0}
                                    title="Clear all"
                                >
                                    ✕
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Fretboard content */}
                <div className="fretboard-main">
                    <div className="fretboard" ref={fretboardRef}>
                        {/* Fret numbers — 可點擊 toggle on/off 整個 fret */}
                        <div className="fret-numbers">
                            <div className="string-gutter spacer">·</div>
                            {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => {
                                const isFretDisabled = disabledFrets.has(fret);
                                return (
                                    <div
                                        key={fret}
                                        className="fret-number-cell"
                                        style={{ width: fretWidth }}
                                    >
                                        <button
                                            className={`fret-number-btn ${fretMarkers.includes(fret) ? 'marked' : ''} ${isFretDisabled ? 'fret-off' : ''}`}
                                            onClick={() => toggleFret(fret)}
                                            disabled={fret === 0}
                                            title={fret === 0 ? '開放弦' : `Fret ${fret}（點擊 toggle on/off）`}
                                        >
                                            {fret}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Strings */}
                        {STRING_TUNINGS.map((openMidi, stringIdx) => {
                            const stringThickness = 1 + stringIdx * 0.4;

                            return (
                                <div key={stringIdx} className="string-row">
                                    <div className="string-gutter">{STRING_NAMES[stringIdx]}</div>
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
                                                    key={`${stringIdx}-${fret}`}
                                                    className="fret-space"
                                                    style={{ width: fretWidth }}
                                                />
                                            );
                                        }

                                        const isRoot = isRootOf.length > 0;
                                        const inMultiple = enabledInScales.length > 1;

                                        // Generate gradient or solid background
                                        const generateBackground = (colors) => {
                                            if (colors.length === 0) return 'transparent';
                                            if (colors.length === 1) return colors[0];
                                            return `linear-gradient(to right, ${colors.join(', ')})`;
                                        };

                                        let backgroundStyle, textColor, borderColor;

                                        const isCagedDim = cagedRange && !isInCAGEDPosition(fret, cagedRange.startFret, cagedRange.endFret);
                                        const isUserFretDimmed = disabledFrets.has(fret);

                                        let markerClass = 'note-marker';
                                        if (isActive) markerClass += ' active';
                                        if (isRoot) markerClass += ' root';
                                        if (inMultiple) markerClass += ' multi-scale';
                                        if (isCagedDim || isUserFretDimmed) markerClass += ' caged-dim';

                                        const isFullyDisabled = enabledInScales.every(s => disabledScales.has(s.idx));

                                        const visibleScales = isFullyDisabled
                                            ? enabledInScales
                                            : enabledInScales.filter(s => !disabledScales.has(s.idx));

                                        const primaryScaleIdx = visibleScales[0].idx;

                                        // 判斷是否為 chord tone：任一 active scale 把這音列為 chord tone 即算（沒 chordNotes 欄位的就一律當 chord tone）
                                        const isChordToneAny = visibleScales.some(s => {
                                            const sc = scales[s.idx];
                                            return !sc.chordNotes || sc.chordNotes.includes(noteName);
                                        });
                                        // chord tone：滿色實心；passing tone：淡心 + 同色邊框
                                        const isPassing = !isChordToneAny;
                                        const pitchColor = getPitchColor(noteName, { passing: isPassing });
                                        backgroundStyle = pitchColor.bg;
                                        textColor = pitchColor.fg;
                                        borderColor = pitchColor.border || 'transparent';

                                        // disabled scale 的音符變淡
                                        if (isFullyDisabled) {
                                            backgroundStyle = `${pitchColor.bg}55`;
                                        }

                                        let displayText;
                                        if (visibleScales.length > 1) {
                                            if (isIntervalMode) {
                                                const intervals = visibleScales.map(s => getDisplayText(noteName, s.idx));
                                                displayText = [...new Set(intervals)].join('/');
                                            } else {
                                                displayText = (fret === 0 && stringIdx === 0 && noteName === 'E') ? 'e' : noteName;
                                            }
                                        } else {
                                            displayText = getDisplayText(noteName, primaryScaleIdx);
                                            if (!isIntervalMode && fret === 0 && stringIdx === 0 && displayText === 'E') {
                                                displayText = 'e';
                                            }
                                        }

                                        const isLongText = displayText.length > 3;

                                        return (
                                            <div
                                                key={`${stringIdx}-${fret}`}
                                                className="fret-space"
                                                style={{ width: fretWidth }}
                                            >
                                                <button
                                                    className={markerClass}
                                                    style={{
                                                        background: backgroundStyle,
                                                        borderColor: borderColor,
                                                        borderStyle: 'solid',
                                                        borderWidth: isPassing ? '2.5px' : '1.5px',
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

                        {/* Bottom 把位點 (3, 5, 7, 9 單點；12 雙點；15 單點 ...) */}
                        <div className="fret-dots-bottom">
                            <div className="string-gutter spacer">·</div>
                            {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => (
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

                        {/* Drawing canvas overlay */}
                        <canvas
                            ref={canvasRef}
                            className={`drawing-canvas ${drawingEnabled ? 'active' : ''}`}
                            onPointerDown={drawingEnabled ? startStroke : undefined}
                            onPointerMove={drawingEnabled ? continueStroke : undefined}
                            onPointerUp={drawingEnabled ? endStroke : undefined}
                            onPointerLeave={drawingEnabled ? endStroke : undefined}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Fretboard;
