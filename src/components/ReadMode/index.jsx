/**
 * ReadMode - 主控制器
 * 整合所有子元件，管理狀態
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    parseJianpuText,
    jianpuToNote,
    calculate3NPSPositions
} from '../../parsers/JianpuParser.js';
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
import './ReadMode.css';

const AUTOSAVE_KEY = 'guitar-mixer-readmode-autosave';

/**
 * Normalize notes loaded from JSON (autosave/file).
 * Note class getters (midiNote, isSeparator, etc.) are lost after JSON serialization.
 * This ensures all notes have the expected plain properties.
 */
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
        return out;
    });
}

function ReadMode({ guitarType, fretCount }) {
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
    const [octaveOffset, setOctaveOffset] = useState(-1);

    // ===== 顯示設定 =====
    const [viewMode, setViewMode] = useState('both');
    const [showScaleGuide, setShowScaleGuide] = useState(true);

    // ===== YouTube 狀態 =====
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [showYoutube, setShowYoutube] = useState(false);
    const [youtubeLayout, setYoutubeLayout] = useState({ x: 50, y: 50, width: 320, height: 180 });

    // ===== Practice Tools 狀態 =====
    const [showPracticeTools, setShowPracticeTools] = useState(false);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [showPracticeStats, setShowPracticeStats] = useState(false);
    const [showSessionSummary, setShowSessionSummary] = useState(false);
    const [lastSession, setLastSession] = useState(null);

    // ===== Hooks =====
    const { playNote, resumeAudio, isLoading: audioLoading } = useAudio(guitarType);
    const { debouncedSave, load } = useAutosave({ key: AUTOSAVE_KEY });

    // 計算 3NPS 位置（memoized）
    const notePositions = useMemo(() =>
        calculate3NPSPositions(notes, startString, key, scaleType, rangeOctave),
        [notes, startString, key, scaleType, rangeOctave]
    );

    // 播放 Hook
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
        notes,
        notePositions,
        tempo,
        timeSignature,
        playNote,
        audioLoading,
        resumeAudio
    });

    // Loop Section Hook
    const loopSection = useLoopSection({
        totalNotes: notes.length,
        onLoopStart: () => console.log('Loop started'),
        onLoopEnd: () => console.log('Loop ended')
    });

    // Metronome Hook
    const metronome = useMetronome({
        initialBpm: tempo,
        initialTimeSignature: timeSignature
    });

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
                if (typeof saved.octaveOffset === 'number') setOctaveOffset(saved.octaveOffset);
                if (saved.showScaleGuide !== undefined) setShowScaleGuide(saved.showScaleGuide);
                if (saved.youtubeUrl) setYoutubeUrl(saved.youtubeUrl);
                if (saved.showYoutube !== undefined) setShowYoutube(saved.showYoutube);
                if (saved.youtubeLayout) setYoutubeLayout(saved.youtubeLayout);
                if (saved.viewMode) setViewMode(saved.viewMode);
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
            octaveOffset: octaveOffset,
            showScaleGuide: showScaleGuide,
            youtubeUrl,
            showYoutube,
            youtubeLayout,
            viewMode
        };
        debouncedSave(dataToSave);
    }, [editableText, notes, key, scaleType, tempo, timeSignature, startString, octaveOffset, showScaleGuide, youtubeUrl, showYoutube, youtubeLayout, viewMode, debouncedSave]);

    // ===== 調號/音階變更時更新音符 =====
    useEffect(() => {
        setNotes(prevNotes => prevNotes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension) return note;

            const noteOctaveOffset = (note.octave || 4) - 4;
            let acc = note.accidentalStr || '';
            if (!acc && note.displayStr) {
                if (note.displayStr.includes('#')) acc = '#';
                if (note.displayStr.includes('b')) acc = 'b';
            }

            const noteInput = String(note.jianpu) + acc;
            const noteData = jianpuToNote(noteInput, noteOctaveOffset, key, scaleType);

            if (noteData) {
                return {
                    ...note,
                    ...noteData,
                    accidentalStr: acc
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
            if (typeof actualData.octaveOffset === 'number') setOctaveOffset(actualData.octaveOffset);
            if (actualData.youtubeUrl) setYoutubeUrl(actualData.youtubeUrl);
            if (actualData.showYoutube !== undefined) setShowYoutube(actualData.showYoutube);
            if (actualData.youtubeLayout) setYoutubeLayout(actualData.youtubeLayout);
            if (actualData.viewMode) setViewMode(actualData.viewMode);
            alert('樂譜載入成功！');
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
                />

                {/* 設定區 */}
                <SettingsPanel
                    musicKey={key}
                    scaleType={scaleType}
                    timeSignature={timeSignature}
                    tempo={tempo}
                    startString={startString}
                    showScaleGuide={showScaleGuide}
                    enableCountIn={enableCountIn}
                    showYoutube={showYoutube}
                    viewMode={viewMode}
                    onKeyChange={setKey}
                    onScaleTypeChange={setScaleType}
                    onTimeSignatureChange={setTimeSignature}
                    onTempoChange={setTempo}
                    onStartStringChange={setStartString}
                    onShowScaleGuideChange={setShowScaleGuide}
                    onEnableCountInChange={setEnableCountIn}
                    onShowYoutubeChange={setShowYoutube}
                    onViewModeChange={setViewMode}
                />

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
                            <button className="play-btn" onClick={() => handlePlayWithTracking(selectedNoteIndex >= 0 ? selectedNoteIndex : 0)}>Play</button>
                        ) : (
                            <button className="pause-btn" onClick={() => { pause(); practiceTimer.pauseSession(); }}>Pause</button>
                        )}
                        <button className="stop-btn" onClick={handleStopWithTracking}>Stop</button>

                        {/* 練習計時顯示 */}
                        {practiceTimer.isActive && (
                            <span style={{
                                fontSize: '14px',
                                color: practiceTimer.isPaused ? '#ff9800' : '#4caf50',
                                fontFamily: 'monospace'
                            }}>
                                {practiceTimer.formattedTime}
                                {practiceTimer.isPaused && ' (paused)'}
                            </span>
                        )}

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

            {/* 音符編輯區 */}
            {notes.length > 0 && (viewMode === 'both' || viewMode === 'score') && (
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
                    onNotesChange={setNotes}
                    onTextChange={setEditableText}
                    onSelectedNoteChange={setSelectedNoteIndex}
                    onTogglePlay={() => {
                        if (isPlaying) {
                            pause();
                            practiceTimer.pauseSession();
                        } else {
                            handlePlayWithTracking(selectedNoteIndex >= 0 ? selectedNoteIndex : 0);
                        }
                    }}
                    playNote={playNote}
                />
            )}

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

            {/* Score Display */}
            {notes.length > 0 && (
                <div style={{ padding: '0 20px 20px 20px' }}>
                    <h3 style={{ color: '#aaa', marginBottom: '10px' }}>Score Preview</h3>
                    <ScoreDisplay
                        notes={notes}
                        notePositions={notePositions}
                        timeSignature={timeSignature}
                        currentNoteIndex={currentNoteIndex}
                    />
                </div>
            )}

            {/* Practice Tools */}
            <div style={{ padding: '0 20px 20px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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

            {/* 儲存/載入按鈕 */}
            <FileActions
                editableText={editableText}
                notes={notes}
                musicKey={key}
                scaleType={scaleType}
                tempo={tempo}
                timeSignature={timeSignature}
                startString={startString}
                octaveOffset={octaveOffset}
                youtubeUrl={youtubeUrl}
                showYoutube={showYoutube}
                youtubeLayout={youtubeLayout}
                viewMode={viewMode}
                onLoadFile={handleLoadFile}
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
