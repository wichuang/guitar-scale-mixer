import { useRef, useCallback, useState, useEffect } from 'react';
import Soundfont from 'soundfont-player';

// Available guitar instruments from the soundfont
export const GUITAR_INSTRUMENTS = {
    'acoustic_guitar_nylon': 'Acoustic Nylon',
    'acoustic_guitar_steel': 'Acoustic Steel',
    'electric_guitar_clean': 'Electric Clean',
    'electric_guitar_muted': 'Electric Muted',
    'electric_guitar_jazz': 'Electric Jazz',
    'overdriven_guitar': 'Overdriven',
    'distortion_guitar': 'Distortion',
};

// Shared audio context and instruments cache
let sharedAudioContext = null;
let audioUnlocked = false;
const instrumentsCache = {};

function getAudioContext() {
    if (!sharedAudioContext) {
        sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return sharedAudioContext;
}

/**
 * iOS/iPadOS 音頻解鎖
 * 多種策略並用：AudioContext resume + 靜音 buffer + HTML5 Audio
 */
function unlockAudio() {
    if (audioUnlocked) return;

    // 1. 建立並 resume AudioContext
    const ac = getAudioContext();
    if (ac.state === 'suspended') {
        ac.resume();
    }

    // 2. 播放靜音 Web Audio buffer
    try {
        const buf = ac.createBuffer(1, 1, 22050);
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start(0);
    } catch (e) { /* ignore */ }

    // 3. HTML5 Audio 播放靜音（iOS 上更可靠的解鎖方式）
    try {
        const audio = new Audio();
        audio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+M4wAAAAAAAAAAAAEluZm8AAAAPAAAAAgAAAbAAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAbD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/+M4wAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/jOMAAABIASoAAAABMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
        audio.volume = 0.01;
        audio.play().catch(() => {});
    } catch (e) { /* ignore */ }

    audioUnlocked = true;
}

async function loadInstrumentIfNeeded(name) {
    if (instrumentsCache[name]) {
        return instrumentsCache[name];
    }

    const ac = getAudioContext();
    // 確保 context 是 running 才能 decode audio
    if (ac.state === 'suspended') {
        await ac.resume();
    }
    const instrument = await Soundfont.instrument(ac, name, {
        soundfont: 'MusyngKite',
        format: 'mp3',
    });
    instrumentsCache[name] = instrument;
    return instrument;
}

// iOS/iPadOS: 在第一次用戶觸碰時解鎖音頻
// 使用 touchend + click 雙監聽，capture phase
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const events = ['touchstart', 'touchend', 'click', 'keydown'];
    const onFirstInteraction = () => {
        unlockAudio();
        events.forEach(evt => document.removeEventListener(evt, onFirstInteraction, true));
    };
    // 延遲註冊確保 DOM 就緒
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            events.forEach(evt => document.addEventListener(evt, onFirstInteraction, true));
        });
    } else {
        events.forEach(evt => document.addEventListener(evt, onFirstInteraction, true));
    }
}

export function useAudio(instrumentName = 'acoustic_guitar_nylon') {
    const [isLoading, setIsLoading] = useState(false);
    const instrumentRef = useRef(null);
    const currentNameRef = useRef(instrumentName);
    const loadingPromiseRef = useRef(null);

    // Load instrument on demand
    const ensureLoaded = useCallback(async () => {
        const name = currentNameRef.current;
        if (instrumentRef.current && instrumentsCache[name]) {
            return instrumentRef.current;
        }
        if (loadingPromiseRef.current) {
            return loadingPromiseRef.current;
        }
        setIsLoading(true);
        loadingPromiseRef.current = loadInstrumentIfNeeded(name)
            .then(instrument => {
                instrumentRef.current = instrument;
                setIsLoading(false);
                loadingPromiseRef.current = null;
                return instrument;
            })
            .catch(error => {
                console.error('Failed to load instrument:', error);
                setIsLoading(false);
                loadingPromiseRef.current = null;
                return null;
            });
        return loadingPromiseRef.current;
    }, []);

    // When instrument name changes, clear cached ref
    useEffect(() => {
        if (instrumentName !== currentNameRef.current) {
            currentNameRef.current = instrumentName;
            instrumentRef.current = instrumentsCache[instrumentName] || null;
            loadingPromiseRef.current = null;
        }
    }, [instrumentName]);

    const midiToNoteName = useCallback((midiNote) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }, []);

    // Play a note（同步呼叫，從 timer 觸發時不在用戶手勢中）
    const playNote = useCallback((midiNote, stringIndex = 2, options = {}) => {
        if (!instrumentRef.current) {
            ensureLoaded();
            return;
        }

        const ac = getAudioContext();
        if (ac.state === 'suspended') {
            ac.resume();
        }

        const noteName = midiToNoteName(midiNote);
        const gain = options.gain || 0.8;

        try {
            instrumentRef.current.play(noteName, ac.currentTime, {
                duration: options.duration || 2,
                gain: gain,
            });
        } catch (err) {
            console.error('Error playing note:', err);
        }
    }, [midiToNoteName, ensureLoaded]);

    const playNoteByName = useCallback((noteName) => {
        const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIdx = NOTES.indexOf(noteName);
        if (noteIdx !== -1) {
            playNote(60 + noteIdx, 2);
        }
    }, [playNote]);

    // resumeAudio — 從用戶手勢呼叫，同步解鎖 + 非同步載入音色
    const resumeAudio = useCallback(async () => {
        // 同步解鎖（必須在 await 之前）
        unlockAudio();
        // 確保 AudioContext 是 running
        const ac = getAudioContext();
        if (ac.state === 'suspended') {
            await ac.resume();
        }
        // 載入音色
        await ensureLoaded();
        return ac;
    }, [ensureLoaded]);

    return {
        playNote,
        playNoteByName,
        resumeAudio,
        isLoading,
        instruments: GUITAR_INSTRUMENTS
    };
}
