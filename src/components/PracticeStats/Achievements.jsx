/**
 * Achievements - 成就徽章系統
 * 顯示已解鎖和可解鎖的成就
 */

import React from 'react';
import { ACHIEVEMENT_DEFINITIONS, markAchievementSeen } from '../../stores/practiceStore.js';

function AchievementCard({ achievement, unlocked, isNew, stats }) {
    const def = ACHIEVEMENT_DEFINITIONS[achievement.id || achievement];

    if (!def) return null;

    // 計算進度
    let progress = 0;
    if (!unlocked) {
        switch (def.id) {
            case 'first_session':
                progress = stats.totalSessions > 0 ? 100 : 0;
                break;
            case 'streak_3':
                progress = Math.min(100, (stats.streak?.current / 3) * 100);
                break;
            case 'streak_7':
                progress = Math.min(100, (stats.streak?.current / 7) * 100);
                break;
            case 'streak_30':
                progress = Math.min(100, (stats.streak?.current / 30) * 100);
                break;
            case 'hour_1':
                progress = Math.min(100, (stats.totalPracticeTime / 3600) * 100);
                break;
            case 'hour_10':
                progress = Math.min(100, (stats.totalPracticeTime / 36000) * 100);
                break;
            case 'hour_50':
                progress = Math.min(100, (stats.totalPracticeTime / 180000) * 100);
                break;
            case 'loops_100':
                progress = Math.min(100, (stats.totalLoops / 100) * 100);
                break;
            case 'songs_5':
                progress = Math.min(100, (stats.uniqueSongs / 5) * 100);
                break;
            default:
                progress = 0;
        }
    }

    return (
        <div style={{
            background: unlocked ? '#222' : '#1a1a1a',
            border: isNew ? '2px solid #ffd700' : '1px solid #333',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            opacity: unlocked ? 1 : 0.6,
            position: 'relative'
        }}>
            {/* 新徽章標記 */}
            {isNew && (
                <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#ffd700',
                    color: '#000',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                }}>
                    NEW!
                </div>
            )}

            {/* 圖示 */}
            <div style={{
                fontSize: '32px',
                filter: unlocked ? 'none' : 'grayscale(100%)'
            }}>
                {def.icon}
            </div>

            {/* 資訊 */}
            <div style={{ flex: 1 }}>
                <div style={{
                    fontWeight: 'bold',
                    marginBottom: '2px',
                    color: unlocked ? '#fff' : '#888'
                }}>
                    {def.name}
                </div>
                <div style={{ fontSize: '12px', color: '#888' }}>
                    {def.description}
                </div>

                {/* 進度條 (未解鎖時顯示) */}
                {!unlocked && progress > 0 && (
                    <div style={{
                        marginTop: '6px',
                        height: '4px',
                        background: '#333',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: '#4caf50',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                )}
            </div>

            {/* 狀態 */}
            {unlocked && (
                <div style={{
                    color: '#4caf50',
                    fontSize: '20px'
                }}>
                    ✓
                </div>
            )}
        </div>
    );
}

function Achievements({ achievements, stats, onRefresh }) {
    const allAchievements = Object.keys(ACHIEVEMENT_DEFINITIONS);

    // 分類成就
    const unlockedList = allAchievements.filter(id => achievements[id]);
    const lockedList = allAchievements.filter(id => !achievements[id]);

    // 處理新成就點擊
    const handleNewAchievementClick = (id) => {
        if (achievements[id]?.isNew) {
            markAchievementSeen(id);
            onRefresh?.();
        }
    };

    return (
        <div className="achievements" style={{
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
                <h4 style={{ margin: 0, color: '#aaa' }}>Achievements</h4>
                <span style={{ fontSize: '14px', color: '#888' }}>
                    {unlockedList.length}/{allAchievements.length}
                </span>
            </div>

            {/* 已解鎖 */}
            {unlockedList.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{
                        fontSize: '12px',
                        color: '#4caf50',
                        marginBottom: '8px'
                    }}>
                        Unlocked ({unlockedList.length})
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {unlockedList.map(id => (
                            <div
                                key={id}
                                onClick={() => handleNewAchievementClick(id)}
                                style={{ cursor: achievements[id]?.isNew ? 'pointer' : 'default' }}
                            >
                                <AchievementCard
                                    achievement={{ id }}
                                    unlocked={true}
                                    isNew={achievements[id]?.isNew}
                                    stats={stats}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 未解鎖 */}
            {lockedList.length > 0 && (
                <div>
                    <div style={{
                        fontSize: '12px',
                        color: '#888',
                        marginBottom: '8px'
                    }}>
                        Locked ({lockedList.length})
                    </div>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {lockedList.map(id => (
                            <AchievementCard
                                key={id}
                                achievement={{ id }}
                                unlocked={false}
                                isNew={false}
                                stats={stats}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 無成就時顯示 */}
            {allAchievements.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666'
                }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
                    <div>No achievements available</div>
                </div>
            )}
        </div>
    );
}

export default Achievements;
