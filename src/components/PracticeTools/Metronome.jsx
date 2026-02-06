/**
 * Metronome - 節拍器元件
 * 視覺化節拍指示器，BPM 控制，拍號選擇
 */

import React from 'react';
import { useMetronome } from '../../hooks/useMetronome.js';

// 可用的拍號選項
const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8'];

function Metronome({
    initialBpm = 120,
    initialTimeSignature = '4/4',
    onBpmChange,
    onTimeSignatureChange,
    syncWithPlayback = false
}) {
    const {
        bpm,
        timeSignature,
        isRunning,
        currentBeat,
        beatsPerMeasure,
        accentEnabled,
        volume,
        start,
        stop,
        toggle,
        setBpm,
        setTimeSignature,
        setAccentEnabled,
        setVolume,
        tapTempo
    } = useMetronome({
        initialBpm,
        initialTimeSignature
    });

    // 當 BPM 變更時通知父元件
    const handleBpmChange = (newBpm) => {
        setBpm(newBpm);
        onBpmChange?.(newBpm);
    };

    // 當拍號變更時通知父元件
    const handleTimeSignatureChange = (newTs) => {
        setTimeSignature(newTs);
        onTimeSignatureChange?.(newTs);
    };

    // 生成節拍指示器
    const beatIndicators = [];
    for (let i = 0; i < beatsPerMeasure; i++) {
        const isActive = isRunning && currentBeat === i;
        const isAccent = i === 0;
        beatIndicators.push(
            <div
                key={i}
                className={`beat-indicator ${isActive ? 'active' : ''} ${isAccent ? 'accent' : ''}`}
                style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: isActive
                        ? (isAccent ? '#ff5252' : '#4caf50')
                        : '#333',
                    border: isAccent ? '2px solid #ff5252' : '2px solid #555',
                    transition: 'all 0.05s ease'
                }}
            />
        );
    }

    return (
        <div className="metronome" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#aaa' }}>Metronome</h4>
                <button
                    onClick={toggle}
                    style={{
                        padding: '8px 20px',
                        background: isRunning ? '#ff5252' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {isRunning ? 'Stop' : 'Start'}
                </button>
            </div>

            {/* 節拍指示器 */}
            <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                marginBottom: '16px',
                padding: '12px',
                background: '#111',
                borderRadius: '4px'
            }}>
                {beatIndicators}
            </div>

            {/* BPM 控制 */}
            <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <label style={{ color: '#888', width: '40px' }}>BPM</label>
                    <button
                        onClick={() => handleBpmChange(bpm - 5)}
                        style={{ padding: '4px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        -5
                    </button>
                    <button
                        onClick={() => handleBpmChange(bpm - 1)}
                        style={{ padding: '4px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        -1
                    </button>
                    <span style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        minWidth: '60px',
                        textAlign: 'center'
                    }}>
                        {bpm}
                    </span>
                    <button
                        onClick={() => handleBpmChange(bpm + 1)}
                        style={{ padding: '4px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        +1
                    </button>
                    <button
                        onClick={() => handleBpmChange(bpm + 5)}
                        style={{ padding: '4px 10px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        +5
                    </button>
                    <button
                        onClick={tapTempo}
                        style={{
                            padding: '4px 12px',
                            background: '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginLeft: '8px'
                        }}
                    >
                        Tap
                    </button>
                </div>
                <input
                    type="range"
                    min="40"
                    max="240"
                    value={bpm}
                    onChange={(e) => handleBpmChange(Number(e.target.value))}
                    style={{ width: '100%' }}
                />
            </div>

            {/* 拍號選擇 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <label style={{ color: '#888', width: '60px' }}>Time Sig</label>
                <select
                    value={timeSignature}
                    onChange={(e) => handleTimeSignatureChange(e.target.value)}
                    style={{
                        padding: '6px 12px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {TIME_SIGNATURES.map(ts => (
                        <option key={ts} value={ts}>{ts}</option>
                    ))}
                </select>
            </div>

            {/* 設定選項 */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={accentEnabled}
                        onChange={(e) => setAccentEnabled(e.target.checked)}
                    />
                    Accent first beat
                </label>
            </div>

            {/* 音量控制 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ color: '#888', width: '60px' }}>Volume</label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                    style={{ flex: 1 }}
                />
                <span style={{ color: '#888', width: '40px' }}>{Math.round(volume * 100)}%</span>
            </div>
        </div>
    );
}

export default Metronome;
