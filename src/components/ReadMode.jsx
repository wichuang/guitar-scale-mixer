import { useState, useRef, useCallback, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { parseJianpuText, cleanJianpuText, GUITAR_POSITIONS, getBestPosition } from '../data/jianpuParser';
import { NOTES } from '../data/scaleData';
import { useAudio } from '../hooks/useAudio';
import { useScores } from '../hooks/useScores';
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
    const [position, setPosition] = useState(1);
    const [tempo, setTempo] = useState(120); // BPM
    const [key, setKey] = useState('C');
    const [scoreName, setScoreName] = useState('');
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDialog, setShowLoadDialog] = useState(false);
    const [currentScoreId, setCurrentScoreId] = useState(null);

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
            const parsedNotes = parseJianpuText(text, key);
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
        const parsedNotes = parseJianpuText(editableText, key);
        setNotes(parsedNotes);
    };

    // 播放控制
    const play = useCallback(() => {
        if (notes.length === 0) return;
        setIsPlaying(true);
        setCurrentNoteIndex(0);
    }, [notes]);

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
        const pos = getBestPosition(note.midiNote, position);

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
    }, [isPlaying, currentNoteIndex, notes, position, tempo, playNote, audioLoading]);

    // 點擊單個音符
    const handleNoteClick = (index) => {
        setCurrentNoteIndex(index);
        const note = notes[index];
        const pos = getBestPosition(note.midiNote, position);
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
            position: position,
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
            setPosition(data.position || 1);
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
                        <label>把位</label>
                        <select
                            value={position}
                            onChange={(e) => setPosition(Number(e.target.value))}
                        >
                            {Object.entries(GUITAR_POSITIONS).map(([key, val]) => (
                                <option key={key} value={key}>{val.name}</option>
                            ))}
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

                {/* 辨識結果編輯 */}
                {rawText && (
                    <div className="result-section">
                        <label>辨識結果 (可編輯) - 高音用 <code>1.</code> 低音用 <code>_1</code></label>
                        <div className="octave-tools">
                            <span className="tool-label">快捷標記：</span>
                            <button
                                className="octave-btn high"
                                onClick={() => setEditableText(prev => prev.replace(/([1-7])(?!\.)/g, '$1.'))}
                                title="全部標記為高八度"
                            >
                                ⬆️ 全部高八度
                            </button>
                            <button
                                className="octave-btn low"
                                onClick={() => setEditableText(prev => prev.replace(/(?<!_)([1-7])/g, '_$1'))}
                                title="全部標記為低八度"
                            >
                                ⬇️ 全部低八度
                            </button>
                            <button
                                className="octave-btn reset"
                                onClick={() => setEditableText(prev => prev.replace(/[._·]+/g, '').replace(/_+/g, ''))}
                                title="清除所有八度標記"
                            >
                                🔄 清除標記
                            </button>
                        </div>
                        <textarea
                            value={editableText}
                            onChange={(e) => setEditableText(e.target.value)}
                            placeholder="範例：1 2 3. 4. _5 _6 7"
                            rows={3}
                        />
                        <div className="edit-hint">
                            💡 提示：高八度在數字後加 <code>.</code>，低八度在數字前加 <code>_</code>
                        </div>
                        <button className="parse-btn" onClick={handleManualParse}>
                            重新解析
                        </button>
                    </div>
                )}

                {/* 音符顯示 */}
                {notes.length > 0 && (
                    <div className="notes-section">
                        <label>解析的音符 ({notes.length} 個)</label>
                        <div className="notes-display">
                            {notes.map((note, idx) => (
                                <span
                                    key={idx}
                                    className={`note-chip ${idx === currentNoteIndex ? 'active' : ''} ${note.octave > 4 ? 'high' : ''} ${note.octave < 4 ? 'low' : ''}`}
                                    onClick={() => handleNoteClick(idx)}
                                    title={`${note.noteName}${note.octave}`}
                                >
                                    {note.displayStr || note.jianpu}
                                    <small>{note.noteName}{note.octave !== 4 ? note.octave : ''}</small>
                                </span>
                            ))}
                        </div>
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

            {/* 指板顯示 */}
            <ReadFretboard
                notes={notes}
                currentNoteIndex={currentNoteIndex}
                position={position}
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
            {showSaveDialog && (
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
            )}

            {/* 載入對話框 */}
            {showLoadDialog && (
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
            )}
        </div>
    );
}

export default ReadMode;
