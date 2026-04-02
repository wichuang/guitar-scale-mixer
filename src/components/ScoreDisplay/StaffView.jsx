/**
 * StaffView - 五線譜視圖元件
 * 使用 VexFlow 渲染標準五線譜，支援音符時值
 */

import React, { useEffect, useRef } from 'react';
import { Factory, StaveNote, Stave, Voice, Formatter, Accidental, Dot } from 'vexflow';

/**
 * 將 Note.duration 轉換為 VexFlow duration 字串
 * @param {string} duration - 音符時值
 * @param {boolean} isRest - 是否為休止符
 * @returns {string} VexFlow duration code
 */
function toVexDuration(duration, isRest = false) {
    const map = {
        'whole': 'w',
        'half': 'h',
        'quarter': 'q',
        'eighth': '8',
        '8th': '8',
        '16th': '16',
        'sixteenth': '16',
        '32nd': '32',
        'thirty-second': '32',
        '64th': '64',
    };
    const vexCode = map[duration] || 'q';
    return isRest ? vexCode + 'r' : vexCode;
}

function StaffView({
    notes,
    notePositions = [],
    timeSignature = '4/4',
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
        const height = 200;

        const vf = new Factory({
            renderer: { elementId: containerRef.current, width: calculatedWidth, height }
        });

        const staveNotes = [];
        const noteMapping = [];

        notes.forEach((note, index) => {
            if (note.isSeparator || note.isSymbol) {
                noteMapping.push(null);
                return;
            }

            try {
                let keys = ["b/4"];
                const isRest = note.isRest || note.displayStr === '0';
                const duration = toVexDuration(note.duration || 'quarter', isRest);

                if (isRest) {
                    keys = ["b/4"];
                } else if (notePositions[index] && typeof notePositions[index].midi === 'number') {
                    const pos = notePositions[index];
                    const noteIndex = ((pos.midi % 12) + 12) % 12;
                    const octave = Math.max(0, Math.floor(pos.midi / 12) - 1);
                    const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
                    const name = names[noteIndex] || 'b';
                    keys = [`${name}/${octave}`];
                } else if (note.noteName) {
                    const octave = Math.max(0, note.octave || 4);
                    const keyStr = `${note.noteName.toLowerCase()}/${octave}`;
                    keys = [keyStr];
                }

                const sNote = new StaveNote({
                    keys: keys,
                    duration: duration,
                    clef: "treble"
                });

                // 升降記號
                if (!isRest && note.noteName?.includes('#')) sNote.addModifier(new Accidental("#"));
                else if (!isRest && note.noteName?.includes('b')) sNote.addModifier(new Accidental("b"));

                // 附點音符
                if (note.dotted && note.dotted >= 1) {
                    for (let d = 0; d < note.dotted; d++) {
                        Dot.buildAndAttach([sNote]);
                    }
                }

                staveNotes.push(sNote);
                noteMapping.push(staveNotes.length - 1);
            } catch (err) {
                console.warn("VexFlow StaveNote Error:", err, note);
                noteMapping.push(null);
            }
        });

        if (staveNotes.length === 0) return;

        const staveX = 10;
        const staveWidth = Math.max(500, staveNotes.length * 50);

        const stave = new Stave(staveX, staveY, staveWidth);
        stave.addClef("treble").addTimeSignature(timeSignature);

        const context = vf.getContext();
        stave.setContext(context).draw();

        const voice = new Voice({ num_beats: staveNotes.length, beat_value: 4 });
        voice.setMode(Voice.Mode.SOFT);
        voice.addTickables(staveNotes);

        const formatter = new Formatter();
        formatter.joinVoices([voice]).format([voice], staveWidth - 50);

        voice.draw(context, stave);

        // 回傳音符座標（需乘以 scale 因子）
        if (onNoteCoordinates) {
            const scale = 0.8;
            const coords = notes.map((note, idx) => {
                const vfIndex = noteMapping[idx];
                if (vfIndex !== null && staveNotes[vfIndex]) {
                    const noteX = staveNotes[vfIndex].getAbsoluteX();
                    return isNaN(noteX) ? null : noteX * scale;
                }
                return null;
            });
            onNoteCoordinates(coords);
        }

    }, [notes, notePositions, timeSignature, width, staveY, onNoteCoordinates]);

    return (
        <div
            ref={containerRef}
            className="staff-view"
            style={{
                filter: 'invert(100%)',
                transform: 'scale(0.8)',
                transformOrigin: 'top left',
            }}
        />
    );
}

export default StaffView;
