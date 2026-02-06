/**
 * ProgressChart - 進度圖表
 * 顯示速度和練習時間的進度
 */

import React, { useMemo } from 'react';

/**
 * 簡易 SVG 折線圖
 */
function SimpleLineChart({ data, width = 300, height = 120, color = '#4caf50' }) {
    if (!data || data.length === 0) {
        return (
            <div style={{
                width,
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '14px'
            }}>
                No data yet
            </div>
        );
    }

    const padding = 10;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
        const y = padding + chartHeight - ((d.value - minValue) / range) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    // 面積填充路徑
    const areaPath = `M ${padding},${padding + chartHeight} ` +
        data.map((d, i) => {
            const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
            const y = padding + chartHeight - ((d.value - minValue) / range) * chartHeight;
            return `L ${x},${y}`;
        }).join(' ') +
        ` L ${padding + chartWidth},${padding + chartHeight} Z`;

    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            {/* 背景網格 */}
            <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#333" strokeWidth="0.5" />
                </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#grid)" />

            {/* 面積填充 */}
            <path d={areaPath} fill={color} fillOpacity="0.2" />

            {/* 折線 */}
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* 數據點 */}
            {data.map((d, i) => {
                const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
                const y = padding + chartHeight - ((d.value - minValue) / range) * chartHeight;
                return (
                    <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3"
                        fill={color}
                    />
                );
            })}

            {/* Y 軸標籤 */}
            <text x={padding} y={padding + 4} fontSize="10" fill="#666">
                {maxValue}
            </text>
            <text x={padding} y={padding + chartHeight} fontSize="10" fill="#666">
                {minValue}
            </text>
        </svg>
    );
}

/**
 * 簡易柱狀圖
 */
function SimpleBarChart({ data, width = 300, height = 120, color = '#2196F3' }) {
    if (!data || data.length === 0) {
        return (
            <div style={{
                width,
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '14px'
            }}>
                No data yet
            </div>
        );
    }

    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const barWidth = Math.min(30, (chartWidth / data.length) * 0.8);
    const gap = (chartWidth - barWidth * data.length) / (data.length + 1);

    const maxValue = Math.max(...data.map(d => d.value)) || 1;

    return (
        <svg width={width} height={height} style={{ display: 'block' }}>
            {data.map((d, i) => {
                const barHeight = (d.value / maxValue) * chartHeight;
                const x = padding + gap + i * (barWidth + gap);
                const y = padding + chartHeight - barHeight;

                return (
                    <g key={i}>
                        <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={color}
                            rx="2"
                        />
                        <text
                            x={x + barWidth / 2}
                            y={height - 4}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#666"
                        >
                            {d.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

function ProgressChart({ stats, formatTime }) {
    // 準備速度進步數據
    const speedData = useMemo(() => {
        if (!stats.speedProgress?.history?.length) return [];
        return stats.speedProgress.history.slice(-14).map(h => ({
            value: h.bpm,
            label: new Date(h.date).getDate().toString()
        }));
    }, [stats.speedProgress]);

    // 準備每日練習時間數據 (最近 7 天)
    const dailyTimeData = useMemo(() => {
        const days = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            const dateEnd = new Date(date);
            dateEnd.setHours(23, 59, 59, 999);

            // 這裡需要從 sessions 計算，但簡化處理
            days.push({
                value: 0, // 會由父組件提供
                label: dayNames[date.getDay()]
            });
        }

        return days;
    }, []);

    return (
        <div className="progress-chart" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#aaa' }}>Progress</h4>

            {/* 總覽卡片 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '20px'
            }}>
                <div style={{
                    background: '#222',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Total Time</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4caf50' }}>
                        {formatTime ? formatTime(stats.totalPracticeTime) : `${Math.floor(stats.totalPracticeTime / 60)}m`}
                    </div>
                </div>

                <div style={{
                    background: '#222',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Sessions</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>
                        {stats.totalSessions}
                    </div>
                </div>

                <div style={{
                    background: '#222',
                    borderRadius: '8px',
                    padding: '12px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Max BPM</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff9800' }}>
                        {stats.speedProgress?.max || 0}
                    </div>
                </div>
            </div>

            {/* 速度進步圖表 */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                    Speed Progress (Last 14 sessions)
                </div>
                <div style={{ background: '#111', borderRadius: '8px', padding: '8px' }}>
                    <SimpleLineChart data={speedData} color="#4caf50" />
                </div>
                {stats.speedProgress?.improvement !== 0 && (
                    <div style={{
                        fontSize: '12px',
                        color: stats.speedProgress.improvement > 0 ? '#4caf50' : '#ff5252',
                        marginTop: '8px',
                        textAlign: 'center'
                    }}>
                        {stats.speedProgress.improvement > 0 ? '+' : ''}{stats.speedProgress.improvement}% since first session
                    </div>
                )}
            </div>

            {/* 本週統計 */}
            <div style={{
                background: '#222',
                borderRadius: '8px',
                padding: '12px'
            }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>This Week</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Practice days: <strong>{stats.weeklyStats?.practiceDays || 0}</strong></span>
                    <span>Time: <strong>
                        {formatTime ? formatTime(stats.weeklyStats?.totalTime || 0) : `${Math.floor((stats.weeklyStats?.totalTime || 0) / 60)}m`}
                    </strong></span>
                </div>
            </div>
        </div>
    );
}

export default ProgressChart;
