/**
 * GoalSetting - 目標設定
 * 設定每日練習目標並追蹤進度
 */

import React, { useState } from 'react';
import { saveGoals } from '../../stores/practiceStore.js';

function GoalSetting({ goals, goalProgress, onRefresh }) {
    const [editing, setEditing] = useState(false);
    const [editValues, setEditValues] = useState({
        dailyPracticeMinutes: goals.dailyPracticeMinutes || 30,
        weeklyDays: goals.weeklyDays || 5,
        targetBpm: goals.targetBpm || ''
    });

    const handleSave = () => {
        saveGoals({
            dailyPracticeMinutes: editValues.dailyPracticeMinutes,
            weeklyDays: editValues.weeklyDays,
            targetBpm: editValues.targetBpm || null
        });
        setEditing(false);
        onRefresh?.();
    };

    const formatRemaining = (seconds) => {
        const mins = Math.floor(seconds / 60);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remainMins = mins % 60;
            return `${hours}h ${remainMins}m`;
        }
        return `${mins}m`;
    };

    return (
        <div className="goal-setting" style={{
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
                <h4 style={{ margin: 0, color: '#aaa' }}>Goals</h4>
                <button
                    onClick={() => setEditing(!editing)}
                    style={{
                        padding: '4px 12px',
                        background: editing ? '#4caf50' : '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    {editing ? 'Cancel' : 'Edit'}
                </button>
            </div>

            {editing ? (
                /* 編輯模式 */
                <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                            Daily Practice Goal (minutes)
                        </label>
                        <input
                            type="number"
                            min="5"
                            max="240"
                            value={editValues.dailyPracticeMinutes}
                            onChange={(e) => setEditValues(prev => ({
                                ...prev,
                                dailyPracticeMinutes: Number(e.target.value)
                            }))}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                            Weekly Practice Days
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {[3, 4, 5, 6, 7].map(days => (
                                <button
                                    key={days}
                                    onClick={() => setEditValues(prev => ({ ...prev, weeklyDays: days }))}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        background: editValues.weeklyDays === days ? '#4caf50' : '#222',
                                        color: '#fff',
                                        border: '1px solid #444',
                                        borderRadius: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {days}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                            Target BPM (optional)
                        </label>
                        <input
                            type="number"
                            min="40"
                            max="300"
                            placeholder="e.g., 180"
                            value={editValues.targetBpm}
                            onChange={(e) => setEditValues(prev => ({
                                ...prev,
                                targetBpm: e.target.value ? Number(e.target.value) : ''
                            }))}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '6px',
                                fontSize: '14px'
                            }}
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        style={{
                            padding: '12px',
                            background: '#4caf50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Save Goals
                    </button>
                </div>
            ) : (
                /* 顯示模式 */
                <div style={{ display: 'grid', gap: '12px' }}>
                    {/* 每日目標 */}
                    <div style={{
                        background: '#222',
                        borderRadius: '8px',
                        padding: '14px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '8px'
                        }}>
                            <span style={{ fontSize: '14px' }}>Daily Practice</span>
                            <span style={{
                                fontSize: '14px',
                                color: goalProgress.dailyProgress >= 100 ? '#4caf50' : '#fff'
                            }}>
                                {goalProgress.dailyProgress}%
                            </span>
                        </div>

                        {/* 進度條 */}
                        <div style={{
                            height: '8px',
                            background: '#333',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                width: `${Math.min(100, goalProgress.dailyProgress)}%`,
                                height: '100%',
                                background: goalProgress.dailyProgress >= 100
                                    ? 'linear-gradient(90deg, #4caf50, #8bc34a)'
                                    : 'linear-gradient(90deg, #ff9800, #ffc107)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>

                        <div style={{ fontSize: '12px', color: '#888' }}>
                            {goalProgress.dailyProgress >= 100 ? (
                                <span style={{ color: '#4caf50' }}>✓ Goal reached!</span>
                            ) : (
                                <>Goal: {goals.dailyPracticeMinutes}m / Remaining: {formatRemaining(goalProgress.dailyRemaining)}</>
                            )}
                        </div>
                    </div>

                    {/* 每週目標 */}
                    <div style={{
                        background: '#222',
                        borderRadius: '8px',
                        padding: '14px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '8px'
                        }}>
                            <span style={{ fontSize: '14px' }}>Weekly Days</span>
                            <span style={{
                                fontSize: '14px',
                                color: goalProgress.weeklyDaysProgress >= 100 ? '#4caf50' : '#fff'
                            }}>
                                {goalProgress.weeklyDaysProgress}%
                            </span>
                        </div>

                        {/* 進度條 */}
                        <div style={{
                            height: '8px',
                            background: '#333',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                width: `${Math.min(100, goalProgress.weeklyDaysProgress)}%`,
                                height: '100%',
                                background: goalProgress.weeklyDaysProgress >= 100
                                    ? 'linear-gradient(90deg, #4caf50, #8bc34a)'
                                    : 'linear-gradient(90deg, #2196F3, #03a9f4)',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>

                        <div style={{ fontSize: '12px', color: '#888' }}>
                            Goal: {goals.weeklyDays} days per week
                        </div>
                    </div>

                    {/* BPM 目標 */}
                    {goals.targetBpm && goalProgress.targetBpmProgress !== null && (
                        <div style={{
                            background: '#222',
                            borderRadius: '8px',
                            padding: '14px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px'
                            }}>
                                <span style={{ fontSize: '14px' }}>Target Speed</span>
                                <span style={{
                                    fontSize: '14px',
                                    color: goalProgress.targetBpmProgress >= 100 ? '#4caf50' : '#fff'
                                }}>
                                    {goalProgress.targetBpmProgress}%
                                </span>
                            </div>

                            {/* 進度條 */}
                            <div style={{
                                height: '8px',
                                background: '#333',
                                borderRadius: '4px',
                                overflow: 'hidden',
                                marginBottom: '8px'
                            }}>
                                <div style={{
                                    width: `${Math.min(100, goalProgress.targetBpmProgress)}%`,
                                    height: '100%',
                                    background: goalProgress.targetBpmProgress >= 100
                                        ? 'linear-gradient(90deg, #4caf50, #8bc34a)'
                                        : 'linear-gradient(90deg, #9c27b0, #e91e63)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>

                            <div style={{ fontSize: '12px', color: '#888' }}>
                                Goal: {goals.targetBpm} BPM
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default GoalSetting;
