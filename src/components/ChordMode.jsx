import React, { useState, useMemo } from 'react';
import Fretboard from './Fretboard';
import ChordPanel from './ChordPanel';
import { getChordNotes } from '../data/chordData';
import { GUITAR_OPTIONS } from '../App';

function ChordMode({ guitarType, setGuitarType, displayMode, setDisplayMode, fretCount }) {
    const [chordCount, setChordCount] = useState(1);

    // Default chords
    const [chords, setChords] = useState([
        { root: 'C', quality: 'Major', extension: '3' },
        { root: 'G', quality: 'Dominant', extension: '7' },
        { root: 'A', quality: 'Minor', extension: '7' }
    ]);

    const activeChords = chords.slice(0, chordCount);

    const updateChord = (index, field, value) => {
        setChords(prev => {
            const newChords = [...prev];
            newChords[index] = { ...newChords[index], [field]: value };
            return newChords;
        });
    };

    // Convert chords to "scales" for the Fretboard
    const mappedScales = useMemo(() => {
        return activeChords.map(chord => {
            const notes = getChordNotes(chord.root, chord.quality, chord.extension);
            return {
                root: chord.root,
                scale: 'chromatic', // Use chromatic formula so we can freely enable just our chord notes
                enabledNotes: notes,
                isChord: true // Custom flag in case Fretboard/interval formatting needs it
            };
        });
    }, [activeChords]);

    return (
        <div className="scale-mode">
            <div className="controls-card">
                <div className="control-section">
                    <label className="section-label">Chords</label>
                    <div className="btn-group">
                        {[1, 2, 3].map(n => (
                            <button
                                key={n}
                                className={`sm-btn ${chordCount === n ? 'active' : ''}`}
                                onClick={() => setChordCount(n)}
                            >{n}</button>
                        ))}
                    </div>
                </div>

                <div className="control-section">
                    <label className="section-label">Display</label>
                    <div className="btn-group">
                        <button
                            className={`sm-btn ${displayMode === 'notes' ? 'active' : ''}`}
                            onClick={() => setDisplayMode('notes')}
                        >ABC</button>
                        <button
                            className={`sm-btn ${displayMode === 'intervals' ? 'active' : ''}`}
                            onClick={() => setDisplayMode('intervals')}
                        >123</button>
                    </div>
                </div>

                <div className="control-section">
                    <label className="section-label">Sound</label>
                    <select
                        className="sm-select"
                        value={guitarType}
                        onChange={(e) => setGuitarType(e.target.value)}
                    >
                        {GUITAR_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="scales-row">
                {activeChords.map((chord, i) => (
                    <ChordPanel
                        key={i}
                        index={i + 1}
                        root={chord.root}
                        quality={chord.quality}
                        extension={chord.extension}
                        onRootChange={(v) => updateChord(i, 'root', v)}
                        onQualityChange={(v) => updateChord(i, 'quality', v)}
                        onExtensionChange={(v) => updateChord(i, 'extension', v)}
                    />
                ))}
            </div>

            <div className="fretboard-container">
                <Fretboard
                    scales={mappedScales}
                    guitarType={guitarType}
                    displayMode={displayMode}
                    fretCount={fretCount}
                />
            </div>
        </div>
    );
}

export default ChordMode;
