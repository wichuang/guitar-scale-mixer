/**
 * TabView - 六線譜視圖元件
 * 使用 VexFlow 渲染吉他六線譜，支援音符時值
 */

import React, { useEffect, useRef } from 'react';
import { Factory, TabNote, TabStave, Voice, Formatter, Dot, TabSlide, TabTie, Annotation } from 'vexflow';

/**
 * 將 Note.duration 轉換為 VexFlow duration 字串
 */
// 三種技巧的顏色（與 Compose 工具列按鈕一致）：滑音橘、延音綠、顫音紫
const TECH_COLORS = { slide: '#E8943A', tie: '#3fae5a', vibrato: '#9b59b6' };

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

function TabView({
    notes,
    notePositions = [],
    currentNoteIndex = -1,
    onNoteCoordinates,
    width,
    staveY = 20,
    selectedIndices = [],
    onNoteClick
}) {
    const containerRef = useRef(null);
    const overlayRef = useRef(null);
    const lastCoordsRef = useRef(''); // 上次回報的座標（避免重複 setState 造成無限重繪）

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
                const isRest = note.isRest || note.displayStr === '0';
                const duration = toVexDuration(note.duration || 'quarter', isRest);
                const pos = notePositions[index];

                let tNote;
                if (isRest) {
                    tNote = new TabNote({
                        positions: [{ str: 1, fret: 0 }],
                        duration: duration,
                        type: "r"
                    });
                } else if (pos && typeof pos.string === 'number') {
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
                    tNote = new TabNote({
                        positions: [{ str: 3, fret: 0 }],
                        duration: duration
                    });
                }

                // 附點音符
                if (note.dotted && note.dotted >= 1) {
                    for (let d = 0; d < note.dotted; d++) {
                        Dot.buildAndAttach([tNote]);
                    }
                }

                // 技巧符號：滑音顯示「/」、顫音顯示「~」於數字上方（需在格式化前加入）
                if (!isRest && (note.technique === 'slide' || note.technique === 'vibrato')) {
                    try {
                        const mark = note.technique === 'slide' ? '/' : '~';
                        const color = TECH_COLORS[note.technique];
                        const annot = new Annotation(mark);
                        annot.setVerticalJustification(Annotation.VerticalJustify.TOP);
                        annot.setStyle({ fillStyle: color, strokeStyle: color });
                        tNote.addModifier(annot, 0);
                    } catch { /* ignore */ }
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

        // 滑音 (technique==='slide') / 延音 (tieStart)：連接此音與其後第一個「實際音符」
        // （需在音符繪製後再畫；跳過休止符、延音線、小節線、符號）
        notes.forEach((note, idx) => {
            const wantsSlide = note.technique === 'slide';
            const wantsTie = note.tieStart;
            if (!wantsSlide && !wantsTie) return;
            const fromVf = noteMapping[idx];
            if (fromVf == null) return;
            // 找後面第一個實際音符作為連接終點
            let toVf = null, toNote = null;
            for (let j = idx + 1; j < notes.length; j++) {
                const nj = notes[j];
                if (nj.isSeparator || nj.isSymbol || nj.isRest || nj.isExtension) continue;
                if (noteMapping[j] != null) { toVf = noteMapping[j]; toNote = nj; }
                break;
            }
            if (toVf == null) return;
            const first = tabNotes[fromVf];
            const last = tabNotes[toVf];
            try {
                if (wantsSlide) {
                    const dir = (toNote.fret ?? 0) >= (note.fret ?? 0)
                        ? TabSlide.SLIDE_UP : TabSlide.SLIDE_DOWN;
                    context.save();
                    context.setStrokeStyle(TECH_COLORS.slide);
                    context.setFillStyle(TECH_COLORS.slide);
                    new TabSlide(
                        { first_note: first, last_note: last, first_indices: [0], last_indices: [0] },
                        dir
                    ).setContext(context).draw();
                    context.restore();
                }
                if (wantsTie) {
                    context.save();
                    context.setStrokeStyle(TECH_COLORS.tie);
                    context.setFillStyle(TECH_COLORS.tie);
                    new TabTie(
                        { first_note: first, last_note: last, first_indices: [0], last_indices: [0] }
                    ).setContext(context).draw();
                    context.restore();
                }
            } catch (err) {
                console.warn('TabView technique render error:', err);
            }
        });

        // 可點選 hotspot（供 Compose 選音連接）— 直接建立覆蓋層 DOM，避免在 effect 內 setState
        if (onNoteClick && overlayRef.current) {
            const overlay = overlayRef.current;
            overlay.innerHTML = '';
            notes.forEach((note, idx) => {
                if (note.isSeparator || note.isSymbol) return;
                const vf = noteMapping[idx];
                if (vf == null) return;
                const x = tabNotes[vf].getAbsoluteX();
                if (isNaN(x)) return;
                const sel = selectedIndices.includes(idx);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.title = '點擊選取此音（選兩個相鄰音可連滑音／延音）';
                btn.style.cssText = `position:absolute;left:${x - 13}px;top:${staveY}px;width:26px;height:90px;padding:0;cursor:pointer;border-radius:4px;pointer-events:auto;background:${sel ? 'rgba(33,150,243,0.25)' : 'transparent'};border:2px solid ${sel ? '#2196f3' : 'transparent'};`;
                btn.addEventListener('click', () => onNoteClick(idx));
                overlay.appendChild(btn);
            });
        }

        // 回傳音符座標（僅在座標真的改變時才回呼，避免父層 setState → 無限重繪）
        if (onNoteCoordinates) {
            const coords = notes.map((note, idx) => {
                const vfIndex = noteMapping[idx];
                if (vfIndex !== null && tabNotes[vfIndex]) {
                    const noteX = tabNotes[vfIndex].getAbsoluteX();
                    return isNaN(noteX) ? null : noteX;
                }
                return null;
            });
            const key = coords.join(',');
            if (key !== lastCoordsRef.current) {
                lastCoordsRef.current = key;
                onNoteCoordinates(coords);
            }
        }

    }, [notes, notePositions, width, staveY, onNoteCoordinates, onNoteClick, selectedIndices]);

    return (
        <div className="tab-view-wrap" style={{ position: 'relative' }}>
            <div
                ref={containerRef}
                className="tab-view"
                style={{ filter: 'invert(100%)' }}
            />
            <div
                ref={overlayRef}
                className="tab-view-overlay"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}
            />
        </div>
    );
}

export default TabView;
