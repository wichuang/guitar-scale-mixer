/**
 * ReadFretboard — Read 模式指板
 * 保留 Read 的定位/播放邏輯（CAGED 單一把位、3NPS、ghost、播放箭頭），
 * 但「呈現」交給共用的 FretboardView（外觀以 Compose 為準）。
 * 本檔只負責算出 normalized cells / arrow / activeKey 餵進 FretboardView。
 */
import { useMemo } from 'react';
import { STRING_TUNINGS, getNoteName, getCAGEDFretRange, isInCAGEDPosition, getScaleNotes, SCALE_TYPES, getIntervalForNote } from '../data/scaleData';
import { calculate3NPSPositions, calculateCAGEDPositions, generate3NPSMap } from '../parsers/JianpuParser';
import { getPitchColor } from '../data/pitchColors';
import FretboardView from './FretboardView';

function ReadFretboard({ notes, currentNoteIndex, fretCount, onNoteClick, onPlayMidi, startString = 5, rangeOctave = 0, cagedPosition = null, musicKey = 'C', scaleType = 'Major', showScaleGuide = false, displayMode = 'notes', toolbarExtra }) {
    const visibleFrets = fretCount || 19;
    // ABC = 音名；123 = 音階級數（相對 root 的 interval，root 顯示 R）
    const intervalMode = displayMode === 'intervals';
    const labelFor = (noteName) => {
        if (!intervalMode) return noteName;
        const iv = getIntervalForNote(noteName, musicKey, scaleType);
        return iv === '1' ? 'R' : (iv || noteName);
    };

    // CAGED 範圍（box 外變暗用）
    const cagedRange = useMemo(() => (
        cagedPosition ? getCAGEDFretRange(musicKey, cagedPosition) : null
    ), [musicKey, cagedPosition]);
    const isFretInCAGED = (fret) => !cagedRange || isInCAGEDPosition(fret, cagedRange.startFret, cagedRange.endFret);

    // 樂譜音符位置：選了 CAGED 用 CAGED 定位，否則 3NPS
    const notePositions = useMemo(() => {
        const positions = cagedPosition
            ? calculateCAGEDPositions(notes, musicKey, cagedPosition)
            : calculate3NPSPositions(notes, startString, musicKey, scaleType, rangeOctave);
        return notes.map((note, idx) => ({ ...note, position: positions[idx], index: idx }))
            .filter(n => n.position);
    }, [notes, startString, musicKey, scaleType, rangeOctave, cagedPosition]);

    // 背景音階（3NPS 模式）
    const scaleMap = useMemo(() => {
        if (!showScaleGuide || cagedPosition) return [];
        return generate3NPSMap(startString, musicKey, scaleType);
    }, [startString, musicKey, scaleType, showScaleGuide, cagedPosition]);

    // 所選調音階音名集合（判斷調外 ghost 音）
    const scaleNoteSet = useMemo(() => {
        const arr = getScaleNotes(musicKey, SCALE_TYPES[scaleType] || (scaleType || 'major').toLowerCase());
        return new Set(arr);
    }, [musicKey, scaleType]);

    // CAGED box 內背景：'scale'（半實心）或 'ghost'（樂譜用到的調外音，空心）
    const cagedBoxMap = useMemo(() => {
        if (!cagedPosition || !cagedRange) return null;
        const scoreNames = new Set();
        (notes || []).forEach(n => {
            if (!n) return;
            const m = n.midiNote ?? n.midi;
            if (m != null && !(n.isSeparator || n._type === 'separator')) scoreNames.add(getNoteName(m));
        });
        const map = new Map();
        for (let s = 0; s < 6; s++) {
            for (let f = 0; f <= visibleFrets; f++) {
                if (!isInCAGEDPosition(f, cagedRange.startFret, cagedRange.endFret)) continue;
                const name = getNoteName(STRING_TUNINGS[s] + f);
                if (scaleNoteSet.has(name)) map.set(`${s}-${f}`, 'scale');
                else if (scoreNames.has(name)) map.set(`${s}-${f}`, 'ghost');
            }
        }
        return map;
    }, [cagedPosition, cagedRange, scaleNoteSet, notes, visibleFrets]);

    // 目前播放音 + 播放動線（前一音 → 目前音）
    const curPosIdx = notePositions.findIndex(np => np.index === currentNoteIndex);
    const currentPosition = curPosIdx >= 0 ? notePositions[curPosIdx].position : null;
    const prevPosition = curPosIdx > 0 ? notePositions[curPosIdx - 1].position : null;
    const arrowFromKey = prevPosition ? `${prevPosition.string}-${prevPosition.fret}` : null;
    const arrowToKey = currentPosition ? `${currentPosition.string}-${currentPosition.fret}` : null;
    const drawArrow = !!(arrowFromKey && arrowToKey && arrowFromKey !== arrowToKey);
    // 畫箭頭時不再顯示單點高亮；第一個音（無前音）仍以單點高亮
    const activeKey = (!drawArrow && currentPosition) ? `${currentPosition.string}-${currentPosition.fret}` : null;

    // 組 normalized cells 給 FretboardView
    const cells = useMemo(() => {
        const map = new Map();
        STRING_TUNINGS.forEach((openMidi, stringIdx) => {
            for (let fret = 0; fret <= visibleFrets; fret++) {
                const midiNote = openMidi + fret;
                const noteName = getNoteName(midiNote);
                const key = `${stringIdx}-${fret}`;
                const scoreNote = notePositions.find(np => np.position?.string === stringIdx && np.position?.fret === fret);
                const scaleNote = showScaleGuide ? scaleMap.find(sm => sm.string === stringIdx && sm.fret === fret) : null;
                const boxRole = cagedBoxMap ? cagedBoxMap.get(key) : null;
                if (!scoreNote && !scaleNote && !boxRole) continue;

                let label = labelFor(noteName);
                if (!intervalMode && fret === 0 && stringIdx === 0 && label === 'E') label = 'e';
                const dim = !isFretInCAGED(fret);
                const pc = getPitchColor(noteName);

                let cell = null;
                if (scoreNote) {
                    // 旋律音：被迫彈在把位外或為調外音 → ghost（空心）；否則實心
                    const scoreGhost = scoreNote.position?.outOfBox || !scaleNoteSet.has(noteName);
                    cell = scoreGhost
                        ? { label, noteName, role: 'ghost', dim }
                        : { label, noteName, role: 'solid', isRoot: (scoreNote.jianpu == '1' || scoreNote.jianpu === 1), dim };
                    cell.scoreIndex = scoreNote.index;
                } else if (scaleNote || boxRole === 'scale') {
                    // scale 背景音：半實心（區別於旋律音），顏色由 inline 提供
                    cell = { label, noteName, role: 'solid', dim, bg: `${pc.bg}aa`, fg: pc.fg, border: pc.bg };
                } else if (boxRole === 'ghost') {
                    cell = { label, noteName, role: 'ghost', dim };
                }
                if (cell) map.set(key, cell);
            }
        });
        return map;
    }, [notePositions, scaleMap, cagedBoxMap, scaleNoteSet, showScaleGuide, visibleFrets, cagedRange, displayMode, musicKey, scaleType]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <FretboardView
            fretCount={visibleFrets}
            cells={cells}
            arrowFromKey={drawArrow ? arrowFromKey : null}
            arrowToKey={drawArrow ? arrowToKey : null}
            activeKey={activeKey}
            onPlayMidi={onPlayMidi}
            onCellClick={(s, f, midi, cell) => { if (cell && cell.scoreIndex != null && onNoteClick) onNoteClick(cell.scoreIndex); }}
            header={toolbarExtra || null}
        />
    );
}

export default ReadFretboard;
