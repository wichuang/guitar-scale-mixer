import { NOTES, SCALES } from '../data/scaleData';
import './ScalePanelCompact.css';

const SCALE_COLORS = ['#2196f3', '#ff9800', '#e91e63'];

function ScalePanelCompact({ index, root, scale, onRootChange, onScaleChange }) {
    const scaleOptions = Object.entries(SCALES).map(([key, val]) => ({
        value: key,
        label: val.name
    }));

    return (
        <div className="scale-compact" style={{ borderColor: SCALE_COLORS[index] }}>
            <span className="scale-num" style={{ background: SCALE_COLORS[index] }}>{index + 1}</span>

            <select
                className="root-select"
                value={root}
                onChange={(e) => onRootChange(e.target.value)}
            >
                {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <select
                className="scale-select"
                value={scale}
                onChange={(e) => onScaleChange(e.target.value)}
            >
                {scaleOptions.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
            </select>
        </div>
    );
}

export default ScalePanelCompact;
