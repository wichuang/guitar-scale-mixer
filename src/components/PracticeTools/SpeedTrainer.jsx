/**
 * SpeedTrainer - 速度訓練器元件
 * 漸進式加速練習 UI
 */

import React from 'react';
import { useSpeedTrainer } from '../../hooks/useSpeedTrainer.js';

function SpeedTrainer({
    onBpmChange,
    onComplete,
    initialStartBpm = 60,
    initialTargetBpm = 120
}) {
    const {
        startBpm,
        targetBpm,
        incrementBpm,
        repetitions,
        isTraining,
        isPaused,
        currentBpm,
        currentRepetition,
        totalSteps,
        currentStep,
        progress,
        setStartBpm,
        setTargetBpm,
        setIncrementBpm,
        setRepetitions,
        start,
        stop,
        togglePause,
        completeRepetition,
        nextSpeed,
        prevSpeed
    } = useSpeedTrainer({
        startBpm: initialStartBpm,
        targetBpm: initialTargetBpm,
        onBpmChange,
        onComplete
    });

    return (
        <div className="speed-trainer" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#aaa' }}>Speed Trainer</h4>

            {/* 進度條 */}
            {isTraining && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        fontSize: '14px'
                    }}>
                        <span style={{ color: '#888' }}>Step {currentStep} / {totalSteps}</span>
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{currentBpm} BPM</span>
                    </div>
                    <div style={{
                        height: '8px',
                        background: '#333',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #4caf50, #8bc34a)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#888'
                    }}>
                        Repetition {currentRepetition + 1} / {repetitions}
                    </div>
                </div>
            )}

            {/* 設定區（訓練未開始時顯示） */}
            {!isTraining && (
                <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ color: '#888', width: '80px' }}>Start BPM</label>
                        <input
                            type="number"
                            min="40"
                            max="200"
                            value={startBpm}
                            onChange={(e) => setStartBpm(Number(e.target.value))}
                            style={{
                                width: '70px',
                                padding: '6px',
                                background: '#333',
                                color: '#fff',
                                border: '1px solid #555',
                                borderRadius: '4px'
                            }}
                        />
                        <input
                            type="range"
                            min="40"
                            max="200"
                            value={startBpm}
                            onChange={(e) => setStartBpm(Number(e.target.value))}
                            style={{ flex: 1 }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ color: '#888', width: '80px' }}>Target BPM</label>
                        <input
                            type="number"
                            min="40"
                            max="240"
                            value={targetBpm}
                            onChange={(e) => setTargetBpm(Number(e.target.value))}
                            style={{
                                width: '70px',
                                padding: '6px',
                                background: '#333',
                                color: '#fff',
                                border: '1px solid #555',
                                borderRadius: '4px'
                            }}
                        />
                        <input
                            type="range"
                            min="40"
                            max="240"
                            value={targetBpm}
                            onChange={(e) => setTargetBpm(Number(e.target.value))}
                            style={{ flex: 1 }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ color: '#888', width: '80px' }}>Increment</label>
                        <select
                            value={incrementBpm}
                            onChange={(e) => setIncrementBpm(Number(e.target.value))}
                            style={{
                                padding: '6px 12px',
                                background: '#333',
                                color: '#fff',
                                border: '1px solid #555',
                                borderRadius: '4px'
                            }}
                        >
                            <option value={1}>+1 BPM</option>
                            <option value={2}>+2 BPM</option>
                            <option value={5}>+5 BPM</option>
                            <option value={10}>+10 BPM</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label style={{ color: '#888', width: '80px' }}>Repetitions</label>
                        <select
                            value={repetitions}
                            onChange={(e) => setRepetitions(Number(e.target.value))}
                            style={{
                                padding: '6px 12px',
                                background: '#333',
                                color: '#fff',
                                border: '1px solid #555',
                                borderRadius: '4px'
                            }}
                        >
                            <option value={2}>2 times</option>
                            <option value={4}>4 times</option>
                            <option value={6}>6 times</option>
                            <option value={8}>8 times</option>
                        </select>
                    </div>

                    <div style={{
                        padding: '8px 12px',
                        background: '#222',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#888'
                    }}>
                        Total steps: {totalSteps} | Estimated: {totalSteps * repetitions} loops
                    </div>
                </div>
            )}

            {/* 控制按鈕 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!isTraining ? (
                    <button
                        onClick={start}
                        disabled={startBpm >= targetBpm}
                        style={{
                            flex: 1,
                            padding: '10px 20px',
                            background: startBpm >= targetBpm ? '#555' : '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: startBpm >= targetBpm ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Start Training
                    </button>
                ) : (
                    <>
                        <button
                            onClick={prevSpeed}
                            style={{
                                padding: '10px 16px',
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            ◀ Slower
                        </button>
                        <button
                            onClick={togglePause}
                            style={{
                                flex: 1,
                                padding: '10px 20px',
                                background: isPaused ? '#4caf50' : '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            {isPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                            onClick={nextSpeed}
                            style={{
                                padding: '10px 16px',
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Faster ▶
                        </button>
                        <button
                            onClick={stop}
                            style={{
                                padding: '10px 16px',
                                background: '#ff5252',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Stop
                        </button>
                    </>
                )}
            </div>

            {/* 訓練中的快速動作按鈕 */}
            {isTraining && (
                <button
                    onClick={completeRepetition}
                    style={{
                        width: '100%',
                        marginTop: '12px',
                        padding: '12px',
                        background: '#2196F3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    Complete Repetition ✓
                </button>
            )}
        </div>
    );
}

export default SpeedTrainer;
