import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Draggable from 'react-draggable';
import YouTube from 'react-youtube';
import Tesseract from 'tesseract.js';
import {
    parseJianpuText,
    cleanJianpuText,
    notesToJianpuString,
    jianpuToNote,
    calculate3NPSPositions
} from '../parsers/JianpuParser';
import { NOTES } from '../data/scaleData';
import { useAudio } from '../hooks/useAudio';
import ReadFretboard from './ReadFretboard';
import ScoreDisplay from './ScoreDisplay';
import './ReadMode.css';



// Timer Helper
const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

function ReadMode({ guitarType, fretCount }) {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [rawText, setRawText] = useState('');
    const [notes, setNotes] = useState([]);
    const [editableText, setEditableText] = useState('');
    const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playTime, setPlayTime] = useState(0);
    // 3NPS 模式：使用 startString 控制起始弦 (5=6弦, 4=5弦, 3=4弦)
    const [startString, setStartString] = useState(5);
    const [rangeOctave, setRangeOctave] = useState(0); // 0=Normal, 1=+8ve, -1=-8ve
    const [octaveOffset, setOctaveOffset] = useState(-1); // Guitar Default: -1 Octave (Low Strings)
    const [tempo, setTempo] = useState(120); // BPM
    const [timeSignature, setTimeSignature] = useState('4/4'); // Default 4/4
    const [key, setKey] = useState('C');
    const [scaleType, setScaleType] = useState('Major'); // Major, Minor, etc.
    const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1);
    const [showNoteMenu, setShowNoteMenu] = useState(false);
    const [hoverInfo, setHoverInfo] = useState(''); // Info bar text
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [showScaleGuide, setShowScaleGuide] = useState(true); // User requested to restore Ghost notes

    // YouTube State
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [showYoutube, setShowYoutube] = useState(false);
    const [youtubeLayout, setYoutubeLayout] = useState({ x: 50, y: 50, width: 320, height: 180 });
    const youtubeNodeRef = useRef(null);

    // View Mode: 'both' | 'text' | 'score'
    const [viewMode, setViewMode] = useState('both');

    const fileInputRef = useRef(null);
    const loadInputRef = useRef(null); // For loading JSON files
    const playTimeoutRef = useRef(null);
    const { playNote, resumeAudio, isLoading: audioLoading } = useAudio(guitarType);

    // Session AutoSave key
    const AUTOSAVE_KEY = 'guitar-mixer-readmode-autosave';

    // Load Autosave on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(AUTOSAVE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data) {
                    // Only restore if fields exist
                    if (data.text) {
                        setEditableText(data.text);
                        setRawText(data.text);
                    }
                    if (data.notes) setNotes(data.notes);
                    if (data.key) setKey(data.key);
                    if (data.scaleType) setScaleType(data.scaleType || data.key);
                    if (data.tempo) setTempo(data.tempo);
                    if (data.timeSignature) setTimeSignature(data.timeSignature);
                    if (typeof data.startString === 'number') setStartString(data.startString);
                    if (typeof data.octaveOffset === 'number') setOctaveOffset(data.octaveOffset);
                    if (typeof data.octaveOffset === 'number') setOctaveOffset(data.octaveOffset);
                    if (data.showScaleGuide !== undefined) setShowScaleGuide(data.showScaleGuide);

                    // Restore YouTube State
                    if (data.youtubeUrl) setYoutubeUrl(data.youtubeUrl);
                    if (data.showYoutube !== undefined) setShowYoutube(data.showYoutube);
                    if (data.youtubeLayout) setYoutubeLayout(data.youtubeLayout);
                    // Restore View Mode
                    if (data.viewMode) setViewMode(data.viewMode);
                }
            }
        } catch (e) {
            console.error('Failed to load autosave', e);
        }
    }, []);

    // Autosave on change
    useEffect(() => {
        // Debounce slightly to avoid excessive writes
        const timer = setTimeout(() => {
            const dataToSave = {
                text: editableText,
                notes: notes,
                key: key,
                scaleType: scaleType,
                tempo: tempo,
                timeSignature: timeSignature,
                startString: startString,
                octaveOffset: octaveOffset,
                showScaleGuide: showScaleGuide,
                showScaleGuide: showScaleGuide,
                youtubeUrl,
                showYoutube,
                youtubeLayout,
                viewMode
            };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
        }, 1000);
        return () => clearTimeout(timer);
    }, [editableText, notes, key, scaleType, tempo, timeSignature, startString, octaveOffset, showScaleGuide, youtubeUrl, showYoutube, youtubeLayout, viewMode]);

    const youtubePlayerRef = useRef(null);

    const extractYouTubeId = (url) => {
        if (!url) return '';
        let videoId = '';
        try {
            if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            } else if (url.includes('v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('embed/')) {
                videoId = url.split('embed/')[1].split('?')[0];
            }
        } catch (e) { return ''; }
        return videoId;
    };

    const handleYouTubeCountIn = () => {
        if (enableCountIn) {
            startCountIn(() => {
                if (youtubePlayerRef.current) {
                    youtubePlayerRef.current.internalPlayer.playVideo();
                }
            });
        } else {
            if (youtubePlayerRef.current) {
                youtubePlayerRef.current.internalPlayer.playVideo();
            }
        }
    };

    // 處理檔案上傳
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    // 處理拖放
    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // 處理檔案
    const processFile = (file) => {
        if (!file.type.startsWith('image/')) {
            alert('請上傳圖片檔案 (JPG, PNG)');
            return;
        }

        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // 重置狀態
        setNotes([]);
        setRawText('');
        setEditableText('');
        setCurrentNoteIndex(-1);
    };

    // OCR 辨識
    const handleOCR = async () => {
        if (!image) return;

        setIsProcessing(true);
        setOcrProgress(0);

        try {
            const result = await Tesseract.recognize(image, 'chi_tra+eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                    }
                },
            });

            const text = result.data.text;
            setRawText(text);

            // 自動清理非簡譜字符
            const cleanedText = cleanJianpuText(text);
            setEditableText(cleanedText);

            // 解析簡譜（傳入調號與八度偏移）
            const parsedNotes = parseJianpuText(text, key, scaleType, octaveOffset);
            setNotes(parsedNotes);
        } catch (error) {
            console.error('OCR 錯誤:', error);
            alert('OCR 辨識失敗，請嘗試其他圖片');
        } finally {
            setIsProcessing(false);
            setOcrProgress(100);
        }
    };

    // 手動解析編輯後的文字
    const handleManualParse = () => {
        const parsedNotes = parseJianpuText(editableText, key, scaleType, octaveOffset);
        setNotes(parsedNotes);
    };

    // 播放控制
    const play = useCallback(async () => {
        if (notes.length === 0) return;

        // Resume Audio Context first to prevent latency/drop of first notes
        if (resumeAudio) {
            try {
                await resumeAudio();
            } catch (e) {
                console.warn('Audio resume failed', e);
            }
        }

        setIsPlaying(true);
        // Start from selected note if valid, otherwise 0
        const startIndex = selectedNoteIndex >= 0 ? selectedNoteIndex : 0;
        setCurrentNoteIndex(startIndex);
        if (startIndex === 0) setPlayTime(0);
    }, [notes, selectedNoteIndex, resumeAudio]);

    const pause = () => {
        setIsPlaying(false);
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
    };

    const stop = () => {
        setIsPlaying(false);
        setCurrentNoteIndex(-1);
        setPlayTime(0);
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
    };

    const [enableCountIn, setEnableCountIn] = useState(true);
    const [countInStatus, setCountInStatus] = useState(''); // '' | '4' | '3'...

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

    const startCountIn = (onComplete) => {
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
                // Go!
                clearInterval(timer);
                setCountInStatus('');
                playClickSound(true); // High pitch for "Go"
                if (onComplete) onComplete();
            }
        }, interval);

        playTimeoutRef.current = timer;
    };

    const togglePlay = () => {
        if (isPlaying) {
            pause();
            setCountInStatus('');
        } else {
            if (enableCountIn && currentNoteIndex === -1) {
                startCountIn(play);
            } else {
                play();
            }
        }
    };

    // 計算 3NPS 位置（memoized）
    // 計算 3NPS 位置（memoized）
    const notePositions = useMemo(() =>
        calculate3NPSPositions(notes, startString, key, scaleType, rangeOctave), [notes, startString, key, scaleType, rangeOctave]);

    // 當調號或音階改變時，更新所有音符的音高
    useEffect(() => {
        setNotes(prevNotes => prevNotes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension) return note;

            // Recalculate based on current jianpu and octave, PRESERVING ACCIDENTALS
            const octaveOffset = (note.octave || 4) - 4;
            // Construct input string that includes the accidental (e.g. "1#")
            // Ensure accidentalStr is determined if missing but present in displayStr
            let acc = note.accidentalStr || '';
            if (!acc && note.displayStr) {
                if (note.displayStr.includes('#')) acc = '#';
                if (note.displayStr.includes('b')) acc = 'b';
            }

            const noteInput = String(note.jianpu) + acc;

            if (note.jianpu === 2 && acc === '#') {
                console.log('[DEBUG] Recalculating 2#: Input=', noteInput, ' Key=', key, ' Result=', jianpuToNote(noteInput, octaveOffset, key, scaleType));
            }

            const noteData = jianpuToNote(noteInput, octaveOffset, key, scaleType);

            if (noteData) {
                return {
                    ...note,
                    ...noteData, // updates midiNote, noteName
                    accidentalStr: acc // Ensure it is preserved
                };
            }
            return note;
        }));
    }, [key, scaleType]);

    // Beat tracking for accents
    const beatCounterRef = useRef(0);
    const lastNoteIndexRef = useRef(-1);

    // 播放邏輯
    useEffect(() => {
        if (!isPlaying || currentNoteIndex < 0 || currentNoteIndex >= notes.length) {
            if (currentNoteIndex >= notes.length) {
                setIsPlaying(false);
                setCurrentNoteIndex(-1);
                setPlayTime(0); // Reset timer
                beatCounterRef.current = 0; // Reset beat
            }
            return;
        }

        // Detect manual navigation/jumps to reset beat if needed
        if (currentNoteIndex !== lastNoteIndexRef.current + 1) {
            // Logic to handle jumps? For now, maybe not strict.
            // But let's keep beat continuity or reset? 
            // Better to let it flow unless configured.
        }
        lastNoteIndexRef.current = currentNoteIndex;

        const note = notes[currentNoteIndex];

        // Ensure separator resets beat count to 0 (so next note is beat 1)
        if (note.isSeparator) {
            beatCounterRef.current = 0;
            setCurrentNoteIndex(prev => prev + 1);
            return;
        }

        // Skip symbols without sound but don't reset beat?
        // Actually symbols might denote duration changes (which we aren't handling fully yet)
        if (note.isSymbol) {
            setCurrentNoteIndex(prev => prev + 1);
            return;
        }

        const pos = notePositions[currentNoteIndex];

        // Determine Accent
        // Simple logic: Increment beat counter
        // Gets numerator from timeSignature string "4/4" -> 4
        const beatsPerBar = parseInt(timeSignature.split('/')[0]) || 4;

        let isAccent = false;
        // Check if this is the first beat
        if (beatCounterRef.current % beatsPerBar === 0) {
            isAccent = true;
        }

        if (pos && !audioLoading) {
            // Priority: Play the note at the visual position (Calculated 3NPS position)
            const targetMidi = pos.midi || (pos.string !== undefined ? STRING_TUNINGS[pos.string] + pos.fret : note.midiNote);

            // Play with accent if it's beat 1
            playNote(targetMidi, pos.string, { gain: isAccent ? 1.3 : 0.7 });
        }

        // Increment beat count for NEXT note
        beatCounterRef.current++;

        const interval = (60 / tempo) * 1000; // 毫秒
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

    // 點擊單個音符
    const handleNoteClick = (index) => {
        setCurrentNoteIndex(index);
        beatCounterRef.current = 0; // Reset beat for manual play
        const note = notes[index];
        const pos = notePositions[index];
        if (pos && !audioLoading) {
            const targetMidi = pos.midi || (pos.string !== undefined ? STRING_TUNINGS[pos.string] + pos.fret : note.midiNote);
            playNote(targetMidi, pos.string);
        }
    };

    // 儲存檔案 (Save to File)
    const handleSaveFile = async () => {
        if (!editableText.trim()) {
            alert('沒有可儲存的簡譜內容');
            return;
        }

        const scoreData = {
            name: 'GuitarScore', // Helper name, mostly unused in file content logic but good for structure
            data: {
                text: editableText,
                notes: notes,
                key: key,
                scaleType: scaleType,
                tempo: tempo,
                startString: startString,
                octaveOffset: octaveOffset,
                youtubeUrl: youtubeUrl,
                showYoutube: showYoutube,
                youtubeLayout: youtubeLayout,
                viewMode: viewMode
            }
        };

        const strData = JSON.stringify(scoreData, null, 2);

        // Try File System Access API
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `guitar_score_${new Date().toISOString().slice(0, 10)}.json`,
                    types: [{
                        description: 'Guitar Mixer Score',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(strData);
                await writable.close();
                alert('檔案儲存成功！');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return; // User cancelled
                console.warn('File Picker failed, falling back to download', err);
            }
        }

        // Fallback: Download Link
        const blob = new Blob([strData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const now = new Date();
        const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const fileName = `GuitarScore_${timeStr}.json`;

        a.href = url;
        a.download = fileName;
        a.setAttribute('download', fileName);
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };

    // 開啟檔案 (Open File)
    const handleLoadFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = JSON.parse(ev.target.result);
                // Support both { name, data: {...} } format AND direct data format if someone saved raw
                const actualData = content.data ? content.data : content;

                // Validate critical fields
                if (actualData && (actualData.notes || actualData.text)) {
                    setEditableText(actualData.text || '');
                    setNotes(actualData.notes || []);
                    setKey(actualData.key || 'C');
                    setScaleType(actualData.scaleType || 'Major');
                    setTempo(actualData.tempo || 120);
                    if (typeof actualData.startString === 'number') setStartString(actualData.startString);
                    if (typeof actualData.octaveOffset === 'number') setOctaveOffset(actualData.octaveOffset);

                    // Restore YouTube Data
                    if (actualData.youtubeUrl) setYoutubeUrl(actualData.youtubeUrl);
                    if (actualData.showYoutube !== undefined) setShowYoutube(actualData.showYoutube);
                    if (actualData.youtubeLayout) setYoutubeLayout(actualData.youtubeLayout);
                    if (actualData.viewMode) setViewMode(actualData.viewMode);

                    alert('樂譜載入成功！');
                } else {
                    alert('載入失敗：檔案格式不符');
                }
            } catch (err) {
                console.error('Load failed', err);
                alert('載入失敗：無法解析檔案');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    // 複製當前狀態到剪貼簿 (Copy Current)
    const handleCopyCurrentScore = () => {
        const scoreData = {
            name: 'GuitarScore_Copy',
            data: {
                text: editableText,
                notes: notes,
                key: key,
                scaleType: scaleType,
                tempo: tempo,
                startString: startString,
                octaveOffset: octaveOffset
            }
        };
        const jsonStr = JSON.stringify(scoreData, null, 2);

        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('✅ 樂譜資料已複製到剪貼簿！');
        }).catch(err => {
            const textArea = document.createElement("textarea");
            textArea.value = jsonStr;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert('✅ 樂譜資料已複製到剪貼簿！');
            } catch (err) {
                alert('❌ 複製失敗');
            }
            document.body.removeChild(textArea);
        });
    };

    // 同步更新 editableText
    const syncEditableText = (newNotes) => {
        setEditableText(notesToJianpuString(newNotes));
    };

    // 選擇音符進行編輯
    const handleNoteSelect = (index, e) => {
        e.stopPropagation();
        if (selectedNoteIndex === index && showNoteMenu) {
            setShowNoteMenu(false);
            setSelectedNoteIndex(-1);
        } else {
            setSelectedNoteIndex(index);

            // 計算選單位置
            const rect = e.currentTarget.getBoundingClientRect();
            const menuWidth = 250;
            const menuHeight = 350;
            let left = rect.left + rect.width / 2 - menuWidth / 2;
            let top = rect.bottom + 8;

            // 確保不超出視窗
            if (left < 10) left = 10;
            if (left + menuWidth > window.innerWidth - 10) {
                left = window.innerWidth - menuWidth - 10;
            }
            if (top + menuHeight > window.innerHeight - 10) {
                top = rect.top - menuHeight - 8;
            }

            setMenuPosition({ top, left });
            setShowNoteMenu(true);

            // 播放選中的音符
            const note = notes[index];
            if (note && !note.isSeparator) {
                const pos = notePositions[index];
                if (pos && !audioLoading) {
                    playNote(note.midiNote, pos.string);
                }
            }
        }
    };

    // 關閉編輯選單
    const closeNoteMenu = () => {
        setShowNoteMenu(false);
        setSelectedNoteIndex(-1);
    };

    // 刪除音符
    const handleDeleteNote = () => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;

        const deletedIndex = selectedNoteIndex;
        const newNotes = notes.filter((_, idx) => idx !== deletedIndex);
        setNotes(newNotes);
        syncEditableText(newNotes);

        // 刪除後自動選取下一個音符
        if (newNotes.length === 0) {
            // 沒有音符了，不選取
            setSelectedNoteIndex(-1);
        } else if (deletedIndex >= newNotes.length) {
            // 刪除的是最後一個，不選取
            setSelectedNoteIndex(-1);
        } else {
            // 保持選取同一個索引（現在指向原本的下一個音符）
            // 先設為 -1 再設回來，強制 React 重新渲染
            setSelectedNoteIndex(-1);
            setTimeout(() => setSelectedNoteIndex(deletedIndex), 0);
        }
    };

    // 在音符前插入
    const handleInsertBefore = (jianpuNum) => {
        if (selectedNoteIndex < 0) return;
        const noteData = jianpuToNote(jianpuNum, 0, key, scaleType);
        const newNote = {
            jianpu: String(jianpuNum),
            octave: 4,
            midiNote: noteData?.midiNote || 60,
            noteName: noteData?.noteName || '',
            displayStr: String(jianpuNum)
        };
        const newNotes = [...notes];
        newNotes.splice(selectedNoteIndex, 0, newNote);
        setNotes(newNotes);
        syncEditableText(newNotes);
        // Don't close menu, and since we inserted at 'selectedNoteIndex', 
        // the new note takes that index. We don't need to change index, 
        // just keep it to edit the *new* note.
    };

    // 在音符後插入
    const handleInsertAfter = (jianpuNum) => {
        if (selectedNoteIndex < 0) return;
        const noteData = jianpuToNote(jianpuNum, 0, key, scaleType);
        const newNote = {
            jianpu: String(jianpuNum),
            octave: 4,
            midiNote: noteData?.midiNote || 60,
            noteName: noteData?.noteName || '',
            displayStr: String(jianpuNum)
        };
        const newNotes = [...notes];
        newNotes.splice(selectedNoteIndex + 1, 0, newNote);
        setNotes(newNotes);
        syncEditableText(newNotes);

        // Advance selection to the new note
        setSelectedNoteIndex(selectedNoteIndex + 1);
    };

    // 在音符後插入符號 (0, -)
    const handleInsertSymbol = (symbol, position = 'after') => {
        if (selectedNoteIndex < 0) return;

        let newNote = null;
        if (symbol === '0') {
            newNote = {
                jianpu: '0',
                displayStr: '0',
                isRest: true,
                octave: 4,
                index: 0
            };
        } else if (symbol === '-') {
            newNote = {
                jianpu: '-',
                displayStr: '-',
                isExtension: true,
                octave: 4,
                index: 0
            };
        } else {
            // Generic symbols
            newNote = {
                jianpu: symbol,
                displayStr: symbol,
                isSymbol: true, // Mark as generic symbol
                octave: 4,
                index: 0
            };
        }

        if (newNote) {
            const newNotes = [...notes];
            const insertIndex = position === 'after' ? selectedNoteIndex + 1 : selectedNoteIndex;
            newNotes.splice(insertIndex, 0, newNote);
            setNotes(newNotes);
            syncEditableText(newNotes);

            // Auto-select the new symbol
            setSelectedNoteIndex(insertIndex);
        }
    };

    // Update pitch of selected note (for keyboard input)
    const handleUpdateNotePitch = (newJianpuChar) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;

        const oldNote = notes[selectedNoteIndex];
        // Only update if it's a real note, rest, or symbol (allow rewriting placeholders)
        // Keep separators and extensions (unless we want to allow rewriting extensions?)
        // Let's protect separators and extensions for now.
        if (oldNote.isSeparator || oldNote.isExtension) return;

        const noteData = jianpuToNote(newJianpuChar, (oldNote.octave || 4) - 4, key, scaleType);
        if (noteData) {
            const newNotes = [...notes];
            newNotes[selectedNoteIndex] = {
                ...oldNote,
                ...noteData, // updates midiNote, noteName
                jianpu: newJianpuChar,
                displayStr: newJianpuChar + (oldNote.displayStr.includes('.') ? '.' : '') + (oldNote.displayStr.includes('_') ? '_' : ''),
                isRest: false, // Ensure it's no longer a rest
                isSymbol: false // Ensure it's no longer a symbol
            };

            // Reconstruct displayStr simplified
            let ds = newJianpuChar;
            if (oldNote.octave === 5) ds += '·';
            if (oldNote.octave === 6) ds += '··';
            if (oldNote.octave === 3) ds = '₋' + ds;
            if (oldNote.octave === 2) ds = '₌' + ds;
            newNotes[selectedNoteIndex].displayStr = ds;

            setNotes(newNotes);
            syncEditableText(newNotes);
        }
    };

    // Toggle Dot (Append .)
    const handleAddDot = () => {
        handleSetOctave(Math.min((notes[selectedNoteIndex]?.octave || 4) + 1, 6));
    };

    // Keyboard Input Handler
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            // 1-7: Change Pitch
            if (e.key >= '1' && e.key <= '7') {
                if (selectedNoteIndex >= 0) {
                    handleUpdateNotePitch(e.key);
                }
            }
            // 0: Insert Rest (after?) or Change to Rest? User said "打數字...把該音符直接變所按數字".
            if (e.key === '0') {
                if (selectedNoteIndex >= 0) {
                    // Change to Rest
                    const newNotes = [...notes];
                    newNotes[selectedNoteIndex] = {
                        jianpu: '0',
                        displayStr: '0',
                        isRest: true,
                        octave: 4,
                        index: selectedNoteIndex
                    };
                    setNotes(newNotes);
                    syncEditableText(newNotes);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNoteIndex, notes, key, scaleType]);



    // 添加區隔線
    const handleAddSeparator = (before = false) => {
        if (selectedNoteIndex < 0) return;
        const separator = { isSeparator: true, jianpu: '|', displayStr: '|' };
        const newNotes = [...notes];
        if (before) {
            newNotes.splice(selectedNoteIndex, 0, separator);
        } else {
            newNotes.splice(selectedNoteIndex + 1, 0, separator);
        }
        setNotes(newNotes);
        syncEditableText(newNotes);
        closeNoteMenu();
    };

    // 標記八度
    // 調整單一音符八度 (Relative)
    const handleShiftOctave = (direction) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const oldOctave = currentNote.octave || 4;
        const newOctave = Math.max(2, Math.min(6, oldOctave + direction)); // Limit 2-6

        if (newOctave === oldOctave) return;

        // Reconstruct display string with new octave dots
        let newDisplay = String(currentNote.jianpu);
        if (newOctave >= 5) newDisplay = newDisplay + '.'.repeat(newOctave - 4);
        if (newOctave === 3) newDisplay = '_' + newDisplay;
        if (newOctave === 2) newDisplay = '__' + newDisplay;

        // Preserve accidental
        const oldDisplay = currentNote.displayStr || String(currentNote.jianpu);
        if (oldDisplay.includes('#')) newDisplay += '#';
        else if (oldDisplay.includes('b')) newDisplay += 'b';

        newNotes[selectedNoteIndex] = {
            ...currentNote,
            octave: newOctave,
            midiNote: currentNote.midiNote + (newOctave - oldOctave) * 12,
            displayStr: newDisplay,
            accidentalStr: oldDisplay.includes('#') ? '#' : (oldDisplay.includes('b') ? 'b' : '')
        };
        setNotes(newNotes);
        syncEditableText(newNotes);
    };

    // 全曲升降八度
    const handleShiftAllOctaves = (direction) => {
        const newNotes = notes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension || note.isSymbol) return note;

            const oldOctave = note.octave || 4;
            const newOctave = Math.max(2, Math.min(6, oldOctave + direction)); // Limit 2-6

            if (newOctave === oldOctave) return note;

            // Reconstruct display
            let newDisplay = String(note.jianpu);
            if (newOctave >= 5) newDisplay = newDisplay + '.'.repeat(newOctave - 4);
            if (newOctave === 3) newDisplay = '_' + newDisplay;
            if (newOctave === 2) newDisplay = '__' + newDisplay;

            if (note.accidentalStr) newDisplay += note.accidentalStr;
            else if (note.displayStr?.includes('#')) newDisplay += '#';
            else if (note.displayStr?.includes('b')) newDisplay += 'b';

            return {
                ...note,
                octave: newOctave,
                midiNote: note.midiNote + (newOctave - oldOctave) * 12,
                displayStr: newDisplay
            };
        });
        setNotes(newNotes);
        syncEditableText(newNotes);
    };

    // 切換升音 (Sharp)
    const handleToggleSharp = () => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const hasSharp = currentNote.noteName?.includes('#');
        const hasFlat = currentNote.noteName?.includes('b');

        if (hasSharp) {
            // 移除 sharp
            newNotes[selectedNoteIndex] = {
                ...currentNote,
                midiNote: currentNote.midiNote - 1,
                noteName: currentNote.noteName.replace('#', ''),
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', ''),
                accidentalStr: ''
            };
        } else {
            // 添加 sharp，移除 flat (如果有)
            newNotes[selectedNoteIndex] = {
                ...currentNote,
                midiNote: currentNote.midiNote + (hasFlat ? 2 : 1),
                noteName: currentNote.noteName.replace('b', '') + '#',
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', '') + '#',
                accidentalStr: '#'
            };
        }
        setNotes(newNotes);
        syncEditableText(newNotes);
    };

    // 切換降音 (Flat)
    const handleToggleFlat = () => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const hasSharp = currentNote.noteName?.includes('#');
        const hasFlat = currentNote.noteName?.includes('b');

        if (hasFlat) {
            // 移除 flat
            newNotes[selectedNoteIndex] = {
                ...currentNote,
                midiNote: currentNote.midiNote + 1,
                noteName: currentNote.noteName.replace('b', ''),
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', ''),
                accidentalStr: ''
            };
        } else {
            // 添加 flat，移除 sharp (如果有)
            newNotes[selectedNoteIndex] = {
                ...currentNote,
                midiNote: currentNote.midiNote - (hasSharp ? 2 : 1),
                noteName: currentNote.noteName.replace('#', '') + 'b',
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', '') + 'b',
                accidentalStr: 'b'
            };
        }
        setNotes(newNotes);
        syncEditableText(newNotes);
    };

    // 點擊外部關閉選單
    useEffect(() => {
        const handleClickOutside = () => {
            if (showNoteMenu) {
                closeNoteMenu();
            }

        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showNoteMenu]);

    // --- Session Management (Autosave/Load) ---
    // State for session data
    const [sessionData, setSessionData] = useState(() => {
        try {
            const savedSession = localStorage.getItem('guitarMapSession');
            return savedSession ? JSON.parse(savedSession) : null;
        } catch (error) {
            console.error("Failed to parse saved session from localStorage", error);
            return null;
        }
    });

    // Initialize state from sessionData on mount
    useEffect(() => {
        if (sessionData) {
            if (sessionData.notes) setNotes(sessionData.notes);
            if (sessionData.key) setKey(sessionData.key);
            if (sessionData.scaleType) setScaleType(sessionData.scaleType);
            if (sessionData.tempo) setTempo(sessionData.tempo);
            if (sessionData.startString !== undefined) setStartString(sessionData.startString);
            if (sessionData.octaveOffset !== undefined) setOctaveOffset(sessionData.octaveOffset);
            // If rawText was saved, set it to trigger parsing
            if (sessionData.rawText) {
                setRawText(sessionData.rawText);
                setEditableText(sessionData.editableText || sessionData.rawText);
            }
        }
    }, []); // Run only once on mount

    // Autosave session data to localStorage
    useEffect(() => {
        const currentSession = {
            notes,
            key,
            scaleType,
            tempo,
            startString,
            octaveOffset,
            rawText, // Save rawText and editableText for manual input mode persistence
            editableText,
        };
        localStorage.setItem('guitarMapSession', JSON.stringify(currentSession));
    }, [notes, key, scaleType, tempo, startString, octaveOffset, rawText, editableText]);




    return (
        <div className="read-mode">
            <div className="read-controls">
                {/* 上傳區 */}
                <div className="upload-section">
                    <div
                        className="upload-area"
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="樂譜預覽" className="preview-image" />
                        ) : (
                            <div className="upload-placeholder">
                                <span className="upload-icon">📷</span>
                                <span>點擊或拖放簡譜圖片</span>
                                <span className="upload-hint">支援 JPG, PNG</span>
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        hidden
                    />

                    <div className="upload-actions">
                        {imagePreview && (
                            <button
                                className="ocr-btn"
                                onClick={handleOCR}
                                disabled={isProcessing}
                            >
                                {isProcessing ? `辨識中...${ocrProgress} % ` : '🔍 開始辨識'}
                            </button>
                        )}
                        <button
                            className="manual-btn"
                            onClick={() => {
                                setRawText(' '); // Enable text area
                                setEditableText('');
                                setNotes([]);
                                setCurrentNoteIndex(-1);
                            }}
                        >
                            ✏️ 手動輸入
                        </button>
                    </div>
                </div>

                {/* 設定區 */}
                <div className="settings-section">
                    <div className="setting-row">
                        <label>調號</label>
                        <select value={key} onChange={(e) => setKey(e.target.value)}>
                            {NOTES.map(n => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </div>

                    <div className="setting-row">
                        <label>音階</label>
                        <select value={scaleType} onChange={(e) => setScaleType(e.target.value)}>
                            <option value="Major">Major (大調)</option>
                            <option value="Minor">Minor (小調)</option>
                            <option value="Dorian">Dorian</option>
                            <option value="Phrygian">Phrygian</option>
                            <option value="Lydian">Lydian</option>
                            <option value="Mixolydian">Mixolydian</option>
                            <option value="Locrian">Locrian</option>
                            <option value="HarmonicMinor">Harmonic Minor</option>
                            <option value="MelodicMinor">Melodic Minor</option>
                        </select>
                    </div>

                    <div className="setting-row">
                        <label>拍子</label>
                        <select
                            value={timeSignature}
                            onChange={(e) => setTimeSignature(e.target.value)}
                        >
                            <option value="4/4">4/4</option>
                            <option value="3/4">3/4</option>
                            <option value="2/4">2/4</option>
                            <option value="6/8">6/8</option>
                            <option value="12/8">12/8</option>
                        </select>
                    </div>

                    <div className="setting-row mode-info">
                        <label>指法模式</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <span className="mode-badge">🎸 3NPS</span>
                            <select
                                value={startString}
                                onChange={(e) => setStartString(Number(e.target.value))}
                                style={{
                                    padding: '4px',
                                    borderRadius: '4px',
                                    border: '1px solid #444',
                                    background: '#222',
                                    color: 'white',
                                    fontSize: '12px'
                                }}
                            >
                                <option value={5}>根音在第 6 弦 (E)</option>
                                <option value={4}>根音在第 5 弦 (A)</option>
                                <option value={3}>根音在第 4 弦 (D)</option>
                            </select>
                        </div>
                    </div>

                    <div className="setting-row">
                        <label>速度</label>
                        <input
                            type="range"
                            min="40"
                            max="200"
                            value={tempo}
                            onChange={(e) => setTempo(Number(e.target.value))}
                        />
                        <span>{tempo} BPM</span>
                    </div>

                    <div className="setting-row" style={{ marginTop: '5px' }}>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                            <input
                                type="checkbox"
                                checked={showScaleGuide}
                                onChange={(e) => setShowScaleGuide(e.target.checked)}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <span>顯示背景音階 (Ghost Notes)</span>
                        </label>
                    </div>

                    <div className="setting-row" style={{ marginTop: '5px' }}>
                        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                            <input
                                type="checkbox"
                                checked={enableCountIn}
                                onChange={(e) => setEnableCountIn(e.target.checked)}
                                style={{ width: '16px', height: '16px' }}
                            />
                            <span>播放前倒數 (Count-In)</span>
                        </label>
                    </div>

                    <div className="setting-row" style={{ marginTop: '5px' }}>
                        <button
                            onClick={() => setShowYoutube(!showYoutube)}
                            style={{
                                background: showYoutube ? '#ff0000' : '#444',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            {showYoutube ? '🔴 關閉 YouTube 視窗' : '📺 開啟 YouTube 視窗'}
                        </button>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="setting-row" style={{ marginTop: '10px', padding: '5px 0', borderTop: '1px solid #444' }}>
                        <span style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>顯示模式</span>
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <button
                                onClick={() => setViewMode('both')}
                                style={{
                                    flex: 1, padding: '4px', fontSize: '12px', cursor: 'pointer',
                                    background: viewMode === 'both' ? '#2196F3' : '#444',
                                    color: 'white', border: 'none', borderRadius: '4px'
                                }}
                            >全部</button>
                            <button
                                onClick={() => setViewMode('text')}
                                style={{
                                    flex: 1, padding: '4px', fontSize: '12px', cursor: 'pointer',
                                    background: viewMode === 'text' ? '#2196F3' : '#444',
                                    color: 'white', border: 'none', borderRadius: '4px'
                                }}
                            >簡譜</button>
                            <button
                                onClick={() => setViewMode('score')}
                                style={{
                                    flex: 1, padding: '4px', fontSize: '12px', cursor: 'pointer',
                                    background: viewMode === 'score' ? '#2196F3' : '#444',
                                    color: 'white', border: 'none', borderRadius: '4px'
                                }}
                            >譜面</button>
                        </div>
                    </div>
                </div>

                {/* 辨識結果顯示 */}
                {rawText && (viewMode === 'both' || viewMode === 'text') && (
                    <div className="result-section expanded">
                        <label>簡譜內容</label>
                        <textarea
                            value={editableText}
                            onChange={(e) => setEditableText(e.target.value)}
                            onBlur={handleManualParse}
                            placeholder="辨識後的簡譜內容 (可直接編輯，點擊外處更新)"
                            rows={10}
                        />
                    </div>
                )}

                {/* 播放控制 */}
                {notes.length > 0 && (
                    <div className="playback-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {!isPlaying ? (
                            <button className="play-btn" onClick={play}>▶️ 播放</button>
                        ) : (
                            <button className="pause-btn" onClick={pause}>⏸️ 暫停</button>
                        )}
                        <button className="stop-btn" onClick={stop}>⏹️ 停止</button>

                        {/* Count-In Status Display */}
                        {countInStatus && (
                            <span style={{
                                fontSize: '20px',
                                color: '#ff5252',
                                fontWeight: 'bold',
                                animation: 'pulse 0.5s infinite alternate'
                            }}>
                                {countInStatus}
                            </span>
                        )}
                    </div>
                )}
            </div>



            {/* Draggable YouTube Window */}
            {
                showYoutube && (
                    <Draggable
                        nodeRef={youtubeNodeRef}
                        handle=".yt-handle"
                        defaultPosition={{ x: youtubeLayout.x, y: youtubeLayout.y }}
                        onStop={(e, data) => setYoutubeLayout(prev => ({ ...prev, x: data.x, y: data.y }))}
                    >
                        <div ref={youtubeNodeRef} className="youtube-floating-window" style={{
                            position: 'fixed', zIndex: 1000,
                            width: youtubeLayout.width, height: youtubeLayout.height,
                            background: '#222', border: '1px solid #444',
                            resize: 'both', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            paddingBottom: '16px' // Reserve space for resize handle
                        }}>
                            <div className="yt-handle" style={{
                                padding: '5px', background: '#333', cursor: 'move', color: '#fff',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none'
                            }}>
                                <span style={{ fontSize: '12px' }}>📺 YouTube (拖曳標題移動 / 右下角縮放)</span>
                                <button onClick={() => setShowYoutube(false)} style={{ background: 'red', border: 'none', color: 'white', width: '20px', cursor: 'pointer' }}>x</button>
                            </div>
                            <div style={{ flex: 1, position: 'relative', background: '#111' }}>
                                {!youtubeUrl ? (
                                    <div style={{ padding: '10px', color: '#ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                        <input
                                            type="text"
                                            placeholder="貼上 YouTube 網址..."
                                            onBlur={(e) => setYoutubeUrl(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') setYoutubeUrl(e.currentTarget.value); }}
                                            style={{ width: '90%', padding: '4px', background: '#222', color: 'white', border: '1px solid #555' }}
                                        />
                                        <p style={{ fontSize: '12px', marginTop: '4px' }}>貼上網址後按 Enter 或點擊外部</p>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '40px' }}>
                                            <YouTube
                                                videoId={extractYouTubeId(youtubeUrl)}
                                                opts={{
                                                    height: '100%',
                                                    width: '100%',
                                                    playerVars: {
                                                        autoplay: 0,
                                                        controls: 1,
                                                    },
                                                }}
                                                onReady={(e) => youtubePlayerRef.current = e.target}
                                                style={{ height: '100%' }}
                                                className={'youtube-player-iframe'}
                                            />
                                        </div>

                                        {/* YouTube Control Bar */}
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            background: '#222', padding: '0 8px', borderTop: '1px solid #444'
                                        }}>
                                            <button
                                                onClick={handleYouTubeCountIn}
                                                style={{
                                                    background: '#4CAF50', color: 'white', border: 'none',
                                                    padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                                                    fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                ▶️ 倒數播放 (Play w/ Count-In)
                                            </button>

                                            <button
                                                onClick={() => setYoutubeUrl('')}
                                                style={{
                                                    background: '#555', color: 'white', border: 'none',
                                                    padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                                                    fontSize: '11px'
                                                }}
                                            >
                                                更換影片
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </Draggable>
                )
            }

            {/* 音符編輯區 - 獨立全寬區域 */}
            {/* 音符編輯區 - 獨立全寬區域 */}
            {
                notes.length > 0 && (viewMode === 'both' || viewMode === 'score') && (
                    <div className="note-editor-area">
                        {/* 左側：編輯面板 */}
                        <div className="editor-panel">
                            <h4>🎹 編輯面板</h4>

                            {/* 選中音符資訊 */}
                            <div className="selected-note-info">
                                <span className="selected-label">選中音符：</span>
                                <span className="selected-value">
                                    {selectedNoteIndex >= 0 && selectedNoteIndex < notes.length
                                        ? (notes[selectedNoteIndex].isSeparator
                                            ? '區隔線 |'
                                            : `${notes[selectedNoteIndex].displayStr || notes[selectedNoteIndex].jianpu}(${notes[selectedNoteIndex].noteName}${notes[selectedNoteIndex].octave})`)
                                        : '未選擇'
                                    }
                                </span>
                            </div>



                            {/* 八度控制: Changed to Relative Shift */}
                            <div className="editor-group">
                                <span className="editor-label">八度</span>
                                <div className="editor-buttons">
                                    <button
                                        className="editor-btn"
                                        onClick={() => handleShiftOctave(1)}
                                        disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                    >⬆️ +8度</button>
                                    <button
                                        className="editor-btn"
                                        onClick={() => handleShiftOctave(-1)}
                                        disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                    >⬇️ -8度</button>
                                </div>
                                {/* Global Octave Shift */}
                                <div className="editor-buttons" style={{ marginTop: '4px' }}>
                                    <button
                                        className="editor-btn secondary"
                                        onClick={() => handleShiftAllOctaves(1)}
                                        title="全曲升八度"
                                    >
                                        全+8
                                    </button>
                                    <button
                                        className="editor-btn secondary"
                                        onClick={() => handleShiftAllOctaves(-1)}
                                        title="全曲降八度"
                                    >
                                        全-8
                                    </button>
                                </div>
                            </div>




                            {/* 插入音符 (改為插入空格) */}
                            <div className="editor-group">
                                <span className="editor-label">插入空格</span>
                                <div className="editor-buttons">
                                    <button
                                        className="editor-btn"
                                        onClick={() => handleInsertSymbol('0', 'before')}
                                        disabled={selectedNoteIndex < 0}
                                        onMouseEnter={() => setHoverInfo('在當前音符「前」插入空格 (休止符 0)')}
                                        onMouseLeave={() => setHoverInfo('')}
                                    >前</button>
                                    <button
                                        className="editor-btn"
                                        onClick={() => handleInsertSymbol('0', 'after')}
                                        disabled={selectedNoteIndex < 0}
                                        onMouseEnter={() => setHoverInfo('在當前音符「後」插入空格 (休止符 0)')}
                                        onMouseLeave={() => setHoverInfo('')}
                                    >後</button>
                                </div>

                                {/* 特殊符號插入 */}
                                <div className="editor-insert-row" style={{ marginTop: '8px' }}>
                                    <span>符號：</span>
                                    {/* Basic Symbols */}
                                    <button
                                        className="editor-btn small"
                                        onClick={() => handleInsertSymbol('0')}
                                        disabled={selectedNoteIndex < 0}
                                        onMouseEnter={() => setHoverInfo('插入休止符 (Rest 0)')}
                                        onMouseLeave={() => setHoverInfo('')}
                                    >0</button>
                                    <button
                                        className="editor-btn small"
                                        onClick={() => handleInsertSymbol('-')}
                                        disabled={selectedNoteIndex < 0}
                                        onMouseEnter={() => setHoverInfo('插入延音線 (Extension -)')}
                                        onMouseLeave={() => setHoverInfo('')}
                                    >-</button>


                                    {/* Advanced Symbols - Merged here */}
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol('(')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('圓滑線 / 連音開始 (Slur/Tie Start)')} onMouseLeave={() => setHoverInfo('')}>(</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol(')')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('圓滑線 / 連音結束 (Slur/Tie End)')} onMouseLeave={() => setHoverInfo('')}>)</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol(':')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('冒號 / 反覆記號 (Colon)')} onMouseLeave={() => setHoverInfo('')}>:</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol('_')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('底線 / 八分音符 (Eighth)')} onMouseLeave={() => setHoverInfo('')}>_</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol('=')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('雙底線 / 十六分音符 (Sixteenth)')} onMouseLeave={() => setHoverInfo('')}>=</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol('>')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('重音 (Accent)')} onMouseLeave={() => setHoverInfo('')}>&gt;</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol('[')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('三連音 / 群組開始 (Triplets / Tuplets Start)')} onMouseLeave={() => setHoverInfo('')}>[</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol(']')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('三連音 / 群組結束 (Triplets / Tuplets End)')} onMouseLeave={() => setHoverInfo('')}>]</button>
                                    <button className="editor-btn small" onClick={() => handleInsertSymbol('|')} disabled={selectedNoteIndex < 0} onMouseEnter={() => setHoverInfo('小節線 (Separator |)')} onMouseLeave={() => setHoverInfo('')}>|</button>
                                </div>
                            </div>


                            {/* 功能說明欄 (移動至此) */}
                            <div className="editor-info-bar" style={{
                                minHeight: '24px',
                                margin: '8px 0',
                                padding: '4px 8px',
                                background: '#333',
                                borderRadius: '4px',
                                color: '#4caf50',
                                fontSize: '0.9rem',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                ℹ️ {hoverInfo || '滑鼠移至按鈕可查看說明'}
                            </div>



                            {/* 刪除按鈕 */}
                            <button
                                className="delete-note-btn"
                                onClick={handleDeleteNote}
                                disabled={selectedNoteIndex < 0}
                            >
                                🗑️ 刪除此{selectedNoteIndex >= 0 && notes[selectedNoteIndex]?.isSeparator ? '區隔線' : '音符'}
                            </button>
                        </div>

                        {/* 右側：音符列表 */}
                        <div className="notes-list-area">
                            <div className="section-header">
                                <h3>🎵 音符列表 ({notes.filter(n => !n.isSeparator).length} 個) - 點擊音符進行編輯</h3>
                            </div>
                            <div className="notes-display">
                                {notes.map((note, idx) => (
                                    <div
                                        key={idx}
                                        className={`note-chip-wrapper ${idx === selectedNoteIndex ? 'selected' : ''}`}
                                        onClick={(e) => handleNoteSelect(idx, e)}
                                    >
                                        <span
                                            className={`note-chip ${idx === currentNoteIndex ? 'active' : ''} ${note.isSeparator ? 'separator' : ''} ${note.octave > 4 ? 'high' : ''} ${note.octave < 4 ? 'low' : ''} ${note.noteName?.includes('#') ? 'sharp' : ''} ${note.noteName?.includes('b') ? 'flat' : ''}`}
                                            title={note.isSeparator ? '區隔線' : (note.noteName ? `${note.noteName}${note.octave}` : note.displayStr)}
                                        >
                                            {note.isSeparator ? '|' : (note.displayStr || note.jianpu)}
                                            {!note.isSeparator && (
                                                <small>{note.noteName ? `${note.noteName}${note.octave !== 4 ? note.octave : ''}` : ''}</small>
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Play Controls - Moved here */}
                            <div className="controls-bar" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px', gap: '12px' }}>
                                {/* Timer Display */}
                                <div style={{
                                    background: '#111',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontFamily: 'monospace',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    color: isPlaying ? '#4caf50' : '#666',
                                    border: '1px solid #333',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                                    minWidth: '100px',
                                    textAlign: 'center'
                                }}>
                                    {formatTime(playTime)}
                                </div>

                                <button
                                    className={`control-btn play ${isPlaying ? 'active' : ''}`}
                                    onClick={togglePlay}

                                    disabled={audioLoading}
                                    title={isPlaying ? "停止播放" : "播放樂譜"}
                                    style={{
                                        padding: '8px 24px',
                                        fontSize: '16px',
                                        background: isPlaying ? '#f44336' : '#4caf50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {audioLoading ? '⏳' : (isPlaying ? '⏹ 停止' : '▶ 播放')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 指板顯示 */}
            <ReadFretboard
                notes={notes}
                currentNoteIndex={currentNoteIndex}
                fretCount={fretCount}
                onNoteClick={handleNoteClick}
                startString={startString}
                onStartStringChange={setStartString}
                rangeOctave={rangeOctave}
                onRangeOctaveChange={setRangeOctave}
                musicKey={key}
                scaleType={scaleType}
                showScaleGuide={showScaleGuide}
            />

            {/* Score Display (Music Notation & Tabs) */}
            {
                notes.length > 0 && (
                    <div style={{ padding: '0 20px 20px 20px' }}>
                        <h3 style={{ color: '#aaa', marginBottom: '10px' }}>🎼 五線譜/六線譜預覽</h3>
                        <ScoreDisplay
                            notes={notes}
                            notePositions={notePositions}
                            timeSignature={timeSignature}
                            currentNoteIndex={currentNoteIndex}
                        />
                    </div>
                )
            }

            {/* 儲存/載入按鈕 */}
            <div className="score-actions">
                <button
                    className="score-btn save"
                    onClick={handleSaveFile}
                    title="儲存為 .json 檔案"
                >
                    💾 儲存檔案 (Save)
                </button>
                <button
                    className="score-btn load"
                    onClick={() => loadInputRef.current?.click()}
                    title="開啟 .json 檔案"
                >
                    📂 開啟檔案 (Open)
                </button>
                <button
                    className="score-btn copy"
                    style={{
                        background: '#FF9800',
                        color: 'white'
                    }}
                    onClick={handleCopyCurrentScore}
                    title="複製到剪貼簿"
                >
                    📋 複製 (Copy)
                </button>
                <input
                    ref={loadInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleLoadFile}
                    hidden
                />
            </div>
        </div >
    );

}

export default ReadMode;

