/**
 * FretboardView — 共用「呈現層」指板（外觀以 Compose 的 Fretboard 為準）
 *
 * 只負責「畫」：版面 fit-to-width、格號、弦、marker、把位點、琴枕/格線、
 * 播放動線箭頭、CAGED 變暗。完全不懂音階/旋律——由各模式（Compose / Read /
 * Play）自行算出要顯示什麼，透過 normalized props 餵進來。
 *
 * 重用 Fretboard.css 的 class，確保與 Compose 視覺完全一致。
 *
 * cells: Map<"string-fret", {
 *   label,            // 顯示文字
 *   noteName,         // 用來取 12 音名色（未給 bg 時）
 *   role,             // 'solid' | 'ghost'
 *   isRoot,           // 根音白點
 *   dim,              // CAGED 範圍外變暗
 *   bg, fg, border    // 選填：直接指定顏色（如 Play 的多音階漸層）
 * }>
 */
import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { STRING_TUNINGS } from '../data/scaleData';
import { getPitchColor } from '../data/pitchColors';
import './Fretboard.css';

const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];
const DEFAULT_FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
const DEFAULT_DOUBLE_DOTS = [12, 24];

function FretboardView({
    fretCount = 19,
    cells = new Map(),
    arrowFromKey = null,
    arrowToKey = null,
    activeKey = null,
    onCellClick,
    onPlayMidi,
    onToggleFret,
    disabledFrets,
    header = null,
    overlay = null,
    stringTunings = STRING_TUNINGS,
    fretMarkers = DEFAULT_FRET_MARKERS,
    doubleDotFrets = DEFAULT_DOUBLE_DOTS,
    fretboardRef: externalFretboardRef = null,   // 由外層傳入時用它（繪圖 canvas 需要 ref 到 .fretboard）
    containerClassName = '',                      // 額外容器 class（如 interval bw-mode）
}) {
    const containerRef = useRef(null);
    const internalFretboardRef = useRef(null);
    const fretboardRef = externalFretboardRef || internalFretboardRef;
    const [fretWidth, setFretWidth] = useState(48);

    // fit-to-width：依容器寬度算格寬（與 Compose Fretboard 同公式）
    useEffect(() => {
        const update = () => {
            if (!containerRef.current) return;
            const containerWidth = containerRef.current.offsetWidth - 32 - 28;
            const w = Math.max(22, Math.floor(containerWidth / (fretCount + 0.5)));
            setFretWidth(w);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [fretCount]);

    // 播放動線：量測前/後音 marker 位置畫單一條箭頭（下一條出現時上一條消失）
    const [arrowCoords, setArrowCoords] = useState(null);
    useLayoutEffect(() => {
        const fb = fretboardRef.current;
        let next = null;
        if (fb && arrowFromKey && arrowToKey) {
            const fromEl = fb.querySelector(`[data-key="${arrowFromKey}"]`);
            const toEl = fb.querySelector(`[data-key="${arrowToKey}"]`);
            if (fromEl && toEl) {
                const fbRect = fb.getBoundingClientRect();
                const center = (el) => {
                    const r = el.getBoundingClientRect();
                    return { x: r.left - fbRect.left + r.width / 2, y: r.top - fbRect.top + r.height / 2 };
                };
                const p1 = center(fromEl);
                const p2 = center(toEl);
                next = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, w: fb.offsetWidth, h: fb.offsetHeight };
            }
        }
        setArrowCoords(next);
    }, [arrowFromKey, arrowToKey, fretWidth, cells, fretboardRef]);

    const frets = Array.from({ length: fretCount + 1 }, (_, f) => f);
    const isFretDisabled = (fret) => !!(disabledFrets && disabledFrets.has && disabledFrets.has(fret));

    return (
        <div className={`fretboard-container ${containerClassName}`} ref={containerRef}>
            <div className="fretboard-wrapper">
                {header && <div className="fretboard-header">{header}</div>}

                <div className="fretboard-main">
                    <div className="fretboard" ref={fretboardRef}>
                        {/* 格號 — 每格都顯示（marked 較亮）；可選 toggle */}
                        <div className="fret-numbers">
                            <div className="string-gutter spacer">·</div>
                            {frets.map(fret => (
                                <div key={fret} className="fret-number-cell" style={{ width: fretWidth }}>
                                    <button
                                        className={`fret-number-btn ${fretMarkers.includes(fret) ? 'marked' : ''} ${isFretDisabled(fret) ? 'fret-off' : ''}`}
                                        onClick={() => onToggleFret && fret > 0 && onToggleFret(fret)}
                                        disabled={!onToggleFret || fret === 0}
                                        title={fret === 0 ? '開放弦' : `Fret ${fret}`}
                                    >{fret}</button>
                                </div>
                            ))}
                        </div>

                        {/* 弦 + marker */}
                        {stringTunings.map((openMidi, stringIdx) => {
                            const stringThickness = 1 + stringIdx * 0.4;
                            return (
                                <div key={stringIdx} className="string-row">
                                    <div className="string-gutter">{STRING_NAMES[stringIdx]}</div>
                                    <div className="string-line" style={{ height: `${stringThickness}px` }} />
                                    {frets.map(fret => {
                                        const midiNote = openMidi + fret;
                                        const key = `${stringIdx}-${fret}`;
                                        const cell = cells.get(key);
                                        if (!cell) {
                                            return <div key={fret} className="fret-space" style={{ width: fretWidth }} />;
                                        }

                                        // 顏色：給了 bg 就直接用（如 disabled 的半透明）；否則取 12 音名色。
                                        // 與 Compose 一致：passing/ghost = passing 變體底色 + 2.5px 邊框；chord tone = 實心 1.5px。
                                        const pc = cell.bg
                                            ? { bg: cell.bg, fg: cell.fg, border: cell.border }
                                            : getPitchColor(cell.noteName, { passing: cell.role === 'ghost' });
                                        const style = {
                                            background: pc.bg,
                                            color: pc.fg,
                                            borderColor: pc.border || 'transparent',
                                            borderStyle: 'solid',
                                            borderWidth: cell.role === 'ghost' ? '2.5px' : '1.5px',
                                        };

                                        let cls = 'note-marker';
                                        if (cell.isRoot) cls += ' root';
                                        if (cell.multiScale) cls += ' multi-scale';
                                        if (cell.dim) cls += ' caged-dim';
                                        if (activeKey === key) cls += ' active';

                                        const isLong = (cell.label || '').length > 3;

                                        return (
                                            <div key={fret} className="fret-space" style={{ width: fretWidth }}>
                                                <button
                                                    className={cls}
                                                    data-key={key}
                                                    style={{ ...style, fontSize: isLong ? '8px' : undefined, lineHeight: isLong ? '1' : undefined }}
                                                    onClick={() => {
                                                        if (onPlayMidi) onPlayMidi(midiNote);
                                                        if (onCellClick) onCellClick(stringIdx, fret, midiNote, cell);
                                                    }}
                                                    title={`${cell.noteName ?? ''} (Fret ${fret})`}
                                                >
                                                    {cell.label}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* 把位點 */}
                        <div className="fret-dots-bottom">
                            <div className="string-gutter spacer">·</div>
                            {frets.map(fret => (
                                <div key={fret} className="fret-dot-cell" style={{ width: fretWidth }}>
                                    {fretMarkers.includes(fret) && !doubleDotFrets.includes(fret) && <div className="fret-dot" />}
                                    {doubleDotFrets.includes(fret) && (<><div className="fret-dot" /><div className="fret-dot" /></>)}
                                </div>
                            ))}
                        </div>

                        {/* 格線 / 琴枕 */}
                        <div className="fret-lines">
                            {frets.map(fret => (
                                <div key={fret} className={`fret-line ${fret === 0 ? 'nut' : ''}`} style={{ width: fretWidth }} />
                            ))}
                        </div>

                        {/* 播放動線箭頭 */}
                        {arrowCoords && (
                            <svg className="play-arrow-layer" width={arrowCoords.w} height={arrowCoords.h}>
                                <defs>
                                    <marker id="fbv-play-arrowhead" markerWidth="6" markerHeight="6" refX="4.6" refY="3" orient="auto">
                                        <path className="play-arrow-head" d="M0,0 L6,3 L0,6 Z" />
                                    </marker>
                                </defs>
                                <line
                                    className="play-arrow-line"
                                    x1={arrowCoords.x1} y1={arrowCoords.y1}
                                    x2={arrowCoords.x2} y2={arrowCoords.y2}
                                    markerEnd="url(#fbv-play-arrowhead)"
                                />
                            </svg>
                        )}

                        {/* 額外覆蓋層（如繪圖 canvas）*/}
                        {overlay}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FretboardView;
