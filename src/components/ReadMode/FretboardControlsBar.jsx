/**
 * FretboardControlsBar — 指板上方控制列（Display / Key / Scale / BPM / 8ve / Position）
 * 由 inline 指板與彈出視窗共用；以 callbacks 接設定（inline 直接 set，popup 送訊息）。
 */
import { NOTES, CAGED_SHAPES } from '../../data/scaleData.js';

const SCALE_OPTIONS = [
    ['Major', 'Major'], ['Minor', 'Minor'], ['Dorian', 'Dorian'], ['Phrygian', 'Phrygian'],
    ['Lydian', 'Lydian'], ['Mixolydian', 'Mixolydian'], ['Locrian', 'Locrian'],
    ['HarmonicMinor', 'Harm. Minor'], ['MelodicMinor', 'Mel. Minor'],
];

function FretboardControlsBar({
    displayMode = 'notes', musicKey = 'C', scaleType = 'Major', tempo = 120, rangeOctave = 0, cagedPosition = null,
    onDisplay, onKey, onScale, onTempo, onOctave, onCaged,
}) {
    const lbl = { color: '#888', fontSize: '11px' };
    const sel = { background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', padding: '2px 4px' };
    const btn = (active) => ({
        padding: '2px 8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        background: active ? '#2196F3' : '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px',
    });
    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={lbl}>Display</span>
            <div style={{ display: 'flex', gap: '2px' }}>
                <button style={btn((displayMode || 'notes') !== 'intervals')} onClick={() => onDisplay && onDisplay('notes')}>ABC</button>
                <button style={btn(displayMode === 'intervals')} onClick={() => onDisplay && onDisplay('intervals')}>123</button>
            </div>

            <span style={lbl}>Key</span>
            <select style={sel} value={musicKey} onChange={(e) => onKey && onKey(e.target.value)}>
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <select style={sel} value={scaleType} onChange={(e) => onScale && onScale(e.target.value)}>
                {SCALE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            <span style={lbl}>BPM</span>
            <input type="number" min="40" max="240" value={tempo}
                onChange={(e) => onTempo && onTempo(Number(e.target.value))}
                style={{ ...sel, width: '52px' }} />

            <span style={lbl}>8ve</span>
            <button style={btn(false)} onClick={() => onOctave && onOctave((rangeOctave || 0) - 1)}>−</button>
            <span style={{ color: '#fff', fontSize: '12px', minWidth: '18px', textAlign: 'center' }}>
                {(rangeOctave || 0) > 0 ? `+${rangeOctave}` : (rangeOctave || 0)}
            </span>
            <button style={btn(false)} onClick={() => onOctave && onOctave((rangeOctave || 0) + 1)}>＋</button>

            <span style={lbl}>Position</span>
            <div style={{ display: 'flex', gap: '2px' }}>
                <button style={btn(cagedPosition === null)} onClick={() => onCaged && onCaged(null)}>All</button>
                {CAGED_SHAPES.map(s => (
                    <button key={s} style={btn(cagedPosition === s)} onClick={() => onCaged && onCaged(s)}>{s}</button>
                ))}
            </div>
        </div>
    );
}

export default FretboardControlsBar;
