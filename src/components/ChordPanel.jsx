import React from 'react';
import { CHORD_ROOTS, CHORD_EXTENSIONS, CHORD_QUALITIES } from '../data/chordData';
import { NOTES, getIntervalForNote } from '../data/scaleData';
import { getPitchColor } from '../data/pitchColors';
import './ChordPanel.css';

function ChordPanel({
    index,
    root,
    quality,
    extension,
    enabledNotes = [],
    chordNotes = [],
    onRootChange,
    onQualityChange,
    onExtensionChange,
    onToggleNote
}) {
    return (
        <div className="chord-panel chord-theme">
            <div className="chord-header">
                <span className="chord-title">Chord {index}</span>
            </div>

            <div className="chord-selectors">
                <div className="selector-group">
                    <label>Root</label>
                    <select
                        value={root}
                        onChange={(e) => onRootChange(e.target.value)}
                        className="chord-select"
                    >
                        {CHORD_ROOTS.map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>

                <div className="selector-group">
                    <label>Quality</label>
                    <select
                        value={quality}
                        onChange={(e) => onQualityChange(e.target.value)}
                        className="chord-select"
                    >
                        {CHORD_QUALITIES.map(q => (
                            <option key={q} value={q}>{q}</option>
                        ))}
                    </select>
                </div>

                <div className="selector-group">
                    <label>Ext.</label>
                    <select
                        value={extension}
                        onChange={(e) => onExtensionChange(e.target.value)}
                        className="chord-select"
                    >
                        {CHORD_EXTENSIONS.map(ext => (
                            <option key={ext} value={ext}>{ext === 3 ? "Triad (3)" : ext}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 12 音名 picker — 預設 chord 內的音 ON、其他 OFF；可逐個 toggle */}
            <div className="chord-notes-toggle">
                {NOTES.map(note => {
                    const isEnabled = enabledNotes.includes(note);
                    const isChordTone = chordNotes.includes(note);
                    const isRoot = note === root;
                    let interval = getIntervalForNote(note, root, 'chromatic') || '';
                    if (isRoot) interval = 'R';

                    // chord tone：原色實心；passing tone（user toggle on 的非 chord 音）：淡心 + 同色邊框
                    const pc = getPitchColor(note, { passing: isEnabled && !isChordTone });
                    const isPassing = isEnabled && !isChordTone;
                    const basePc = getPitchColor(note);
                    const pillStyle = isEnabled
                        ? {
                            background: pc.bg,
                            color: pc.fg,
                            borderColor: pc.border || 'transparent',
                            borderStyle: 'solid',
                            borderWidth: isPassing ? '2px' : '1px',
                        }
                        : {
                            background: `${basePc.bg}22`,
                            color: pc.fg,
                            borderColor: `${basePc.bg}55`,
                            borderStyle: 'solid',
                            borderWidth: '1px',
                        };

                    // 所有 chord tone（含 root）都鎖定不可 toggle off
                    const isLocked = isChordTone;

                    return (
                        <button
                            key={note}
                            className={`note-toggle-btn ${isEnabled ? 'enabled' : 'disabled'} ${isRoot ? 'is-root' : ''}`}
                            onClick={isLocked ? undefined : () => onToggleNote?.(note)}
                            disabled={isLocked}
                            style={{ ...pillStyle, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                            title={
                                isLocked
                                    ? `${note}（${isRoot ? 'root' : 'chord tone'} · 鎖定）`
                                    : `${note}（passing） · ${interval}`
                            }
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

export default ChordPanel;
