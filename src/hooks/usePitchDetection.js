import { useState, useRef, useCallback, useEffect } from 'react';

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
// 8192 取樣 @44.1kHz ≈ 186ms，低音 E(82Hz) 有 ~15 個週期，
// 自相關才有足夠資料把弱基頻的低音粗弦穩定抓出來。
const FFT_SIZE = 8192;
const FREQ_WINDOW = 5;        // 頻率中位數視窗（幀數）
const MIN_STABLE = 2;         // 視窗至少這麼多筆才開始輸出（低音衰減快，門檻放低才來得及顯示）
const HISTORY_STABLE = 5;     // 同一個音要連續穩定這麼多幀才寫入歷史（越大越能濾掉多餘/瞬間的音）
const MIN_NOTE_GAP_MS = 110;  // 兩筆紀錄至少間隔這麼久（擋掉半音邊界來回跳造成的重複/多餘音）
// 低音粗弦的基頻常被麥克風高通衰減，RMS 偏低；門檻太高會把它整個擋掉。
// NSDF 的 CLARITY_GATE 才是真正的「是否有穩定音高」判斷，RMS 只擋全靜音。
const RMS_GATE = 0.004;       // 訊號門檻（放低讓較弱的低音弦也能進入辨識）

// 吉他音域（留餘裕）：最低 ~70Hz（低音 E 82Hz 之下），最高 ~1320Hz
const MIN_FREQ = 70;
const MAX_FREQ = 1320;
const CLARITY_GATE = 0.30;    // 全域 NSDF 峰值低於此 → 視為無穩定音高（低音弦峰值較低，放寬）
const PEAK_PICK_K = 0.88;     // 選第一個 >= k×全域峰 的關鍵峰（抗八度誤判的核心）

/**
 * 以正規化平方差自相關 (NSDF) + McLeod 取峰法估計基頻。
 * 比 YIN 更適合吉他低音粗弦：諧波會在「基頻週期」的整數倍互相增強，
 * 即使基頻本身很弱（或被麥克風高通濾掉）也能從諧波還原出真正的週期；
 * 取「第一個」足夠高的關鍵峰 → 自然鎖定最短真實週期，不會誤判到八度。
 * @param {Float32Array} buffer 時域取樣
 * @param {number} sampleRate
 * @returns {number|null} 頻率 (Hz)，無法判定回 null
 */
function detectPitchAC(buffer, sampleRate) {
    const n = buffer.length;
    const maxLag = Math.min(n - 1, Math.ceil(sampleRate / MIN_FREQ));
    const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQ));

    // NSDF: n(tau) = 2·Σ x[i]x[i+tau] / Σ(x[i]²+x[i+tau]²)，值域 [-1, 1]
    const nsdf = new Float32Array(maxLag + 1);
    for (let tau = 0; tau <= maxLag; tau++) {
        let acf = 0, energy = 0;
        for (let i = 0; i + tau < n; i++) {
            const a = buffer[i], b = buffer[i + tau];
            acf += a * b;
            energy += a * a + b * b;
        }
        nsdf[tau] = energy > 0 ? (2 * acf) / energy : 0;
    }

    // 收集「關鍵峰」：跳過 tau=0 附近的初始正向大瓣，之後每段正值區間取區域最大
    const peaks = [];
    let tau = 1;
    while (tau <= maxLag && nsdf[tau] > 0) tau++;   // 跳過初始大瓣直到首次轉負
    while (tau <= maxLag) {
        if (nsdf[tau] > 0) {
            let localMax = tau;
            while (tau <= maxLag && nsdf[tau] > 0) {
                if (nsdf[tau] > nsdf[localMax]) localMax = tau;
                tau++;
            }
            if (localMax >= minLag) peaks.push(localMax);
        } else {
            tau++;
        }
    }
    if (peaks.length === 0) return null;

    let globalMax = 0;
    for (const p of peaks) if (nsdf[p] > globalMax) globalMax = nsdf[p];
    if (globalMax < CLARITY_GATE) return null;       // 訊號太不週期 → 無音高

    // 取第一個越過門檻的峰（= 最短真實週期 → 正確八度）
    const cutoff = globalMax * PEAK_PICK_K;
    let chosen = peaks[0];
    for (const p of peaks) {
        if (nsdf[p] >= cutoff) { chosen = p; break; }
    }

    // 拋物線插值微調 tau（子取樣精度，高音也準）
    let betterTau = chosen;
    if (chosen > minLag && chosen < maxLag) {
        const s0 = nsdf[chosen - 1], s1 = nsdf[chosen], s2 = nsdf[chosen + 1];
        const denom = 2 * (2 * s1 - s2 - s0);
        if (denom !== 0) betterTau = chosen + (s2 - s0) / denom;
    }
    return sampleRate / betterTau;
}

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
    // 寫入歷史的「待確認音」與其連續穩定幀數（過濾撥弦攻擊瞬間的誤判）
    const pendingNoteRef = useRef(null);
    const pendingCountRef = useRef(0);
    const sampleRateRef = useRef(44100);
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

    // Pitch detection loop（NSDF 自相關 + 中位數平滑 + 一致性閘門）
    const detectPitch = useCallback(() => {
        if (!analyserRef.current) return;

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

        // 訊號太弱 → 清空狀態。同時清掉 lastNoteRef，
        // 讓「放開後再彈同一個音」能被當成新音記錄（而非被去重擋掉）。
        if (rms <= RMS_GATE) {
            freqWindowRef.current = [];
            lastStableFreqRef.current = null;
            lastNoteRef.current = null;
            pendingNoteRef.current = null;
            pendingCountRef.current = 0;
            setDetectedNote(null);
            setDetectedOctave(null);
            setDetectedFrequency(null);
            setCentsDeviation(0);
            setConfidence(0);
            rafIdRef.current = requestAnimationFrame(detectPitch);
            return;
        }

        const frequency = detectPitchAC(buffer, sampleRateRef.current);

        // 吉他音域：低音E(82Hz) ~ 高把位(~1100Hz)，留點餘裕。
        // NSDF 取峰法本身已鎖定正確八度，不需再做相對於前一音的八度修正
        //（否則使用者真的換八度時會被錯誤地拉回原八度）。
        if (frequency && frequency > MIN_FREQ && frequency < MAX_FREQ) {
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

                    // 寫入歷史前先確認此音已連續穩定數幀，過濾撥弦攻擊瞬間
                    // 的非週期雜訊造成的鄰近音誤判（如彈 C5 先閃出 C#5）。
                    if (noteWithOctave === pendingNoteRef.current) {
                        pendingCountRef.current++;
                    } else {
                        pendingNoteRef.current = noteWithOctave;
                        pendingCountRef.current = 1;
                    }

                    // 只有「音改變且已穩定」才記錄一筆；持續按住同一個音不會重複塞滿。
                    // 放開讓訊號掉到靜音門檻後，lastNoteRef 會被清空，
                    // 因此重新彈同一個音仍會記成新的一筆。
                    const now = Date.now();
                    if (pendingCountRef.current >= HISTORY_STABLE
                        && noteWithOctave !== lastNoteRef.current
                        && now - lastNoteTimeRef.current >= MIN_NOTE_GAP_MS) {
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
        sampleRateRef.current = audioContextRef.current.sampleRate;

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
        lastNoteRef.current = null;
        pendingNoteRef.current = null;
        pendingCountRef.current = 0;
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
