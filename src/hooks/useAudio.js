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
const instrumentsCache = {};

function getAudioContext() {
    if (!sharedAudioContext) {
        sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume();
    }
    return sharedAudioContext;
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

    // Play a note — 如果音色未載入，等待載入後再播放（不靜默跳過）
    const playNote = useCallback(async (midiNote, stringIndex = 2, options = {}) => {
        const ac = getAudioContext();

        let instrument = instrumentRef.current;
        if (!instrument) {
            // 等待音色載入完成再播放
            instrument = await ensureLoaded();
            if (!instrument) return; // 載入失敗才放棄
        }

        // 確保 AudioContext 是 running（iOS 可能被 suspend）
        if (ac.state === 'suspended') {
            try { await ac.resume(); } catch (e) { /* ignore */ }
        }

        const noteName = midiToNoteName(midiNote);
        const gain = options.gain || 0.8;

        try {
            instrument.play(noteName, ac.currentTime, {
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
            playNote(60 + noteIdx, 2);
        }
    }, [playNote]);

    const resumeAudio = useCallback(async () => {
        await ensureLoaded();
        const ac = getAudioContext();
        if (ac.state === 'suspended') {
            await ac.resume();
        }
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
