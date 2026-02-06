/**
 * LoopSection - 段落循環元件
 * 選取並循環播放特定段落
 */

import React from 'react';

function LoopSection({
    loopStart,
    loopEnd,
    isLoopEnabled,
    loopCount,
    maxLoops,
    hasValidLoop,
    loopLength,
    isSelecting,
    selectionMode,
    totalNotes,
    startSelecting,
    stopSelecting,
    clearLoop,
    toggleLoop,
    setMaxLoops,
    setLoopByBars
}) {
    const formatIndex = (idx) => {
        if (idx === null) return '-';
        return idx + 1; // 顯示為 1-based
    };

    return (
        <div className="loop-section" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, color: '#aaa' }}>Loop Section</h4>
                {hasValidLoop && (
                    <button
                        onClick={toggleLoop}
                        style={{
                            padding: '6px 16px',
                            background: isLoopEnabled ? '#4caf50' : '#555',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        {isLoopEnabled ? 'Loop ON' : 'Loop OFF'}
                    </button>
                )}
            </div>

            {/* 選取模式指示 */}
            {isSelecting && (
                <div style={{
                    padding: '12px',
                    marginBottom: '12px',
                    background: '#2196F3',
                    borderRadius: '4px',
                    textAlign: 'center'
                }}>
                    <span style={{ fontWeight: 'bold' }}>
                        Click a note to set loop {selectionMode === 'start' ? 'START' : 'END'} point
                    </span>
                    <button
                        onClick={stopSelecting}
                        style={{
                            marginLeft: '12px',
                            padding: '4px 12px',
                            background: 'rgba(0,0,0,0.3)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* 循環範圍顯示 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px'
            }}>
                <div style={{
                    padding: '12px',
                    background: '#222',
                    borderRadius: '4px',
                    border: loopStart !== null ? '2px solid #4caf50' : '2px solid #333'
                }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Start</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {formatIndex(loopStart)}
                    </div>
                    <button
                        onClick={() => startSelecting('start')}
                        disabled={isSelecting}
                        style={{
                            marginTop: '8px',
                            padding: '4px 12px',
                            background: '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isSelecting ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            opacity: isSelecting ? 0.5 : 1
                        }}
                    >
                        Set Start
                    </button>
                </div>

                <div style={{
                    padding: '12px',
                    background: '#222',
                    borderRadius: '4px',
                    border: loopEnd !== null ? '2px solid #ff5252' : '2px solid #333'
                }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>End</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                        {formatIndex(loopEnd)}
                    </div>
                    <button
                        onClick={() => startSelecting('end')}
                        disabled={isSelecting}
                        style={{
                            marginTop: '8px',
                            padding: '4px 12px',
                            background: '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isSelecting ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            opacity: isSelecting ? 0.5 : 1
                        }}
                    >
                        Set End
                    </button>
                </div>
            </div>

            {/* 快速選擇小節數 */}
            {loopStart !== null && (
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Quick set bars (from start)</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[1, 2, 4, 8].map(bars => (
                            <button
                                key={bars}
                                onClick={() => setLoopByBars(bars)}
                                style={{
                                    padding: '4px 12px',
                                    background: '#333',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                {bars} bar{bars > 1 ? 's' : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 循環資訊 */}
            {hasValidLoop && (
                <div style={{
                    padding: '12px',
                    background: '#222',
                    borderRadius: '4px',
                    marginBottom: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: '#888' }}>Loop length:</span>
                        <span>{loopLength} notes</span>
                    </div>
                    {isLoopEnabled && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                            <span style={{ color: '#888' }}>Loop count:</span>
                            <span style={{ color: '#4caf50' }}>
                                {loopCount} {maxLoops > 0 ? `/ ${maxLoops}` : '(infinite)'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* 最大循環次數設定 */}
            {hasValidLoop && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <label style={{ color: '#888', fontSize: '14px' }}>Max loops</label>
                    <select
                        value={maxLoops}
                        onChange={(e) => setMaxLoops(Number(e.target.value))}
                        style={{
                            padding: '6px 12px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: '4px'
                        }}
                    >
                        <option value={0}>Infinite</option>
                        <option value={2}>2 times</option>
                        <option value={4}>4 times</option>
                        <option value={8}>8 times</option>
                        <option value={16}>16 times</option>
                    </select>
                </div>
            )}

            {/* 清除按鈕 */}
            {(loopStart !== null || loopEnd !== null) && (
                <button
                    onClick={clearLoop}
                    style={{
                        width: '100%',
                        padding: '8px',
                        background: '#ff5252',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Clear Loop
                </button>
            )}

            {/* 使用說明 */}
            {loopStart === null && loopEnd === null && (
                <div style={{
                    padding: '12px',
                    background: '#222',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#888',
                    textAlign: 'center'
                }}>
                    Click "Set Start" and "Set End" to define a loop section,<br />
                    then click on notes in the score to mark the positions.
                </div>
            )}
        </div>
    );
}

export default LoopSection;
