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
import ReadFretboard from '../ReadFretboard.jsx';
import ScoreDisplay from '../ScoreDisplay.jsx';
import UploadPanel from './UploadPanel.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import NoteEditor from './NoteEditor.jsx';
import FileActions from './FileActions.jsx';
import YouTubePlayer from './YouTubePlayer.jsx';
import './ReadMode.css';

const AUTOSAVE_KEY = 'guitar-mixer-readmode-autosave';

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

    // ===== 載入自動儲存 =====
    useEffect(() => {
        try {
            const saved = load();
            if (saved) {
                if (saved.text) {
                    setEditableText(saved.text);
                    setRawText(saved.text);
                }
                if (saved.notes) setNotes(saved.notes);
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
            setNotes(actualData.notes || []);
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
                            <button className="play-btn" onClick={() => play(selectedNoteIndex >= 0 ? selectedNoteIndex : 0)}>Play</button>
                        ) : (
                            <button className="pause-btn" onClick={pause}>Pause</button>
                        )}
                        <button className="stop-btn" onClick={stop}>Stop</button>

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
                    onTogglePlay={() => togglePlay(selectedNoteIndex)}
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

            {/* 儲存/載入按鈕 */}
            <FileActions
                editableText={editableText}
                notes={notes}
                musicKey={key}
                scaleType={scaleType}
                tempo={tempo}
                startString={startString}
                octaveOffset={octaveOffset}
                youtubeUrl={youtubeUrl}
                showYoutube={showYoutube}
                youtubeLayout={youtubeLayout}
                viewMode={viewMode}
                onLoadFile={handleLoadFile}
            />
        </div>
    );
}

export default ReadMode;
