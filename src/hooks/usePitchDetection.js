import { useState, useRef, useCallback, useEffect } from 'react';
import Pitchfinder from 'pitchfinder';

// Note frequencies (A4 = 440Hz standard tuning)
const A4 = 440;
const A4_MIDI = 69;

// Convert frequency to MIDI note number
function frequencyToMidi(frequency) {
    return Math.round(12 * Math.log2(frequency / A4) + A4_MIDI);
}

// Convert MIDI to note name
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return noteNames[midi % 12];
}

// Get octave from MIDI note
function midiToOctave(midi) {
    return Math.floor(midi / 12) - 1;
}

// Convert frequency to cents deviation from nearest note
function frequencyToCents(frequency) {
    const midi = 12 * Math.log2(frequency / A4) + A4_MIDI;
    const roundedMidi = Math.round(midi);
    return Math.round((midi - roundedMidi) * 100);
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

    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const rafIdRef = useRef(null);
    const lastNoteRef = useRef(null);
    const lastNoteTimeRef = useRef(0);
    const detectPitchFnRef = useRef(null);

    // Note buffer for smoothing
    const noteBufferRef = useRef([]);

    // Get available audio input devices
    const refreshDevices = useCallback(async () => {
        try {
            // We need to request permission to get labels, but we should close it immediately
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
            setDevices(audioInputs);

            if (!selectedDevice && audioInputs.length > 0) {
                setSelectedDevice(audioInputs[0].deviceId);
            }

            // Stop the temporary stream to release the microphone!
            stream.getTracks().forEach(track => track.stop());
            // Stop the temporary stream to release the microphone!
            stream.getTracks().forEach(track => track.stop());
        } catch (err) {
            console.error('Failed to get devices:', err);
        }
    }, [selectedDevice]);

    useEffect(() => {
        refreshDevices();
    }, [refreshDevices]);

    // Pitch detection loop using YIN algorithm
    const detectPitch = useCallback(() => {
        if (!analyserRef.current || !detectPitchFnRef.current) return;

        const analyser = analyserRef.current;
        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);

        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        setVolume(Math.min(1, rms * 8));

        // Only detect if there's enough signal
        if (rms > 0.015) {
            // Use YIN algorithm from pitchfinder
            const frequency = detectPitchFnRef.current(buffer);

            if (frequency && frequency > 70 && frequency < 1500) {
                const midi = frequencyToMidi(frequency);
                const noteName = midiToNoteName(midi);
                const octave = midiToOctave(midi);
                const cents = frequencyToCents(frequency);

                // Add to note buffer for smoothing (note+octave combined)
                const noteWithOctave = `${noteName}${octave}`;
                noteBufferRef.current.push(noteWithOctave);
                if (noteBufferRef.current.length > 4) {
                    noteBufferRef.current.shift();
                }

                // Count note occurrences
                const noteCounts = {};
                noteBufferRef.current.forEach(n => {
                    noteCounts[n] = (noteCounts[n] || 0) + 1;
                });

                // Find most common note
                let mostCommonNoteWithOctave = noteWithOctave;
                let maxCount = 0;
                Object.entries(noteCounts).forEach(([note, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        mostCommonNoteWithOctave = note;
                    }
                });

                // Parse note and octave from most common
                const mostCommonNote = mostCommonNoteWithOctave.replace(/[0-9]/g, '');
                const mostCommonOctave = parseInt(mostCommonNoteWithOctave.match(/[0-9]+/)?.[0] || octave);

                // Update if note is stable (appears 2+ times)
                if (maxCount >= 2) {
                    setDetectedFrequency(Math.round(frequency));
                    setDetectedNote(mostCommonNote);
                    setDetectedOctave(mostCommonOctave);
                    setCentsDeviation(cents);
                    setConfidence(maxCount / 4);

                    // Add to history with debounce
                    const now = Date.now();
                    if (mostCommonNoteWithOctave !== lastNoteRef.current || now - lastNoteTimeRef.current > 350) {
                        lastNoteRef.current = mostCommonNoteWithOctave;
                        lastNoteTimeRef.current = now;
                        setNoteHistory(prev => {
                            const newHistory = [{
                                note: mostCommonNote,
                                octave: mostCommonOctave,
                                fullNote: mostCommonNoteWithOctave,
                                time: now,
                                freq: Math.round(frequency)
                            }, ...prev];
                            return newHistory.slice(0, 20);
                        });
                    }
                }
            }
        } else {
            // Low signal - clear detection after a moment
            if (noteBufferRef.current.length > 0) {
                noteBufferRef.current = [];
            }
            setDetectedNote(null);
            setDetectedOctave(null);
            setDetectedFrequency(null);
            setCentsDeviation(0);
            setConfidence(0);
        }

        rafIdRef.current = requestAnimationFrame(detectPitch);
    }, []);

    // Start listening
    const startListening = useCallback(async () => {
        try {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            const sampleRate = audioContextRef.current.sampleRate;

            // Initialize YIN detector with correct sample rate
            detectPitchFnRef.current = Pitchfinder.YIN({
                sampleRate: sampleRate,
                threshold: 0.1,  // Lower = more sensitive, higher = more accurate
            });

            const constraints = {
                audio: {
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                }
            };

            streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

            // Use larger FFT for better frequency resolution
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0;

            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            source.connect(analyserRef.current);

            // Reset buffers
            noteBufferRef.current = [];

            setIsListening(true);
            rafIdRef.current = requestAnimationFrame(detectPitch);

        } catch (err) {
            console.error('Failed to start listening:', err);
        }
    }, [selectedDevice, detectPitch]);

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

        noteBufferRef.current = [];
        detectPitchFnRef.current = null;
        setIsListening(false);
        setDetectedNote(null);
        setDetectedOctave(null);
        setDetectedFrequency(null);
        setCentsDeviation(0);
        setVolume(0);
        setConfidence(0);
    }, []);

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
        startListening,
        stopListening,
        refreshDevices,
        clearHistory
    };
}
