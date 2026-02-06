/**
 * OCRResultEditor - OCR 結果校正元件
 * 允許使用者在匯入前修正辨識結果
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Note } from '../core/models/Note.js';

// 音符名稱對照表
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function OCRResultEditor({ notes, onSave, onCancel }) {
    const [editedNotes, setEditedNotes] = useState(() =>
        notes.map((n, i) => ({ ...n, id: n.id || `note-${i}` }))
    );
    const [selectedIndex, setSelectedIndex] = useState(null);
    const [showPitchEditor, setShowPitchEditor] = useState(false);

    /**
     * 計算統計資訊
     */
    const stats = useMemo(() => {
        const noteCount = editedNotes.filter(n => n.isNote).length;
        const separatorCount = editedNotes.filter(n => n.isSeparator).length;
        return { noteCount, separatorCount };
    }, [editedNotes]);

    /**
     * 刪除音符
     */
    const handleDelete = useCallback((index) => {
        setEditedNotes(prev => prev.filter((_, i) => i !== index));
        setSelectedIndex(null);
    }, []);

    /**
     * 調整音高
     */
    const handlePitchChange = useCallback((index, delta) => {
        setEditedNotes(prev => prev.map((note, i) => {
            if (i !== index || !note.isNote) return note;

            const newMidi = (note.midi || note.midiNote) + delta;
            if (newMidi < 21 || newMidi > 108) return note;

            return Note.fromMidi(newMidi, { ...note, index: i });
        }));
    }, []);

    /**
     * 設定特定音高
     */
    const handleSetPitch = useCallback((index, midi) => {
        setEditedNotes(prev => prev.map((note, i) => {
            if (i !== index || !note.isNote) return note;
            return Note.fromMidi(midi, { ...note, index: i });
        }));
        setShowPitchEditor(false);
    }, []);

    /**
     * 插入音符
     */
    const handleInsert = useCallback((afterIndex) => {
        const refNote = editedNotes[afterIndex];
        const newMidi = refNote?.midi || refNote?.midiNote || 60;
        const newNote = Note.fromMidi(newMidi, { index: afterIndex + 1 });

        setEditedNotes(prev => {
            const updated = [...prev];
            updated.splice(afterIndex + 1, 0, newNote);
            return updated.map((n, i) => ({ ...n, index: i }));
        });
    }, [editedNotes]);

    /**
     * 插入小節線
     */
    const handleInsertSeparator = useCallback((afterIndex) => {
        const separator = Note.createSeparator({ index: afterIndex + 1 });

        setEditedNotes(prev => {
            const updated = [...prev];
            updated.splice(afterIndex + 1, 0, separator);
            return updated.map((n, i) => ({ ...n, index: i }));
        });
    }, []);

    /**
     * 儲存變更
     */
    const handleSave = useCallback(() => {
        const reindexed = editedNotes.map((note, i) => ({
            ...note,
            index: i
        }));
        onSave?.(reindexed);
    }, [editedNotes, onSave]);

    /**
     * 渲染音符項目
     */
    const renderNoteItem = (note, index) => {
        const isSelected = selectedIndex === index;
        const midi = note.midi || note.midiNote;

        if (note.isSeparator) {
            return (
                <div
                    key={`sep-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '8px 4px',
                        background: isSelected ? '#333' : 'transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        minWidth: '30px'
                    }}
                >
                    <div style={{
                        width: '2px',
                        height: '40px',
                        background: '#666'
                    }} />
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>|</div>
                    {isSelected && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(index); }}
                            style={{
                                marginTop: '4px',
                                padding: '2px 6px',
                                background: '#ff5252',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '3px',
                                fontSize: '10px',
                                cursor: 'pointer'
                            }}
                        >
                            刪除
                        </button>
                    )}
                </div>
            );
        }

        if (!note.isNote) return null;

        const noteName = note.displayStr || note.noteName || NOTE_NAMES[midi % 12];
        const octave = note.octave || Math.floor(midi / 12) - 1;

        return (
            <div
                key={`note-${index}`}
                onClick={() => setSelectedIndex(isSelected ? null : index)}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '8px',
                    background: isSelected ? '#2a4a3a' : '#222',
                    border: isSelected ? '2px solid #4caf50' : '1px solid #333',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    minWidth: '50px',
                    transition: 'all 0.15s ease'
                }}
            >
                <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#fff'
                }}>
                    {noteName}
                </div>
                <div style={{
                    fontSize: '12px',
                    color: '#888',
                    marginTop: '2px'
                }}>
                    {octave}
                </div>
                <div style={{
                    fontSize: '10px',
                    color: '#666',
                    marginTop: '2px'
                }}>
                    MIDI: {midi}
                </div>

                {isSelected && (
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        marginTop: '8px',
                        flexWrap: 'wrap',
                        justifyContent: 'center'
                    }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePitchChange(index, 12); }}
                            style={buttonStyle}
                            title="升一個八度"
                        >
                            +8ve
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePitchChange(index, 1); }}
                            style={buttonStyle}
                            title="升半音"
                        >
                            +1
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePitchChange(index, -1); }}
                            style={buttonStyle}
                            title="降半音"
                        >
                            -1
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handlePitchChange(index, -12); }}
                            style={buttonStyle}
                            title="降一個八度"
                        >
                            -8ve
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(index); }}
                            style={{ ...buttonStyle, background: '#ff5252' }}
                            title="刪除"
                        >
                            X
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const buttonStyle = {
        padding: '4px 8px',
        background: '#444',
        color: '#fff',
        border: 'none',
        borderRadius: '3px',
        fontSize: '11px',
        cursor: 'pointer'
    };

    return (
        <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '800px',
            width: '100%',
            color: '#fff'
        }}>
            {/* 標題 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <h3 style={{ margin: 0 }}>
                    ✏️ 校正 OCR 結果
                </h3>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    {stats.noteCount} 音符 | {stats.separatorCount} 小節
                </div>
            </div>

            {/* 說明 */}
            <div style={{
                padding: '10px',
                background: '#222',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#aaa'
            }}>
                點擊音符可進行編輯：調整音高、刪除、或在後方插入新音符
            </div>

            {/* 音符列表 */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '16px',
                background: '#111',
                borderRadius: '8px',
                marginBottom: '16px',
                maxHeight: '300px',
                overflowY: 'auto'
            }}>
                {editedNotes.map((note, index) => renderNoteItem(note, index))}

                {editedNotes.length === 0 && (
                    <div style={{ color: '#666', padding: '20px', textAlign: 'center', width: '100%' }}>
                        沒有可編輯的音符
                    </div>
                )}
            </div>

            {/* 插入工具列 */}
            {selectedIndex !== null && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#222',
                    borderRadius: '6px'
                }}>
                    <span style={{ color: '#888', fontSize: '13px', marginRight: '8px' }}>
                        在選取項目後插入：
                    </span>
                    <button
                        onClick={() => handleInsert(selectedIndex)}
                        style={{
                            padding: '6px 12px',
                            background: '#4caf50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        + 音符
                    </button>
                    <button
                        onClick={() => handleInsertSeparator(selectedIndex)}
                        style={{
                            padding: '6px 12px',
                            background: '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        + 小節線
                    </button>
                </div>
            )}

            {/* 操作按鈕 */}
            <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
            }}>
                <button
                    onClick={onCancel}
                    style={{
                        padding: '12px 24px',
                        background: '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        cursor: 'pointer'
                    }}
                >
                    取消
                </button>
                <button
                    onClick={handleSave}
                    disabled={stats.noteCount === 0}
                    style={{
                        padding: '12px 24px',
                        background: stats.noteCount > 0 ? '#4caf50' : '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        cursor: stats.noteCount > 0 ? 'pointer' : 'not-allowed',
                        opacity: stats.noteCount > 0 ? 1 : 0.5
                    }}
                >
                    確認匯入 ({stats.noteCount} 音符)
                </button>
            </div>
        </div>
    );
}

export default OCRResultEditor;
