/**
 * NoteEditor - 音符編輯元件
 * 包含編輯面板和音符列表
 */

import React, { useState, useEffect, useCallback } from 'react';
import { jianpuToNote, notesToJianpuString } from '../../parsers/JianpuParser.js';
import { PlaybackControlsBar } from './PlaybackControls.jsx';

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
                octave: 4,
                index: 0
            };
        } else if (symbol === '-') {
            newNote = {
                jianpu: '-',
                displayStr: '-',
                isExtension: true,
                octave: 4,
                index: 0
            };
        } else {
            newNote = {
                jianpu: symbol,
                displayStr: symbol,
                isSymbol: true,
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

    const selectedNote = selectedNoteIndex >= 0 && selectedNoteIndex < notes.length ? notes[selectedNoteIndex] : null;

    return (
        <div className="note-editor-area">
            {/* 左側：編輯面板 */}
            <div className="editor-panel">
                <h4>Edit Panel</h4>

                {/* 選中音符資訊 */}
                <div className="selected-note-info">
                    <span className="selected-label">選中音符：</span>
                    <span className="selected-value">
                        {selectedNote
                            ? (selectedNote.isSeparator
                                ? '區隔線 |'
                                : `${selectedNote.displayStr || selectedNote.jianpu}(${selectedNote.noteName}${selectedNote.octave})`)
                            : '未選擇'
                        }
                    </span>
                </div>

                {/* 八度控制 */}
                <div className="editor-group">
                    <span className="editor-label">八度</span>
                    <div className="editor-buttons">
                        <button
                            className="editor-btn"
                            onClick={() => handleShiftOctave(1)}
                            disabled={selectedNoteIndex < 0 || selectedNote?.isSeparator}
                        >+8度</button>
                        <button
                            className="editor-btn"
                            onClick={() => handleShiftOctave(-1)}
                            disabled={selectedNoteIndex < 0 || selectedNote?.isSeparator}
                        >-8度</button>
                    </div>
                    {/* Global Octave Shift */}
                    <div className="editor-buttons" style={{ marginTop: '4px' }}>
                        <button
                            className="editor-btn secondary"
                            onClick={() => handleShiftAllOctaves(1)}
                            title="全曲升八度"
                        >
                            全+8
                        </button>
                        <button
                            className="editor-btn secondary"
                            onClick={() => handleShiftAllOctaves(-1)}
                            title="全曲降八度"
                        >
                            全-8
                        </button>
                    </div>
                </div>

                {/* 插入符號 */}
                <div className="editor-group">
                    <span className="editor-label">插入空格</span>
                    <div className="editor-buttons">
                        <button
                            className="editor-btn"
                            onClick={() => handleInsertSymbol('0', 'before')}
                            disabled={selectedNoteIndex < 0}
                            onMouseEnter={() => setHoverInfo('在當前音符「前」插入空格 (休止符 0)')}
                            onMouseLeave={() => setHoverInfo('')}
                        >前</button>
                        <button
                            className="editor-btn"
                            onClick={() => handleInsertSymbol('0', 'after')}
                            disabled={selectedNoteIndex < 0}
                            onMouseEnter={() => setHoverInfo('在當前音符「後」插入空格 (休止符 0)')}
                            onMouseLeave={() => setHoverInfo('')}
                        >後</button>
                    </div>

                    {/* 特殊符號插入 */}
                    <div className="editor-insert-row" style={{ marginTop: '8px' }}>
                        <span>符號：</span>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('0')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('插入休止符 (Rest 0)')} onMouseLeave={() => setHoverInfo('')}>0</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('-')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('插入延音線 (Extension -)')} onMouseLeave={() => setHoverInfo('')}>-</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('(')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('圓滑線 / 連音開始')} onMouseLeave={() => setHoverInfo('')}>(</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol(')')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('圓滑線 / 連音結束')} onMouseLeave={() => setHoverInfo('')}>)</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol(':')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('冒號 / 反覆記號')} onMouseLeave={() => setHoverInfo('')}>:</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('_')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('底線 / 八分音符')} onMouseLeave={() => setHoverInfo('')}>_</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('=')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('雙底線 / 十六分音符')} onMouseLeave={() => setHoverInfo('')}>=</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('>')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('重音')} onMouseLeave={() => setHoverInfo('')}>&gt;</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('[')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('三連音開始')} onMouseLeave={() => setHoverInfo('')}>[</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol(']')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('三連音結束')} onMouseLeave={() => setHoverInfo('')}>]</button>
                        <button className="editor-btn small" onClick={() => handleInsertSymbol('|')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('小節線')} onMouseLeave={() => setHoverInfo('')}>|</button>
                    </div>
                </div>

                {/* 功能說明欄 */}
                <div className="editor-info-bar" style={{
                    minHeight: '24px',
                    margin: '8px 0',
                    padding: '4px 8px',
                    background: '#333',
                    borderRadius: '4px',
                    color: '#4caf50',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    {hoverInfo || '滑鼠移至按鈕可查看說明'}
                </div>

                {/* 刪除按鈕 */}
                <button
                    className="delete-note-btn"
                    onClick={handleDeleteNote}
                    disabled={selectedNoteIndex < 0}
                >
                    刪除此{selectedNote?.isSeparator ? '區隔線' : '音符'}
                </button>
            </div>

            {/* 右側：音符列表 */}
            <div className="notes-list-area">
                <div className="section-header">
                    <h3>Notes ({notes.filter(n => !n.isSeparator).length}) - 點擊音符進行編輯</h3>
                </div>
                <div className="notes-display">
                    {notes.map((note, idx) => (
                        <div
                            key={idx}
                            className={`note-chip-wrapper ${idx === selectedNoteIndex ? 'selected' : ''}`}
                            onClick={(e) => handleNoteItemSelect(idx, e)}
                        >
                            <span
                                className={`note-chip ${idx === currentNoteIndex ? 'active' : ''} ${note.isSeparator ? 'separator' : ''} ${note.octave > 4 ? 'high' : ''} ${note.octave < 4 ? 'low' : ''} ${note.noteName?.includes('#') ? 'sharp' : ''} ${note.noteName?.includes('b') ? 'flat' : ''}`}
                                title={note.isSeparator ? '區隔線' : (note.noteName ? `${note.noteName}${note.octave}` : note.displayStr)}
                            >
                                {note.isSeparator ? '|' : (note.displayStr || note.jianpu)}
                                {!note.isSeparator && (
                                    <small>{note.noteName ? `${note.noteName}${note.octave !== 4 ? note.octave : ''}` : ''}</small>
                                )}
                            </span>
                        </div>
                    ))}
                </div>

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
