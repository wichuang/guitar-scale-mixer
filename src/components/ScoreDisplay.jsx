import React, { useEffect, useRef, useState } from 'react';
import { Factory, StaveNote, TabNote, Stave, TabStave, StaveConnector, Voice, Formatter, Accidental } from 'vexflow';

const ScoreDisplay = ({ notes, notePositions, timeSignature = '4/4', currentNoteIndex = -1 }) => {
    const containerRef = useRef(null);
    const [noteXCoordinates, setNoteXCoordinates] = useState([]);
    const scrollContainerRef = useRef(null);

    // Render Score (Only when notes/data changes)
    useEffect(() => {
        if (!containerRef.current || !notes.length) return;

        // Clear previous render
        containerRef.current.innerHTML = '';

        // Calculate dynamic width based on note count.
        const width = Math.max(800, notes.length * 60 + 100);
        const height = 300; // Staff + Tab

        const vf = new Factory({
            renderer: { elementId: containerRef.current, width, height }
        });

        const staveNotes = [];
        const tabNotes = [];
        const noteMapping = []; // Maps note index to VexFlow note index (handling skips)

        notes.forEach((note, index) => {
            if (note.isSeparator || note.isSymbol) {
                noteMapping.push(null); // No visual note for this index
                return;
            }

            // Pitch: noteName + octave (e.g., "C/4")
            let keys = ["b/4"];
            let duration = "q";

            // 1. Prepare Key & Duration
            try {
                // Pitch: noteName + octave (e.g., "C/4")
                let keys = ["b/4"];
                let duration = "q";
                let isRest = note.isRest || note.displayStr === '0';

                if (isRest) {
                    keys = ["b/4"];
                    duration = "qr";
                } else if (notePositions[index] && typeof notePositions[index].midi === 'number' && !isNaN(notePositions[index].midi)) {
                    // Use Shifted MIDI from Position
                    const pos = notePositions[index];
                    const noteIndex = ((pos.midi % 12) + 12) % 12; // Handle negative midi safely
                    const octave = Math.max(0, Math.floor(pos.midi / 12) - 1);
                    const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
                    const name = names[noteIndex] || 'b';
                    keys = [`${name}/${octave}`];
                } else if (note.noteName) {
                    // Fallback to parsed note
                    // Fix: Clamp octave here too!
                    const octave = Math.max(0, note.octave || 4);
                    const keyStr = `${note.noteName.toLowerCase()}/${octave}`;
                    keys = [keyStr];
                }

                // Stave Note
                const sNote = new StaveNote({
                    keys: keys,
                    duration: duration,
                    clef: "treble"
                });

                if (!isRest && note.noteName?.includes('#')) sNote.addModifier(new Accidental("#"));
                else if (!isRest && note.noteName?.includes('b')) sNote.addModifier(new Accidental("b"));

                // Tab Note
                const pos = notePositions[index];
                let tNote;
                if (isRest) {
                    tNote = new TabNote({
                        positions: [{ str: 0, fret: 0 }],
                        duration: duration,
                        type: "r"
                    });
                } else {
                    if (pos && typeof pos.string === 'number') {
                        // Fix: Map 0-indexed string (0=High E) to VexFlow 1-indexed (1=High E)
                        tNote = new TabNote({
                            positions: [{ str: pos.string + 1, fret: pos.fret || 0 }],
                            duration: duration
                        });
                    } else {
                        // Fallback
                        tNote = new TabNote({
                            positions: [{ str: 2, fret: 0 }],
                            duration: duration
                        });
                    }
                }

                staveNotes.push(sNote);
                tabNotes.push(tNote);
                noteMapping.push(staveNotes.length - 1);
            } catch (err) {
                console.warn("VexFlow Note Creation Error:", err, note);
                // Push a dummy rest to keep alignment or just skip? 
                // Better push a Rest to maintain index alignment if possible, but simplest is skip logic.
                // But noteMapping needs to stay synced? 
                // Actually noteMapping aligns `notes[index]` to `staveNotes[index]`.
                // If we skip, we should push null to noteMapping.
                noteMapping.push(null);
            }
        });

        if (staveNotes.length === 0) return;

        // Create Staves - Shift down to make room for Jianpu
        const staveX = 10;
        const staveY = 70; // Was 20. Shifted down 50px for Jianpu.
        const staveWidth = Math.max(500, staveNotes.length * 50);

        const stave = new Stave(staveX, staveY, staveWidth);
        stave.addClef("treble").addTimeSignature(timeSignature);

        const tabStave = new TabStave(staveX, staveY + 100, staveWidth);
        tabStave.addClef("tab").setNoteStartX(stave.getNoteStartX());

        const connector = new StaveConnector(stave, tabStave);
        connector.setType(StaveConnector.type.SINGLE);

        const context = vf.getContext();
        stave.setContext(context).draw();
        tabStave.setContext(context).draw();
        connector.setContext(context).draw();

        const voice = new Voice({ num_beats: staveNotes.length, beat_value: 4 });
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(staveNotes);

        const tabVoice = new Voice({ num_beats: tabNotes.length, beat_value: 4 });
        tabVoice.setMode(Voice.Mode.SOFT);
        tabVoice.addTickables(tabNotes);

        const formatter = new Formatter();
        formatter.joinVoices([voice, tabVoice]).format([voice, tabVoice], staveWidth - 50);

        voice.draw(context, stave);
        tabVoice.draw(context, tabStave);

        // Capture Note Coordinates for Cursor
        const coords = notes.map((note, idx) => {
            const vfIndex = noteMapping[idx];
            if (vfIndex !== null && staveNotes[vfIndex]) {
                const noteX = staveNotes[vfIndex].getAbsoluteX();
                // Check if valid number
                return isNaN(noteX) ? null : noteX;
            }
            return null;
        });
        setNoteXCoordinates(coords);

    }, [notes, notePositions, timeSignature]);

    // Scroll cursor into view
    useEffect(() => {
        if (currentNoteIndex >= 0 && noteXCoordinates[currentNoteIndex] && scrollContainerRef.current) {
            const x = noteXCoordinates[currentNoteIndex];
            const container = scrollContainerRef.current;
            const scrollLeft = x - container.clientWidth / 2;
            container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    }, [currentNoteIndex, noteXCoordinates]);

    // Helper to render Jianpu Dots
    const renderDots = (count, position) => {
        if (count === 0) return null;
        const dots = [];
        for (let i = 0; i < Math.abs(count); i++) {
            dots.push(<div key={i} style={{ width: '4px', height: '4px', background: 'white', borderRadius: '50%', margin: '0 2px' }}></div>);
        }
        return (
            <div style={{ display: 'flex', justifyContent: 'center', position: 'absolute', [position]: '-8px', width: '100%' }}>
                {dots}
            </div>
        );
    };

    // Helper to render Underlines
    const renderUnderlines = (duration) => {
        let lines = 0;
        if (duration.includes('8')) lines = 1;
        if (duration.includes('16')) lines = 2;
        if (duration.includes('32')) lines = 3;

        if (lines === 0) return null;

        return (
            <div style={{ position: 'absolute', bottom: '-4px', left: '0', right: '0', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {Array.from({ length: lines }).map((_, i) => (
                    <div key={i} style={{ height: '2px', background: 'white', width: '100%' }}></div>
                ))}
            </div>
        );
    };

    return (
        <div
            ref={scrollContainerRef}
            className="score-display-wrapper"
            style={{
                overflowX: 'auto',
                backgroundColor: '#1a1a1a', // Dark Background
                padding: '20px',
                borderRadius: '8px',
                marginTop: '20px',
                position: 'relative',
                minHeight: '380px', // Increased height
                border: '1px solid #333'
            }}
        >
            {/* Chord Symbol Layer */}
            <div className="chord-layer" style={{ height: '20px', position: 'relative', width: '100%' }}>
                {notes.map((note, index) => {
                    if (!note.chordSymbol) return null;
                    const x = noteXCoordinates[index];
                    if (x === null || x === undefined) return null;

                    return (
                        <div key={`chord-${index}`} style={{
                            position: 'absolute',
                            left: x - 15,
                            top: '2px',
                            color: '#4fc3f7',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                        }}>
                            {note.chordSymbol}
                        </div>
                    );
                })}
            </div>

            {/* Jianpu Layer */}
            <div className="jianpu-layer" style={{ height: '60px', position: 'relative', width: '100%' }}>
                {notes.map((note, index) => {
                    const x = noteXCoordinates[index];
                    if (x === null || x === undefined) return null;

                    let char = note.displayStr || note.jianpu || '?';
                    if (note.isRest) char = '0';
                    if (note.isSeparator) char = '|';

                    const octDiff = (note.octave || 4) - 4;

                    return (
                        <div key={index} style={{
                            position: 'absolute',
                            left: x - 10,
                            top: '20px',
                            width: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '18px',
                            lineHeight: '1'
                        }}>
                            {octDiff > 0 && renderDots(octDiff, 'top')}
                            <span>{char}</span>
                            {octDiff < 0 && renderDots(octDiff, 'bottom')}

                            {renderUnderlines(note.duration || 'q')}
                        </div>
                    );
                })}
            </div>

            {/* VexFlow Canvas - Inverted to show White on Dark */}
            <div
                ref={containerRef}
                className="vexflow-canvas"
                style={{ filter: 'invert(100%)' }}
            ></div>

            {/* Playhead Cursor */}
            {currentNoteIndex >= 0 && noteXCoordinates[currentNoteIndex] && (
                <div
                    style={{
                        position: 'absolute',
                        top: 20, // Adjusted top
                        left: noteXCoordinates[currentNoteIndex],
                        width: '2px',
                        height: '340px', // Adjusted height
                        backgroundColor: '#ff5252', // Bright Red
                        boxShadow: '0 0 8px rgba(255, 82, 82, 0.8)',
                        zIndex: 10,
                        transition: 'left 0.1s linear',
                        pointerEvents: 'none',
                        transform: 'translateX(calc(-50% + 15px))' // Center + Offset (tuned)
                    }}
                />
            )}
        </div>
    );
};

export default ScoreDisplay;
