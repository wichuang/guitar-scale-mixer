/**
 * useLoopSection - 段落循環 Hook
 * 支援選取段落並循環播放
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useLoopSection Hook
 * @param {Object} options - 選項
 * @param {number} options.totalNotes - 總音符數
 * @param {Function} options.onLoopStart - 循環開始回調
 * @param {Function} options.onLoopEnd - 循環結束回調
 * @returns {Object} 段落循環狀態和控制方法
 */
export function useLoopSection(options = {}) {
    const {
        totalNotes = 0,
        onLoopStart,
        onLoopEnd
    } = options;

    // 段落狀態
    const [loopStart, setLoopStart] = useState(null);
    const [loopEnd, setLoopEnd] = useState(null);
    const [isLoopEnabled, setIsLoopEnabled] = useState(false);
    const [loopCount, setLoopCount] = useState(0);
    const [maxLoops, setMaxLoops] = useState(0); // 0 = 無限循環

    // 選取模式狀態
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionMode, setSelectionMode] = useState(null); // 'start' | 'end'

    // Refs
    const callbackRef = useRef({ onLoopStart, onLoopEnd });
    callbackRef.current = { onLoopStart, onLoopEnd };

    /**
     * 檢查是否有有效的循環段落
     */
    const hasValidLoop = loopStart !== null && loopEnd !== null && loopStart < loopEnd;

    /**
     * 檢查索引是否在循環範圍內
     */
    const isInLoop = useCallback((index) => {
        if (!hasValidLoop) return true; // 無循環時全部有效
        return index >= loopStart && index <= loopEnd;
    }, [hasValidLoop, loopStart, loopEnd]);

    /**
     * 設定循環起點
     */
    const setStart = useCallback((index) => {
        if (index < 0 || index >= totalNotes) return;
        setLoopStart(index);
        if (loopEnd !== null && index >= loopEnd) {
            setLoopEnd(null);
        }
        setLoopCount(0);
    }, [totalNotes, loopEnd]);

    /**
     * 設定循環終點
     */
    const setEnd = useCallback((index) => {
        if (index < 0 || index >= totalNotes) return;
        setLoopEnd(index);
        if (loopStart !== null && index <= loopStart) {
            setLoopStart(null);
        }
        setLoopCount(0);
    }, [totalNotes, loopStart]);

    /**
     * 開始選取模式
     */
    const startSelecting = useCallback((mode) => {
        setIsSelecting(true);
        setSelectionMode(mode);
    }, []);

    /**
     * 結束選取模式
     */
    const stopSelecting = useCallback(() => {
        setIsSelecting(false);
        setSelectionMode(null);
    }, []);

    /**
     * 處理音符點擊（在選取模式下）
     */
    const handleNoteClick = useCallback((index) => {
        if (!isSelecting) return false;

        if (selectionMode === 'start') {
            setStart(index);
        } else if (selectionMode === 'end') {
            setEnd(index);
        }

        stopSelecting();
        return true;
    }, [isSelecting, selectionMode, setStart, setEnd, stopSelecting]);

    /**
     * 清除循環段落
     */
    const clearLoop = useCallback(() => {
        setLoopStart(null);
        setLoopEnd(null);
        setLoopCount(0);
        setIsLoopEnabled(false);
        stopSelecting();
    }, [stopSelecting]);

    /**
     * 切換循環啟用狀態
     */
    const toggleLoop = useCallback(() => {
        if (!hasValidLoop) return;
        setIsLoopEnabled(prev => !prev);
        setLoopCount(0);
    }, [hasValidLoop]);

    /**
     * 檢查並處理循環（當播放到達終點時調用）
     * @param {number} currentIndex - 當前播放索引
     * @returns {{ shouldLoop: boolean, nextIndex: number }} 是否應該循環及下一個索引
     */
    const checkLoop = useCallback((currentIndex) => {
        if (!isLoopEnabled || !hasValidLoop) {
            return { shouldLoop: false, nextIndex: currentIndex + 1 };
        }

        if (currentIndex >= loopEnd) {
            // 到達終點，檢查是否繼續循環
            const newCount = loopCount + 1;

            if (maxLoops > 0 && newCount >= maxLoops) {
                // 達到最大循環次數
                callbackRef.current.onLoopEnd?.();
                return { shouldLoop: false, nextIndex: loopEnd + 1 };
            }

            setLoopCount(newCount);
            callbackRef.current.onLoopStart?.();
            return { shouldLoop: true, nextIndex: loopStart };
        }

        return { shouldLoop: false, nextIndex: currentIndex + 1 };
    }, [isLoopEnabled, hasValidLoop, loopStart, loopEnd, loopCount, maxLoops]);

    /**
     * 取得循環範圍內的音符數量
     */
    const loopLength = hasValidLoop ? loopEnd - loopStart + 1 : 0;

    /**
     * 快速設定常用循環長度
     */
    const setLoopByBars = useCallback((bars, notesPerBar = 4) => {
        if (loopStart === null) return;
        const length = bars * notesPerBar;
        const end = Math.min(loopStart + length - 1, totalNotes - 1);
        setEnd(end);
    }, [loopStart, totalNotes, setEnd]);

    return {
        // 狀態
        loopStart,
        loopEnd,
        isLoopEnabled,
        loopCount,
        maxLoops,
        hasValidLoop,
        loopLength,

        // 選取模式
        isSelecting,
        selectionMode,

        // 方法
        setStart,
        setEnd,
        setLoopStart,
        setLoopEnd,
        setMaxLoops,
        startSelecting,
        stopSelecting,
        handleNoteClick,
        clearLoop,
        toggleLoop,
        checkLoop,
        isInLoop,
        setLoopByBars
    };
}

export default useLoopSection;
