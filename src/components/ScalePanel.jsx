import { useCallback, useMemo } from 'react';
import { SCALES, NOTES, getScaleNotes, getNoteColor, getNoteTextColor } from '../data/scaleData';
import { useAudio } from '../hooks/useAudio';
import './ScalePanel.css';

// Scale panel colors
const PANEL_ACCENT_COLORS = ['#d4a574', '#00bcd4', '#e040fb'];

function ScalePanel({ scaleIndex, root, scale, enabledNotes, onRootChange, onScaleChange, onToggleNote, guitarType }) {
    const { playNoteByName } = useAudio(guitarType);
    const scaleData = SCALES[scale];
    const scaleNotes = getScaleNotes(root, scale);
    const accentColor = PANEL_ACCENT_COLORS[scaleIndex] || PANEL_ACCENT_COLORS[0];

    // Memoize enabled check
    const enabledSet = useMemo(() => {
        if (enabledNotes === null) return null;
        return new Set(enabledNotes);
    }, [enabledNotes]);

    const isNoteEnabled = useCallback((noteName) => {
        if (enabledSet === null) return true;
        return enabledSet.has(noteName);
    }, [enabledSet]);

    const handleNoteClick = useCallback((noteName) => {
        playNoteByName(noteName);
    }, [playNoteByName]);

    const handleToggle = useCallback((noteName) => {
        onToggleNote(noteName, scaleNotes);
    }, [onToggleNote, scaleNotes]);

    return (
        <div
            className="scale-panel"
            style={{ '--accent': accentColor }}
        >
            <div className="panel-header">
                <span className="panel-title">
                    SCALE <span className="scale-number">{scaleIndex + 1}</span>
                </span>
                <span className="root-badge">{root}</span>
            </div>

            <div className="controls-row">
                <div className="control-group small">
                    <label className="control-label">Root</label>
                    <select
                        className="dropdown"
                        value={root}
                        onChange={(e) => onRootChange(e.target.value)}
                    >
                        {NOTES.map(note => (
                            <option key={note} value={note}>
                                {note}{note.includes('#') ? ` / ${note.replace('#', 'b')}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="control-group">
                    <label className="control-label">Scale</label>
                    <select
                        className="dropdown"
                        value={scale}
                        onChange={(e) => onScaleChange(e.target.value)}
                    >
                        <optgroup label="Major Modes">
                            <option value="major">Major (Ionian)</option>
                            <option value="dorian">Dorian</option>
                            <option value="phrygian">Phrygian</option>
                            <option value="lydian">Lydian</option>
                            <option value="mixolydian">Mixolydian</option>
                            <option value="aeolian">Natural Minor (Aeolian)</option>
                            <option value="locrian">Locrian</option>
                        </optgroup>
                        <optgroup label="Minor Variants">
                            <option value="harmonic-minor">Harmonic Minor</option>
                            <option value="melodic-minor">Melodic Minor</option>
                        </optgroup>
                        <optgroup label="Pentatonic / Blues">
                            <option value="major-pentatonic">Major Pentatonic</option>
                            <option value="minor-pentatonic">Minor Pentatonic</option>
                            <option value="blues">Blues</option>
                        </optgroup>
                        <optgroup label="Symmetric Scales">
                            <option value="whole-tone">Whole Tone</option>
                            <option value="diminished-hw">Diminished (Half-Whole)</option>
                            <option value="diminished-wh">Diminished (Whole-Half)</option>
                            <option value="chromatic">Chromatic</option>
                        </optgroup>
                        <optgroup label="Exotic / World Scales">
                            <option value="phrygian-dominant">Phrygian Dominant</option>
                            <option value="hungarian-minor">Hungarian Minor</option>
                            <option value="japanese">Japanese (In Sen)</option>
                            <option value="arabic">Arabic (Double Harmonic)</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            {scaleData && (
                <div
                    className="scale-grid"
                    style={{ gridTemplateColumns: `repeat(${scaleNotes.length}, 1fr)` }}
                >
                    {/* Row 1: Toggle buttons */}
                    {scaleNotes.map((note, i) => {
                        const enabled = isNoteEnabled(note);
                        return (
                            <button
                                key={`toggle-${i}`}
                                className={`grid-cell toggle-cell ${enabled ? 'on' : 'off'}`}
                                onClick={() => handleToggle(note)}
                                title={enabled ? 'Click to hide' : 'Click to show'}
                                type="button"
                            >
                                {enabled ? '●' : '○'}
                            </button>
                        );
                    })}

                    {/* Row 2: Degrees */}
                    {scaleData.degrees.map((deg, i) => (
                        <div
                            key={`deg-${i}`}
                            className={`grid-cell degree-cell ${!isNoteEnabled(scaleNotes[i]) ? 'disabled' : ''}`}
                        >
                            {deg}
                        </div>
                    ))}

                    {/* Row 3: Notes (clickable) */}
                    {scaleNotes.map((note, i) => {
                        const enabled = isNoteEnabled(note);
                        return (
                            <button
                                key={`note-${i}`}
                                className={`grid-cell note-cell ${!enabled ? 'disabled' : ''}`}
                                style={{
                                    backgroundColor: enabled ? getNoteColor(note) : 'transparent',
                                    color: enabled ? getNoteTextColor(note) : 'var(--text-muted)',
                                    borderColor: enabled ? 'transparent' : getNoteColor(note),
                                }}
                                onClick={() => enabled && handleNoteClick(note)}
                                type="button"
                            >
                                {note}
                            </button>
                        );
                    })}

                    {/* Row 4: Intervals */}
                    {scaleData.intervalNames.map((interval, i) => (
                        <div
                            key={`int-${i}`}
                            className={`grid-cell interval-cell ${!isNoteEnabled(scaleNotes[i]) ? 'disabled' : ''}`}
                        >
                            {interval}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ScalePanel;
