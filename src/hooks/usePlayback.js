/**
 * usePlayback - 播放邏輯 Hook
 * 封裝播放狀態、count-in、節拍追蹤和重音邏輯
 * 支援音符時值（duration）、附點、三連音
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { STRING_TUNINGS } from '../data/scaleData.js';

/**
 * 音符時值對應的拍數 (quarter = 1 beat)
 */
const DURATION_BEATS = {
    'whole': 4,
    'half': 2,
    'quarter': 1,
    'eighth': 0.5,
    '16th': 0.25,
    '32nd': 0.125,
    '64th': 0.0625
};

/**
 * 計算音符實際拍數
 * @param {string} duration - 時值名稱
 * @param {number} dotted - 附點數量 (0, 1, 2)
 * @param {Object|null} tuplet - 連音符 { num, den }
 * @returns {number} 拍數
 */
function getDurationBeats(duration, dotted = 0, tuplet = null) {
    let beats = DURATION_BEATS[duration] ?? 1;

    // 附點: 第一個附點加 50%, 第二個附點再加 25%
    if (dotted >= 1) beats *= 1.5;
    if (dotted >= 2) beats *= 1.25;

    // 三連音等連音符
    if (tuplet && tuplet.num && tuplet.den) {
        beats *= tuplet.den / tuplet.num;
    }

    return beats;
}

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
 * @param {Object} options.loopSection - Loop Section Hook 實例
 * @returns {Object}
 */
export function usePlayback({
    notes = [],
    notePositions = [],
    tempo = 120,
    timeSignature = '4/4',
    playNote,
    audioLoading = false,
    resumeAudio,
    loopSection = null
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
    const [playTime, setPlayTime] = useState(0);
    const [enableCountIn, setEnableCountIn] = useState(true);
    const [countInStatus, setCountInStatus] = useState('');

    const playTimeoutRef = useRef(null);
    const beatCounterRef = useRef(0);
    const lastNoteIndexRef = useRef(-1);
    const loopSectionRef = useRef(loopSection);
    loopSectionRef.current = loopSection;

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
        if (!audioLoading && playNote) {
            const targetMidi = note.midiNote ?? note.midi ?? (pos && pos.midi);
            if (targetMidi) {
                playNote(targetMidi, pos ? pos.string : 2);
            }
        }
    }, [notes, notePositions, audioLoading, playNote]);

    /**
     * 播放邏輯 Effect
     */
    useEffect(() => {
        if (!isPlaying || currentNoteIndex < 0 || currentNoteIndex >= notes.length) {
            if (currentNoteIndex >= notes.length) {
                // 檢查 loop section
                const ls = loopSectionRef.current;
                if (ls && ls.hasValidLoop && ls.isLoopEnabled) {
                    const result = ls.checkLoop(currentNoteIndex);
                    if (result && result.shouldLoop) {
                        setCurrentNoteIndex(result.nextIndex);
                        return;
                    }
                }
                setIsPlaying(false);
                setCurrentNoteIndex(-1);
                setPlayTime(0);
                beatCounterRef.current = 0;
            }
            return;
        }

        lastNoteIndexRef.current = currentNoteIndex;

        // Skip all consecutive separators and symbols in one setState call
        let idx = currentNoteIndex;
        while (idx < notes.length) {
            const n = notes[idx];
            if (n.isSeparator || n._type === 'separator') {
                beatCounterRef.current = 0;
                idx++;
            } else if (n.isSymbol || n._type === 'symbol') {
                idx++;
            } else {
                break;
            }
        }
        if (idx !== currentNoteIndex) {
            if (idx >= notes.length) {
                const ls = loopSectionRef.current;
                if (ls && ls.hasValidLoop && ls.isLoopEnabled) {
                    const result = ls.checkLoop(idx);
                    if (result && result.shouldLoop) {
                        setCurrentNoteIndex(result.nextIndex);
                        return;
                    }
                }
                setIsPlaying(false);
                setCurrentNoteIndex(-1);
                setPlayTime(0);
                beatCounterRef.current = 0;
            } else {
                setCurrentNoteIndex(idx);
            }
            return;
        }

        const note = notes[currentNoteIndex];
        const pos = notePositions[currentNoteIndex];

        // 使用音符自帶的 beatTempo（GP 檔案中段速度變更）或全域 tempo
        const effectiveTempo = note.beatTempo || tempo;

        // 計算基礎 interval（一拍的時間，毫秒）
        const beatInterval = (60 / effectiveTempo) * 1000;

        // 計算此音符的實際時值拍數
        const durationBeats = getDurationBeats(
            note.duration || 'quarter',
            note.dotted || 0,
            note.tuplet || null
        );

        // 此音符的實際播放時間
        const noteInterval = beatInterval * durationBeats;

        // Determine Accent
        const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;
        const isAccent = beatCounterRef.current % beatsPerBar === 0;

        // 播放音符（休止符、延長符、延音結束音不發聲，但佔時間）
        const isRest = note.isRest || note._type === 'rest';
        const isExtension = note.isExtension || note._type === 'extension';
        const isTieEnd = note.tieEnd;

        if (!isRest && !isExtension && !isTieEnd && !audioLoading && playNote) {
            // 使用音符本身的 MIDI 值播放（不受 3NPS 指板定位的八度偏移影響）
            const targetMidi = note.midiNote ?? note.midi ?? (pos && pos.midi);
            if (targetMidi) {
                // 延音線 (tie)：計算延長的持續時間（自身 + 後續所有 tieEnd 音符的拍數）
                let tieDurationSec = noteInterval / 1000;
                if (note.tieStart) {
                    let ti = currentNoteIndex + 1;
                    while (ti < notes.length) {
                        const tn = notes[ti];
                        if (tn.tieEnd) {
                            const tBeats = getDurationBeats(tn.duration || 'quarter', tn.dotted || 0, tn.tuplet || null);
                            const tTempo = tn.beatTempo || effectiveTempo;
                            tieDurationSec += (60 / tTempo) * tBeats;
                            ti++;
                        } else {
                            break;
                        }
                    }
                }
                playNote(targetMidi, pos ? pos.string : 2, {
                    gain: isAccent ? 1.3 : 0.7,
                    duration: tieDurationSec
                });
            }
        }

        // 和弦處理：同一 beat 的後續和弦音同時發聲，不佔額外時間
        let chordSkip = 0;
        if (note.isChord) {
            let ci = currentNoteIndex + 1;
            while (ci < notes.length && notes[ci].isChord && notes[ci].chordPosition > 0) {
                const chordNote = notes[ci];
                const chordPos = notePositions[ci];
                if (!audioLoading && playNote) {
                    const chordMidi = chordNote.midiNote ?? chordNote.midi ?? (chordPos && chordPos.midi);
                    if (chordMidi) {
                        playNote(chordMidi, chordPos ? chordPos.string : 2, { gain: isAccent ? 1.3 : 0.7 });
                    }
                }
                chordSkip++;
                ci++;
            }
        }

        beatCounterRef.current += durationBeats;

        playTimeoutRef.current = setTimeout(() => {
            const nextIndex = currentNoteIndex + 1 + chordSkip;

            // Loop section 檢查 (透過 ref 取得最新值)
            const ls = loopSectionRef.current;
            if (ls && ls.hasValidLoop && ls.isLoopEnabled) {
                if (nextIndex > ls.loopEnd) {
                    const result = ls.checkLoop(nextIndex);
                    if (result && result.shouldLoop) {
                        beatCounterRef.current = 0;
                        setCurrentNoteIndex(result.nextIndex);
                        setPlayTime(prev => prev + (noteInterval / 1000));
                        return;
                    }
                }
            }

            setCurrentNoteIndex(nextIndex);
            setPlayTime(prev => prev + (noteInterval / 1000));
        }, noteInterval);

        return () => {
            if (playTimeoutRef.current) {
                clearTimeout(playTimeoutRef.current);
            }
        };
    // loopSection 透過 ref 存取，不放入 dependency array 避免不必要的 re-run
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
