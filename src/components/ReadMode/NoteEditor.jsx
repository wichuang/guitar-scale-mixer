/**
 * NoteEditor - 音符編輯元件
 * 包含編輯面板和音符列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import { jianpuToNote, notesToJianpuString } from '../../parsers/JianpuParser.js';
import { PlaybackControlsBar } from './PlaybackControls.jsx';

/**
 * 取得時值底線數量
 */
function getUnderlineCount(duration) {
    if (!duration) return 0;
    if (duration.includes('32') || duration.includes('thirty')) return 3;
    if (duration.includes('16') || duration.includes('sixteenth')) return 2;
    if (duration.includes('eighth') || duration === '8th' || duration === '8') return 1;
    return 0;
}

/**
 * 技巧縮寫
 */
const TECHNIQUE_LABELS = {
    'slide': 'sl.',
    'hammer-on': 'H',
    'pull-off': 'P',
    'bend': 'B',
    'vibrato': '~',
    'mute': 'x',
    'harmonic': 'har.'
};

/**
 * 單個音符渲染元件 — 模仿標準簡譜排版
 *
 * 結構（由上到下）:
 *   技巧標記 (sl. / P / H ...)
 *   升降號 # / b（顯示在數字上方）
 *   高八度點
 *   音符數字（含附點）
 *   低八度點
 *   時值底線 (八分1條 / 十六分2條 / 三十二分3條)
 *   Tab fret
 */
function JianpuNoteCell({ note, idx, isActive, isSelected, onNoteSelect }) {
    const isRest = note.isRest || note._type === 'rest';
    const isExtension = note.isExtension || note._type === 'extension';
    const isSymbol = note.isSymbol || note._type === 'symbol';
    const isSpecial = isRest || isExtension || isSymbol;

    // 簡譜數字（不含升降號）
    let num = '';
    if (isRest) num = '0';
    else if (isExtension) num = '–';
    else if (isSymbol) num = note.displayStr || note.jianpu || '?';
    else num = String(note.jianpu || '?').replace(/[^0-9]/g, '') || String(note.jianpu || '?');

    // 升降號（獨立顯示在數字上方）
    const acc = note.accidentalStr || '';

    const octDiff = isSpecial ? 0 : ((note.octave || 4) + (note.displayOctaveShift || 0) - 4);
    const underlines = getUnderlineCount(note.duration);
    const isHalf = note.duration === 'half';
    const isWhole = note.duration === 'whole';
    const dotted = note.dotted || 0;
    const technique = note.technique ? (TECHNIQUE_LABELS[note.technique] || note.technique) : '';
    const hasFret = typeof note.fret === 'number' && typeof note.stringIndex === 'number';

    // Tab 位置：優先使用 chordFrets（和弦全部位置），否則用單音的 string/fret
    const tabPositions = note.chordFrets && note.chordFrets.length > 0
        ? note.chordFrets
        : (hasFret ? [{ string: note.stringIndex, fret: note.fret }] : []);

    const color = isActive ? '#4caf50' : '#eee';
    const dimColor = isActive ? '#4caf50' : '#777';

    return (
        <div
            data-active={isActive}
            onClick={(e) => onNoteSelect(idx, e)}
            title={note.noteName ? `${note.noteName}${note.octave}${technique ? ' ' + technique : ''}` : num}
            style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '26px',
                padding: '0 1px',
                cursor: 'pointer',
                borderRadius: '3px',
                background: isSelected ? 'rgba(33,150,243,0.2)' : 'transparent',
                outline: isSelected ? '2px solid #2196F3' : 'none',
            }}
        >
            {/* 技巧標記 */}
            <div style={{ height: '13px', fontSize: '9px', color: dimColor, lineHeight: '13px', whiteSpace: 'nowrap' }}>
                {technique || '\u00A0'}
            </div>

            {/* 升降號 (顯示在數字上方，如標準簡譜) */}
            <div style={{ height: '14px', fontSize: '13px', fontWeight: 'bold', color, lineHeight: '14px' }}>
                {!isSpecial && acc ? acc : '\u00A0'}
            </div>

            {/* 高八度點 */}
            <div style={{ height: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                {octDiff > 0 && Array.from({ length: octDiff }).map((_, i) => (
                    <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: color }} />
                ))}
            </div>

            {/* 音符數字 + 附點 */}
            <div style={{
                fontSize: '22px',
                fontWeight: 'bold',
                lineHeight: '1',
                color,
                textShadow: isActive ? '0 0 8px rgba(76,175,80,0.5)' : 'none',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'baseline'
            }}>
                <span style={{ textDecoration: (isHalf || isWhole) && !isSpecial ? 'underline' : 'none', textUnderlineOffset: '4px' }}>
                    {num}
                </span>
                {dotted > 0 && (
                    <span style={{ fontSize: '16px', marginLeft: '1px', lineHeight: '1' }}>
                        {'·'.repeat(dotted)}
                    </span>
                )}
            </div>

            {/* 低八度點 */}
            <div style={{ height: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                {octDiff < 0 && Array.from({ length: Math.abs(octDiff) }).map((_, i) => (
                    <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: color }} />
                ))}
            </div>

            {/* 時值底線 (八分/十六分/三十二分) */}
            <div style={{ height: '10px', width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'flex-start' }}>
                {underlines > 0 && Array.from({ length: underlines }).map((_, i) => (
                    <div key={i} style={{ height: '2px', background: color, borderRadius: '1px' }} />
                ))}
            </div>

            {/* Tab 六線譜 (6 strings with fret numbers) */}
            <div style={{
                width: '100%',
                height: '30px',
                position: 'relative',
                marginTop: '3px'
            }}>
                {/* 6 弦線 */}
                {[0, 1, 2, 3, 4, 5].map(s => (
                    <div key={s} style={{
                        position: 'absolute',
                        top: `${s * 5 + 2}px`,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: '#444'
                    }} />
                ))}
                {/* Fret 數字（顯示所有和弦位置） */}
                {!isRest && tabPositions.map((pos, pi) => (
                    <span key={pi} style={{
                        position: 'absolute',
                        top: `${pos.string * 5 - 3}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        color: isActive ? '#4caf50' : '#ccc',
                        background: '#111',
                        padding: '0 1px',
                        lineHeight: '1',
                        zIndex: 1
                    }}>
                        {pos.fret}
                    </span>
                ))}
            </div>
        </div>
    );
}

/**
 * 連音符號元件 — 在一組連音上方顯示括號和數字（不影響佈局）
 */
function TupletBracket({ num }) {
    return (
        <div style={{
            position: 'absolute',
            top: '-14px',
            left: '4px',
            right: '4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 1
        }}>
            <span style={{ fontSize: '10px', color: '#ffb74d', fontWeight: 'bold', lineHeight: '1' }}>{num}</span>
            <div style={{
                width: '100%',
                height: '4px',
                borderLeft: '1px solid #ffb74d',
                borderRight: '1px solid #ffb74d',
                borderTop: '1px solid #ffb74d',
                borderRadius: '2px 2px 0 0'
            }} />
        </div>
    );
}

/**
 * 將小節內的音符按連音分組
 * 回傳 groups: [{ type: 'normal'|'tuplet', items, tupletNum }]
 */
function groupByTuplet(measureNotes) {
    const groups = [];
    let i = 0;
    while (i < measureNotes.length) {
        const { note } = measureNotes[i];
        if (note.tuplet && note.tuplet.num) {
            const tupletNum = note.tuplet.num;
            const tupletDen = note.tuplet.den;
            const items = [];
            while (i < measureNotes.length) {
                const cn = measureNotes[i].note;
                if (cn.tuplet && cn.tuplet.num === tupletNum && cn.tuplet.den === tupletDen) {
                    items.push(measureNotes[i]);
                    i++;
                } else {
                    break;
                }
            }
            groups.push({ type: 'tuplet', items, tupletNum });
        } else {
            groups.push({ type: 'normal', items: [measureNotes[i]] });
            i++;
        }
    }
    return groups;
}

/**
 * JianpuScoreView - 簡譜樂譜排版元件
 * 以小節為單位排列，含連音括號、時值、Tab，可捲動
 */
function JianpuScoreView({ notes, currentNoteIndex, selectedNoteIndex, onNoteSelect }) {
    const measures = React.useMemo(() => {
        const result = [];
        let current = [];
        let measureNum = 1;

        notes.forEach((note, idx) => {
            if (note.isSeparator || note._type === 'separator') {
                if (current.length > 0) {
                    result.push({ notes: current, number: measureNum++ });
                    current = [];
                }
            } else {
                current.push({ note, idx });
            }
        });
        if (current.length > 0) {
            result.push({ notes: current, number: measureNum });
        }
        return result;
    }, [notes]);

    const scrollRef = React.useRef(null);

    React.useEffect(() => {
        if (currentNoteIndex >= 0 && scrollRef.current) {
            const activeEl = scrollRef.current.querySelector('[data-active="true"]');
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [currentNoteIndex]);

    const barLineStyle = { width: '2px', background: '#555', flexShrink: 0, alignSelf: 'stretch' };

    return (
        <div
            ref={scrollRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                background: '#111',
                borderRadius: '8px',
                border: '1px solid #333'
            }}
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0' }}>
                {measures.map((measure) => {
                    const groups = groupByTuplet(measure.notes);

                    return (
                        <div
                            key={measure.number}
                            style={{
                                display: 'flex',
                                alignItems: 'stretch',
                                marginBottom: '6px'
                            }}
                        >
                            {/* 小節號（每小節都顯示，確保換行起始可見） */}
                            <span style={{
                                fontSize: '10px',
                                color: '#555',
                                alignSelf: 'flex-start',
                                marginRight: '2px',
                                marginTop: '2px',
                                userSelect: 'none',
                                minWidth: '16px',
                                textAlign: 'right'
                            }}>
                                {measure.number}
                            </span>

                            <div style={barLineStyle} />

                            {/* 小節內音符（按連音分組） */}
                            <div style={{ display: 'flex', alignItems: 'stretch', padding: '0 4px' }}>
                                {groups.map((group, gi) => {
                                    if (group.type === 'tuplet') {
                                        return (
                                            <div key={gi} style={{ display: 'flex', position: 'relative' }}>
                                                <TupletBracket num={group.tupletNum} />
                                                {group.items.map(({ note, idx }) => (
                                                    <JianpuNoteCell
                                                        key={idx}
                                                        note={note}
                                                        idx={idx}
                                                        isActive={idx === currentNoteIndex}
                                                        isSelected={idx === selectedNoteIndex}
                                                        onNoteSelect={onNoteSelect}
                                                    />
                                                ))}
                                            </div>
                                        );
                                    }
                                    const { note, idx } = group.items[0];
                                    return (
                                        <JianpuNoteCell
                                            key={idx}
                                            note={note}
                                            idx={idx}
                                            isActive={idx === currentNoteIndex}
                                            isSelected={idx === selectedNoteIndex}
                                            onNoteSelect={onNoteSelect}
                                        />
                                    );
                                })}
                            </div>

                            <div style={barLineStyle} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function NoteEditor({
    notes,
    notePositions,
    currentNoteIndex,
    selectedNoteIndex,
    isPlaying,
    playTime,
    audioLoading,
    musicKey,
    scaleType,
    onNotesChange,
    onTextChange,
    onSelectedNoteChange,
    onNoteSelect,
    onTogglePlay,
    playNote
}) {
    const [hoverInfo, setHoverInfo] = useState('');
    const [editPanelOpen, setEditPanelOpen] = useState(false);

    /**
     * 同步更新 editableText
     */
    const syncEditableText = useCallback((newNotes) => {
        onTextChange(notesToJianpuString(newNotes));
    }, [onTextChange]);

    /**
     * 刪除音符
     */
    const handleDeleteNote = () => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;

        const deletedIndex = selectedNoteIndex;
        const newNotes = notes.filter((_, idx) => idx !== deletedIndex);
        onNotesChange(newNotes);
        syncEditableText(newNotes);

        if (newNotes.length === 0) {
            onSelectedNoteChange(-1);
        } else if (deletedIndex >= newNotes.length) {
            onSelectedNoteChange(-1);
        } else {
            onSelectedNoteChange(-1);
            setTimeout(() => onSelectedNoteChange(deletedIndex), 0);
        }
    };

    /**
     * 調整八度 (Relative)
     */
    const handleShiftOctave = (direction) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const oldOctave = currentNote.octave || 4;
        const newOctave = Math.max(2, Math.min(6, oldOctave + direction));

        if (newOctave === oldOctave) return;

        let newDisplay = String(currentNote.jianpu);
        if (newOctave >= 5) newDisplay = newDisplay + '.'.repeat(newOctave - 4);
        if (newOctave === 3) newDisplay = '_' + newDisplay;
        if (newOctave === 2) newDisplay = '__' + newDisplay;

        const oldDisplay = currentNote.displayStr || String(currentNote.jianpu);
        if (oldDisplay.includes('#')) newDisplay += '#';
        else if (oldDisplay.includes('b')) newDisplay += 'b';

        newNotes[selectedNoteIndex] = {
            ...currentNote,
            octave: newOctave,
            midiNote: currentNote.midiNote + (newOctave - oldOctave) * 12,
            displayStr: newDisplay,
            accidentalStr: oldDisplay.includes('#') ? '#' : (oldDisplay.includes('b') ? 'b' : '')
        };
        onNotesChange(newNotes);
        syncEditableText(newNotes);
    };

    /**
     * 全曲升降八度
     */
    const handleShiftAllOctaves = (direction) => {
        const newNotes = notes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension || note.isSymbol) return note;

            const oldOctave = note.octave || 4;
            const newOctave = Math.max(2, Math.min(6, oldOctave + direction));

            if (newOctave === oldOctave) return note;

            let newDisplay = String(note.jianpu);
            if (newOctave >= 5) newDisplay = newDisplay + '.'.repeat(newOctave - 4);
            if (newOctave === 3) newDisplay = '_' + newDisplay;
            if (newOctave === 2) newDisplay = '__' + newDisplay;

            if (note.accidentalStr) newDisplay += note.accidentalStr;
            else if (note.displayStr?.includes('#')) newDisplay += '#';
            else if (note.displayStr?.includes('b')) newDisplay += 'b';

            return {
                ...note,
                octave: newOctave,
                midiNote: note.midiNote + (newOctave - oldOctave) * 12,
                displayStr: newDisplay
            };
        });
        onNotesChange(newNotes);
        syncEditableText(newNotes);
    };

    /**
     * 插入符號
     */
    const handleInsertSymbol = (symbol, position = 'after') => {
        if (selectedNoteIndex < 0) return;

        let newNote = null;
        if (symbol === '0') {
            newNote = {
                jianpu: '0',
                displayStr: '0',
                isRest: true,
                _type: 'rest',
                octave: 4,
                index: 0
            };
        } else if (symbol === '-') {
            newNote = {
                jianpu: '-',
                displayStr: '-',
                isExtension: true,
                _type: 'extension',
                octave: 4,
                index: 0
            };
        } else if (symbol === '|') {
            newNote = {
                jianpu: '|',
                displayStr: '|',
                isSeparator: true,
                _type: 'separator',
                octave: 4,
                index: 0
            };
        } else {
            newNote = {
                jianpu: symbol,
                displayStr: symbol,
                isSymbol: true,
                _type: 'symbol',
                octave: 4,
                index: 0
            };
        }

        if (newNote) {
            const newNotes = [...notes];
            const insertIndex = position === 'after' ? selectedNoteIndex + 1 : selectedNoteIndex;
            newNotes.splice(insertIndex, 0, newNote);
            onNotesChange(newNotes);
            syncEditableText(newNotes);
            onSelectedNoteChange(insertIndex);
        }
    };

    /**
     * 切換升降記號
     */
    const handleToggleAccidental = (type) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const hasSharp = currentNote.noteName?.includes('#');
        const hasFlat = currentNote.noteName?.includes('b');

        if (type === 'sharp') {
            if (hasSharp) {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote - 1,
                    noteName: currentNote.noteName.replace('#', ''),
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', ''),
                    accidentalStr: ''
                };
            } else {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote + (hasFlat ? 2 : 1),
                    noteName: currentNote.noteName.replace('b', '') + '#',
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', '') + '#',
                    accidentalStr: '#'
                };
            }
        } else if (type === 'flat') {
            if (hasFlat) {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote + 1,
                    noteName: currentNote.noteName.replace('b', ''),
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', ''),
                    accidentalStr: ''
                };
            } else {
                newNotes[selectedNoteIndex] = {
                    ...currentNote,
                    midiNote: currentNote.midiNote - (hasSharp ? 2 : 1),
                    noteName: currentNote.noteName.replace('#', '') + 'b',
                    displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', '') + 'b',
                    accidentalStr: 'b'
                };
            }
        }

        onNotesChange(newNotes);
        syncEditableText(newNotes);
    };

    /**
     * 鍵盤輸入處理
     */
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // 1-7: Change Pitch
            if (e.key >= '1' && e.key <= '7') {
                if (selectedNoteIndex >= 0) {
                    const oldNote = notes[selectedNoteIndex];
                    if (oldNote.isSeparator || oldNote.isExtension) return;

                    const noteData = jianpuToNote(e.key, (oldNote.octave || 4) - 4, musicKey, scaleType);
                    if (noteData) {
                        const newNotes = [...notes];
                        let ds = e.key;
                        if (oldNote.octave === 5) ds += '·';
                        if (oldNote.octave === 6) ds += '··';
                        if (oldNote.octave === 3) ds = '₋' + ds;
                        if (oldNote.octave === 2) ds = '₌' + ds;

                        newNotes[selectedNoteIndex] = {
                            ...oldNote,
                            ...noteData,
                            jianpu: e.key,
                            displayStr: ds,
                            isRest: false,
                            isSymbol: false
                        };
                        onNotesChange(newNotes);
                        syncEditableText(newNotes);
                    }
                }
            }

            // 0: Change to Rest
            if (e.key === '0') {
                if (selectedNoteIndex >= 0) {
                    const newNotes = [...notes];
                    newNotes[selectedNoteIndex] = {
                        jianpu: '0',
                        displayStr: '0',
                        isRest: true,
                        octave: 4,
                        index: selectedNoteIndex
                    };
                    onNotesChange(newNotes);
                    syncEditableText(newNotes);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNoteIndex, notes, musicKey, scaleType, onNotesChange, syncEditableText]);

    /**
     * 選擇音符進行編輯
     */
    const handleNoteItemSelect = (index, e) => {
        e.stopPropagation();
        onSelectedNoteChange(selectedNoteIndex === index ? -1 : index);

        // 播放選中的音符
        const note = notes[index];
        if (note && !note.isSeparator) {
            const pos = notePositions[index];
            if (pos && !audioLoading && playNote) {
                playNote(note.midiNote, pos.string);
            }
        }
    };

    /**
     * 修改選中音符的屬性
     */
    const handleUpdateNoteProperty = useCallback((prop, value) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const newNotes = [...notes];
        newNotes[selectedNoteIndex] = { ...newNotes[selectedNoteIndex], [prop]: value };
        onNotesChange(newNotes);
        syncEditableText(newNotes);
    }, [selectedNoteIndex, notes, onNotesChange, syncEditableText]);

    /**
     * 設定選中音符的時值
     */
    const handleSetDuration = useCallback((duration) => {
        handleUpdateNoteProperty('duration', duration);
    }, [handleUpdateNoteProperty]);

    /**
     * 切換附點
     */
    const handleToggleDotted = useCallback(() => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const current = notes[selectedNoteIndex].dotted || 0;
        // 循環: 0 → 1 → 2 → 0
        handleUpdateNoteProperty('dotted', current >= 2 ? 0 : current + 1);
    }, [selectedNoteIndex, notes, handleUpdateNoteProperty]);

    /**
     * 設定連音符
     */
    const handleSetTuplet = useCallback((tuplet) => {
        handleUpdateNoteProperty('tuplet', tuplet);
    }, [handleUpdateNoteProperty]);

    /**
     * 設定段落速度
     */
    const handleSetBeatTempo = useCallback((value) => {
        const tempo = value === '' ? null : Number(value);
        handleUpdateNoteProperty('beatTempo', tempo || null);
    }, [handleUpdateNoteProperty]);

    const selectedNote = selectedNoteIndex >= 0 && selectedNoteIndex < notes.length ? notes[selectedNoteIndex] : null;
    const isNoteEditable = selectedNoteIndex >= 0 && selectedNote && !selectedNote.isSeparator && !selectedNote.isSymbol;

    // 時值 SVG 圖示（跨平台一致顯示）
    const NoteSvg = ({ filled = true, stem = true, flags = 0, size = 20 }) => (
        <svg width={size} height={size} viewBox="0 0 20 24" style={{ display: 'block' }}>
            {/* 符頭 */}
            <ellipse cx="8" cy="18" rx="5" ry="3.5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" transform="rotate(-20,8,18)" />
            {/* 符桿 */}
            {stem && <line x1="12.5" y1="17" x2="12.5" y2="3" stroke="currentColor" strokeWidth="1.5" />}
            {/* 符尾 */}
            {flags >= 1 && <path d="M12.5 3 Q16 6 13 10" stroke="currentColor" strokeWidth="1.3" fill="none" />}
            {flags >= 2 && <path d="M12.5 7 Q16 10 13 14" stroke="currentColor" strokeWidth="1.3" fill="none" />}
            {flags >= 3 && <path d="M12.5 11 Q16 14 13 18" stroke="currentColor" strokeWidth="1.3" fill="none" />}
        </svg>
    );

    const DURATION_OPTIONS = [
        { value: 'whole',    icon: <NoteSvg filled={false} stem={false} />,  title: '全音符 (4 beats)' },
        { value: 'half',     icon: <NoteSvg filled={false} stem={true} />,   title: '二分音符 (2 beats)' },
        { value: 'quarter',  icon: <NoteSvg filled={true} stem={true} />,    title: '四分音符 (1 beat)' },
        { value: 'eighth',   icon: <NoteSvg filled={true} flags={1} />,      title: '八分音符 (1/2 beat)' },
        { value: '16th',     icon: <NoteSvg filled={true} flags={2} />,      title: '十六分音符 (1/4 beat)' },
        { value: '32nd',     icon: <NoteSvg filled={true} flags={3} />,      title: '三十二分音符 (1/8 beat)' },
    ];

    // 連音符選項
    const TUPLET_OPTIONS = [
        { value: null,            label: '無',  title: '無連音' },
        { value: { num: 3, den: 2 }, label: '3',   title: '三連音 (3:2)' },
        { value: { num: 5, den: 4 }, label: '5',   title: '五連音 (5:4)' },
        { value: { num: 6, den: 4 }, label: '6',   title: '六連音 (6:4)' },
        { value: { num: 7, den: 4 }, label: '7',   title: '七連音 (7:4)' },
    ];

    return (
        <div className="note-editor-area">
            {/* 左側：編輯面板（可收合） */}
            <div className="editor-panel" style={editPanelOpen ? {} : { width: 'auto', minWidth: '40px', padding: '8px', gap: '8px' }}>
                <h4
                    onClick={() => setEditPanelOpen(prev => !prev)}
                    style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <span style={{
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: editPanelOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        fontSize: '12px'
                    }}>&#9654;</span>
                    {editPanelOpen ? 'Edit Panel' : 'Edit'}
                </h4>

                {!editPanelOpen && selectedNote && !selectedNote.isSeparator && (
                    <div style={{ writingMode: 'vertical-rl', fontSize: '13px', color: '#4caf50', whiteSpace: 'nowrap' }}>
                        {selectedNote.displayStr || selectedNote.jianpu}({selectedNote.noteName}{selectedNote.octave})
                    </div>
                )}

                {editPanelOpen && <>
                {/* ── 選中音符 ── */}
                <div className="selected-note-info">
                    <span className="selected-label">選中：</span>
                    <span className="selected-value">
                        {selectedNote
                            ? (selectedNote.isSeparator
                                ? '| 小節線'
                                : `${selectedNote.displayStr || selectedNote.jianpu} (${selectedNote.noteName}${selectedNote.octave})`)
                            : '未選擇'}
                    </span>
                </div>

                {/* ── 音高 ── */}
                <div className="editor-group">
                    <span className="editor-label">音高</span>
                    <div className="editor-buttons">
                        <button className={`editor-btn ${selectedNote?.accidentalStr === '#' ? 'active' : ''}`} onClick={() => handleToggleAccidental('sharp')} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('升記號 #')} onMouseLeave={() => setHoverInfo('')}>#</button>
                        <button className={`editor-btn ${selectedNote?.accidentalStr === 'b' ? 'active' : ''}`} onClick={() => handleToggleAccidental('flat')} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('降記號 b')} onMouseLeave={() => setHoverInfo('')}>b</button>
                        <button className="editor-btn" onClick={() => handleShiftOctave(1)} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('升八度')} onMouseLeave={() => setHoverInfo('')}>+8ve</button>
                        <button className="editor-btn" onClick={() => handleShiftOctave(-1)} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('降八度')} onMouseLeave={() => setHoverInfo('')}>-8ve</button>
                    </div>
                    <div className="editor-buttons" style={{ marginTop: '4px' }}>
                        <button className="editor-btn secondary" onClick={() => handleShiftAllOctaves(1)} onMouseEnter={() => setHoverInfo('全曲升八度')} onMouseLeave={() => setHoverInfo('')}>全+8</button>
                        <button className="editor-btn secondary" onClick={() => handleShiftAllOctaves(-1)} onMouseEnter={() => setHoverInfo('全曲降八度')} onMouseLeave={() => setHoverInfo('')}>全-8</button>
                    </div>
                </div>

                {/* ── 時值 ── */}
                <div className="editor-group">
                    <span className="editor-label">時值</span>
                    <div className="editor-buttons" style={{ flexWrap: 'wrap', gap: '4px' }}>
                        {DURATION_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                className={`editor-btn small ${(selectedNote?.duration || 'quarter') === opt.value ? 'active' : ''}`}
                                onClick={() => handleSetDuration(opt.value)}
                                disabled={!isNoteEditable}
                                title={opt.title}
                                onMouseEnter={() => setHoverInfo(opt.title)}
                                onMouseLeave={() => setHoverInfo('')}
                                style={{ minWidth: '32px', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '4px' }}
                            >{opt.icon}</button>
                        ))}
                    </div>
                    {/* 附點 + 連音 (同一區塊) */}
                    <div className="editor-buttons" style={{ marginTop: '6px', gap: '4px' }}>
                        <button
                            className={`editor-btn ${(selectedNote?.dotted || 0) >= 1 ? 'active' : ''}`}
                            onClick={handleToggleDotted}
                            disabled={!isNoteEditable}
                            onMouseEnter={() => setHoverInfo('附點：無→單(×1.5)→複(×1.75)→無')}
                            onMouseLeave={() => setHoverInfo('')}
                            style={{ flex: 1 }}
                        >{(selectedNote?.dotted || 0) === 0 ? '· 無' : (selectedNote?.dotted || 0) === 1 ? '· 單附點' : '·· 複附點'}</button>
                    </div>
                    <div className="editor-buttons" style={{ marginTop: '4px', gap: '4px' }}>
                        {TUPLET_OPTIONS.map((opt, i) => {
                            const ct = selectedNote?.tuplet;
                            const active = opt.value === null ? !ct : (ct?.num === opt.value?.num && ct?.den === opt.value?.den);
                            return (
                                <button key={i} className={`editor-btn small ${active ? 'active' : ''}`} onClick={() => handleSetTuplet(opt.value)} disabled={!isNoteEditable} title={opt.title} onMouseEnter={() => setHoverInfo(opt.title)} onMouseLeave={() => setHoverInfo('')}>{opt.label}</button>
                            );
                        })}
                    </div>
                </div>

                {/* ── 速度 ── */}
                <div className="editor-group">
                    <span className="editor-label">速度</span>
                    <div className="editor-buttons" style={{ alignItems: 'center' }}>
                        <input type="number" min="20" max="300" placeholder="BPM" value={selectedNote?.beatTempo ?? ''} onChange={(e) => handleSetBeatTempo(e.target.value)} disabled={!isNoteEditable} onMouseEnter={() => setHoverInfo('從此音符起變更播放速度 (留空=沿用全域)')} onMouseLeave={() => setHoverInfo('')} style={{ width: '72px', padding: '4px 6px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }} />
                        <span style={{ fontSize: '12px', color: '#aaa', marginLeft: '4px' }}>BPM</span>
                        {selectedNote?.beatTempo && (
                            <button className="editor-btn small" onClick={() => handleSetBeatTempo('')} title="清除" style={{ marginLeft: '4px' }}>✕</button>
                        )}
                    </div>
                </div>

                {/* ── 符號/插入 ── */}
                <div className="editor-group">
                    <span className="editor-label">插入</span>
                    <div className="editor-buttons">
                        <button className="editor-btn" onClick={() => handleInsertSymbol('0', 'before')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('前方插入休止符')} onMouseLeave={() => setHoverInfo('')}>前</button>
                        <button className="editor-btn" onClick={() => handleInsertSymbol('0', 'after')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('後方插入休止符')} onMouseLeave={() => setHoverInfo('')}>後</button>
                    </div>
                    <div className="editor-insert-row" style={{ marginTop: '6px' }}>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('0')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('休止符 0')} onMouseLeave={() => setHoverInfo('')}>0</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('-')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('延音線 –')} onMouseLeave={() => setHoverInfo('')}>–</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('|')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('小節線 |')} onMouseLeave={() => setHoverInfo('')}>|</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('(')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('圓滑線開始')} onMouseLeave={() => setHoverInfo('')}>(</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol(')')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('圓滑線結束')} onMouseLeave={() => setHoverInfo('')}>)</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol(':')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('反覆記號')} onMouseLeave={() => setHoverInfo('')}>:</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('>')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('重音')} onMouseLeave={() => setHoverInfo('')}>&gt;</button>
                    </div>
                </div>

                {/* 說明 + 刪除 */}
                <div className="editor-info-bar" style={{ minHeight: '22px', padding: '4px 8px', background: '#333', borderRadius: '4px', color: '#4caf50', fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                    {hoverInfo || '滑鼠移至按鈕可查看說明'}
                </div>
                <button className="delete-note-btn" onClick={handleDeleteNote} disabled={selectedNoteIndex < 0}>
                    刪除此{selectedNote?.isSeparator ? '區隔線' : '音符'}
                </button>
                </>}
            </div>

            {/* 右側：簡譜樂譜顯示 */}
            <div className="notes-list-area">
                <div className="section-header">
                    <h3>Notes ({notes.filter(n => !n.isSeparator).length}) - 點擊音符進行編輯</h3>
                </div>
                <JianpuScoreView
                    notes={notes}
                    currentNoteIndex={currentNoteIndex}
                    selectedNoteIndex={selectedNoteIndex}
                    onNoteSelect={handleNoteItemSelect}
                />

                {/* Play Controls */}
                <PlaybackControlsBar
                    isPlaying={isPlaying}
                    playTime={playTime}
                    audioLoading={audioLoading}
                    onTogglePlay={onTogglePlay}
                />
            </div>
        </div>
    );
}

export default NoteEditor;
