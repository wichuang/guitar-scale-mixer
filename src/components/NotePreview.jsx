/**
 * NotePreview - 音符視覺化預覽元件
 * 顯示簡易鋼琴卷軸風格的音符序列
 */

import React, { useMemo } from 'react';

// 音符名稱
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function NotePreview({ notes, maxNotes = 30, height = 120 }) {
    const displayData = useMemo(() => {
        if (!notes || notes.length === 0) return null;

        // 過濾只要音符
        const noteOnly = notes.filter(n => n.isNote);
        if (noteOnly.length === 0) return null;

        // 計算 MIDI 範圍
        const midiValues = noteOnly.map(n => n.midi || n.midiNote).filter(m => m);
        const minMidi = Math.min(...midiValues);
        const maxMidi = Math.max(...midiValues);
        const range = Math.max(maxMidi - minMidi, 12); // 至少顯示一個八度

        // 限制顯示的音符數量
        const displayNotes = noteOnly.slice(0, maxNotes);

        return {
            notes: displayNotes,
            minMidi: minMidi - 2,
            maxMidi: maxMidi + 2,
            range: range + 4,
            total: noteOnly.length
        };
    }, [notes, maxNotes]);

    if (!displayData) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#111',
                borderRadius: '6px',
                color: '#666',
                fontSize: '13px'
            }}>
                無音符可預覽
            </div>
        );
    }

    const noteWidth = 100 / Math.min(displayData.notes.length, maxNotes);

    return (
        <div style={{
            background: '#111',
            borderRadius: '6px',
            padding: '8px',
            overflow: 'hidden'
        }}>
            {/* 標題列 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '11px',
                color: '#888'
            }}>
                <span>音符預覽</span>
                <span>
                    {displayData.notes.length === displayData.total
                        ? `${displayData.total} 音符`
                        : `顯示 ${displayData.notes.length} / ${displayData.total} 音符`
                    }
                </span>
            </div>

            {/* 鋼琴卷軸區 */}
            <div style={{
                position: 'relative',
                height: height - 40,
                background: '#0a0a0a',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                {/* 背景格線 */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                flex: 1,
                                borderBottom: '1px solid #1a1a1a'
                            }}
                        />
                    ))}
                </div>

                {/* 音符方塊 */}
                {displayData.notes.map((note, index) => {
                    const midi = note.midi || note.midiNote;
                    const normalizedY = (displayData.maxMidi - midi) / displayData.range;
                    const noteName = NOTE_NAMES[midi % 12];
                    const isSharp = noteName.includes('#');

                    return (
                        <div
                            key={index}
                            style={{
                                position: 'absolute',
                                left: `${index * noteWidth}%`,
                                top: `${normalizedY * 100}%`,
                                width: `${noteWidth - 0.5}%`,
                                height: '12px',
                                background: isSharp
                                    ? 'linear-gradient(135deg, #ff9800, #f57c00)'
                                    : 'linear-gradient(135deg, #4caf50, #388e3c)',
                                borderRadius: '2px',
                                transform: 'translateY(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '9px',
                                color: '#fff',
                                fontWeight: 'bold',
                                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }}
                            title={`${noteName}${Math.floor(midi / 12) - 1} (MIDI: ${midi})`}
                        >
                            {noteWidth > 4 && noteName}
                        </div>
                    );
                })}
            </div>

            {/* 音符名稱標籤 */}
            <div style={{
                display: 'flex',
                marginTop: '4px',
                fontSize: '9px',
                color: '#666',
                overflow: 'hidden'
            }}>
                {displayData.notes.slice(0, 15).map((note, index) => {
                    const midi = note.midi || note.midiNote;
                    const noteName = NOTE_NAMES[midi % 12];
                    const octave = Math.floor(midi / 12) - 1;

                    return (
                        <div
                            key={index}
                            style={{
                                flex: '0 0 auto',
                                width: `${noteWidth}%`,
                                textAlign: 'center',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {noteName}{octave}
                        </div>
                    );
                })}
                {displayData.notes.length > 15 && (
                    <div style={{ color: '#444' }}>...</div>
                )}
            </div>
        </div>
    );
}

export default NotePreview;
