/**
 * practiceStore - 練習數據持久化儲存
 * 使用 localStorage 儲存練習紀錄、目標、成就
 */

import { PracticeSession } from '../core/models/PracticeSession.js';

// localStorage Keys
const KEYS = {
    SESSIONS: 'guitar-mixer-practice-sessions',
    GOALS: 'guitar-mixer-practice-goals',
    ACHIEVEMENTS: 'guitar-mixer-achievements',
    STATS_CACHE: 'guitar-mixer-stats-cache'
};

/**
 * 安全讀取 localStorage
 */
function safeGetItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`Error reading ${key} from localStorage:`, e);
        return defaultValue;
    }
}

/**
 * 安全寫入 localStorage
 */
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Error writing ${key} to localStorage:`, e);
        // 嘗試清理舊資料
        if (e.name === 'QuotaExceededError') {
            cleanupOldSessions();
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e2) {
                console.error('Still failed after cleanup:', e2);
            }
        }
        return false;
    }
}

/**
 * 清理超過 90 天的舊紀錄
 */
function cleanupOldSessions() {
    const sessions = safeGetItem(KEYS.SESSIONS, []);
    const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
    const filtered = sessions.filter(s => s.date > cutoff);
    safeSetItem(KEYS.SESSIONS, filtered);
}

// ==================== Sessions ====================

/**
 * 載入所有練習紀錄
 */
export function loadSessions() {
    const data = safeGetItem(KEYS.SESSIONS, []);
    return data.map(s => PracticeSession.fromJSON(s));
}

/**
 * 儲存所有練習紀錄
 */
export function saveSessions(sessions) {
    const data = sessions.map(s => s.toJSON ? s.toJSON() : s);
    return safeSetItem(KEYS.SESSIONS, data);
}

/**
 * 新增練習紀錄
 */
export function addSession(session) {
    const sessions = loadSessions();
    const newSession = session instanceof PracticeSession
        ? session
        : new PracticeSession(session);
    sessions.push(newSession);
    saveSessions(sessions);

    // 清除統計快取
    clearStatsCache();

    return newSession;
}

/**
 * 更新練習紀錄
 */
export function updateSession(id, updates) {
    const sessions = loadSessions();
    const index = sessions.findIndex(s => s.id === id);
    if (index !== -1) {
        sessions[index].update(updates);
        saveSessions(sessions);
        clearStatsCache();
        return sessions[index];
    }
    return null;
}

/**
 * 刪除練習紀錄
 */
export function deleteSession(id) {
    const sessions = loadSessions();
    const filtered = sessions.filter(s => s.id !== id);
    saveSessions(filtered);
    clearStatsCache();
    return filtered.length !== sessions.length;
}

/**
 * 依日期範圍查詢
 */
export function getSessionsByDateRange(startDate, endDate) {
    const sessions = loadSessions();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1); // 包含結束日
    return sessions.filter(s => s.date >= start && s.date <= end);
}

/**
 * 依樂譜查詢
 */
export function getSessionsBySong(songId) {
    const sessions = loadSessions();
    return sessions.filter(s => s.songId === songId);
}

/**
 * 取得最近 N 筆紀錄
 */
export function getRecentSessions(count = 10) {
    const sessions = loadSessions();
    return sessions
        .sort((a, b) => b.date - a.date)
        .slice(0, count);
}

/**
 * 取得今天的練習紀錄
 */
export function getTodaySessions() {
    const today = new Date().toISOString().split('T')[0];
    return getSessionsByDateRange(today, today);
}

// ==================== Goals ====================

/**
 * 預設目標
 */
const DEFAULT_GOALS = {
    dailyPracticeMinutes: 30,
    targetBpm: null,
    weeklyDays: 5
};

/**
 * 載入目標設定
 */
export function loadGoals() {
    return safeGetItem(KEYS.GOALS, DEFAULT_GOALS);
}

/**
 * 儲存目標設定
 */
export function saveGoals(goals) {
    return safeSetItem(KEYS.GOALS, { ...DEFAULT_GOALS, ...goals });
}

// ==================== Achievements ====================

/**
 * 成就定義
 */
export const ACHIEVEMENT_DEFINITIONS = {
    'first_session': {
        id: 'first_session',
        name: 'First Steps',
        description: 'Complete your first practice session',
        icon: '🎸',
        requirement: 1
    },
    'streak_3': {
        id: 'streak_3',
        name: 'Getting Started',
        description: 'Practice 3 days in a row',
        icon: '🔥',
        requirement: 3
    },
    'streak_7': {
        id: 'streak_7',
        name: 'Week Warrior',
        description: 'Practice 7 days in a row',
        icon: '⭐',
        requirement: 7
    },
    'streak_30': {
        id: 'streak_30',
        name: 'Dedicated',
        description: 'Practice 30 days in a row',
        icon: '🏆',
        requirement: 30
    },
    'speed_10': {
        id: 'speed_10',
        name: 'Speeding Up',
        description: 'Increase speed by 10 BPM in one session',
        icon: '⚡',
        requirement: 10
    },
    'speed_30': {
        id: 'speed_30',
        name: 'Speed Demon',
        description: 'Increase speed by 30 BPM in one session',
        icon: '🚀',
        requirement: 30
    },
    'hour_1': {
        id: 'hour_1',
        name: 'First Hour',
        description: 'Practice for a total of 1 hour',
        icon: '⏱️',
        requirement: 3600
    },
    'hour_10': {
        id: 'hour_10',
        name: 'Committed',
        description: 'Practice for a total of 10 hours',
        icon: '🎯',
        requirement: 36000
    },
    'hour_50': {
        id: 'hour_50',
        name: 'Devoted',
        description: 'Practice for a total of 50 hours',
        icon: '💎',
        requirement: 180000
    },
    'loops_100': {
        id: 'loops_100',
        name: 'Loop Master',
        description: 'Complete 100 practice loops',
        icon: '🔁',
        requirement: 100
    },
    'songs_5': {
        id: 'songs_5',
        name: 'Diverse',
        description: 'Practice 5 different songs',
        icon: '📚',
        requirement: 5
    }
};

/**
 * 載入已解鎖成就
 */
export function loadAchievements() {
    return safeGetItem(KEYS.ACHIEVEMENTS, {});
}

/**
 * 儲存成就
 */
export function saveAchievements(achievements) {
    return safeSetItem(KEYS.ACHIEVEMENTS, achievements);
}

/**
 * 解鎖成就
 */
export function unlockAchievement(achievementId) {
    const achievements = loadAchievements();
    if (!achievements[achievementId]) {
        achievements[achievementId] = {
            unlockedAt: Date.now(),
            isNew: true
        };
        saveAchievements(achievements);
        return ACHIEVEMENT_DEFINITIONS[achievementId];
    }
    return null;
}

/**
 * 標記成就為已讀
 */
export function markAchievementSeen(achievementId) {
    const achievements = loadAchievements();
    if (achievements[achievementId]) {
        achievements[achievementId].isNew = false;
        saveAchievements(achievements);
    }
}

/**
 * 取得新解鎖的成就
 */
export function getNewAchievements() {
    const achievements = loadAchievements();
    return Object.entries(achievements)
        .filter(([_, data]) => data.isNew)
        .map(([id]) => ACHIEVEMENT_DEFINITIONS[id]);
}

// ==================== Stats Cache ====================

/**
 * 載入統計快取
 */
export function loadStatsCache() {
    return safeGetItem(KEYS.STATS_CACHE, null);
}

/**
 * 儲存統計快取
 */
export function saveStatsCache(stats) {
    return safeSetItem(KEYS.STATS_CACHE, {
        ...stats,
        cachedAt: Date.now()
    });
}

/**
 * 清除統計快取
 */
export function clearStatsCache() {
    localStorage.removeItem(KEYS.STATS_CACHE);
}

// ==================== Import/Export ====================

/**
 * 匯出所有數據
 */
export function exportData() {
    return {
        sessions: safeGetItem(KEYS.SESSIONS, []),
        goals: safeGetItem(KEYS.GOALS, DEFAULT_GOALS),
        achievements: safeGetItem(KEYS.ACHIEVEMENTS, {}),
        exportedAt: Date.now(),
        version: '1.0'
    };
}

/**
 * 匯入數據
 */
export function importData(data, merge = true) {
    if (!data || !data.sessions) {
        throw new Error('Invalid data format');
    }

    if (merge) {
        // 合併模式：保留現有資料，新增不重複的
        const existingSessions = loadSessions();
        const existingIds = new Set(existingSessions.map(s => s.id));
        const newSessions = data.sessions.filter(s => !existingIds.has(s.id));
        saveSessions([...existingSessions, ...newSessions.map(s => PracticeSession.fromJSON(s))]);

        const existingAchievements = loadAchievements();
        saveAchievements({ ...existingAchievements, ...data.achievements });
    } else {
        // 覆蓋模式
        saveSessions(data.sessions.map(s => PracticeSession.fromJSON(s)));
        saveAchievements(data.achievements || {});
    }

    if (data.goals) {
        saveGoals(data.goals);
    }

    clearStatsCache();
    return true;
}

/**
 * 清除所有數據
 */
export function clearAllData() {
    localStorage.removeItem(KEYS.SESSIONS);
    localStorage.removeItem(KEYS.GOALS);
    localStorage.removeItem(KEYS.ACHIEVEMENTS);
    localStorage.removeItem(KEYS.STATS_CACHE);
}

export default {
    // Sessions
    loadSessions,
    saveSessions,
    addSession,
    updateSession,
    deleteSession,
    getSessionsByDateRange,
    getSessionsBySong,
    getRecentSessions,
    getTodaySessions,

    // Goals
    loadGoals,
    saveGoals,

    // Achievements
    ACHIEVEMENT_DEFINITIONS,
    loadAchievements,
    saveAchievements,
    unlockAchievement,
    markAchievementSeen,
    getNewAchievements,

    // Cache
    loadStatsCache,
    saveStatsCache,
    clearStatsCache,

    // Import/Export
    exportData,
    importData,
    clearAllData
};
