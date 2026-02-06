/**
 * useSpeedTrainer - 速度訓練器 Hook
 * 漸進式加速練習功能
 */

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useSpeedTrainer Hook
 * @param {Object} options - 選項
 * @param {number} options.startBpm - 起始 BPM (預設 60)
 * @param {number} options.targetBpm - 目標 BPM (預設 120)
 * @param {number} options.incrementBpm - 每次增加的 BPM (預設 5)
 * @param {number} options.repetitions - 每個速度重複次數 (預設 4)
 * @param {Function} options.onBpmChange - BPM 變更回調
 * @param {Function} options.onComplete - 訓練完成回調
 * @returns {Object} 訓練器狀態和控制方法
 */
export function useSpeedTrainer(options = {}) {
    const {
        startBpm: initialStartBpm = 60,
        targetBpm: initialTargetBpm = 120,
        incrementBpm: initialIncrementBpm = 5,
        repetitions: initialRepetitions = 4,
        onBpmChange,
        onComplete
    } = options;

    // 設定狀態
    const [startBpm, setStartBpm] = useState(initialStartBpm);
    const [targetBpm, setTargetBpm] = useState(initialTargetBpm);
    const [incrementBpm, setIncrementBpm] = useState(initialIncrementBpm);
    const [repetitions, setRepetitions] = useState(initialRepetitions);

    // 訓練狀態
    const [isTraining, setIsTraining] = useState(false);
    const [currentBpm, setCurrentBpm] = useState(initialStartBpm);
    const [currentRepetition, setCurrentRepetition] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // 進度計算
    const totalSteps = Math.ceil((targetBpm - startBpm) / incrementBpm) + 1;
    const currentStep = Math.floor((currentBpm - startBpm) / incrementBpm) + 1;
    const progress = ((currentBpm - startBpm) / (targetBpm - startBpm)) * 100;

    // Refs
    const callbackRef = useRef({ onBpmChange, onComplete });
    callbackRef.current = { onBpmChange, onComplete };

    /**
     * 開始訓練
     */
    const start = useCallback(() => {
        setCurrentBpm(startBpm);
        setCurrentRepetition(0);
        setIsTraining(true);
        setIsPaused(false);
        callbackRef.current.onBpmChange?.(startBpm);
    }, [startBpm]);

    /**
     * 停止訓練
     */
    const stop = useCallback(() => {
        setIsTraining(false);
        setIsPaused(false);
        setCurrentBpm(startBpm);
        setCurrentRepetition(0);
    }, [startBpm]);

    /**
     * 暫停/繼續訓練
     */
    const togglePause = useCallback(() => {
        setIsPaused(prev => !prev);
    }, []);

    /**
     * 完成一次重複（由外部播放完成時調用）
     */
    const completeRepetition = useCallback(() => {
        if (!isTraining || isPaused) return;

        const nextRep = currentRepetition + 1;

        if (nextRep >= repetitions) {
            // 完成所有重複，進入下一速度
            const nextBpm = Math.min(currentBpm + incrementBpm, targetBpm);

            if (nextBpm > targetBpm || currentBpm >= targetBpm) {
                // 訓練完成
                setIsTraining(false);
                callbackRef.current.onComplete?.();
                return;
            }

            setCurrentBpm(nextBpm);
            setCurrentRepetition(0);
            callbackRef.current.onBpmChange?.(nextBpm);
        } else {
            setCurrentRepetition(nextRep);
        }
    }, [isTraining, isPaused, currentRepetition, repetitions, currentBpm, incrementBpm, targetBpm]);

    /**
     * 手動跳到下一速度
     */
    const nextSpeed = useCallback(() => {
        if (!isTraining) return;

        const nextBpm = Math.min(currentBpm + incrementBpm, targetBpm);
        if (nextBpm > targetBpm) {
            setIsTraining(false);
            callbackRef.current.onComplete?.();
            return;
        }

        setCurrentBpm(nextBpm);
        setCurrentRepetition(0);
        callbackRef.current.onBpmChange?.(nextBpm);
    }, [isTraining, currentBpm, incrementBpm, targetBpm]);

    /**
     * 手動跳到上一速度
     */
    const prevSpeed = useCallback(() => {
        if (!isTraining) return;

        const prevBpm = Math.max(currentBpm - incrementBpm, startBpm);
        setCurrentBpm(prevBpm);
        setCurrentRepetition(0);
        callbackRef.current.onBpmChange?.(prevBpm);
    }, [isTraining, currentBpm, incrementBpm, startBpm]);

    /**
     * 重設設定
     */
    const reset = useCallback(() => {
        stop();
        setStartBpm(initialStartBpm);
        setTargetBpm(initialTargetBpm);
        setIncrementBpm(initialIncrementBpm);
        setRepetitions(initialRepetitions);
    }, [stop, initialStartBpm, initialTargetBpm, initialIncrementBpm, initialRepetitions]);

    return {
        // 設定
        startBpm,
        targetBpm,
        incrementBpm,
        repetitions,

        // 訓練狀態
        isTraining,
        isPaused,
        currentBpm,
        currentRepetition,

        // 進度
        totalSteps,
        currentStep,
        progress: Math.min(Math.max(progress, 0), 100),

        // 設定方法
        setStartBpm,
        setTargetBpm,
        setIncrementBpm,
        setRepetitions,

        // 控制方法
        start,
        stop,
        togglePause,
        completeRepetition,
        nextSpeed,
        prevSpeed,
        reset
    };
}

export default useSpeedTrainer;
