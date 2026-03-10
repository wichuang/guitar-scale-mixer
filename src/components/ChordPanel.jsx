import React from 'react';
import { CHORD_ROOTS, CHORD_EXTENSIONS, CHORD_QUALITIES } from '../data/chordData';
import './ChordPanel.css';

function ChordPanel({ index, root, quality, extension, onRootChange, onQualityChange, onExtensionChange }) {
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
        </div>
    );
}

export default ChordPanel;
