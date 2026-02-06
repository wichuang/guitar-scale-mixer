/**
 * StreakTracker - 連續練習追蹤
 * 日曆熱圖和連續天數顯示
 */

import React, { useMemo } from 'react';

function StreakTracker({ sessions, streak }) {
    // 生成日曆數據（過去 35 天 = 5 週）
    const calendarData = useMemo(() => {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 建立練習日期集合
        const practiceDates = new Set(
            sessions.map(s => {
                const d = new Date(s.date);
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            })
        );

        // 生成過去 35 天
        for (let i = 34; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            const hasPractice = practiceDates.has(dateKey);

            // 計算當天練習時長
            const dayStart = new Date(date).getTime();
            const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
            const dayDuration = sessions
                .filter(s => s.date >= dayStart && s.date <= dayEnd)
                .reduce((sum, s) => sum + (s.duration || 0), 0);

            days.push({
                date,
                dateKey,
                hasPractice,
                duration: dayDuration,
                isToday: i === 0,
                dayOfWeek: date.getDay()
            });
        }

        return days;
    }, [sessions]);

    // 計算本月統計
    const monthStats = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        const practiceDates = new Set(
            sessions
                .filter(s => s.date >= monthStart.getTime())
                .map(s => new Date(s.date).getDate())
        );

        return {
            practiceDays: practiceDates.size,
            totalDays: monthDays,
            percentage: Math.round((practiceDates.size / now.getDate()) * 100)
        };
    }, [sessions]);

    // 熱度顏色
    const getHeatColor = (duration) => {
        if (duration === 0) return '#1a1a1a';
        if (duration < 300) return 'rgba(76, 175, 80, 0.3)';  // < 5 min
        if (duration < 900) return 'rgba(76, 175, 80, 0.5)';  // < 15 min
        if (duration < 1800) return 'rgba(76, 175, 80, 0.7)'; // < 30 min
        return 'rgba(76, 175, 80, 1)'; // >= 30 min
    };

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="streak-tracker" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#aaa' }}>Practice Streak</h4>

            {/* 連續天數顯示 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginBottom: '20px'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontSize: '36px',
                        fontWeight: 'bold',
                        color: streak.current > 0 ? '#ff9800' : '#666'
                    }}>
                        {streak.current}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        Current Streak
                    </div>
                    {streak.current > 0 && (
                        <div style={{ fontSize: '20px', marginTop: '4px' }}>🔥</div>
                    )}
                </div>

                <div style={{
                    width: '1px',
                    background: '#333'
                }} />

                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        fontSize: '36px',
                        fontWeight: 'bold',
                        color: '#4caf50'
                    }}>
                        {streak.longest}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        Longest Streak
                    </div>
                    {streak.longest >= 7 && (
                        <div style={{ fontSize: '20px', marginTop: '4px' }}>⭐</div>
                    )}
                </div>
            </div>

            {/* 日曆熱圖 */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{
                    fontSize: '12px',
                    color: '#888',
                    marginBottom: '8px'
                }}>
                    Last 5 Weeks
                </div>

                {/* 星期標籤 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px',
                    marginBottom: '4px'
                }}>
                    {dayLabels.map((label, i) => (
                        <div
                            key={i}
                            style={{
                                textAlign: 'center',
                                fontSize: '10px',
                                color: '#666'
                            }}
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {/* 日曆格子 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px'
                }}>
                    {calendarData.map((day, i) => (
                        <div
                            key={i}
                            style={{
                                aspectRatio: '1',
                                background: getHeatColor(day.duration),
                                borderRadius: '4px',
                                border: day.isToday ? '2px solid #4caf50' : '1px solid #333',
                                cursor: 'default',
                                position: 'relative'
                            }}
                            title={`${day.date.toLocaleDateString()}: ${day.hasPractice ? `${Math.floor(day.duration / 60)}m practiced` : 'No practice'}`}
                        >
                            {day.isToday && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-14px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '8px',
                                    color: '#4caf50'
                                }}>
                                    Today
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* 圖例 */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '12px',
                    fontSize: '10px',
                    color: '#666'
                }}>
                    <span>Less</span>
                    {[0, 300, 900, 1800, 3600].map((dur, i) => (
                        <div
                            key={i}
                            style={{
                                width: '12px',
                                height: '12px',
                                background: getHeatColor(dur),
                                borderRadius: '2px',
                                border: '1px solid #333'
                            }}
                        />
                    ))}
                    <span>More</span>
                </div>
            </div>

            {/* 本月統計 */}
            <div style={{
                background: '#222',
                borderRadius: '8px',
                padding: '12px'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: '14px' }}>
                        This month: <strong>{monthStats.practiceDays}</strong> days
                    </span>
                    <span style={{
                        fontSize: '12px',
                        color: monthStats.percentage >= 70 ? '#4caf50' : '#888'
                    }}>
                        {monthStats.percentage}% consistency
                    </span>
                </div>

                {/* 進度條 */}
                <div style={{
                    marginTop: '8px',
                    height: '6px',
                    background: '#333',
                    borderRadius: '3px',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${monthStats.percentage}%`,
                        height: '100%',
                        background: monthStats.percentage >= 70 ? '#4caf50' : '#ff9800',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>
        </div>
    );
}

export default StreakTracker;
