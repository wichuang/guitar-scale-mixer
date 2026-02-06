/**
 * PracticeHistory - 練習歷史列表
 * 顯示過去的練習紀錄
 */

import React, { useState, useMemo } from 'react';
import { deleteSession } from '../../stores/practiceStore.js';

function PracticeHistory({ sessions, formatTime, onRefresh }) {
    const [filter, setFilter] = useState('all'); // 'all', 'week', 'month'
    const [confirmDelete, setConfirmDelete] = useState(null);

    // 篩選和分組
    const groupedSessions = useMemo(() => {
        let filtered = [...sessions];

        // 依時間篩選
        const now = Date.now();
        if (filter === 'week') {
            const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
            filtered = filtered.filter(s => s.date > weekAgo);
        } else if (filter === 'month') {
            const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
            filtered = filtered.filter(s => s.date > monthAgo);
        }

        // 排序（最新在前）
        filtered.sort((a, b) => b.date - a.date);

        // 依日期分組
        const groups = {};
        for (const session of filtered) {
            const date = new Date(session.date);
            const dateKey = date.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(session);
        }

        return groups;
    }, [sessions, filter]);

    const handleDelete = (id) => {
        deleteSession(id);
        setConfirmDelete(null);
        onRefresh?.();
    };

    const formatSessionTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="practice-history" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <h4 style={{ margin: 0, color: '#aaa' }}>History</h4>

                {/* 篩選按鈕 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'month', label: '30d' },
                        { key: 'week', label: '7d' }
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setFilter(opt.key)}
                            style={{
                                padding: '4px 10px',
                                background: filter === opt.key ? '#4caf50' : '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 歷史列表 */}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {Object.keys(groupedSessions).length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px',
                        color: '#666'
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
                        <div>No practice sessions yet</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            Start practicing to see your history
                        </div>
                    </div>
                ) : (
                    Object.entries(groupedSessions).map(([date, daySessions]) => (
                        <div key={date} style={{ marginBottom: '16px' }}>
                            {/* 日期標題 */}
                            <div style={{
                                fontSize: '12px',
                                color: '#888',
                                marginBottom: '8px',
                                padding: '4px 0',
                                borderBottom: '1px solid #333'
                            }}>
                                {date}
                            </div>

                            {/* 當日練習列表 */}
                            {daySessions.map(session => (
                                <div
                                    key={session.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        background: '#222',
                                        borderRadius: '6px',
                                        marginBottom: '6px'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: '14px', marginBottom: '2px' }}>
                                            {session.songName || 'Practice Session'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>
                                            {formatSessionTime(session.date)} •
                                            {formatTime ? ` ${formatTime(session.duration)}` : ` ${Math.floor(session.duration / 60)}m`} •
                                            {session.startBpm}-{session.endBpm} BPM
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {/* 速度變化標籤 */}
                                        {session.endBpm > session.startBpm && (
                                            <span style={{
                                                padding: '2px 6px',
                                                background: 'rgba(76, 175, 80, 0.2)',
                                                color: '#4caf50',
                                                borderRadius: '4px',
                                                fontSize: '10px'
                                            }}>
                                                +{session.endBpm - session.startBpm}
                                            </span>
                                        )}

                                        {/* 刪除按鈕 */}
                                        {confirmDelete === session.id ? (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={() => handleDelete(session.id)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: '#ff5252',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '10px'
                                                    }}
                                                >
                                                    Confirm
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: '#333',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '10px'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(session.id)}
                                                style={{
                                                    padding: '4px 8px',
                                                    background: 'transparent',
                                                    color: '#666',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }}
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* 統計摘要 */}
            {sessions.length > 0 && (
                <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: '#222',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#888',
                    textAlign: 'center'
                }}>
                    Total: {sessions.length} sessions
                </div>
            )}
        </div>
    );
}

export default PracticeHistory;
