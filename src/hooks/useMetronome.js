/**
 * useMetronome - 節拍器 Hook
 * 提供節拍器功能，包含 BPM 控制、拍號、重音
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// 音頻上下文單例
let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

/**
 * 播放節拍聲
 * @param {number} frequency - 頻率 (Hz)
 * @param {number} duration - 持續時間 (秒)
 * @param {number} volume - 音量 (0-1)
 */
function playClick(frequency = 1000, duration = 0.05, volume = 0.5) {
    const ctx = getAudioContext();

    // Resume if suspended
    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
}

/**
 * useMetronome Hook
 * @param {Object} options - 選項
 * @param {number} options.initialBpm - 初始 BPM (預設 120)
 * @param {string} options.initialTimeSignature - 初始拍號 (預設 '4/4')
 * @param {boolean} options.initialAccentEnabled - 是否啟用重音 (預設 true)
 * @returns {Object} 節拍器狀態和控制方法
 */
export function useMetronome(options = {}) {
    const {
        initialBpm = 120,
        initialTimeSignature = '4/4',
        initialAccentEnabled = true
    } = options;

    // 狀態
    const [bpm, setBpm] = useState(initialBpm);
    const [timeSignature, setTimeSignature] = useState(initialTimeSignature);
    const [isRunning, setIsRunning] = useState(false);
    const [currentBeat, setCurrentBeat] = useState(0);
    const [accentEnabled, setAccentEnabled] = useState(initialAccentEnabled);
    const [volume, setVolume] = useState(0.5);

    // Refs
    const intervalRef = useRef(null);
    const beatRef = useRef(0);

    // 解析拍號
    const [beatsPerMeasure] = timeSignature.split('/').map(Number);

    /**
     * 播放一拍
     */
    const tick = useCallback(() => {
        const isAccent = beatRef.current === 0 && accentEnabled;
        const freq = isAccent ? 1200 : 800;  // 重音較高音
        const vol = isAccent ? volume * 1.2 : volume;

        playClick(freq, 0.05, Math.min(vol, 1));

        setCurrentBeat(beatRef.current);
        beatRef.current = (beatRef.current + 1) % beatsPerMeasure;
    }, [accentEnabled, beatsPerMeasure, volume]);

    /**
     * 開始節拍器
     */
    const start = useCallback(() => {
        if (intervalRef.current) return;

        beatRef.current = 0;
        setCurrentBeat(0);
        setIsRunning(true);

        // 立即播放第一拍
        tick();

        // 設定間隔
        const intervalMs = (60 / bpm) * 1000;
        intervalRef.current = setInterval(tick, intervalMs);
    }, [bpm, tick]);

    /**
     * 停止節拍器
     */
    const stop = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsRunning(false);
        setCurrentBeat(0);
        beatRef.current = 0;
    }, []);

    /**
     * 切換節拍器
     */
    const toggle = useCallback(() => {
        if (isRunning) {
            stop();
        } else {
            start();
        }
    }, [isRunning, start, stop]);

    /**
     * 更新 BPM (運行中時重設間隔)
     */
    const updateBpm = useCallback((newBpm) => {
        const clampedBpm = Math.max(40, Math.min(240, newBpm));
        setBpm(clampedBpm);

        if (isRunning && intervalRef.current) {
            clearInterval(intervalRef.current);
            const intervalMs = (60 / clampedBpm) * 1000;
            intervalRef.current = setInterval(tick, intervalMs);
        }
    }, [isRunning, tick]);

    /**
     * 點擊測速
     */
    const tapTempoRef = useRef([]);

    const tapTempo = useCallback(() => {
        const now = Date.now();
        const taps = tapTempoRef.current;

        // 清除超過 2 秒的點擊
        while (taps.length > 0 && now - taps[0] > 2000) {
            taps.shift();
        }

        taps.push(now);

        // 至少需要 2 個點擊
        if (taps.length >= 2) {
            const intervals = [];
            for (let i = 1; i < taps.length; i++) {
                intervals.push(taps[i] - taps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const detectedBpm = Math.round(60000 / avgInterval);
            updateBpm(detectedBpm);
        }
    }, [updateBpm]);

    // BPM 變更時更新間隔
    useEffect(() => {
        if (isRunning && intervalRef.current) {
            clearInterval(intervalRef.current);
            const intervalMs = (60 / bpm) * 1000;
            intervalRef.current = setInterval(tick, intervalMs);
        }
    }, [bpm, isRunning, tick]);

    // 清理
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        // 狀態
        bpm,
        timeSignature,
        isRunning,
        currentBeat,
        beatsPerMeasure,
        accentEnabled,
        volume,

        // 方法
        start,
        stop,
        toggle,
        setBpm: updateBpm,
        setTimeSignature,
        setAccentEnabled,
        setVolume,
        tapTempo
    };
}

export default useMetronome;
