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

            if (note.isRest || note.displayStr === '0') {
                keys = ["b/4"];
                duration = "qr";
            } else if (note.noteName) {
                const keyStr = `${note.noteName.toLowerCase()}/${note.octave || 4}`;
                keys = [keyStr];
            }

            // Stave Note
            const sNote = new StaveNote({
                keys: keys,
                duration: duration,
                clef: "treble"
            });

            if (!note.isRest && note.noteName?.includes('#')) sNote.addModifier(new Accidental("#"));
            else if (!note.isRest && note.noteName?.includes('b')) sNote.addModifier(new Accidental("b"));

            // Tab Note
            const pos = notePositions[index];
            let tNote;
            if (note.isRest || note.displayStr === '0') {
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
            noteMapping.push(staveNotes.length - 1); // Map original note index to this generated note
        });

        if (staveNotes.length === 0) return;

        // Create Staves
        const staveX = 10;
        const staveY = 20;
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
                return staveNotes[vfIndex].getAbsoluteX();
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
                minHeight: '340px',
                border: '1px solid #333'
            }}
        >
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
                        top: 20,
                        left: noteXCoordinates[currentNoteIndex],
                        width: '2px',
                        height: '280px',
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
