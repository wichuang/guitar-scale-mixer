/**
 * TabView - 六線譜視圖元件
 * 使用 VexFlow 渲染吉他六線譜
 */

import React, { useEffect, useRef } from 'react';
import { Factory, TabNote, TabStave, Voice, Formatter } from 'vexflow';

function TabView({
    notes,
    notePositions = [],
    currentNoteIndex = -1,
    onNoteCoordinates,
    width,
    staveY = 20
}) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current || !notes.length) return;

        // 清除先前渲染
        containerRef.current.innerHTML = '';

        // 計算動態寬度
        const calculatedWidth = width || Math.max(800, notes.length * 60 + 100);
        const height = 150;

        const vf = new Factory({
            renderer: { elementId: containerRef.current, width: calculatedWidth, height }
        });

        const tabNotes = [];
        const noteMapping = [];

        notes.forEach((note, index) => {
            if (note.isSeparator || note.isSymbol) {
                noteMapping.push(null);
                return;
            }

            try {
                let duration = "q";
                let isRest = note.isRest || note.displayStr === '0';
                const pos = notePositions[index];

                let tNote;
                if (isRest) {
                    tNote = new TabNote({
                        positions: [{ str: 1, fret: 0 }],
                        duration: duration,
                        type: "r"
                    });
                } else if (pos && typeof pos.string === 'number') {
                    // Map 0-indexed string to VexFlow 1-indexed
                    tNote = new TabNote({
                        positions: [{ str: pos.string + 1, fret: pos.fret || 0 }],
                        duration: duration
                    });
                } else if (note.stringIndex !== undefined && note.fret !== undefined) {
                    tNote = new TabNote({
                        positions: [{ str: note.stringIndex + 1, fret: note.fret }],
                        duration: duration
                    });
                } else {
                    // Fallback
                    tNote = new TabNote({
                        positions: [{ str: 3, fret: 0 }],
                        duration: duration
                    });
                }

                tabNotes.push(tNote);
                noteMapping.push(tabNotes.length - 1);
            } catch (err) {
                console.warn("VexFlow TabNote Error:", err, note);
                noteMapping.push(null);
            }
        });

        if (tabNotes.length === 0) return;

        const staveX = 10;
        const staveWidth = Math.max(500, tabNotes.length * 50);

        const tabStave = new TabStave(staveX, staveY, staveWidth);
        tabStave.addClef("tab");

        const context = vf.getContext();
        tabStave.setContext(context).draw();

        const voice = new Voice({ num_beats: tabNotes.length, beat_value: 4 });
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(tabNotes);

        const formatter = new Formatter();
        formatter.joinVoices([voice]).format([voice], staveWidth - 50);

        voice.draw(context, tabStave);

        // 回傳音符座標
        if (onNoteCoordinates) {
            const coords = notes.map((note, idx) => {
                const vfIndex = noteMapping[idx];
                if (vfIndex !== null && tabNotes[vfIndex]) {
                    const noteX = tabNotes[vfIndex].getAbsoluteX();
                    return isNaN(noteX) ? null : noteX;
                }
                return null;
            });
            onNoteCoordinates(coords);
        }

    }, [notes, notePositions, width, staveY, onNoteCoordinates]);

    return (
        <div
            ref={containerRef}
            className="tab-view"
            style={{ filter: 'invert(100%)' }}
        />
    );
}

export default TabView;
