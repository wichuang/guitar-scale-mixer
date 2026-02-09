/**
 * usePlayback - 播放邏輯 Hook
 * 封裝播放狀態、count-in、節拍追蹤和重音邏輯
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { STRING_TUNINGS } from '../data/scaleData.js';

/**
 * 播放 Click 聲音
 * @param {boolean} high - 是否為高音
 */
const playClickSound = (high = false) => {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.frequency.value = high ? 1500 : 1000;
    gain.gain.value = 0.5;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    osc.start();
    osc.stop(ac.currentTime + 0.1);
};

/**
 * usePlayback Hook
 * @param {Object} options
 * @param {Array} options.notes - 音符陣列
 * @param {Array} options.notePositions - 音符位置陣列
 * @param {number} options.tempo - BPM
 * @param {string} options.timeSignature - 拍號 (e.g., '4/4')
 * @param {Function} options.playNote - 播放音符函數
 * @param {boolean} options.audioLoading - 音頻是否載入中
 * @param {Function} options.resumeAudio - 恢復音頻上下文
 * @returns {Object}
 */
export function usePlayback({
    notes = [],
    notePositions = [],
    tempo = 120,
    timeSignature = '4/4',
    playNote,
    audioLoading = false,
    resumeAudio
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
    const [playTime, setPlayTime] = useState(0);
    const [enableCountIn, setEnableCountIn] = useState(true);
    const [countInStatus, setCountInStatus] = useState('');

    const playTimeoutRef = useRef(null);
    const beatCounterRef = useRef(0);
    const lastNoteIndexRef = useRef(-1);

    /**
     * 開始倒數
     * @param {Function} onComplete - 倒數完成後的回調
     */
    const startCountIn = useCallback((onComplete) => {
        let beat = 4;
        setCountInStatus('Ready: ' + beat);
        playClickSound(false);

        const interval = 60000 / tempo;

        const timer = setInterval(() => {
            beat--;
            if (beat > 0) {
                setCountInStatus('Ready: ' + beat);
                playClickSound(false);
            } else {
                clearInterval(timer);
                setCountInStatus('');
                playClickSound(true); // High pitch for "Go"
                if (onComplete) onComplete();
            }
        }, interval);

        playTimeoutRef.current = timer;
    }, [tempo]);

    /**
     * 播放
     */
    const play = useCallback(async (startFromIndex = -1) => {
        if (notes.length === 0) return;

        // Resume Audio Context first
        if (resumeAudio) {
            try {
                await resumeAudio();
            } catch (e) {
                console.warn('Audio resume failed', e);
            }
        }

        setIsPlaying(true);
        const startIndex = startFromIndex >= 0 ? startFromIndex : 0;
        setCurrentNoteIndex(startIndex);
        if (startIndex === 0) setPlayTime(0);
    }, [notes, resumeAudio]);

    /**
     * 暫停
     */
    const pause = useCallback(() => {
        setIsPlaying(false);
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
    }, []);

    /**
     * 停止
     */
    const stop = useCallback(() => {
        setIsPlaying(false);
        setCurrentNoteIndex(-1);
        setPlayTime(0);
        setCountInStatus('');
        beatCounterRef.current = 0;
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
    }, []);

    /**
     * 切換播放/暫停
     */
    const togglePlay = useCallback((selectedNoteIndex = -1) => {
        if (isPlaying) {
            pause();
            setCountInStatus('');
        } else {
            if (enableCountIn && currentNoteIndex === -1) {
                startCountIn(() => play(selectedNoteIndex >= 0 ? selectedNoteIndex : 0));
            } else {
                play(selectedNoteIndex >= 0 ? selectedNoteIndex : currentNoteIndex);
            }
        }
    }, [isPlaying, enableCountIn, currentNoteIndex, pause, startCountIn, play]);

    /**
     * 點擊音符播放
     */
    const handleNoteClick = useCallback((index) => {
        setCurrentNoteIndex(index);
        beatCounterRef.current = 0;

        const note = notes[index];
        const pos = notePositions[index];
        if (pos && !audioLoading && playNote) {
            const targetMidi = pos.midi || (pos.string !== undefined ? STRING_TUNINGS[pos.string] + pos.fret : (note.midiNote ?? note.midi));
            playNote(targetMidi, pos.string);
        }
    }, [notes, notePositions, audioLoading, playNote]);

    /**
     * 播放邏輯 Effect
     */
    useEffect(() => {
        if (!isPlaying || currentNoteIndex < 0 || currentNoteIndex >= notes.length) {
            if (currentNoteIndex >= notes.length) {
                setIsPlaying(false);
                setCurrentNoteIndex(-1);
                setPlayTime(0);
                beatCounterRef.current = 0;
            }
            return;
        }

        lastNoteIndexRef.current = currentNoteIndex;

        const note = notes[currentNoteIndex];

        // Separator resets beat count (handle both Note instances and plain objects)
        if (note.isSeparator || note._type === 'separator') {
            beatCounterRef.current = 0;
            setCurrentNoteIndex(prev => prev + 1);
            return;
        }

        // Skip symbols
        if (note.isSymbol || note._type === 'symbol') {
            setCurrentNoteIndex(prev => prev + 1);
            return;
        }

        const pos = notePositions[currentNoteIndex];

        // Determine Accent
        const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;
        const isAccent = beatCounterRef.current % beatsPerBar === 0;

        if (pos && !audioLoading && playNote) {
            const targetMidi = pos.midi || (pos.string !== undefined ? STRING_TUNINGS[pos.string] + pos.fret : (note.midiNote ?? note.midi));
            playNote(targetMidi, pos.string, { gain: isAccent ? 1.3 : 0.7 });
        }

        beatCounterRef.current++;

        const interval = (60 / tempo) * 1000;
        playTimeoutRef.current = setTimeout(() => {
            setCurrentNoteIndex(prev => prev + 1);
            setPlayTime(prev => prev + (interval / 1000));
        }, interval);

        return () => {
            if (playTimeoutRef.current) {
                clearTimeout(playTimeoutRef.current);
            }
        };
    }, [isPlaying, currentNoteIndex, notes, notePositions, tempo, playNote, audioLoading, timeSignature]);

    /**
     * 格式化時間
     */
    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '0:00.00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return {
        // 狀態
        isPlaying,
        currentNoteIndex,
        playTime,
        formattedTime: formatTime(playTime),
        enableCountIn,
        countInStatus,

        // 方法
        play,
        pause,
        stop,
        togglePlay,
        handleNoteClick,
        setEnableCountIn,
        setCurrentNoteIndex,
        startCountIn,

        // Refs (for external use if needed)
        beatCounterRef
    };
}

export default usePlayback;
