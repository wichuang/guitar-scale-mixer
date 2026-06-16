import { useRef, useEffect, useState } from 'react';
import YouTube from 'react-youtube';
import {
    STRING_TUNINGS,
    NUM_FRETS,
    getNoteName,
    NOTES,
} from '../data/scaleData';
import { Note } from '../core/models/Note';
import { Score } from '../core/models/Score';
import { useAudio } from '../hooks/useAudio';
import PlayItemCard from './PlayItemCard';
import { getScaleNotes } from '../data/scaleData';
import { getChordNotes } from '../data/chordData';
import './LiveMode.css';

// 從各種 YouTube 連結格式抽出 11 碼 video id（也接受直接貼 id）
function extractVideoId(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    const m = trimmed.match(/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/);
    return (m && m[7] && m[7].length === 11) ? m[7] : '';
}

function LiveMode({ pitchDetection, displayMode, onDisplayModeChange, scales, fretCount, guitarType }) {
    const {
        isListening, devices, selectedDevice, setSelectedDevice,
        detectedNote, detectedOctave, detectedFrequency, centsDeviation, volume, noteHistory,
        inputSource, setInputSource,
        startListening, startListeningFromTab, stopListening, refreshDevices, clearHistory
    } = pitchDetection;

    const containerRef = useRef(null);
    const [fretWidth, setFretWidth] = useState(45);
    // Scale/Chord 選擇器（與 Compose/Read 一致）；root 供 jianpu/interval 用
    const [item, setItem] = useState({
        type: 'scale',
        root: scales.length > 0 ? scales[0].root : 'A',
        scale: 'minor-pentatonic',
        enabledNotes: null,
    });
    const liveRoot = item.root;
    const updateItem = (patch) => setItem(prev => ({ ...prev, ...patch }));
    const toggleItemNote = (note) => setItem(prev => {
        const base = prev.type === 'chord'
            ? (prev.enabledNotes || getChordNotes(prev.root, prev.quality, prev.extension))
            : (prev.enabledNotes || getScaleNotes(prev.root, prev.scale));
        return { ...prev, enabledNotes: base.includes(note) ? base.filter(n => n !== note) : [...base, note] };
    });

    // 播放 Recent 音符用
    const { playNote, resumeAudio } = useAudio(guitarType);
    const playTimersRef = useRef([]);
    const [isPlayingRecent, setIsPlayingRecent] = useState(false);
    const [playingRecentIdx, setPlayingRecentIdx] = useState(-1); // 正在播放的 Recent 索引（chrono 順序）

    // 把 Recent 一筆轉成 MIDI（C4=60，依偵測到的音名+八度）
    const midiOf = (h) => {
        const idx = NOTES.indexOf(h.note);
        return (idx < 0 || h.octave == null) ? null : (h.octave + 1) * 12 + idx;
    };
    // 簡譜數字（相對 liveRoot 的音階級數，含升降號）
    const jianpuOf = (h) => {
        const midi = midiOf(h);
        if (midi == null) return '';
        const n = Note.fromMidi(midi, { key: liveRoot });
        return n.jianpu != null ? `${n.jianpu}${n.accidentalStr || ''}` : '';
    };

    const stopRecent = () => {
        playTimersRef.current.forEach(clearTimeout);
        playTimersRef.current = [];
        setIsPlayingRecent(false);
        setPlayingRecentIdx(-1);
    };
    // 依「實際彈奏時間」播放 Recent（用錄製的 time 還原節奏；夾住極短/極長間隔）
    const playRecent = () => {
        stopRecent();
        if (noteHistory.length === 0) return;
        resumeAudio?.();
        const chrono = [...noteHistory].reverse(); // 舊→新
        const delays = [];
        let acc = 0;
        chrono.forEach((h, i) => {
            if (i > 0) {
                let gap = (h.time ?? 0) - (chrono[i - 1].time ?? 0);
                gap = Math.min(Math.max(gap > 0 ? gap : 120, 70), 1800); // 70ms~1.8s
                acc += gap;
            }
            delays.push(acc);
        });
        setIsPlayingRecent(true);
        chrono.forEach((h, i) => {
            const midi = midiOf(h);
            playTimersRef.current.push(setTimeout(() => {
                setPlayingRecentIdx(i);            // 高亮放大目前音；下一個音時自然換到下一格
                if (midi != null) playNote(midi, 2);
            }, delays[i]));
        });
        playTimersRef.current.push(setTimeout(() => {
            setIsPlayingRecent(false);
            setPlayingRecentIdx(-1);
        }, acc + 600));
    };
    useEffect(() => () => playTimersRef.current.forEach(clearTimeout), []);

    // YouTube 來源
    const [ytUrl, setYtUrl] = useState('');
    const [videoId, setVideoId] = useState('');
    const [captureMsg, setCaptureMsg] = useState('');

    const loadVideo = () => {
        const id = extractVideoId(ytUrl);
        setVideoId(id);
        setCaptureMsg(id ? '' : '無法解析連結，請確認是有效的 YouTube 網址');
    };

    const handleCaptureTab = async () => {
        setCaptureMsg('');
        try {
            await startListeningFromTab();
        } catch (err) {
            if (err.message === 'NO_AUDIO') {
                setCaptureMsg('沒有擷取到聲音 — 請在分享對話框勾選「分享分頁音訊 / 系統音訊」後再試一次。');
            } else if (err.message === 'CANCELLED') {
                setCaptureMsg('已取消擷取。');
            } else {
                setCaptureMsg('擷取失敗：' + (err.message || '未知錯誤'));
            }
        }
    };

    // —— 將擷取到的音符記錄存成 Score JSON（可在 Compose / Read 模式載入）——
    // noteHistory 以「最新在前」儲存，存檔時反轉回演奏順序。
    const saveHistory = () => {
        if (noteHistory.length === 0) return;
        const chrono = [...noteHistory].reverse();

        // —— 由錄製的 time 還原節奏 ——
        // 每個音的時值 ≈ 到下一個音的間隔（最後一個音用中位數補）。
        const gaps = chrono.map((h, i) =>
            i < chrono.length - 1 ? Math.max(60, (chrono[i + 1].time ?? 0) - (h.time ?? 0)) : null
        );
        const known = gaps.filter(g => g != null).sort((a, b) => a - b);
        const medGap = known.length ? known[Math.floor(known.length / 2)] : 500;
        for (let i = 0; i < gaps.length; i++) if (gaps[i] == null) gaps[i] = medGap;
        // tempo：讓「中位數間隔 ≈ 一拍（四分音符）」，夾在 40~240 BPM
        const tempo = Math.max(40, Math.min(240, Math.round(60000 / medGap)));
        const secPerBeat = 60 / tempo;
        const BUCKETS = [['eighth', 0.5], ['quarter', 1], ['half', 2], ['whole', 4]];
        const durationFor = (gapMs) => {
            const beats = (gapMs / 1000) / secPerBeat;
            let best = 'quarter', bestD = Infinity;
            for (const [name, b] of BUCKETS) {
                const d = Math.abs(Math.log(b / beats));
                if (d < bestD) { bestD = d; best = name; }
            }
            return best;
        };

        const notes = chrono.map((h, idx) => {
            const noteIndex = NOTES.indexOf(h.note);
            // 由偵測到的音名 + 八度還原真實發聲音高（C4 = MIDI 60）
            const midi = (h.octave + 1) * 12 + (noteIndex < 0 ? 0 : noteIndex);
            // displayOctaveShift: 1 → 與 Compose 一致（吉他記譜比實音高八度）
            return Note.fromMidi(midi, { index: idx, duration: durationFor(gaps[idx]), displayOctaveShift: 1 });
        });
        const score = new Score({
            notes,
            metadata: { name: 'Live', key: liveRoot, tempo, viewMode: 'both' },
        });
        const blob = new Blob([JSON.stringify(score.toJSON(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        a.href = url;
        a.download = `Live_${today}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setCaptureMsg(`已存檔 ${notes.length} 個音符（含節奏，${tempo} BPM）！可到 Compose / Read 模式用「開啟」載入。`);
    };

    useEffect(() => {
        const updateFretWidth = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth - 24;
                const count = Math.max(12, fretCount || 15);
                const width = Math.max(32, Math.floor(containerWidth / (count + 0.5)));
                setFretWidth(width);
            }
        };
        updateFretWidth();
        window.addEventListener('resize', updateFretWidth);
        return () => window.removeEventListener('resize', updateFretWidth);
    }, [fretCount]);

    const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 21];
    const doubleDotFrets = [12];
    // 用「音名+八度」(如 E3) 比對，讓指板只亮起偵測到的那個八度，而非所有同名音
    const recentNotes = noteHistory.slice(0, 5).map(h => h.fullNote || `${h.note}${h.octave}`);
    const detectedFull = (detectedNote && detectedOctave != null) ? `${detectedNote}${detectedOctave}` : null;

    // Calculate interval from liveRoot
    const NOTES_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const INTERVAL_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

    const getInterval = (noteName) => {
        const rootIdx = NOTES_ORDER.indexOf(liveRoot);
        const noteIdx = NOTES_ORDER.indexOf(noteName);
        if (rootIdx === -1 || noteIdx === -1) return '?';
        const semitones = (noteIdx - rootIdx + 12) % 12;
        const interval = INTERVAL_NAMES[semitones];
        return interval === '1' ? 'R' : interval;
    };

    return (
        <div className="live-mode" ref={containerRef}>
            {/* Display + Scale/Chord 選擇器 — 按 Listen 前就可先選 */}
            <div className="live-top-controls">
                <div className="fb-control-group">
                    <label className="fb-label">Display:</label>
                    <div className="display-toggle">
                        <button className={`dt-btn ${displayMode === 'notes' ? 'active' : ''}`} onClick={() => onDisplayModeChange('notes')}>ABC</button>
                        <button className={`dt-btn ${displayMode === 'intervals' ? 'active' : ''}`} onClick={() => onDisplayModeChange('intervals')}>123</button>
                    </div>
                </div>
            </div>
            <div className="live-scale-picker">
                <PlayItemCard
                    index={0}
                    item={item}
                    onChange={updateItem}
                    onToggleNote={toggleItemNote}
                    showGhostNotes={true}
                />
            </div>

            {/* 輸入來源切換：麥克風 / YouTube */}
            <div className="source-toggle">
                <button
                    className={`src-btn ${inputSource === 'mic' ? 'active' : ''}`}
                    onClick={() => setInputSource('mic')}
                    disabled={isListening}
                >🎤 麥克風</button>
                <button
                    className={`src-btn ${inputSource === 'tab' ? 'active' : ''}`}
                    onClick={() => setInputSource('tab')}
                    disabled={isListening}
                >▶️ YouTube</button>
            </div>

            {/* Audio Controls */}
            {inputSource === 'mic' ? (
                <div className="audio-controls">
                    <select
                        className="device-select"
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        disabled={isListening}
                    >
                        {devices.length === 0 ? (
                            <option value="">No devices</option>
                        ) : (
                            devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>
                                    {d.label || `Input ${d.deviceId.slice(0, 6)}`}
                                </option>
                            ))
                        )}
                    </select>

                    <button className="ref-btn" onClick={refreshDevices} disabled={isListening}>↻</button>

                    <button
                        className={`listen-btn ${isListening ? 'active' : ''}`}
                        onClick={isListening ? stopListening : startListening}
                    >
                        {isListening ? '⏹ Stop' : '▶ Listen'}
                    </button>

                    {noteHistory.length > 0 && (
                        <>
                            <button className="save-btn" onClick={saveHistory}>💾 存檔</button>
                            <button className="clear-btn" onClick={clearHistory}>Clear</button>
                        </>
                    )}
                </div>
            ) : (
                <div className="youtube-source">
                    <div className="yt-url-row">
                        <input
                            className="yt-url-input"
                            type="text"
                            placeholder="貼上 YouTube 連結…"
                            value={ytUrl}
                            onChange={(e) => setYtUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadVideo()}
                            disabled={isListening}
                        />
                        <button className="ref-btn" onClick={loadVideo} disabled={isListening}>載入</button>
                    </div>

                    {videoId && (
                        <div className="yt-embed">
                            <YouTube
                                videoId={videoId}
                                opts={{ width: '100%', height: '220', playerVars: { playsinline: 1 } }}
                            />
                        </div>
                    )}

                    <div className="audio-controls">
                        <button
                            className={`listen-btn ${isListening ? 'active' : ''}`}
                            onClick={isListening ? stopListening : handleCaptureTab}
                        >
                            {isListening ? '⏹ Stop' : '🎧 擷取分頁聲音並辨識'}
                        </button>
                        {noteHistory.length > 0 && (
                            <>
                                <button className="save-btn" onClick={saveHistory}>💾 存檔</button>
                                <button className="clear-btn" onClick={clearHistory}>Clear</button>
                            </>
                        )}
                    </div>

                    {!isListening && (
                        <p className="yt-hint">
                            先按播放讓影片出聲，再按「擷取分頁聲音」。瀏覽器跳出分享視窗時，
                            選 <strong>「本分頁」</strong> 並務必勾選 <strong>「分享分頁音訊」</strong>。
                            （單音/獨奏辨識最準；和弦或整首伴奏為複音，辨識會較不穩定。建議用 Chrome / Edge 桌面版。）
                        </p>
                    )}
                    {captureMsg && <p className="yt-error">{captureMsg}</p>}
                </div>
            )}

            {/* Detection Display - Fixed height structure */}
            <div className={`detection-box ${isListening ? 'active' : ''}`}>
                {isListening ? (
                    <>
                        <div className="vol-indicator">
                            <div className="vol-fill" style={{ width: `${volume * 100}%` }} />
                        </div>

                        {/* Always same structure to prevent height jump */}
                        <div className="detected-info">
                            <div className="note-display">
                                <span className={`big-note ${!detectedNote ? 'placeholder' : ''}`}>
                                    {detectedNote ? (
                                        <>{detectedNote}<sub className="octave">{detectedOctave}</sub></>
                                    ) : '—'}
                                </span>
                                <span className={`interval-badge ${!detectedNote ? 'placeholder' : ''}`}>
                                    {detectedNote ? getInterval(detectedNote) : '—'}
                                </span>
                            </div>
                            <div className="note-details">
                                <span className="freq">{detectedNote ? `${detectedFrequency} Hz` : 'Play a note...'}</span>
                                {detectedNote && (
                                    <span className={`cents ${centsDeviation > 10 ? 'sharp' : centsDeviation < -10 ? 'flat' : 'tune'}`}>
                                        {centsDeviation > 0 ? '+' : ''}{centsDeviation}¢
                                    </span>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="inactive-msg">
                        Click <strong>▶ Listen</strong> to start detecting notes
                    </div>
                )}
            </div>

            {/* Note History - Always visible to prevent layout jump */}
            <div className="history-row">
                <span className="hist-label">Recent:</span>
                {noteHistory.length > 0 && (
                    <button
                        className="hist-play-btn"
                        onClick={isPlayingRecent ? stopRecent : playRecent}
                        title="播放最近偵測到的音符"
                    >{isPlayingRecent ? '⏹ Stop' : '▶ Play'}</button>
                )}
                {noteHistory.length > 0 ? (
                    // 依「錄製順序」由舊到新（左→右），最新的在最右並標為 latest
                    [...noteHistory].reverse().map((h, i, arr) => (
                        <span
                            key={h.time}
                            className={`hist-note ${i === arr.length - 1 ? 'latest' : ''} ${i === playingRecentIdx ? 'playing' : ''}`}
                        >
                            <span className="hist-jianpu">{jianpuOf(h) || '·'}</span>
                            <span className="hist-name">{h.fullNote || `${h.note}${h.octave}`}</span>
                        </span>
                    ))
                ) : (
                    <span className="hist-placeholder">—</span>
                )}
            </div>

            {/* Fretboard Section with its own controls */}
            {isListening && (
                <div className="fretboard-section">

                    {/* Live Fretboard */}
                    <div className="live-fretboard">
                        {/* Fret numbers */}
                        <div className="lf-numbers">
                            {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => (
                                <div key={fret} className="lf-num" style={{ width: fretWidth }}>
                                    <span className={fretMarkers.includes(fret) ? 'marked' : ''}>{fret}</span>
                                    {fretMarkers.includes(fret) && !doubleDotFrets.includes(fret) && <div className="dot" />}
                                    {doubleDotFrets.includes(fret) && <div className="dots"><div className="dot" /><div className="dot" /></div>}
                                </div>
                            ))}
                        </div>

                        {/* Strings */}
                        {STRING_TUNINGS.map((openMidi, stringIdx) => {
                            const thickness = 1 + (5 - stringIdx) * 0.3;
                            return (
                                <div key={stringIdx} className="lf-string">
                                    <div className="string-line" style={{ height: thickness }} />
                                    {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => {
                                        const midiNote = openMidi + fret;
                                        const noteName = getNoteName(midiNote);
                                        const cellOctave = Math.floor(midiNote / 12) - 1;
                                        const cellFull = `${noteName}${cellOctave}`;
                                        const isDetected = detectedFull === cellFull;
                                        const trailIdx = recentNotes.indexOf(cellFull);
                                        const isTrail = trailIdx > 0;

                                        if (!isDetected && !isTrail) {
                                            return <div key={fret} className="lf-cell" style={{ width: fretWidth }} />;
                                        }

                                        const displayText = displayMode === 'intervals' ? getInterval(noteName) : noteName;
                                        const isRoot = displayText === 'R';

                                        return (
                                            <div key={fret} className="lf-cell" style={{ width: fretWidth }}>
                                                <div
                                                    className={`lf-marker ${isDetected ? 'detected' : 'trail'} ${isRoot ? 'is-root' : ''}`}
                                                    style={{ opacity: isDetected ? 1 : (1 - trailIdx * 0.2) }}
                                                >
                                                    {displayText}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}

                        {/* Fret lines */}
                        <div className="lf-lines">
                            {Array.from({ length: (fretCount || 15) + 1 }, (_, fret) => (
                                <div key={fret} className={`lf-line ${fret === 0 ? 'nut' : ''}`} style={{ width: fretWidth }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LiveMode;
