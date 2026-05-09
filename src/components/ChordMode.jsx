import React, { useState, useMemo } from 'react';
import Fretboard from './Fretboard';
import ChordPanel from './ChordPanel';
import { getChordNotes } from '../data/chordData';
import { CAGED_SHAPES } from '../data/scaleData';
import { GUITAR_OPTIONS } from '../App';

function ChordMode({ guitarType, setGuitarType, displayMode, setDisplayMode, fretCount }) {
    const [chordCount, setChordCount] = useState(1);
    const [cagedPosition, setCagedPosition] = useState(null);
    const [fretboardLayout, setFretboardLayout] = useState('overlay');
    const [disabledFrets, setDisabledFrets] = useState(new Set());

    // 切換 CAGED position（含「All」）時重設 fret toggle 狀態
    const handleSetCagedPosition = (pos) => {
        setCagedPosition(pos);
        setDisabledFrets(new Set());
    };

    const toggleFret = (fret) => {
        if (fret <= 0) return;
        setDisabledFrets(prev => {
            const next = new Set(prev);
            if (next.has(fret)) next.delete(fret);
            else next.add(fret);
            return next;
        });
    };

    // Default chords — enabledNotes 預設 = chord 內的音；其他音 picker 為 OFF
    const [chords, setChords] = useState(() => {
        const defaults = [
            { root: 'C', quality: 'Major', extension: '3' },
            { root: 'G', quality: 'Dominant', extension: '7' },
            { root: 'A', quality: 'Minor', extension: '7' }
        ];
        return defaults.map(c => ({
            ...c,
            enabledNotes: getChordNotes(c.root, c.quality, c.extension)
        }));
    });

    const activeChords = chords.slice(0, chordCount);

    // Update root / quality / extension：重設 enabledNotes 為新 chord 的音
    const updateChord = (index, field, value) => {
        setChords(prev => {
            const newChords = [...prev];
            const merged = { ...newChords[index], [field]: value };
            if (field === 'root' || field === 'quality' || field === 'extension') {
                merged.enabledNotes = getChordNotes(merged.root, merged.quality, merged.extension);
            }
            newChords[index] = merged;
            return newChords;
        });
    };

    // 切換 picker 的單個音 on/off。所有 chord tone（含 root）都鎖定，不可 toggle off。
    const toggleChordNote = (index, note) => {
        setChords(prev => {
            const cur = prev[index];
            const chordTones = getChordNotes(cur.root, cur.quality, cur.extension);
            if (chordTones.includes(note)) return prev; // chord tones 鎖定
            const newChords = [...prev];
            const enabled = cur.enabledNotes || [];
            newChords[index] = {
                ...cur,
                enabledNotes: enabled.includes(note)
                    ? enabled.filter(n => n !== note)
                    : [...enabled, note]
            };
            return newChords;
        });
    };

    // Convert chords to "scales" for the Fretboard
    // chordNotes：實際的 chord tones（如 C major = C/E/G）；
    // enabledNotes：實際顯示的音（含 user 額外 toggle on 的 passing tones）
    const mappedScales = useMemo(() => {
        return activeChords.map(chord => {
            return {
                root: chord.root,
                scale: 'chromatic',
                enabledNotes: chord.enabledNotes,
                chordNotes: getChordNotes(chord.root, chord.quality, chord.extension),
                isChord: true
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
                    {chordCount > 1 && (
                        <div className="btn-group" style={{ marginLeft: '8px' }}>
                            <button
                                className={`sm-btn ${fretboardLayout === 'overlay' ? 'active' : ''}`}
                                onClick={() => setFretboardLayout('overlay')}
                                title="合併顯示在同一指板"
                            >合併</button>
                            <button
                                className={`sm-btn ${fretboardLayout === 'separate' ? 'active' : ''}`}
                                onClick={() => setFretboardLayout('separate')}
                                title="各自顯示在獨立指板"
                            >分開</button>
                        </div>
                    )}
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
                    <label className="section-label">Position</label>
                    <div className="btn-group">
                        <button
                            className={`sm-btn ${cagedPosition === null ? 'active' : ''}`}
                            onClick={() => handleSetCagedPosition(null)}
                        >All</button>
                        {CAGED_SHAPES.map(shape => (
                            <button
                                key={shape}
                                className={`sm-btn ${cagedPosition === shape ? 'active' : ''}`}
                                onClick={() => handleSetCagedPosition(shape)}
                            >{shape}</button>
                        ))}
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
                        enabledNotes={chord.enabledNotes}
                        chordNotes={getChordNotes(chord.root, chord.quality, chord.extension)}
                        onRootChange={(v) => updateChord(i, 'root', v)}
                        onQualityChange={(v) => updateChord(i, 'quality', v)}
                        onExtensionChange={(v) => updateChord(i, 'extension', v)}
                        onToggleNote={(note) => toggleChordNote(i, note)}
                    />
                ))}
            </div>

            {fretboardLayout === 'separate' && chordCount > 1 ? (
                <div className="fretboards-separate">
                    {mappedScales.map((scale, idx) => (
                        <div key={idx} className="fretboard-container">
                            <Fretboard
                                scales={[scale]}
                                guitarType={guitarType}
                                displayMode={displayMode}
                                fretCount={fretCount}
                                cagedPosition={cagedPosition}
                                colorOffset={idx}
                                disabledFrets={disabledFrets}
                                onToggleFret={toggleFret}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="fretboard-container">
                    <Fretboard
                        scales={mappedScales}
                        guitarType={guitarType}
                        displayMode={displayMode}
                        fretCount={fretCount}
                        cagedPosition={cagedPosition}
                        disabledFrets={disabledFrets}
                        onToggleFret={toggleFret}
                    />
                </div>
            )}
        </div>
    );
}

export default ChordMode;
