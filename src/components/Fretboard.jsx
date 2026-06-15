import { useState, useCallback, useRef } from 'react';
import {
    STRING_TUNINGS,
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
import FretboardView from './FretboardView';
import './Fretboard.css';
import './DrawingOverlay.css';

// High contrast scale colors for color mode
const SCALE_COLORS = [
    { bg: '#4A90D9', border: '#8AB8F0' },      // Scale 1 - vivid blue
    { bg: '#E8943A', border: '#F5C078' },      // Scale 2 - vivid orange
    { bg: '#D94A7B', border: '#F08AAB' },      // Scale 3 - vivid rose
];
const DISABLED_COLORS = [
    { bg: '#cccccc', text: '#333333', border: '#999999' },
    { bg: '#888888', text: '#ffffff', border: '#555555' },
    { bg: '#444444', text: '#ffffff', border: '#111111' },
];

const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DOUBLE_DOTS = [12, 24];

/**
 * Fretboard — Scale/Chord 指板（Play / Compose 使用）。
 * 計算每格 marker（多音階/passing/disabled/CAGED 變暗/root/interval 顯示），
 * 交給共用的 FretboardView 呈現。
 */
function Fretboard({ scales, guitarType, displayMode, fretCount, cagedPosition, colorOffset = 0, disabledFrets: extDisabledFrets, onToggleFret: extOnToggleFret, onFretClick, activeNoteKey, arrowFromKey, arrowToKey }) {
    const { playNote, isLoading } = useAudio(guitarType);
    const [activeNote, setActiveNote] = useState(null);
    const canvasRef = useRef(null);
    const fretboardRef = useRef(null);
    const [disabledScales, setDisabledScales] = useState(new Set());
    const [localDisabledFrets, setLocalDisabledFrets] = useState(new Set());

    // 受控（從上層傳入）優先；無 prop 時 fallback 用本地 state
    const disabledFrets = extDisabledFrets !== undefined ? extDisabledFrets : localDisabledFrets;
    const toggleFret = (fret) => {
        if (fret <= 0) return;
        if (extOnToggleFret) { extOnToggleFret(fret); return; }
        setLocalDisabledFrets(prev => {
            const next = new Set(prev);
            if (next.has(fret)) next.delete(fret); else next.add(fret);
            return next;
        });
    };

    const {
        drawingEnabled, currentColor, setCurrentColor, brushSize, setBrushSize,
        strokeHistory, toggleDrawing, startStroke, continueStroke, endStroke, undo, clearAll,
    } = useDrawingCanvas(canvasRef, fretboardRef);

    const isIntervalMode = displayMode === 'intervals';
    const cagedRange = cagedPosition && scales.length > 0
        ? getCAGEDFretRange(scales[0].root, cagedPosition)
        : null;

    const scaleNotesArray = scales.map(s => getScaleNotes(s.root, s.scale));
    const rootNotes = scales.map(s => s.root);

    const handleNoteClick = useCallback((midiNote, stringIdx, noteName, fret) => {
        if (isLoading) return;
        playNote(midiNote, stringIdx);
        setActiveNote(`${stringIdx}-${midiNote}`);
        setTimeout(() => setActiveNote(null), 150);
        if (onFretClick) onFretClick({ stringIndex: stringIdx, fret, midiNote, noteName });
    }, [playNote, isLoading, onFretClick]);

    const isNoteEnabled = (noteName, scaleIdx) => {
        const scale = scales[scaleIdx];
        if (!scale) return false;
        if (scale.enabledNotes === null || scale.enabledNotes === undefined) return true;
        return scale.enabledNotes.includes(noteName);
    };

    const getNoteScaleInfo = (noteName) => {
        const inScales = [];
        for (let i = 0; i < scales.length; i++) {
            const notes = scaleNotesArray[i];
            if (!notes) continue;
            if (isNoteInScale(noteName, notes)) inScales.push({ idx: i, enabled: isNoteEnabled(noteName, i) });
        }
        const isRootOf = [];
        for (let i = 0; i < scales.length; i++) {
            if (rootNotes[i] === noteName) isRootOf.push(i);
        }
        return { inScales, isRootOf };
    };

    const getDisplayText = (noteName, scaleIdx) => {
        if (!isIntervalMode) return noteName;
        const scale = scales[scaleIdx];
        if (!scale) return noteName;
        let interval = getIntervalForNote(noteName, scale.root, scale.scale);
        if (scale.isChord && interval) {
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

    const toggleScale = (idx) => {
        setDisabledScales(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return next;
        });
    };

    // —— 計算 cells（normalized）給 FretboardView ——
    const count = fretCount || 15;
    const cells = new Map();
    STRING_TUNINGS.forEach((openMidi, stringIdx) => {
        for (let fret = 0; fret <= count; fret++) {
            const midiNote = openMidi + fret;
            const noteName = getNoteName(midiNote);
            const { inScales, isRootOf } = getNoteScaleInfo(noteName);
            const enabledInScales = inScales.filter(s => s.enabled);
            if (enabledInScales.length === 0) continue;

            const inMultiple = enabledInScales.length > 1;
            const isCagedDim = cagedRange && !isInCAGEDPosition(fret, cagedRange.startFret, cagedRange.endFret);
            const isUserFretDimmed = disabledFrets.has(fret);
            const isFullyDisabled = enabledInScales.every(s => disabledScales.has(s.idx));
            const visibleScales = isFullyDisabled ? enabledInScales : enabledInScales.filter(s => !disabledScales.has(s.idx));
            const primaryScaleIdx = visibleScales[0].idx;

            const isChordToneAny = visibleScales.some(s => {
                const sc = scales[s.idx];
                return !sc.chordNotes || sc.chordNotes.includes(noteName);
            });
            const isPassing = !isChordToneAny;
            const pc = getPitchColor(noteName, { passing: isPassing });
            const bg = isFullyDisabled ? `${pc.bg}55` : pc.bg;

            let label;
            if (visibleScales.length > 1) {
                label = isIntervalMode
                    ? [...new Set(visibleScales.map(s => getDisplayText(noteName, s.idx)))].join('/')
                    : ((fret === 0 && stringIdx === 0 && noteName === 'E') ? 'e' : noteName);
            } else {
                label = getDisplayText(noteName, primaryScaleIdx);
                if (!isIntervalMode && fret === 0 && stringIdx === 0 && label === 'E') label = 'e';
            }

            cells.set(`${stringIdx}-${fret}`, {
                label,
                noteName,
                role: isPassing ? 'ghost' : 'solid',
                isRoot: isRootOf.length > 0,
                multiScale: inMultiple,
                dim: isCagedDim || isUserFretDimmed,
                bg,
                fg: pc.fg,
                border: pc.border || 'transparent',
            });
        }
    });

    // key 由「弦-midi」轉成 FretboardView 的「弦-格」
    const toFretKey = (k) => {
        if (!k) return null;
        const dash = k.indexOf('-');
        const s = Number(k.slice(0, dash));
        const midi = Number(k.slice(dash + 1));
        const open = STRING_TUNINGS[s];
        return open == null ? null : `${s}-${midi - open}`;
    };
    const activeKey = toFretKey(activeNoteKey) || toFretKey(activeNote);

    // —— Header：scale legend + 繪圖工具列 ——
    const header = (
        <>
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
                {isLoading && <div className="legend-item loading"><span>Loading...</span></div>}
            </div>

            <div className="drawing-toolbar">
                <button
                    className={`draw-toggle ${drawingEnabled ? 'active' : ''}`}
                    onClick={toggleDrawing}
                    title={drawingEnabled ? 'Disable drawing' : 'Enable drawing'}
                >✏</button>
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
                                    <span className="brush-size-dot" style={{ width: s.value, height: s.value }} />
                                </button>
                            ))}
                        </div>
                        <button className="draw-action" onClick={undo} disabled={strokeHistory.length === 0} title="Undo">↩</button>
                        <button className="draw-action" onClick={clearAll} disabled={strokeHistory.length === 0} title="Clear all">✕</button>
                    </>
                )}
            </div>
        </>
    );

    // —— Overlay：繪圖 canvas ——
    const overlay = (
        <canvas
            ref={canvasRef}
            className={`drawing-canvas ${drawingEnabled ? 'active' : ''}`}
            onPointerDown={drawingEnabled ? startStroke : undefined}
            onPointerMove={drawingEnabled ? continueStroke : undefined}
            onPointerUp={drawingEnabled ? endStroke : undefined}
            onPointerLeave={drawingEnabled ? endStroke : undefined}
        />
    );

    return (
        <FretboardView
            fretCount={count}
            cells={cells}
            activeKey={activeKey}
            arrowFromKey={toFretKey(arrowFromKey)}
            arrowToKey={toFretKey(arrowToKey)}
            onCellClick={(s, f, midi) => handleNoteClick(midi, s, getNoteName(midi), f)}
            onToggleFret={toggleFret}
            disabledFrets={disabledFrets}
            header={header}
            overlay={overlay}
            fretboardRef={fretboardRef}
            containerClassName={isIntervalMode ? 'bw-mode' : ''}
            fretMarkers={FRET_MARKERS}
            doubleDotFrets={DOUBLE_DOTS}
        />
    );
}

export default Fretboard;
