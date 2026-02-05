/**
 * PlaybackControls - 播放控制元件
 * 包含播放、暫停、停止按鈕和時間顯示
 */

import React from 'react';

/**
 * 格式化時間
 * @param {number} seconds
 * @returns {string}
 */
const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

function PlaybackControls({
    isPlaying,
    playTime,
    countInStatus,
    audioLoading,
    onPlay,
    onPause,
    onStop,
    onTogglePlay
}) {
    return (
        <div className="playback-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isPlaying ? (
                <button className="play-btn" onClick={onPlay}>
                    Play
                </button>
            ) : (
                <button className="pause-btn" onClick={onPause}>
                    Pause
                </button>
            )}
            <button className="stop-btn" onClick={onStop}>
                Stop
            </button>

            {/* Count-In Status Display */}
            {countInStatus && (
                <span style={{
                    fontSize: '20px',
                    color: '#ff5252',
                    fontWeight: 'bold',
                    animation: 'pulse 0.5s infinite alternate'
                }}>
                    {countInStatus}
                </span>
            )}
        </div>
    );
}

/**
 * 播放控制列（用於音符列表下方）
 */
export function PlaybackControlsBar({
    isPlaying,
    playTime,
    audioLoading,
    onTogglePlay
}) {
    return (
        <div className="controls-bar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px', gap: '12px' }}>
            {/* Timer Display */}
            <div style={{
                background: '#111',
                padding: '8px 16px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 'bold',
                color: isPlaying ? '#4caf50' : '#666',
                border: '1px solid #333',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                minWidth: '100px',
                textAlign: 'center'
            }}>
                {formatTime(playTime)}
            </div>

            <button
                className={`control-btn play ${isPlaying ? 'active' : ''}`}
                onClick={onTogglePlay}
                disabled={audioLoading}
                title={isPlaying ? "停止播放" : "播放樂譜"}
                style={{
                    padding: '8px 24px',
                    fontSize: '16px',
                    background: isPlaying ? '#f44336' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                {audioLoading ? 'Loading...' : (isPlaying ? 'Stop' : 'Play')}
            </button>
        </div>
    );
}

export default PlaybackControls;
