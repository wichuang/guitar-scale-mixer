import { NOTES, SCALES, getScaleNotes, getIntervalForNote } from '../data/scaleData';
import './ScalePanelCompact.css';

const SCALE_COLORS = ['#2196f3', '#ff9800', '#e91e63']; // 藍色、橘色、桃紅色，與指板一致

function ScalePanelCompact({ index, root, scale, enabledNotes, onRootChange, onScaleChange, onToggleNote }) {
    const scaleOptions = Object.entries(SCALES).map(([key, val]) => ({
        value: key,
        label: val.name
    }));

    const scaleNotes = getScaleNotes(root, scale);

    return (
        <div className="scale-compact" style={{ borderColor: SCALE_COLORS[index] }}>
            <div className="scale-header-row">
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

            <div className="scale-notes-toggle">
                {scaleNotes.map((note) => {
                    const isEnabled = !enabledNotes || enabledNotes.includes(note);
                    let interval = getIntervalForNote(note, root, scale);
                    const isRoot = interval === '1';
                    if (isRoot) interval = 'R';

                    return (
                        <button
                            key={note}
                            className={`note-toggle-btn ${isEnabled ? 'enabled' : 'disabled'} ${isRoot ? 'is-root' : ''}`}
                            onClick={() => onToggleNote(note)}
                            title={`${note} (${interval})`}
                        >
                            <span className="note-name">{note}</span>
                            <span className="note-interval">{interval}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default ScalePanelCompact;
