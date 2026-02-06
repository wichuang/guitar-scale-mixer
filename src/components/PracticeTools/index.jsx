/**
 * PracticeTools - 練習工具面板
 * 整合節拍器、速度訓練器、段落循環
 */

import React, { useState } from 'react';
import Metronome from './Metronome.jsx';
import SpeedTrainer from './SpeedTrainer.jsx';
import LoopSection from './LoopSection.jsx';
import { useLoopSection } from '../../hooks/useLoopSection.js';

// Tab 選項
const TABS = [
    { id: 'metronome', label: 'Metronome', icon: '🎵' },
    { id: 'speed', label: 'Speed Trainer', icon: '⚡' },
    { id: 'loop', label: 'Loop Section', icon: '🔁' }
];

function PracticeTools({
    tempo = 120,
    timeSignature = '4/4',
    totalNotes = 0,
    onTempoChange,
    onTimeSignatureChange,
    isExpanded = false,
    onToggleExpand
}) {
    const [activeTab, setActiveTab] = useState('metronome');

    // Loop Section hook
    const loopSection = useLoopSection({ totalNotes });

    // 速度訓練器 BPM 變更回調
    const handleSpeedTrainerBpmChange = (newBpm) => {
        onTempoChange?.(newBpm);
    };

    // 速度訓練完成回調
    const handleSpeedTrainerComplete = () => {
        alert('Speed training complete! Great job! 🎉');
    };

    // 簡潔模式（僅顯示切換按鈕）
    if (!isExpanded) {
        return (
            <button
                onClick={onToggleExpand}
                style={{
                    padding: '8px 16px',
                    background: '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                <span>🎯</span>
                Practice Tools
            </button>
        );
    }

    return (
        <div className="practice-tools" style={{
            background: '#111',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #333'
        }}>
            {/* 標題列 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#1a1a1a',
                borderBottom: '1px solid #333'
            }}>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>
                    🎯 Practice Tools
                </h3>
                <button
                    onClick={onToggleExpand}
                    style={{
                        padding: '4px 12px',
                        background: '#333',
                        color: '#888',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    Hide
                </button>
            </div>

            {/* Tab 切換 */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid #333'
            }}>
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            background: activeTab === tab.id ? '#1a1a1a' : 'transparent',
                            color: activeTab === tab.id ? '#fff' : '#888',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid #4caf50' : '2px solid transparent',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span style={{ marginRight: '6px' }}>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab 內容 */}
            <div style={{ padding: '16px' }}>
                {activeTab === 'metronome' && (
                    <Metronome
                        initialBpm={tempo}
                        initialTimeSignature={timeSignature}
                        onBpmChange={onTempoChange}
                        onTimeSignatureChange={onTimeSignatureChange}
                    />
                )}

                {activeTab === 'speed' && (
                    <SpeedTrainer
                        initialStartBpm={Math.max(40, tempo - 40)}
                        initialTargetBpm={tempo}
                        onBpmChange={handleSpeedTrainerBpmChange}
                        onComplete={handleSpeedTrainerComplete}
                    />
                )}

                {activeTab === 'loop' && (
                    <LoopSection
                        {...loopSection}
                        totalNotes={totalNotes}
                    />
                )}
            </div>

            {/* 快速狀態列 */}
            <div style={{
                display: 'flex',
                gap: '16px',
                padding: '8px 16px',
                background: '#0a0a0a',
                borderTop: '1px solid #333',
                fontSize: '12px',
                color: '#666'
            }}>
                <span>BPM: <strong style={{ color: '#4caf50' }}>{tempo}</strong></span>
                <span>Time: <strong style={{ color: '#888' }}>{timeSignature}</strong></span>
                {loopSection.hasValidLoop && (
                    <span style={{ color: loopSection.isLoopEnabled ? '#4caf50' : '#666' }}>
                        Loop: {loopSection.loopStart + 1} - {loopSection.loopEnd + 1}
                        {loopSection.isLoopEnabled && ' (ON)'}
                    </span>
                )}
            </div>
        </div>
    );
}

// 匯出子元件供單獨使用
export { Metronome, SpeedTrainer, LoopSection };
export { useLoopSection } from '../../hooks/useLoopSection.js';

export default PracticeTools;
