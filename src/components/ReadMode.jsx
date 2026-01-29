import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { parseJianpuText, cleanJianpuText, notesToJianpuString, jianpuToNote } from '../data/jianpuParser';
import { NOTES } from '../data/scaleData';
import { useAudio } from '../hooks/useAudio';
import { useScores } from '../hooks/useScores';
import { calculate3NPSPositions } from '../utils/get3NPSPositions';
import ReadFretboard from './ReadFretboard';
import './ReadMode.css';

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
    // 3NPS 模式：使用 startString 控制起始弦 (5=6弦, 4=5弦, 3=4弦)
    const [startString, setStartString] = useState(5);
    const [tempo, setTempo] = useState(120); // BPM
    const [key, setKey] = useState('C');
    const [scaleType, setScaleType] = useState('Major'); // Major, Minor, etc.
    const [scoreName, setScoreName] = useState('');
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDialog, setShowLoadDialog] = useState(false);
    const [currentScoreId, setCurrentScoreId] = useState(null);
    const [selectedNoteIndex, setSelectedNoteIndex] = useState(-1);
    const [showNoteMenu, setShowNoteMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

    const fileInputRef = useRef(null);
    const playTimeoutRef = useRef(null);
    const { playNote, isLoading: audioLoading } = useAudio(guitarType);
    const { scores, saveScore, deleteScore, loadScore } = useScores();

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

            // 解析簡譜（傳入調號）
            const parsedNotes = parseJianpuText(text, key, scaleType);
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
        const parsedNotes = parseJianpuText(editableText, key, scaleType);
        setNotes(parsedNotes);
    };

    // 播放控制
    const play = useCallback(() => {
        if (notes.length === 0) return;
        setIsPlaying(true);
        // Start from selected note if valid, otherwise 0
        setCurrentNoteIndex(selectedNoteIndex >= 0 ? selectedNoteIndex : 0);
    }, [notes, selectedNoteIndex]);

    const pause = () => {
        setIsPlaying(false);
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
    };

    const stop = () => {
        setIsPlaying(false);
        setCurrentNoteIndex(-1);
        if (playTimeoutRef.current) {
            clearTimeout(playTimeoutRef.current);
        }
    };

    // 計算 3NPS 位置（memoized）
    // 計算 3NPS 位置（memoized）
    const notePositions = useMemo(() =>
        calculate3NPSPositions(notes, startString, key, scaleType), [notes, startString, key, scaleType]);

    // 當調號或音階改變時，更新所有音符的音高
    useEffect(() => {
        setNotes(prevNotes => prevNotes.map(note => {
            if (note.isSeparator || note.isRest || note.isExtension) return note;

            // Recalculate based on current jianpu and octave
            const octaveOffset = (note.octave || 4) - 4;
            const noteData = jianpuToNote(note.jianpu, octaveOffset, key, scaleType);

            if (noteData) {
                return {
                    ...note,
                    ...noteData, // updates midiNote, noteName
                };
            }
            return note;
        }));
    }, [key, scaleType]);

    // 播放邏輯
    useEffect(() => {
        if (!isPlaying || currentNoteIndex < 0 || currentNoteIndex >= notes.length) {
            if (currentNoteIndex >= notes.length) {
                setIsPlaying(false);
                setCurrentNoteIndex(-1);
            }
            return;
        }

        const note = notes[currentNoteIndex];

        // Skip separators immediately without pause
        if (note.isSeparator) {
            setCurrentNoteIndex(prev => prev + 1);
            return;
        }

        const pos = notePositions[currentNoteIndex];

        if (pos && !audioLoading) {
            playNote(note.midiNote, pos.string);
        }

        const interval = (60 / tempo) * 1000; // 毫秒
        playTimeoutRef.current = setTimeout(() => {
            setCurrentNoteIndex(prev => prev + 1);
        }, interval);

        return () => {
            if (playTimeoutRef.current) {
                clearTimeout(playTimeoutRef.current);
            }
        };
    }, [isPlaying, currentNoteIndex, notes, notePositions, tempo, playNote, audioLoading]);

    // 點擊單個音符
    const handleNoteClick = (index) => {
        setCurrentNoteIndex(index);
        const note = notes[index];
        const pos = notePositions[index];
        if (pos && !audioLoading) {
            playNote(note.midiNote, pos.string);
        }
    };

    // 儲存樂譜
    const handleSaveScore = () => {
        if (!scoreName.trim()) {
            alert('請輸入樂譜名稱');
            return;
        }
        if (!editableText.trim()) {
            alert('沒有可儲存的簡譜內容');
            return;
        }

        saveScore(scoreName.trim(), {
            text: editableText,
            notes: notes,
            key: key,
            scaleType: scaleType,
            tempo: tempo,
        });

        setScoreName('');
        setShowSaveDialog(false);
        alert('樂譜已儲存！');
    };

    // 載入樂譜
    const handleLoadScore = (id) => {
        const data = loadScore(id);
        if (data) {
            setEditableText(data.text || '');
            setNotes(data.notes || []);
            setKey(data.key || 'C');
            setScaleType(data.scaleType || 'Major');
            setTempo(data.tempo || 120);
            setCurrentScoreId(id);
            setRawText(data.text || ''); // 顯示編輯區
            setShowLoadDialog(false);
        }
    };

    // 刪除樂譜
    const handleDeleteScore = (id, name) => {
        if (confirm(`確定要刪除「${name}」嗎？`)) {
            deleteScore(id);
            if (currentScoreId === id) {
                setCurrentScoreId(null);
            }
        }
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
        closeNoteMenu();
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
        syncEditableText(newNotes);
        // closeNoteMenu(); // Don't close for rapid insertion
    };

    // 在音符後插入符號 (0, -)
    const handleInsertSymbol = (symbol) => {
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
        }

        if (newNote) {
            const newNotes = [...notes];
            newNotes.splice(selectedNoteIndex + 1, 0, newNote);
            setNotes(newNotes);
            syncEditableText(newNotes);

            // Auto-select the new symbol? Maybe keep current selection or move next?
            // Usually move next is good for typing.
            setSelectedNoteIndex(selectedNoteIndex + 1);
        }
    };

    // Update pitch of selected note (for keyboard input)
    const handleUpdateNotePitch = (newJianpuChar) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;

        const oldNote = notes[selectedNoteIndex];
        // Only update if it's a real note
        if (oldNote.isSeparator || oldNote.isRest || oldNote.isExtension) return;

        const noteData = jianpuToNote(newJianpuChar, (oldNote.octave || 4) - 4, key, scaleType);
        if (noteData) {
            const newNotes = [...notes];
            newNotes[selectedNoteIndex] = {
                ...oldNote,
                ...noteData, // updates midiNote, noteName
                jianpu: newJianpuChar,
                displayStr: newJianpuChar + (oldNote.displayStr.includes('.') ? '.' : '') + (oldNote.displayStr.includes('_') ? '_' : '') // Preserve dots? 
                // Wait, jianpuToNote doesn't return dot/underscore info.
                // Best to reconstruct displayStr?
                // Or let parse logic handle it?
                // But we are editing the object directly.
                // Let's simplified: assume octave dot is preserved by updating octave manually if needed
                // But jianpuToNote uses octave param.
                // We keep old octave.
            };
            // Note: displayStr needs to be updated correctly.
            // Simplified approximation:
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
        // Since . means Octave Up in this parser, this button effectively acts as Octave Up?
        // Or does user want a literal '.' in text?
        // If I append '.', notesToJianpuString will likely output it if octave is high.
        // Let's implementation: Increase Octave.
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
            // If I press 0, should it change to Rest? Probably.
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
    const handleSetOctave = (octave) => {
        if (selectedNoteIndex < 0 || selectedNoteIndex >= notes.length) return;
        const note = notes[selectedNoteIndex];
        if (note.isSeparator) return;

        const newNotes = [...notes];
        const currentNote = newNotes[selectedNoteIndex];
        const oldOctave = currentNote.octave;

        // Reconstruct display string with new octave dots
        let newDisplay = String(currentNote.jianpu);
        if (octave === 5) newDisplay += '.';
        if (octave === 6) newDisplay += '..';
        if (octave === 3) newDisplay = '_' + newDisplay;
        if (octave === 2) newDisplay = '__' + newDisplay;

        // Preserve accidental
        const oldDisplay = currentNote.displayStr || String(currentNote.jianpu);
        if (oldDisplay.includes('#')) newDisplay += '#';
        else if (oldDisplay.includes('b')) newDisplay += 'b';

        newNotes[selectedNoteIndex] = {
            ...currentNote,
            octave: octave,
            midiNote: currentNote.midiNote + (octave - oldOctave) * 12,
            displayStr: newDisplay,
            // Also update accidentalStr for consistency if needed, but displayStr is primary
            accidentalStr: oldDisplay.includes('#') ? '#' : (oldDisplay.includes('b') ? 'b' : '')
        };
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
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', '')
            };
        } else {
            // 添加 sharp，移除 flat (如果有)
            newNotes[selectedNoteIndex] = {
                ...currentNote,
                midiNote: currentNote.midiNote + (hasFlat ? 2 : 1),
                noteName: currentNote.noteName.replace('b', '') + '#',
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', '') + '#'
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
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('b', '')
            };
        } else {
            // 添加 flat，移除 sharp (如果有)
            newNotes[selectedNoteIndex] = {
                ...currentNote,
                midiNote: currentNote.midiNote - (hasSharp ? 2 : 1),
                noteName: currentNote.noteName.replace('#', '') + 'b',
                displayStr: (currentNote.displayStr || currentNote.jianpu).replace('#', '') + 'b'
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

                    {image && (
                        <button
                            className="ocr-btn"
                            onClick={handleOCR}
                            disabled={isProcessing}
                        >
                            {isProcessing ? `辨識中... ${ocrProgress}%` : '🔍 開始辨識'}
                        </button>
                    )}
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
                            <option value="HarmonicMinor">Harmonic Minor</option>
                            <option value="MelodicMinor">Melodic Minor</option>
                        </select>
                    </div>

                    <div className="setting-row mode-info">
                        <label>指法模式</label>
                        <span className="mode-badge">🎸 3NPS</span>
                    </div>

                    <div className="setting-row">
                        <label>起始弦</label>
                        <select
                            value={startString}
                            onChange={(e) => setStartString(Number(e.target.value))}
                        >
                            <option value={5}>第 6 弦 (低音 E)</option>
                            <option value={4}>第 5 弦 (A)</option>
                            <option value={3}>第 4 弦 (D)</option>
                        </select>
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
                </div>

                {/* 辨識結果顯示 */}
                {rawText && (
                    <div className="result-section expanded">
                        <label>辨識結果</label>
                        <textarea
                            value={editableText}
                            readOnly
                            placeholder="辨識後的簡譜內容"
                            rows={10}
                        />
                    </div>
                )}

                {/* 播放控制 */}
                {notes.length > 0 && (
                    <div className="playback-controls">
                        {!isPlaying ? (
                            <button className="play-btn" onClick={play}>▶️ 播放</button>
                        ) : (
                            <button className="pause-btn" onClick={pause}>⏸️ 暫停</button>
                        )}
                        <button className="stop-btn" onClick={stop}>⏹️ 停止</button>
                    </div>
                )}
            </div>

            {/* 音符編輯區 - 獨立全寬區域 */}
            {notes.length > 0 && (
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
                                        : `${notes[selectedNoteIndex].displayStr || notes[selectedNoteIndex].jianpu} (${notes[selectedNoteIndex].noteName}${notes[selectedNoteIndex].octave})`)
                                    : '未選擇'
                                }
                            </span>
                        </div>

                        {/* 八度控制 */}
                        <div className="editor-group">
                            <span className="editor-label">八度</span>
                            <div className="editor-buttons">
                                <button
                                    className={`editor-btn ${selectedNoteIndex >= 0 && notes[selectedNoteIndex]?.octave === 5 ? 'active' : ''}`}
                                    onClick={() => handleSetOctave(5)}
                                    disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                >⬆️ 高</button>
                                <button
                                    className={`editor-btn ${selectedNoteIndex >= 0 && notes[selectedNoteIndex]?.octave === 4 ? 'active' : ''}`}
                                    onClick={() => handleSetOctave(4)}
                                    disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                >中</button>
                                <button
                                    className={`editor-btn ${selectedNoteIndex >= 0 && notes[selectedNoteIndex]?.octave === 3 ? 'active' : ''}`}
                                    onClick={() => handleSetOctave(3)}
                                    disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                >⬇️ 低</button>
                            </div>
                        </div>

                        {/* 升降音控制 */}
                        <div className="editor-group">
                            <span className="editor-label">升降音</span>
                            <div className="editor-buttons">
                                <button
                                    className={`editor-btn ${selectedNoteIndex >= 0 && notes[selectedNoteIndex]?.noteName?.includes('#') ? 'active' : ''}`}
                                    onClick={handleToggleSharp}
                                    disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                >♯ Sharp</button>
                                <button
                                    className={`editor-btn ${selectedNoteIndex >= 0 && notes[selectedNoteIndex]?.noteName?.includes('b') ? 'active' : ''}`}
                                    onClick={handleToggleFlat}
                                    disabled={selectedNoteIndex < 0 || notes[selectedNoteIndex]?.isSeparator}
                                >♭ Flat</button>
                            </div>
                        </div>

                        {/* 插入音符 */}
                        <div className="editor-group">
                            <span className="editor-label">插入音符</span>
                            <div className="editor-insert-row">
                                <span>前：</span>
                                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                    <button
                                        key={`b${n}`}
                                        className="insert-btn"
                                        onClick={() => handleInsertBefore(n)}
                                        disabled={selectedNoteIndex < 0}
                                    >{n}</button>
                                ))}
                            </div>
                            <div className="editor-insert-row">
                                <span>後：</span>
                                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                                    <button
                                        key={`a${n}`}
                                        className="insert-btn"
                                        onClick={() => handleInsertAfter(n)}
                                        disabled={selectedNoteIndex < 0}
                                    >{n}</button>
                                ))}
                            </div>

                            {/* 特殊符號插入 */}
                            <div className="editor-insert-row" style={{ marginTop: '8px' }}>
                                <span>符號：</span>
                                <button className="insert-btn" onClick={() => handleInsertSymbol('0')}>0 (休止)</button>
                                <button className="insert-btn" onClick={() => handleInsertSymbol('-')}>- (延音)</button>
                                <button className="insert-btn" onClick={handleAddDot}>. (附點)</button>
                            </div>
                        </div>

                        {/* 區隔線 */}
                        <div className="editor-group">
                            <span className="editor-label">區隔線</span>
                            <div className="editor-buttons">
                                <button
                                    className="editor-btn"
                                    onClick={() => handleAddSeparator(true)}
                                    disabled={selectedNoteIndex < 0}
                                >➕ 前面加 |</button>
                                <button
                                    className="editor-btn"
                                    onClick={() => handleAddSeparator(false)}
                                    disabled={selectedNoteIndex < 0}
                                >➕ 後面加 |</button>
                            </div>
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
                        <label>🎵 音符列表 ({notes.length} 個) - 點擊音符進行編輯</label>
                        <div className="notes-display">
                            {notes.map((note, idx) => (
                                <div
                                    key={idx}
                                    className={`note-chip-wrapper ${idx === selectedNoteIndex ? 'selected' : ''}`}
                                    onClick={(e) => handleNoteSelect(idx, e)}
                                >
                                    <span
                                        className={`note-chip ${idx === currentNoteIndex ? 'active' : ''} ${note.isSeparator ? 'separator' : ''} ${note.octave > 4 ? 'high' : ''} ${note.octave < 4 ? 'low' : ''} ${note.noteName?.includes('#') ? 'sharp' : ''} ${note.noteName?.includes('b') ? 'flat' : ''}`}
                                        title={note.isSeparator ? '區隔線' : `${note.noteName}${note.octave}`}
                                    >
                                        {note.isSeparator ? '|' : (note.displayStr || note.jianpu)}
                                        {!note.isSeparator && (
                                            <small>{note.noteName}{note.octave !== 4 ? note.octave : ''}</small>
                                        )}
                                    </span>
                                </div>
                            ))}
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
            />

            {/* 儲存/載入按鈕 */}
            <div className="score-actions">
                <button
                    className="score-btn save"
                    onClick={() => setShowSaveDialog(true)}
                    disabled={!editableText.trim()}
                >
                    💾 儲存樂譜
                </button>
                <button
                    className="score-btn load"
                    onClick={() => setShowLoadDialog(true)}
                >
                    📂 載入樂譜 {scores.length > 0 && `(${scores.length})`}
                </button>
            </div>

            {/* 儲存對話框 */}
            {
                showSaveDialog && (
                    <div className="dialog-overlay" onClick={() => setShowSaveDialog(false)}>
                        <div className="dialog" onClick={e => e.stopPropagation()}>
                            <h3>💾 儲存樂譜</h3>
                            <input
                                type="text"
                                placeholder="輸入樂譜名稱..."
                                value={scoreName}
                                onChange={e => setScoreName(e.target.value)}
                                autoFocus
                            />
                            <div className="dialog-preview">
                                <span>內容預覽：</span>
                                <code>{editableText.slice(0, 50)}{editableText.length > 50 ? '...' : ''}</code>
                            </div>
                            <div className="dialog-actions">
                                <button className="cancel-btn" onClick={() => setShowSaveDialog(false)}>
                                    取消
                                </button>
                                <button className="confirm-btn" onClick={handleSaveScore}>
                                    儲存
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 載入對話框 */}
            {
                showLoadDialog && (
                    <div className="dialog-overlay" onClick={() => setShowLoadDialog(false)}>
                        <div className="dialog" onClick={e => e.stopPropagation()}>
                            <h3>📂 載入樂譜</h3>
                            {scores.length === 0 ? (
                                <p className="no-scores">還沒有儲存的樂譜</p>
                            ) : (
                                <div className="scores-list">
                                    {scores.map(score => (
                                        <div key={score.id} className="score-item">
                                            <div className="score-info">
                                                <span className="score-name">{score.name}</span>
                                                <span className="score-date">
                                                    {new Date(score.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="score-actions-inline">
                                                <button
                                                    className="load-btn"
                                                    onClick={() => handleLoadScore(score.id)}
                                                >
                                                    載入
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDeleteScore(score.id, score.name)}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="dialog-actions">
                                <button className="cancel-btn" onClick={() => setShowLoadDialog(false)}>
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default ReadMode;

