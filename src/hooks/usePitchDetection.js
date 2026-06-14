import { useState, useRef, useCallback, useEffect } from 'react';
import Pitchfinder from 'pitchfinder';

// Note frequencies (A4 = 440Hz standard tuning)
const A4 = 440;
const A4_MIDI = 69;

// Convert MIDI to note name
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[midi % 12];
}

// Get octave from MIDI note
function midiToOctave(midi) {
    return Math.floor(midi / 12) - 1;
}

// 兩個頻率相差多少 cents（用於一致性判斷）
function centsBetween(f1, f2) {
    return Math.abs(1200 * Math.log2(f1 / f2));
}

// 中位數（對單幀八度誤判 / 雜訊很穩健）
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 分析參數
const FFT_SIZE = 4096;        // ~93ms @44.1kHz，低音弦也有足夠週期數
const FREQ_WINDOW = 5;        // 頻率中位數視窗（幀數）
const MIN_STABLE = 3;         // 視窗至少這麼多筆才開始輸出
const RMS_GATE = 0.01;        // 訊號門檻

export function usePitchDetection() {
    const [isListening, setIsListening] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [detectedNote, setDetectedNote] = useState(null);
    const [detectedOctave, setDetectedOctave] = useState(null);
    const [detectedFrequency, setDetectedFrequency] = useState(null);
    const [centsDeviation, setCentsDeviation] = useState(0);
    const [volume, setVolume] = useState(0);
    const [noteHistory, setNoteHistory] = useState([]);
    const [confidence, setConfidence] = useState(0);

    const [inputSource, setInputSource] = useState('mic'); // 'mic' | 'tab'

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const rafIdRef = useRef(null);
    const lastNoteRef = useRef(null);
    const lastNoteTimeRef = useRef(0);
    const detectPitchFnRef = useRef(null);
    const stopListeningRef = useRef(null);

    // 預配置的時域 buffer（避免每幀 new Float32Array 造成 GC 抖動）
    const bufferRef = useRef(null);
    // 最近幾幀的原始頻率，做中位數平滑
    const freqWindowRef = useRef([]);
    // 上一個穩定頻率，用於八度跳變修正
    const lastStableFreqRef = useRef(null);

    // Get available audio input devices
    // requestPermission=true 才會跳出麥克風權限對話框並取得 device labels；
    // 預設 false（app 啟動時不打擾使用者，等真的開始聆聽時才 request）
    const refreshDevices = useCallback(async (requestPermission = false) => {
        try {
            let tempStream = null;
            if (requestPermission) {
                tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
            setDevices(audioInputs);

            if (!selectedDevice && audioInputs.length > 0) {
                setSelectedDevice(audioInputs[0].deviceId);
            }

            if (tempStream) {
                tempStream.getTracks().forEach(track => track.stop());
            }
        } catch (err) {
            console.error('Failed to get devices:', err);
        }
    }, [selectedDevice]);

    // 啟動時只 enumerate（不 request 麥克風權限）；labels 會是空的，這 OK，
    // 真正開始聆聽 (startListening) 取得權限後才會看到名稱。
    useEffect(() => {
        refreshDevices(false);
    }, [refreshDevices]);

    // Pitch detection loop using YIN algorithm
    const detectPitch = useCallback(() => {
        if (!analyserRef.current || !detectPitchFnRef.current) return;

        const analyser = analyserRef.current;
        const buffer = bufferRef.current;
        if (!buffer) { rafIdRef.current = requestAnimationFrame(detectPitch); return; }
        analyser.getFloatTimeDomainData(buffer);

        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        setVolume(Math.min(1, rms * 8));

        // 訊號太弱 → 清空狀態
        if (rms <= RMS_GATE) {
            freqWindowRef.current = [];
            lastStableFreqRef.current = null;
            setDetectedNote(null);
            setDetectedOctave(null);
            setDetectedFrequency(null);
            setCentsDeviation(0);
            setConfidence(0);
            rafIdRef.current = requestAnimationFrame(detectPitch);
            return;
        }

        let frequency = detectPitchFnRef.current(buffer);

        // 吉他音域：低音E(82Hz) ~ 高把位(~1100Hz)，留點餘裕
        if (frequency && frequency > 60 && frequency < 1320) {
            // 八度跳變修正：YIN 在低音弦常誤判到上/下八度的諧波。
            // 若新頻率約為上一穩定頻率的 2x 或 0.5x，snap 回原八度。
            const stable = lastStableFreqRef.current;
            if (stable) {
                if (centsBetween(frequency / 2, stable) < 50) frequency /= 2;
                else if (centsBetween(frequency * 2, stable) < 50) frequency *= 2;
            }

            // 推入頻率視窗做中位數平滑
            const win = freqWindowRef.current;
            win.push(frequency);
            if (win.length > FREQ_WINDOW) win.shift();

            if (win.length >= MIN_STABLE) {
                const medFreq = median(win);
                // 一致性閘門：視窗內所有值都在中位數 ±半音內才輸出，
                // 否則代表正在換音/不穩，先不更新（避免顯示垃圾音）
                const converged = win.every(f => centsBetween(f, medFreq) < 50);

                if (converged) {
                    const midiFloat = 12 * Math.log2(medFreq / A4) + A4_MIDI;
                    const midi = Math.round(midiFloat);
                    const noteName = midiToNoteName(midi);
                    const octave = midiToOctave(midi);
                    const cents = Math.round((midiFloat - midi) * 100);
                    const noteWithOctave = `${noteName}${octave}`;

                    lastStableFreqRef.current = medFreq;

                    setDetectedFrequency(Math.round(medFreq));
                    setDetectedNote(noteName);
                    setDetectedOctave(octave);
                    setCentsDeviation(cents);
                    setConfidence(Math.max(0, 1 - Math.abs(cents) / 50));

                    // Add to history with debounce
                    const now = Date.now();
                    if (noteWithOctave !== lastNoteRef.current || now - lastNoteTimeRef.current > 350) {
                        lastNoteRef.current = noteWithOctave;
                        lastNoteTimeRef.current = now;
                        setNoteHistory(prev => [{
                            note: noteName,
                            octave,
                            fullNote: noteWithOctave,
                            time: now,
                            freq: Math.round(medFreq)
                        }, ...prev].slice(0, 20));
                    }
                }
            }
        }

        rafIdRef.current = requestAnimationFrame(detectPitch);
    }, []);

    // 共用：把任意 MediaStream 接到 analyser 並開始辨識（mic 與 tab 音訊共用）
    const beginDetection = useCallback((stream) => {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioContextRef.current.sampleRate;

        // Initialize YIN detector with correct sample rate
        detectPitchFnRef.current = Pitchfinder.YIN({
            sampleRate: sampleRate,
            threshold: 0.1,  // Lower = more sensitive, higher = more accurate
        });

        streamRef.current = stream;

        // 若使用者從瀏覽器分享列停止分享，audio track 會 ended → 自動停止辨識
        stream.getAudioTracks().forEach(track => {
            track.addEventListener('ended', () => stopListeningRef.current?.());
        });

        // Use larger FFT for better low-frequency resolution
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = FFT_SIZE;
        analyserRef.current.smoothingTimeConstant = 0;

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        // Reset buffers
        bufferRef.current = new Float32Array(FFT_SIZE);
        freqWindowRef.current = [];
        lastStableFreqRef.current = null;

        setIsListening(true);
        rafIdRef.current = requestAnimationFrame(detectPitch);
    }, [detectPitch]);

    // Start listening from microphone
    const startListening = useCallback(async () => {
        try {
            const constraints = {
                audio: {
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // 取得權限後重新 enumerate 一次，讓裝置清單帶上 labels
            try {
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
                setDevices(audioInputs);
            } catch { /* ignore */ }

            beginDetection(stream);
        } catch (err) {
            console.error('Failed to start listening:', err);
        }
    }, [selectedDevice, beginDetection]);

    // Start listening from a captured tab / system audio stream (getDisplayMedia)
    // 用於 YouTube：使用者在本分頁播放影片，分享「本分頁 + 分頁音訊」後，
    // 整個分頁(含 YouTube iframe)的聲音就會進到 analyser 做音高辨識。
    // throws 'NO_AUDIO' 若使用者沒有勾選分享音訊；throws 'CANCELLED' 若取消。
    const startListeningFromTab = useCallback(async () => {
        let stream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,           // 多數瀏覽器要求一定要有 video track
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
        } catch (err) {
            // 使用者按取消 / 沒授權
            throw Object.assign(new Error('CANCELLED'), { cause: err });
        }

        if (stream.getAudioTracks().length === 0) {
            // 使用者沒有勾選「分享分頁音訊 / 系統音訊」
            stream.getTracks().forEach(t => t.stop());
            throw new Error('NO_AUDIO');
        }

        // 不需要畫面，停掉 video track 省資源（audio track 不受影響）
        stream.getVideoTracks().forEach(t => t.stop());

        beginDetection(stream);
    }, [beginDetection]);

    // Stop listening
    const stopListening = useCallback(() => {
        if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
        }

        freqWindowRef.current = [];
        lastStableFreqRef.current = null;
        bufferRef.current = null;
        detectPitchFnRef.current = null;
        setIsListening(false);
        setDetectedNote(null);
        setDetectedOctave(null);
        setDetectedFrequency(null);
        setCentsDeviation(0);
        setVolume(0);
        setConfidence(0);
    }, []);

    // 讓 track 'ended' 事件能呼叫到最新的 stopListening
    useEffect(() => {
        stopListeningRef.current = stopListening;
    }, [stopListening]);

    useEffect(() => {
        return () => {
            stopListening();
        };
    }, [stopListening]);

    const clearHistory = useCallback(() => {
        setNoteHistory([]);
    }, []);

    return {
        isListening,
        devices,
        selectedDevice,
        setSelectedDevice,
        detectedNote,
        detectedOctave,
        detectedFrequency,
        centsDeviation,
        volume,
        confidence,
        noteHistory,
        inputSource,
        setInputSource,
        startListening,
        startListeningFromTab,
        stopListening,
        refreshDevices,
        clearHistory
    };
}
