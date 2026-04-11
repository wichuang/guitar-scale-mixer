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
 * iOS/iPadOS 音頻解鎖 — 必須在用戶手勢的同步階段呼叫
 * 建立 AudioContext + resume + 播放靜音 buffer 以解鎖
 */
function unlockAudioSync() {
    const ac = getAudioContext();
    if (ac.state === 'suspended') {
        ac.resume();
    }
    // 播放靜音 buffer 解鎖 iOS 音頻
    if (!audioUnlocked) {
        try {
            const buf = ac.createBuffer(1, 1, ac.sampleRate);
            const src = ac.createBufferSource();
            src.buffer = buf;
            src.connect(ac.destination);
            src.start(0);
            audioUnlocked = true;
        } catch (e) { /* ignore */ }
    }
    return ac;
}

async function loadInstrumentIfNeeded(name) {
    if (instrumentsCache[name]) {
        return instrumentsCache[name];
    }

    const ac = getAudioContext();
    const instrument = await Soundfont.instrument(ac, name, {
        soundfont: 'MusyngKite',
        format: 'mp3',
    });
    instrumentsCache[name] = instrument;
    return instrument;
}

// iOS/iPadOS: 在第一次用戶觸碰時解鎖音頻
if (typeof window !== 'undefined') {
    const onFirstTouch = () => {
        unlockAudioSync();
        document.removeEventListener('touchstart', onFirstTouch, true);
        document.removeEventListener('click', onFirstTouch, true);
    };
    document.addEventListener('touchstart', onFirstTouch, true);
    document.addEventListener('click', onFirstTouch, true);
}

export function useAudio(instrumentName = 'acoustic_guitar_nylon') {
    const [isLoading, setIsLoading] = useState(false);
    const instrumentRef = useRef(null);
    const currentNameRef = useRef(instrumentName);
    const loadingPromiseRef = useRef(null);

    // Load instrument on demand (called from user gesture context)
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

    // When instrument name changes, clear cached ref so next play triggers reload
    useEffect(() => {
        if (instrumentName !== currentNameRef.current) {
            currentNameRef.current = instrumentName;
            instrumentRef.current = instrumentsCache[instrumentName] || null;
            loadingPromiseRef.current = null;
        }
    }, [instrumentName]);

    // Convert MIDI note number to note name
    const midiToNoteName = useCallback((midiNote) => {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }, []);

    // Play a note（同步，不做 await — 從 timer 呼叫時不在用戶手勢中）
    const playNote = useCallback((midiNote, stringIndex = 2, options = {}) => {
        const ac = getAudioContext();

        if (!instrumentRef.current) {
            // 音色尚未載入，觸發載入（下次播放才有聲音）
            ensureLoaded();
            return;
        }

        // iOS: 如果 context 還是 suspended，嘗試 resume（可能無效但不影響）
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

    // Play note by name (at middle octave)
    const playNoteByName = useCallback((noteName) => {
        const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteIdx = NOTES.indexOf(noteName);
        if (noteIdx !== -1) {
            const midiNote = 60 + noteIdx; // Middle C octave
            playNote(midiNote, 2);
        }
    }, [playNote]);

    const resumeAudio = useCallback(async () => {
        // 同步解鎖音頻（必須在用戶手勢的同步階段，不能在 await 之後）
        unlockAudioSync();
        // 之後才非同步載入音色
        await ensureLoaded();
        return getAudioContext();
    }, [ensureLoaded]);

    return {
        playNote,
        playNoteByName,
        resumeAudio,
        isLoading,
        instruments: GUITAR_INSTRUMENTS
    };
}
