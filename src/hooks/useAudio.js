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

    // Play a note
    const playNote = useCallback((midiNote, stringIndex = 2, options = {}) => {
        const ac = getAudioContext();

        if (!instrumentRef.current) {
            // Trigger lazy load on first play (user gesture context)
            ensureLoaded();
            return;
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
        // Ensure instrument is loaded (called from user gesture context)
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
