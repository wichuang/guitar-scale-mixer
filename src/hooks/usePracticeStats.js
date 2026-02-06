/**
 * usePracticeStats - 練習統計 Hook
 * 計算各種練習統計數據
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    loadSessions,
    loadGoals,
    loadAchievements,
    loadStatsCache,
    saveStatsCache,
    unlockAchievement,
    ACHIEVEMENT_DEFINITIONS
} from '../stores/practiceStore.js';

/**
 * 計算連續練習天數
 */
function calculateStreak(sessions) {
    if (sessions.length === 0) return { current: 0, longest: 0 };

    // 取得所有練習日期（去重）
    const dates = [...new Set(sessions.map(s => {
        const d = new Date(s.date);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }))].sort().reverse();

    if (dates.length === 0) return { current: 0, longest: 0 };

    // 計算當前連續
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = 0;
    let checkDate = new Date(today);

    // 從今天或昨天開始計算
    const startFromToday = dates[0] === todayStr;
    const startFromYesterday = dates[0] === yesterdayStr;

    if (startFromToday || startFromYesterday) {
        if (!startFromToday && startFromYesterday) {
            checkDate = new Date(yesterday);
        }

        for (const dateStr of dates) {
            const checkStr = checkDate.toISOString().split('T')[0];
            if (dateStr === checkStr) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (dateStr < checkStr) {
                break;
            }
        }
    }

    // 計算最長連續
    let longestStreak = 0;
    let tempStreak = 1;
    const sortedDates = [...dates].sort();

    for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i - 1]);
        const curr = new Date(sortedDates[i]);
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
        current: currentStreak,
        longest: longestStreak
    };
}

/**
 * 計算週統計
 */
function calculateWeeklyStats(sessions) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // 週日開始
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions = sessions.filter(s => s.date >= weekStart.getTime());

    const totalTime = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const practiceDays = new Set(weekSessions.map(s => new Date(s.date).toDateString())).size;

    return {
        totalTime,
        sessionCount: weekSessions.length,
        practiceDays,
        averageSessionLength: weekSessions.length > 0 ? Math.round(totalTime / weekSessions.length) : 0
    };
}

/**
 * 計算月統計
 */
function calculateMonthlyStats(sessions) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthSessions = sessions.filter(s => s.date >= monthStart.getTime());

    const totalTime = monthSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const practiceDays = new Set(monthSessions.map(s => new Date(s.date).toDateString())).size;

    return {
        totalTime,
        sessionCount: monthSessions.length,
        practiceDays,
        averageSessionLength: monthSessions.length > 0 ? Math.round(totalTime / monthSessions.length) : 0
    };
}

/**
 * 計算速度進步
 */
function calculateSpeedProgress(sessions) {
    if (sessions.length === 0) {
        return { initial: 0, current: 0, max: 0, improvement: 0, history: [] };
    }

    const sorted = [...sessions].sort((a, b) => a.date - b.date);
    const initial = sorted[0].startBpm || 120;
    const current = sorted[sorted.length - 1].endBpm || sorted[sorted.length - 1].startBpm || 120;
    const max = Math.max(...sessions.map(s => s.maxBpm || s.endBpm || s.startBpm || 0));

    // 最近 30 天的速度歷史
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentSessions = sessions.filter(s => s.date > thirtyDaysAgo);
    const history = recentSessions.map(s => ({
        date: s.date,
        bpm: s.maxBpm || s.endBpm || s.startBpm
    }));

    return {
        initial,
        current,
        max,
        improvement: initial > 0 ? Math.round(((current - initial) / initial) * 100) : 0,
        history
    };
}

/**
 * usePracticeStats Hook
 * @param {Object} options - 選項
 * @param {Function} options.onAchievementUnlock - 成就解鎖回調
 * @returns {Object} 統計數據
 */
export function usePracticeStats(options = {}) {
    const { onAchievementUnlock } = options;

    const [sessions, setSessions] = useState([]);
    const [achievements, setAchievements] = useState({});
    const [goals, setGoals] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    // 載入數據
    const loadData = useCallback(() => {
        setIsLoading(true);
        try {
            setSessions(loadSessions());
            setAchievements(loadAchievements());
            setGoals(loadGoals());
        } catch (e) {
            console.error('Failed to load practice data:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 初始載入
    useEffect(() => {
        loadData();
    }, [loadData]);

    // 計算統計（memoized）
    const stats = useMemo(() => {
        if (sessions.length === 0) {
            return {
                totalPracticeTime: 0,
                totalSessions: 0,
                averageSessionLength: 0,
                streak: { current: 0, longest: 0 },
                speedProgress: { initial: 0, current: 0, max: 0, improvement: 0, history: [] },
                weeklyStats: { totalTime: 0, sessionCount: 0, practiceDays: 0, averageSessionLength: 0 },
                monthlyStats: { totalTime: 0, sessionCount: 0, practiceDays: 0, averageSessionLength: 0 },
                totalNotes: 0,
                totalLoops: 0,
                uniqueSongs: 0
            };
        }

        const totalPracticeTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const totalNotes = sessions.reduce((sum, s) => sum + (s.notesPlayed || 0), 0);
        const totalLoops = sessions.reduce((sum, s) => sum + (s.loopsCompleted || 0), 0);
        const uniqueSongs = new Set(sessions.filter(s => s.songId).map(s => s.songId)).size;

        return {
            totalPracticeTime,
            totalSessions: sessions.length,
            averageSessionLength: Math.round(totalPracticeTime / sessions.length),
            streak: calculateStreak(sessions),
            speedProgress: calculateSpeedProgress(sessions),
            weeklyStats: calculateWeeklyStats(sessions),
            monthlyStats: calculateMonthlyStats(sessions),
            totalNotes,
            totalLoops,
            uniqueSongs
        };
    }, [sessions]);

    // 檢查並解鎖成就
    const checkAchievements = useCallback(() => {
        const newUnlocks = [];

        // 首次練習
        if (sessions.length >= 1 && !achievements['first_session']) {
            const unlocked = unlockAchievement('first_session');
            if (unlocked) newUnlocks.push(unlocked);
        }

        // 連續練習
        if (stats.streak.current >= 3 && !achievements['streak_3']) {
            const unlocked = unlockAchievement('streak_3');
            if (unlocked) newUnlocks.push(unlocked);
        }
        if (stats.streak.current >= 7 && !achievements['streak_7']) {
            const unlocked = unlockAchievement('streak_7');
            if (unlocked) newUnlocks.push(unlocked);
        }
        if (stats.streak.current >= 30 && !achievements['streak_30']) {
            const unlocked = unlockAchievement('streak_30');
            if (unlocked) newUnlocks.push(unlocked);
        }

        // 練習時間
        if (stats.totalPracticeTime >= 3600 && !achievements['hour_1']) {
            const unlocked = unlockAchievement('hour_1');
            if (unlocked) newUnlocks.push(unlocked);
        }
        if (stats.totalPracticeTime >= 36000 && !achievements['hour_10']) {
            const unlocked = unlockAchievement('hour_10');
            if (unlocked) newUnlocks.push(unlocked);
        }
        if (stats.totalPracticeTime >= 180000 && !achievements['hour_50']) {
            const unlocked = unlockAchievement('hour_50');
            if (unlocked) newUnlocks.push(unlocked);
        }

        // 循環數
        if (stats.totalLoops >= 100 && !achievements['loops_100']) {
            const unlocked = unlockAchievement('loops_100');
            if (unlocked) newUnlocks.push(unlocked);
        }

        // 樂譜數
        if (stats.uniqueSongs >= 5 && !achievements['songs_5']) {
            const unlocked = unlockAchievement('songs_5');
            if (unlocked) newUnlocks.push(unlocked);
        }

        // 檢查單次速度提升
        for (const session of sessions) {
            const speedGain = (session.endBpm || session.startBpm) - session.startBpm;
            if (speedGain >= 10 && !achievements['speed_10']) {
                const unlocked = unlockAchievement('speed_10');
                if (unlocked) newUnlocks.push(unlocked);
            }
            if (speedGain >= 30 && !achievements['speed_30']) {
                const unlocked = unlockAchievement('speed_30');
                if (unlocked) newUnlocks.push(unlocked);
            }
        }

        // 通知新成就
        if (newUnlocks.length > 0) {
            setAchievements(loadAchievements());
            onAchievementUnlock?.(newUnlocks);
        }

        return newUnlocks;
    }, [sessions, achievements, stats, onAchievementUnlock]);

    // 數據變更時檢查成就
    useEffect(() => {
        if (!isLoading && sessions.length > 0) {
            checkAchievements();
        }
    }, [isLoading, sessions.length, checkAchievements]);

    // 目標達成檢查
    const goalProgress = useMemo(() => {
        const todayTime = stats.weeklyStats.totalTime > 0
            ? sessions
                .filter(s => new Date(s.date).toDateString() === new Date().toDateString())
                .reduce((sum, s) => sum + (s.duration || 0), 0)
            : 0;

        const dailyGoalSeconds = (goals.dailyPracticeMinutes || 30) * 60;

        return {
            dailyProgress: Math.min(100, Math.round((todayTime / dailyGoalSeconds) * 100)),
            dailyRemaining: Math.max(0, dailyGoalSeconds - todayTime),
            weeklyDaysProgress: Math.round((stats.weeklyStats.practiceDays / (goals.weeklyDays || 5)) * 100),
            targetBpmProgress: goals.targetBpm
                ? Math.min(100, Math.round((stats.speedProgress.current / goals.targetBpm) * 100))
                : null
        };
    }, [stats, goals, sessions]);

    // 格式化時間
    const formatTime = useCallback((seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }, []);

    return {
        // 狀態
        isLoading,
        sessions,
        achievements,
        goals,

        // 統計數據
        stats,
        goalProgress,

        // 方法
        refresh: loadData,
        formatTime,
        checkAchievements,

        // 成就定義
        ACHIEVEMENT_DEFINITIONS
    };
}

export default usePracticeStats;
