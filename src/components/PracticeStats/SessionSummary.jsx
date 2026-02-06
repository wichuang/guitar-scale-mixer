/**
 * SessionSummary - 當次練習摘要
 * 顯示練習結束時的統計
 */

import React from 'react';

function SessionSummary({ session, onClose, formatTime }) {
    if (!session) return null;

    const speedChange = session.endBpm - session.startBpm;
    const speedChangePercent = session.startBpm > 0
        ? Math.round((speedChange / session.startBpm) * 100)
        : 0;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}
            onClick={onClose}
        >
            <div style={{
                background: '#1a1a1a',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '400px',
                width: '90%',
                color: '#fff',
                textAlign: 'center'
            }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{ margin: '0 0 24px 0', color: '#4caf50' }}>Practice Complete!</h2>

                {/* 練習時長 */}
                <div style={{
                    background: '#222',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                }}>
                    <div style={{ fontSize: '14px', color: '#888', marginBottom: '4px' }}>Duration</div>
                    <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
                        {formatTime ? formatTime(session.duration) : `${Math.floor(session.duration / 60)}m`}
                    </div>
                </div>

                {/* 統計網格 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '24px'
                }}>
                    {/* 速度 */}
                    <div style={{
                        background: '#222',
                        borderRadius: '8px',
                        padding: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Speed</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {session.startBpm} → {session.endBpm}
                        </div>
                        {speedChange !== 0 && (
                            <div style={{
                                fontSize: '12px',
                                color: speedChange > 0 ? '#4caf50' : '#ff5252',
                                marginTop: '4px'
                            }}>
                                {speedChange > 0 ? '+' : ''}{speedChange} BPM ({speedChangePercent > 0 ? '+' : ''}{speedChangePercent}%)
                            </div>
                        )}
                    </div>

                    {/* 最高速度 */}
                    <div style={{
                        background: '#222',
                        borderRadius: '8px',
                        padding: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Max Speed</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                            {session.maxBpm} BPM
                        </div>
                    </div>

                    {/* 音符數 */}
                    <div style={{
                        background: '#222',
                        borderRadius: '8px',
                        padding: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Notes</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {session.notesPlayed || 0}
                        </div>
                    </div>

                    {/* 循環數 */}
                    <div style={{
                        background: '#222',
                        borderRadius: '8px',
                        padding: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Loops</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                            {session.loopsCompleted || 0}
                        </div>
                    </div>
                </div>

                {/* 樂譜資訊 */}
                {session.songName && (
                    <div style={{
                        fontSize: '14px',
                        color: '#888',
                        marginBottom: '24px'
                    }}>
                        Practiced: <span style={{ color: '#fff' }}>{session.songName}</span>
                    </div>
                )}

                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

export default SessionSummary;
