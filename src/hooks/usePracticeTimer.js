/**
 * usePracticeTimer - 練習計時器 Hook
 * 追蹤練習時長、偵測閒置、收集練習指標
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { PracticeSession } from '../core/models/PracticeSession.js';
import { addSession } from '../stores/practiceStore.js';

const IDLE_TIMEOUT = 30000; // 30 秒無操作視為閒置

/**
 * usePracticeTimer Hook
 * @param {Object} options - 選項
 * @param {Function} options.onSessionEnd - 練習結束回調
 * @param {Function} options.onAchievementUnlock - 成就解鎖回調
 * @returns {Object} 計時器狀態和控制方法
 */
export function usePracticeTimer(options = {}) {
    const { onSessionEnd, onAchievementUnlock } = options;

    // 狀態
    const [isActive, setIsActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0); // 秒
    const [currentSession, setCurrentSession] = useState(null);

    // 練習指標
    const [metrics, setMetrics] = useState({
        notesPlayed: 0,
        loopsCompleted: 0,
        maxBpm: 0,
        currentBpm: 120
    });

    // Refs
    const timerRef = useRef(null);
    const lastActivityRef = useRef(Date.now());
    const idleCheckRef = useRef(null);
    const sessionRef = useRef(null);
    const callbackRef = useRef({ onSessionEnd, onAchievementUnlock });
    callbackRef.current = { onSessionEnd, onAchievementUnlock };

    /**
     * 記錄活動（重設閒置計時）
     */
    const recordActivity = useCallback(() => {
        lastActivityRef.current = Date.now();

        // 如果因閒置而暫停，自動恢復
        if (isPaused && isActive) {
            setIsPaused(false);
        }
    }, [isPaused, isActive]);

    /**
     * 檢查閒置
     */
    const checkIdle = useCallback(() => {
        if (!isActive || isPaused) return;

        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime > IDLE_TIMEOUT) {
            setIsPaused(true);
        }
    }, [isActive, isPaused]);

    /**
     * 開始練習計時
     */
    const startSession = useCallback((sessionData = {}) => {
        const session = new PracticeSession({
            ...sessionData,
            date: Date.now(),
            startBpm: sessionData.bpm || 120
        });

        setCurrentSession(session);
        sessionRef.current = session;
        setIsActive(true);
        setIsPaused(false);
        setElapsedTime(0);
        setMetrics({
            notesPlayed: 0,
            loopsCompleted: 0,
            maxBpm: sessionData.bpm || 120,
            currentBpm: sessionData.bpm || 120
        });
        lastActivityRef.current = Date.now();

        return session;
    }, []);

    /**
     * 暫停計時
     */
    const pauseSession = useCallback(() => {
        if (isActive) {
            setIsPaused(true);
        }
    }, [isActive]);

    /**
     * 恢復計時
     */
    const resumeSession = useCallback(() => {
        if (isActive && isPaused) {
            setIsPaused(false);
            lastActivityRef.current = Date.now();
        }
    }, [isActive, isPaused]);

    /**
     * 結束練習並儲存
     */
    const endSession = useCallback((finalData = {}) => {
        if (!sessionRef.current) return null;

        const session = sessionRef.current;
        session.finalize({
            duration: elapsedTime,
            endBpm: metrics.currentBpm,
            maxBpm: metrics.maxBpm,
            notesPlayed: metrics.notesPlayed,
            loopsCompleted: metrics.loopsCompleted,
            ...finalData
        });

        // 儲存到 localStorage
        addSession(session);

        // 通知回調
        callbackRef.current.onSessionEnd?.(session);

        // 重設狀態
        setIsActive(false);
        setIsPaused(false);
        setElapsedTime(0);
        setCurrentSession(null);
        sessionRef.current = null;

        return session;
    }, [elapsedTime, metrics]);

    /**
     * 取消練習（不儲存）
     */
    const cancelSession = useCallback(() => {
        setIsActive(false);
        setIsPaused(false);
        setElapsedTime(0);
        setCurrentSession(null);
        sessionRef.current = null;
    }, []);

    /**
     * 更新練習指標
     */
    const updateMetrics = useCallback((updates) => {
        setMetrics(prev => {
            const newMetrics = { ...prev, ...updates };
            // 更新最高 BPM
            if (updates.currentBpm && updates.currentBpm > prev.maxBpm) {
                newMetrics.maxBpm = updates.currentBpm;
            }
            return newMetrics;
        });
        recordActivity();
    }, [recordActivity]);

    /**
     * 增加音符計數
     */
    const incrementNotes = useCallback((count = 1) => {
        setMetrics(prev => ({
            ...prev,
            notesPlayed: prev.notesPlayed + count
        }));
        recordActivity();
    }, [recordActivity]);

    /**
     * 增加循環計數
     */
    const incrementLoops = useCallback((count = 1) => {
        setMetrics(prev => ({
            ...prev,
            loopsCompleted: prev.loopsCompleted + count
        }));
        recordActivity();
    }, [recordActivity]);

    /**
     * 更新 BPM
     */
    const updateBpm = useCallback((bpm) => {
        setMetrics(prev => ({
            ...prev,
            currentBpm: bpm,
            maxBpm: Math.max(prev.maxBpm, bpm)
        }));
        recordActivity();
    }, [recordActivity]);

    // 計時器邏輯
    useEffect(() => {
        if (isActive && !isPaused) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [isActive, isPaused]);

    // 閒置檢查
    useEffect(() => {
        if (isActive) {
            idleCheckRef.current = setInterval(checkIdle, 5000);
        } else {
            if (idleCheckRef.current) {
                clearInterval(idleCheckRef.current);
                idleCheckRef.current = null;
            }
        }

        return () => {
            if (idleCheckRef.current) {
                clearInterval(idleCheckRef.current);
            }
        };
    }, [isActive, checkIdle]);

    // 格式化時間
    const formattedTime = (() => {
        const hours = Math.floor(elapsedTime / 3600);
        const minutes = Math.floor((elapsedTime % 3600) / 60);
        const seconds = elapsedTime % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    })();

    return {
        // 狀態
        isActive,
        isPaused,
        elapsedTime,
        formattedTime,
        currentSession,
        metrics,

        // 控制方法
        startSession,
        pauseSession,
        resumeSession,
        endSession,
        cancelSession,

        // 指標更新
        updateMetrics,
        incrementNotes,
        incrementLoops,
        updateBpm,
        recordActivity
    };
}

export default usePracticeTimer;
