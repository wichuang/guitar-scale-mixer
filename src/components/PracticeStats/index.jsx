/**
 * PracticeStats - 練習統計面板
 * 整合所有統計元件
 */

import React, { useState } from 'react';
import { usePracticeStats } from '../../hooks/usePracticeStats.js';
import SessionSummary from './SessionSummary.jsx';
import ProgressChart from './ProgressChart.jsx';
import PracticeHistory from './PracticeHistory.jsx';
import Achievements from './Achievements.jsx';
import StreakTracker from './StreakTracker.jsx';
import GoalSetting from './GoalSetting.jsx';

// Tab 選項
const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'progress', label: 'Progress', icon: '📈' },
    { id: 'history', label: 'History', icon: '📝' },
    { id: 'achievements', label: 'Badges', icon: '🏆' }
];

function PracticeStats({
    showSessionSummary = false,
    lastSession = null,
    onSessionSummaryClose,
    isExpanded = false,
    onToggleExpand
}) {
    const [activeTab, setActiveTab] = useState('overview');

    const {
        isLoading,
        sessions,
        achievements,
        goals,
        stats,
        goalProgress,
        refresh,
        formatTime
    } = usePracticeStats({
        onAchievementUnlock: (newAchievements) => {
            console.log('New achievements:', newAchievements);
        }
    });

    // 簡潔模式
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
                <span>📊</span>
                Practice Stats
                {stats.streak?.current > 0 && (
                    <span style={{
                        background: '#ff9800',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '11px'
                    }}>
                        🔥 {stats.streak.current}
                    </span>
                )}
            </button>
        );
    }

    return (
        <>
            {/* 練習結束摘要 */}
            {showSessionSummary && lastSession && (
                <SessionSummary
                    session={lastSession}
                    onClose={onSessionSummaryClose}
                    formatTime={formatTime}
                />
            )}

            {/* 主面板 */}
            <div className="practice-stats" style={{
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
                        📊 Practice Stats
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
                                fontSize: '12px',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span style={{ marginRight: '4px' }}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Loading */}
                {isLoading ? (
                    <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: '#666'
                    }}>
                        Loading...
                    </div>
                ) : (
                    /* Tab 內容 */
                    <div style={{ padding: '16px' }}>
                        {activeTab === 'overview' && (
                            <div style={{ display: 'grid', gap: '16px' }}>
                                {/* 連續練習追蹤 */}
                                <StreakTracker
                                    sessions={sessions}
                                    streak={stats.streak || { current: 0, longest: 0 }}
                                />

                                {/* 目標設定 */}
                                <GoalSetting
                                    goals={goals}
                                    goalProgress={goalProgress}
                                    onRefresh={refresh}
                                />
                            </div>
                        )}

                        {activeTab === 'progress' && (
                            <ProgressChart
                                stats={stats}
                                formatTime={formatTime}
                            />
                        )}

                        {activeTab === 'history' && (
                            <PracticeHistory
                                sessions={sessions}
                                formatTime={formatTime}
                                onRefresh={refresh}
                            />
                        )}

                        {activeTab === 'achievements' && (
                            <Achievements
                                achievements={achievements}
                                stats={stats}
                                onRefresh={refresh}
                            />
                        )}
                    </div>
                )}

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
                    <span>
                        Total: <strong style={{ color: '#4caf50' }}>{formatTime(stats.totalPracticeTime)}</strong>
                    </span>
                    <span>
                        Sessions: <strong style={{ color: '#888' }}>{stats.totalSessions}</strong>
                    </span>
                    {stats.streak?.current > 0 && (
                        <span>
                            Streak: <strong style={{ color: '#ff9800' }}>🔥 {stats.streak.current}</strong>
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}

// 匯出子元件供單獨使用
export {
    SessionSummary,
    ProgressChart,
    PracticeHistory,
    Achievements,
    StreakTracker,
    GoalSetting
};

export default PracticeStats;
