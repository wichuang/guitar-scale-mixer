/**
 * ReadMode - 主控制器
 * 整合所有子元件，管理狀態
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    parseJianpuText,
    jianpuToNote,
    calculate3NPSPositions,
    calculateCAGEDPositions
} from '../../parsers/JianpuParser.js';
import { Note } from '../../core/models/Note.js';
import { useAudio } from '../../hooks/useAudio.js';
import { usePlayback } from '../../hooks/usePlayback.js';
import { useAutosave } from '../../hooks/useAutosave.js';
import { useKeyboardShortcuts, KeyboardShortcutsHelp, DEFAULT_SHORTCUTS } from '../../hooks/useKeyboardShortcuts.jsx';
import { useLoopSection } from '../../hooks/useLoopSection.js';
import { useMetronome } from '../../hooks/useMetronome.js';
import { usePracticeTimer } from '../../hooks/usePracticeTimer.js';
import ReadFretboard from '../ReadFretboard.jsx';
import ScoreDisplay from '../ScoreDisplay/index.jsx';
import PracticeTools from '../PracticeTools/index.jsx';
import PracticeStats from '../PracticeStats/index.jsx';
import UploadPanel from './UploadPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import NoteEditor from './NoteEditor.jsx';
import FileActions from './FileActions.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import { READ_SYNC_CHANNEL } from './ReadPopup.jsx';
import './ReadMode.css';

const AUTOSAVE_KEY = 'guitar-mixer-readmode-autosave';

/**
 * Normalize notes loaded from JSON (autosave/file).
 * Note class getters (midiNote, isSeparator, etc.) are lost after JSON serialization.
 * This ensures all notes have the expected plain properties.
 */
/**
 * 從 displayStr 推算簡譜八度偏移（不依賴 note.octave，避免被 Note.fromMidi 污染）
 */
function getOctaveOffsetFromDisplay(displayStr) {
    if (!displayStr) return 0;
    if (displayStr.startsWith('₌') || displayStr.startsWith('__')) return -2;
    if (displayStr.startsWith('₋') || (displayStr.startsWith('_') && !displayStr.startsWith('__'))) return -1;
    const cleaned = displayStr.replace(/[#b♯♭]/g, '');
    return (cleaned.match(/[.·]/g) || []).length;
}

function normalizeNotes(notes) {
    if (!notes || !Array.isArray(notes)) return [];
    return notes.map(n => {
        const out = { ...n };
        // Ensure midiNote exists (getter lost after JSON round-trip of Note instances)
        if (out.midi != null && out.midiNote == null) {
            out.midiNote = out.midi;
        }
        // Ensure type flags exist as plain properties
        if (out._type && out.isNote == null) {
            out.isNote = out._type === 'note';
            out.isRest = out._type === 'rest';
            out.isExtension = out._type === 'extension';
            out.isSeparator = out._type === 'separator';
            out.isSymbol = out._type === 'symbol';
        }
        // 修復簡譜音符的 octave（從 displayStr 推算，避免 C 分界八度污染）
        if (out.jianpu >= 1 && out.jianpu <= 7 && out.displayStr) {
            const correctOctave = 4 + getOctaveOffsetFromDisplay(out.displayStr);
            if (out.octave !== correctOctave) {
                out.octave = correctOctave;
            }
        }
        return out;
    });
}

function ReadMode({ guitarType, setGuitarType, fretCount }) {
    // ===== 基本狀態 =====
    const [rawText, setRawText] = useState('');
    const [notes, setNotes] = useState([]);
    const [editableText, setEditableText] = useState('');
    const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1);

    // ===== 音樂設定 =====
    const [key, setKey] = useState('C');
    const [scaleType, setScaleType] = useState('Major');
    const [tempo, setTempo] = useState(120);
    const [timeSignature, setTimeSignature] = useState('4/4');
    const [startString, setStartString] = useState(5);
    const [rangeOctave, setRangeOctave] = useState(0);
    const [cagedPosition, setCagedPosition] = useState(null);
    const [octaveOffset, setOctaveOffset] = useState(-1);

    // ===== 顯示設定 =====
    const [viewMode, setViewMode] = useState('both');
    const [showScaleGuide, setShowScaleGuide] = useState(true);
    const [displayMode, setDisplayMode] = useState('notes'); // 指板標示：'notes' (ABC) | 'intervals' (123)

    // ===== OCR 來源圖片（base64 data URL 陣列，存檔時一併儲存，最多 5 張） =====
    const [sourceImages, setSourceImages] = useState([]);

    // ===== YouTube 狀態 =====
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [showYoutube, setShowYoutube] = useState(false);
    const [youtubeLayout, setYoutubeLayout] = useState({ x: 50, y: 50, width: 320, height: 180 });

    // ===== 顯示 / Popup 控制 =====
    const [showInlineFretboard, setShowInlineFretboard] = useState(false); // 預設關閉指板（圖2）
    const [showInlineScore, setShowInlineScore] = useState(false); // 預設關閉 Score Preview（圖3）
    const fretboardWindowRef = useRef(null);
    const scoreWindowRef = useRef(null);

    // ===== Edit/Play 入口：預設不展開 NoteEditor，由使用者主動進入 =====
    const [editPlayOpen, setEditPlayOpen] = useState(false);
    const [editPlayInitialMode, setEditPlayInitialMode] = useState('edit'); // 'edit' | 'play'

    // ===== Practice Tools 狀態 =====
    const [showPracticeTools, setShowPracticeTools] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [showPracticeStats, setShowPracticeStats] = useState(false);
    const [showSessionSummary, setShowSessionSummary] = useState(false);
    const [lastSession, setLastSession] = useState(null);

    // ===== Hooks =====
    const { playNote, resumeAudio, isLoading: audioLoading } = useAudio(guitarType);
    const { debouncedSave, load } = useAutosave({ key: AUTOSAVE_KEY });

    // 整首移調（±八度）：非破壞性。套用在指板/播放/譜面「檢視」上；
    // 編輯（NoteEditor）與存檔仍使用原始 notes，不會改到譜本身。
    const viewNotes = useMemo(() => {
        if (!rangeOctave) return notes;
        return notes.map(n => {
            const m = n.midiNote ?? n.midi;
            if (m == null) return n;
            const shifted = m + rangeOctave * 12;
            return { ...n, midi: shifted, midiNote: shifted };
        });
    }, [notes, rangeOctave]);

    // 計算指板位置（memoized）：選了 CAGED 指型用 CAGED 定位（指板/播放/譜面統一），
    // 否則沿用 3NPS。播放發聲弦、五線/六線譜位置都會跟著一致。
    const notePositions = useMemo(() =>
        cagedPosition
            ? calculateCAGEDPositions(viewNotes, key, cagedPosition)
            : calculate3NPSPositions(viewNotes, startString, key, scaleType, rangeOctave),
        [viewNotes, startString, key, scaleType, rangeOctave, cagedPosition]
    );

    // Loop Section Hook
    const loopSection = useLoopSection({
        totalNotes: notes.length,
        onLoopStart: () => console.log('Loop started'),
        onLoopEnd: () => console.log('Loop ended')
    });

    // 播放 Hook（含 loop section 整合）
    const {
        isPlaying,
        currentNoteIndex,
        playTime,
        enableCountIn,
        countInStatus,
        play,
        pause,
        stop,
        togglePlay,
        handleNoteClick,
        setEnableCountIn,
        startCountIn
    } = usePlayback({
        notes: viewNotes,
        notePositions,
        tempo,
        timeSignature,
        playNote,
        audioLoading,
        resumeAudio,
        loopSection
    });

    // Metronome Hook
    const metronome = useMetronome({
        initialBpm: tempo,
        initialTimeSignature: timeSignature
    });

    // 同步 Metronome BPM 與播放 tempo
    const metronomSetBpm = metronome.setBpm;
    useEffect(() => {
        metronomSetBpm(tempo);
    }, [tempo, metronomSetBpm]);

    // ===== BroadcastChannel — 同步狀態給 Guitar / Score popup 視窗 =====
    const bcRef = useRef(null);
    useEffect(() => {
        const bc = new BroadcastChannel(READ_SYNC_CHANNEL);
        bcRef.current = bc;
        bc.onmessage = (e) => {
            const msg = e.data;
            if (!msg) return;
            if (msg.type === 'request-state') {
                publishStateRef.current?.();
            } else if (msg.type === 'set-caged') {
                setCagedPosition(msg.value ?? null);
            } else if (msg.type === 'set-key') {
                setKey(msg.value);
            } else if (msg.type === 'set-scale') {
                setScaleType(msg.value);
            } else if (msg.type === 'set-tempo') {
                const t = Number(msg.value);
                if (!Number.isNaN(t)) setTempo(t);
            } else if (msg.type === 'set-octave') {
                setRangeOctave(msg.value || 0);
            } else if (msg.type === 'set-display') {
                setDisplayMode(msg.value === 'intervals' ? 'intervals' : 'notes');
            }
        };
        return () => { bc.close(); bcRef.current = null; };
    }, []);

    // ref to latest publish — 避免在 effect deps 中列入所有狀態
    const publishStateRef = useRef(null);

    const openFretboardPopup = useCallback(() => {
        const url = `${window.location.origin}${window.location.pathname}?view=read-fretboard`;
        if (fretboardWindowRef.current && !fretboardWindowRef.current.closed) {
            fretboardWindowRef.current.focus();
            return;
        }
        fretboardWindowRef.current = window.open(url, 'guitar-mixer-fretboard',
            'width=1200,height=400,scrollbars=yes');
    }, []);

    const openScorePopup = useCallback(() => {
        const url = `${window.location.origin}${window.location.pathname}?view=read-score`;
        if (scoreWindowRef.current && !scoreWindowRef.current.closed) {
            scoreWindowRef.current.focus();
            return;
        }
        scoreWindowRef.current = window.open(url, 'guitar-mixer-score',
            'width=1400,height=500,scrollbars=yes');
    }, []);

    // Practice Timer Hook
    const practiceTimer = usePracticeTimer({
        onSessionEnd: (session) => {
            setLastSession(session);
            setShowSessionSummary(true);
        }
    });

    // 播放開始時啟動練習計時
    const handlePlayWithTracking = useCallback((startIndex = 0) => {
        if (!practiceTimer.isActive) {
            practiceTimer.startSession({
                songName: 'Practice Session',
                bpm: tempo,
                key: key,
                scaleType: scaleType
            });
        } else if (practiceTimer.isPaused) {
            practiceTimer.resumeSession();
        }
        practiceTimer.updateBpm(tempo);
        play(startIndex);
    }, [practiceTimer, tempo, key, scaleType, play]);

    // 停止時結束練習紀錄
    const handleStopWithTracking = useCallback(() => {
        stop();
        if (practiceTimer.isActive && practiceTimer.elapsedTime > 10) {
            // 只有練習超過 10 秒才儲存
            practiceTimer.endSession();
        } else if (practiceTimer.isActive) {
            practiceTimer.cancelSession();
        }
    }, [stop, practiceTimer]);

    // Keyboard Shortcuts
    const shortcutHandlers = useMemo(() => ({
        togglePlay: () => {
            if (isPlaying) {
                pause();
                practiceTimer.pauseSession();
            } else {
                handlePlayWithTracking(selectedNoteIndex >= 0 ? selectedNoteIndex : 0);
            }
        },
        stop: () => handleStopWithTracking(),
        prevNote: () => setSelectedNoteIndex(prev => Math.max(0, prev - 1)),
        nextNote: () => setSelectedNoteIndex(prev => Math.min(notes.length - 1, prev + 1)),
        goToStart: () => setSelectedNoteIndex(0),
        goToEnd: () => setSelectedNoteIndex(notes.length - 1),
        tempoUp: () => setTempo(prev => Math.min(240, prev + 1)),
        tempoDown: () => setTempo(prev => Math.max(40, prev - 1)),
        tempoUp5: () => setTempo(prev => Math.min(240, prev + 5)),
        tempoDown5: () => setTempo(prev => Math.max(40, prev - 5)),
        setLoopStart: () => loopSection.setStart(selectedNoteIndex >= 0 ? selectedNoteIndex : currentNoteIndex),
        setLoopEnd: () => loopSection.setEnd(selectedNoteIndex >= 0 ? selectedNoteIndex : currentNoteIndex),
        toggleLoop: () => loopSection.toggleLoop(),
        clearLoop: () => loopSection.clearLoop(),
        toggleMetronome: () => metronome.toggle(),
        repeat: () => handlePlayWithTracking(loopSection.hasValidLoop && loopSection.isLoopEnabled ? loopSection.loopStart : 0),
        showHelp: () => setShowShortcutsHelp(prev => !prev)
    }), [isPlaying, pause, practiceTimer, handlePlayWithTracking, selectedNoteIndex, handleStopWithTracking, notes.length, loopSection, metronome, currentNoteIndex]);

    useKeyboardShortcuts(shortcutHandlers, { enabled: true });

    // ===== Popup 同步 — 將相關狀態 publish 到 BroadcastChannel =====
    const publishState = useCallback(() => {
        if (!bcRef.current) return;
        bcRef.current.postMessage({
            type: 'state',
            payload: {
                notes: viewNotes,
                notePositions,
                currentNoteIndex,
                isPlaying,
                playTime,
                musicKey: key,
                scaleType,
                tempo,
                timeSignature,
                startString,
                rangeOctave,
                cagedPosition,
                showScaleGuide,
                displayMode,
                fretCount,
                instrument: guitarType,
            }
        });
    }, [viewNotes, notePositions, currentNoteIndex, isPlaying, playTime, key, scaleType, tempo, timeSignature, startString, rangeOctave, cagedPosition, showScaleGuide, displayMode, fretCount, guitarType]);
    publishStateRef.current = publishState;
    useEffect(() => { publishState(); }, [publishState]);

    // ===== 載入自動儲存 =====
    useEffect(() => {
        try {
            const saved = load();
            if (saved) {
                if (saved.text) {
                    setEditableText(saved.text);
                    setRawText(saved.text);
                }
                if (saved.notes) setNotes(normalizeNotes(saved.notes));
                if (saved.key) setKey(saved.key);
                if (saved.scaleType) setScaleType(saved.scaleType);
                if (saved.tempo) setTempo(saved.tempo);
                if (saved.timeSignature) setTimeSignature(saved.timeSignature);
                if (typeof saved.startString === 'number') setStartString(saved.startString);
                if (saved.cagedPosition !== undefined) setCagedPosition(saved.cagedPosition);
                if (typeof saved.octaveOffset === 'number') setOctaveOffset(saved.octaveOffset);
                if (saved.showScaleGuide !== undefined) setShowScaleGuide(saved.showScaleGuide);
                if (saved.youtubeUrl) setYoutubeUrl(saved.youtubeUrl);
                if (saved.showYoutube !== undefined) setShowYoutube(saved.showYoutube);
                if (saved.youtubeLayout) setYoutubeLayout(saved.youtubeLayout);
                if (saved.viewMode) setViewMode(saved.viewMode);
                if (saved.instrument && setGuitarType) setGuitarType(saved.instrument);
            }
        } catch (e) {
            console.error('Failed to load autosave', e);
        }
    }, [load]);

    // ===== 自動儲存 =====
    useEffect(() => {
        const dataToSave = {
            text: editableText,
            notes: notes,
            key: key,
            scaleType: scaleType,
            tempo: tempo,
            timeSignature: timeSignature,
            startString: startString,
            cagedPosition: cagedPosition,
            octaveOffset: octaveOffset,
            showScaleGuide: showScaleGuide,
            youtubeUrl,
            showYoutube,
            youtubeLayout,
            viewMode,
            instrument: guitarType
        };
        debouncedSave(dataToSave);
    }, [editableText, notes, key, scaleType, tempo, timeSignature, startString, cagedPosition, octaveOffset, showScaleGuide, youtubeUrl, showYoutube, youtubeLayout, viewMode, guitarType, debouncedSave]);

    // ===== 調號/音階變更時更新音符 =====
    useEffect(() => {
        setNotes(prevNotes => prevNotes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension || note.isSymbol) return note;

            // 簡譜音符（有 jianpu 1-7）：用 jianpuToNote 重算，保持簡譜八度一致
            if (note.jianpu >= 1 && note.jianpu <= 7) {
                // 從 displayStr 推算八度偏移（比 note.octave 更可靠，不受 Note.fromMidi 污染）
                let noteOctaveOffset = 0;
                const ds = note.displayStr || '';
                if (ds.startsWith('₌') || ds.startsWith('__')) {
                    noteOctaveOffset = -2;
                } else if (ds.startsWith('₋') || (ds.startsWith('_') && !ds.startsWith('__'))) {
                    noteOctaveOffset = -1;
                } else {
                    // 計算高八度點數（只算非升降號的 ·/.）
                    const cleaned = ds.replace(/[#b♯♭]/g, '');
                    const dots = (cleaned.match(/[.·]/g) || []).length;
                    noteOctaveOffset = dots;
                }

                let acc = note.accidentalStr || '';
                if (!acc && ds) {
                    if (ds.includes('#')) acc = '#';
                    if (ds.includes('b')) acc = 'b';
                }
                const noteInput = String(note.jianpu) + acc;
                const noteData = jianpuToNote(noteInput, noteOctaveOffset, key, scaleType);
                if (noteData) {
                    return { ...note, ...noteData, accidentalStr: acc };
                }
                return note;
            }

            // 非簡譜音符（GP 匯入等）：從 MIDI 重新計算簡譜，保持絕對音高不變
            const midiVal = note.midi ?? note.midiNote;
            if (midiVal != null) {
                const recalc = Note.fromMidi(midiVal, {
                    key, scaleType,
                    index: note.index,
                    duration: note.duration,
                    stringIndex: note.stringIndex,
                    fret: note.fret,
                    technique: note.technique,
                    format: note.format,
                    displayOctaveShift: note.displayOctaveShift || 0
                });
                return {
                    ...note,
                    jianpu: recalc.jianpu,
                    noteName: recalc.noteName,
                    displayStr: recalc.displayStr,
                    accidentalStr: recalc.accidentalStr,
                    octave: recalc.octave,
                    displayOctaveShift: recalc.displayOctaveShift
                };
            }

            return note;
        }));
    }, [key, scaleType]);

    // ===== 手動解析 =====
    const handleManualParse = useCallback(() => {
        const parsedNotes = parseJianpuText(editableText, key, scaleType, octaveOffset);
        setNotes(parsedNotes);
    }, [editableText, key, scaleType, octaveOffset]);

    // ===== 檔案載入處理 =====
    const handleLoadFile = useCallback((content) => {
        const actualData = content.data ? content.data : content;

        if (actualData && (actualData.notes || actualData.text)) {
            setEditableText(actualData.text || '');
            setNotes(normalizeNotes(actualData.notes || []));
            setKey(actualData.key || 'C');
            setScaleType(actualData.scaleType || 'Major');
            setTempo(actualData.tempo || 120);
            if (typeof actualData.startString === 'number') setStartString(actualData.startString);
            if (actualData.cagedPosition !== undefined) setCagedPosition(actualData.cagedPosition);
            if (typeof actualData.octaveOffset === 'number') setOctaveOffset(actualData.octaveOffset);
            if (actualData.youtubeUrl) setYoutubeUrl(actualData.youtubeUrl);
            if (actualData.showYoutube !== undefined) setShowYoutube(actualData.showYoutube);
            if (actualData.youtubeLayout) setYoutubeLayout(actualData.youtubeLayout);
            if (actualData.viewMode) setViewMode(actualData.viewMode);
            if (actualData.instrument && setGuitarType) setGuitarType(actualData.instrument);
            // 支援新格式 sourceImages 陣列與舊格式單張 sourceImage
            let loadedImageCount = 0;
            if (Array.isArray(actualData.sourceImages)) {
                setSourceImages(actualData.sourceImages);
                loadedImageCount = actualData.sourceImages.length;
            } else if (actualData.sourceImage) {
                setSourceImages([actualData.sourceImage]);
                loadedImageCount = 1;
            } else {
                setSourceImages([]);
            }
            const imageMsg = loadedImageCount > 0
                ? `（含 ${loadedImageCount} 張原圖）`
                : '（無原圖 — 此檔可能是舊版本存的）';
            alert(`樂譜載入成功！${imageMsg}`);
        } else {
            alert('載入失敗：檔案格式不符');
        }
    }, []);

    // ===== 點擊外部關閉選單 =====
    useEffect(() => {
        const handleClickOutside = () => {
            // Can be used for menu closing if needed
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="read-mode">
            <div className="read-controls">
                {/* 上傳區 */}
                <UploadPanel
                    musicKey={key}
                    scaleType={scaleType}
                    octaveOffset={octaveOffset}
                    onNotesChange={setNotes}
                    onTextChange={setEditableText}
                    onRawTextChange={setRawText}
                    onSourceImagesChange={setSourceImages}
                    onImportNotes={(result) => {
                        if (result.notes) {
                            setNotes(normalizeNotes(result.notes));
                        }
                        if (result.metadata) {
                            if (result.metadata.key) setKey(result.metadata.key);
                            if (result.metadata.tempo) setTempo(result.metadata.tempo);
                            if (result.metadata.timeSignature) setTimeSignature(result.metadata.timeSignature);
                        }
                    }}
                />

                {/* 設定區 */}
                <SettingsPanel
                    musicKey={key}
                    scaleType={scaleType}
                    timeSignature={timeSignature}
                    tempo={tempo}
                    startString={startString}
                    cagedPosition={cagedPosition}
                    showScaleGuide={showScaleGuide}
                    displayMode={displayMode}
                    onDisplayModeChange={setDisplayMode}
                    enableCountIn={enableCountIn}
                    showYoutube={showYoutube}
                    viewMode={viewMode}
                    instrument={guitarType}
                    onKeyChange={setKey}
                    onScaleTypeChange={setScaleType}
                    onTimeSignatureChange={setTimeSignature}
                    onTempoChange={setTempo}
                    onStartStringChange={setStartString}
                    onCagedPositionChange={setCagedPosition}
                    onShowScaleGuideChange={setShowScaleGuide}
                    onEnableCountInChange={setEnableCountIn}
                    onShowYoutubeChange={setShowYoutube}
                    onViewModeChange={setViewMode}
                    onInstrumentChange={setGuitarType}
                />


                {/* 檔案操作 (Save/Open/Copy/Export) */}
                <FileActions
                    editableText={editableText}
                    notes={notes}
                    musicKey={key}
                    scaleType={scaleType}
                    tempo={tempo}
                    timeSignature={timeSignature}
                    startString={startString}
                    cagedPosition={cagedPosition}
                    octaveOffset={octaveOffset}
                    youtubeUrl={youtubeUrl}
                    showYoutube={showYoutube}
                    youtubeLayout={youtubeLayout}
                    viewMode={viewMode}
                    instrument={guitarType}
                    sourceImages={sourceImages}
                    onLoadFile={handleLoadFile}
                    fileName="guitar_score"
                />
            </div>

            {/* YouTube Player */}
            <YouTubePlayer
                show={showYoutube}
                youtubeUrl={youtubeUrl}
                youtubeLayout={youtubeLayout}
                enableCountIn={enableCountIn}
                tempo={tempo}
                onClose={() => setShowYoutube(false)}
                onUrlChange={setYoutubeUrl}
                onLayoutChange={setYoutubeLayout}
                onCountInPlay={startCountIn}
            />

            {/* Edit/Play 入口卡（notes 已載入時顯示；預設不直接展開 NoteEditor） */}
            {notes.length > 0 && !editPlayOpen && (
                <div className="edit-play-entry">
                    <div className="edit-play-entry-info">
                        <span className="edit-play-entry-title">已載入 {notes.filter(n => !n.isSeparator && !n.isSymbol).length} 個音符</span>
                        <span className="edit-play-entry-hint">點右側按鈕進入 Edit / Play 模式（可全螢幕編輯與播放）</span>
                    </div>
                    <div className="edit-play-entry-actions">
                        <button
                            className="edit-play-entry-btn primary"
                            onClick={() => { setEditPlayInitialMode('edit'); setEditPlayOpen(true); }}
                            title="進入全螢幕 Edit / Play 模式"
                        >✏️ Edit / ▶ Play</button>
                    </div>
                </div>
            )}

            {/* 音符編輯區 — 改為僅在 editPlayOpen=true 時以全螢幕渲染 */}
            {editPlayOpen && notes.length > 0 && (
                <NoteEditor
                    notes={notes}
                    notePositions={notePositions}
                    currentNoteIndex={currentNoteIndex}
                    selectedNoteIndex={selectedNoteIndex}
                    isPlaying={isPlaying}
                    playTime={playTime}
                    audioLoading={audioLoading}
                    musicKey={key}
                    scaleType={scaleType}
                    tempo={tempo}
                    onTempoChange={setTempo}
                    onNotesChange={setNotes}
                    onTextChange={setEditableText}
                    onSelectedNoteChange={setSelectedNoteIndex}
                    onTogglePlay={() => {
                        // iOS/iPadOS: 必須在用戶手勢的同步階段 resume AudioContext
                        if (resumeAudio) resumeAudio();
                        if (isPlaying) {
                            pause();
                            practiceTimer.pauseSession();
                        } else {
                            handlePlayWithTracking(selectedNoteIndex >= 0 ? selectedNoteIndex : 0);
                        }
                    }}
                    playNote={playNote}
                    onOpenFretboardPopup={openFretboardPopup}
                    onOpenScorePopup={openScorePopup}
                    showInlineFretboard={showInlineFretboard}
                    onToggleInlineFretboard={() => setShowInlineFretboard(p => !p)}
                    showInlineScore={showInlineScore}
                    onToggleInlineScore={() => setShowInlineScore(p => !p)}
                    onClose={() => setEditPlayOpen(false)}
                    initialPlayMode={editPlayInitialMode}
                    instrument={guitarType}
                    onInstrumentChange={setGuitarType}
                />
            )}

            {/* 指板顯示 — 預設關閉，可由 NoteEditor 的 Guitar 鈕開新視窗或開 inline */}
            {showInlineFretboard && (
                <ReadFretboard
                    notes={viewNotes}
                    currentNoteIndex={currentNoteIndex}
                    fretCount={fretCount}
                    onNoteClick={handleNoteClick}
                    onPlayMidi={(midi) => { resumeAudio?.(); playNote(midi); }}
                    startString={startString}
                    onStartStringChange={setStartString}
                    rangeOctave={rangeOctave}
                    onRangeOctaveChange={setRangeOctave}
                    cagedPosition={cagedPosition}
                    musicKey={key}
                    scaleType={scaleType}
                    displayMode={displayMode}
                    showScaleGuide={showScaleGuide}
                    toolbarExtra={
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <PracticeTools
                                tempo={tempo}
                                timeSignature={timeSignature}
                                totalNotes={notes.length}
                                onTempoChange={setTempo}
                                onTimeSignatureChange={setTimeSignature}
                                isExpanded={showPracticeTools}
                                onToggleExpand={() => setShowPracticeTools(prev => !prev)}
                            />
                            <PracticeStats
                                showSessionSummary={showSessionSummary}
                                lastSession={lastSession}
                                onSessionSummaryClose={() => setShowSessionSummary(false)}
                                isExpanded={showPracticeStats}
                                onToggleExpand={() => setShowPracticeStats(prev => !prev)}
                            />
                        </div>
                    }
                />
            )}

            {/* Practice Tools / Stats — 即使指板關閉時也要可用 */}
            {!showInlineFretboard && (
                <div style={{ padding: '8px 20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <PracticeTools
                        tempo={tempo}
                        timeSignature={timeSignature}
                        totalNotes={notes.length}
                        onTempoChange={setTempo}
                        onTimeSignatureChange={setTimeSignature}
                        isExpanded={showPracticeTools}
                        onToggleExpand={() => setShowPracticeTools(prev => !prev)}
                    />
                    <PracticeStats
                        showSessionSummary={showSessionSummary}
                        lastSession={lastSession}
                        onSessionSummaryClose={() => setShowSessionSummary(false)}
                        isExpanded={showPracticeStats}
                        onToggleExpand={() => setShowPracticeStats(prev => !prev)}
                    />
                </div>
            )}

            {/* Score Display — 預設關閉，可由 NoteEditor 的 Score 鈕開新視窗或開 inline */}
            {showInlineScore && notes.length > 0 && (
                <div style={{ padding: '0 20px 20px 20px' }}>
                    <h3 style={{ color: '#aaa', marginBottom: '10px' }}>Score Preview</h3>
                    <ScoreDisplay
                        notes={viewNotes}
                        notePositions={notePositions}
                        timeSignature={timeSignature}
                        currentNoteIndex={currentNoteIndex}
                    />
                </div>
            )}

            {/* Keyboard Shortcuts Help */}
            {showShortcutsHelp && (
                <KeyboardShortcutsHelp
                    shortcuts={DEFAULT_SHORTCUTS}
                    onClose={() => setShowShortcutsHelp(false)}
                />
            )}
        </div>
    );
}

export default ReadMode;
