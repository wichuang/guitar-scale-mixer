import { useState, useRef } from 'react';
import Fretboard from './Fretboard';
import PlayItemCard from './PlayItemCard';
import TabView from './ScoreDisplay/TabView';
import JianpuView from './ScoreDisplay/JianpuView';
import { Note } from '../core/models/Note';
import { Score } from '../core/models/Score';
import { getScaleNotes, CAGED_SHAPES } from '../data/scaleData';
import { getChordNotes } from '../data/chordData';
import { useAudio, GUITAR_INSTRUMENTS } from '../hooks/useAudio';
import './ComposeMode.css';

const GUITAR_OPTIONS = Object.entries(GUITAR_INSTRUMENTS).map(([value, label]) => ({ value, label }));

// 可選時值（Note.duration 內部值 + 中文名 + 拍數，quarter = 1 拍）
const DURATIONS = [
  { value: 'whole', cn: '全音符', beats: 4 },
  { value: 'half', cn: '二分音符', beats: 2 },
  { value: 'quarter', cn: '四分音符', beats: 1 },
  { value: 'eighth', cn: '八分音符', beats: 0.5 },
  { value: '16th', cn: '十六分音符', beats: 0.25 },
];
const beatsOf = (duration) =>
  DURATIONS.find(d => d.value === duration)?.beats ?? 1;

// 三種技巧顏色（需與 TabView 的 TECH_COLORS 一致）：滑音橘、延音綠、顫音紫
const TECH_COLORS = { slide: '#E8943A', tie: '#3fae5a', vibrato: '#9b59b6' };

const EMPTY_SEL = []; // 穩定的空陣列參考，避免每次 render 產生新陣列觸發重繪

/**
 * 用 SVG 畫出標準六線譜音符符號（跨平台一致，不依賴字型缺字的 unicode 音符）
 */
function NoteIcon({ type }) {
  const filled = type !== 'whole' && type !== 'half';
  const hasStem = type !== 'whole';
  const headCx = 5.5, headCy = 17, rx = 4, ry = 2.8;
  const stemX = headCx + rx - 0.4;
  return (
    <svg width="16" height="22" viewBox="0 0 16 22" style={{ display: 'block' }} aria-hidden="true">
      <ellipse
        cx={headCx} cy={headCy} rx={rx} ry={ry}
        transform={`rotate(-22 ${headCx} ${headCy})`}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.3"
      />
      {hasStem && <line x1={stemX} y1={headCy - 1.5} x2={stemX} y2={3} stroke="currentColor" strokeWidth="1.3" />}
      {(type === 'eighth' || type === '16th') && (
        <path d={`M${stemX} 3 q4.5 2.5 3 7`} fill="none" stroke="currentColor" strokeWidth="1.3" />
      )}
      {type === '16th' && (
        <path d={`M${stemX} 7 q4.5 2.5 3 7`} fill="none" stroke="currentColor" strokeWidth="1.3" />
      )}
    </svg>
  );
}

/**
 * 把 Compose 的單一 item 轉成 Fretboard 吃的 scales 結構（與 App 的 itemToFretboardScale 一致）
 */
function itemToFretboardScale(it) {
  if (it.type === 'chord') {
    return {
      root: it.root,
      scale: 'chromatic',
      enabledNotes: it.enabledNotes,
      chordNotes: getChordNotes(it.root, it.quality, it.extension),
      isChord: true,
    };
  }
  // scale：用 chromatic 讓 scale 外的 ghost/passing 音也能顯示在指板上；
  // scale 本身的音標為 chordNotes（實心），ghost 音為淡心
  const scaleNotes = getScaleNotes(it.root, it.scale);
  return {
    root: it.root,
    scale: 'chromatic',
    enabledNotes: it.enabledNotes || scaleNotes,
    chordNotes: scaleNotes,
  };
}

/**
 * ComposeMode — 編曲模式
 *  上：Scale / Chord 選擇器（沿用 PlayItemCard）→ 指板高亮對應位置
 *  中：指板（沿用 Fretboard），點擊任一高亮音 = 播放並寫入下方六線譜
 *  下：可編寫的六線譜（沿用 TabView）＋ 時值 / 休止符 / 小節線 / 復原 / 播放
 */
function ComposeMode({ guitarType, setGuitarType, fretCount }) {
  const [item, setItem] = useState({
    type: 'scale', root: 'A', scale: 'minor-pentatonic', enabledNotes: null,
  });
  const [notes, setNotes] = useState([]);
  const [duration, setDuration] = useState('eighth');
  const [tempo, setTempo] = useState(60);
  const [displayMode, setDisplayMode] = useState('notes');
  const [cagedPosition, setCagedPosition] = useState(null);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [techMode, setTechMode] = useState(null); // null | 'slide' | 'tie' | 'vibrato'
  const [slidePending, setSlidePending] = useState(null); // 滑音第一個音的 index
  const [noteXs, setNoteXs] = useState([]); // 各音在 TAB 的 X 座標（供簡譜對齊）

  const { playNote } = useAudio(guitarType);
  const timersRef = useRef([]);

  // —— 選擇器 handlers（單一 item 版，沿用 App 的 toggle 規則）——
  const updateItem = (patch) => setItem(prev => ({ ...prev, ...patch }));
  const toggleItemNote = (note) => {
    setItem(prev => {
      if (prev.type === 'scale') {
        const baseline = getScaleNotes(prev.root, prev.scale);
        const current = prev.enabledNotes || baseline;
        const newNotes = current.includes(note)
          ? current.filter(n => n !== note)
          : [...current, note];
        return { ...prev, enabledNotes: newNotes };
      }
      const chordTones = getChordNotes(prev.root, prev.quality, prev.extension);
      if (chordTones.includes(note)) return prev; // chord tone 鎖定
      const current = prev.enabledNotes || chordTones;
      const newNotes = current.includes(note)
        ? current.filter(n => n !== note)
        : [...current, note];
      return { ...prev, enabledNotes: newNotes };
    });
  };

  const fretboardScale = itemToFretboardScale(item);
  // TAB 與簡譜共用寬度（與 TabView 預設一致），確保兩者 X 座標對齊
  const tabWidth = Math.max(800, notes.length * 60 + 100);

  // 技巧模式操作提示
  const techHint = !techMode
    ? '技巧：先點下方「滑音／延音／顫音」鈕進入模式，再點六線譜上的音套用。'
    : techMode === 'slide'
      ? (slidePending == null ? '滑音模式：點第一個音' : '滑音模式：再點相鄰的第二個音（再點同一顆取消）')
      : techMode === 'tie'
        ? '延音模式：點一個音 → 與下一個音相連。再點「延音」鈕關閉。'
        : '顫音模式：點要加顫音的音。再點「顫音」鈕關閉。';

  // 播放中當前音 → 指板高亮 key（格式同 Fretboard 內部 `${stringIdx}-${midi}`）
  const playingNote = playingIndex >= 0 ? notes[playingIndex] : null;
  const activeNoteKey = playingNote?.isNote && playingNote.midi != null
    ? `${playingNote.stringIndex}-${playingNote.midi}`
    : null;

  // —— 樂譜編輯 ——
  const addFromFret = ({ stringIndex, fret }) => {
    // 吉他記譜比實音高八度 → displayOctaveShift: 1
    const note = Note.fromTab(stringIndex, fret, { duration, displayOctaveShift: 1 });
    setNotes(prev => [...prev, note]);
  };

  const addRest = () => setNotes(prev => [...prev, Note.createRest({ duration })]);
  const addBar = () => setNotes(prev => [...prev, Note.createSeparator()]);
  const undo = () => { setSlidePending(null); setNotes(prev => prev.slice(0, -1)); };
  const clearAll = () => { stop(); setTechMode(null); setSlidePending(null); setNotes([]); };

  // 實際音符索引序列 + 取得某音的「下一個實際音符」
  const playableIdx = notes.map((n, i) => (n.isNote ? i : -1)).filter(i => i >= 0);
  const nextPlayable = (i) => {
    const p = playableIdx.indexOf(i);
    return (p >= 0 && p + 1 < playableIdx.length) ? playableIdx[p + 1] : -1;
  };

  // —— 技巧模式：先點技巧鈕進入模式，再點音符套用（再點同一鈕關閉）——
  const armTech = (mode) => {
    setTechMode(prev => (prev === mode ? null : mode));
    setSlidePending(null);
  };

  // 點六線譜上的音 → 依目前技巧模式套用
  const handleNoteClick = (idx) => {
    const note = notes[idx];
    if (!note || !note.isNote) return;   // 只對實際音符
    if (!techMode) return;               // 未選技巧 → 不動作

    if (techMode === 'vibrato') {
      setNotes(prev => {
        const n = [...prev];
        const c = n[idx].clone();
        c.technique = c.technique === 'vibrato' ? null : 'vibrato';
        n[idx] = c;
        return n;
      });
      return;
    }

    if (techMode === 'tie') {
      const j = nextPlayable(idx);
      if (j < 0) return;                 // 沒有下一個音可連
      setNotes(prev => {
        const n = [...prev];
        const on = !n[idx].tieStart;
        const a = n[idx].clone(); a.tieStart = on;
        const b = n[j].clone(); b.tieEnd = on;
        n[idx] = a; n[j] = b;
        return n;
      });
      return;
    }

    if (techMode === 'slide') {
      if (slidePending === null) { setSlidePending(idx); return; }
      if (slidePending === idx) { setSlidePending(null); return; } // 取消起點
      const a = Math.min(slidePending, idx);
      const b = Math.max(slidePending, idx);
      const pa = playableIdx.indexOf(a);
      const pb = playableIdx.indexOf(b);
      if (pa >= 0 && pb === pa + 1) {     // 兩音相鄰 → 連接
        setNotes(prev => {
          const n = [...prev];
          const c = n[a].clone();
          c.technique = c.technique === 'slide' ? null : 'slide';
          n[a] = c;
          return n;
        });
        setSlidePending(null);
      } else {
        setSlidePending(idx);            // 不相鄰 → 以新點的音重設起點
      }
    }
  };

  // —— 播放 ——
  const stop = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPlayingIndex(-1);
  };

  const play = () => {
    stop();
    const secPerBeat = 60 / tempo;
    let elapsed = 0;
    const timers = [];

    notes.forEach((n, i) => {
      if (n.isSeparator || n.isSymbol) return; // 小節線 / 符號不佔時間
      const dur = beatsOf(n.duration) * secPerBeat;
      const startMs = elapsed * 1000;
      const stringIdx = n.stringIndex ?? 2;

      // 高亮目前音（含休止/延音尾）
      timers.push(setTimeout(() => setPlayingIndex(i), startMs));

      const playable = n.isNote && n.midi != null && !n.tieEnd; // tieEnd 音不重新起音
      if (playable) {
        // 延音線：持續時間涵蓋後續連續的 tieEnd 音
        let playDur = dur;
        if (n.tieStart) {
          for (let j = i + 1; j < notes.length; j++) {
            const tn = notes[j];
            if (tn.isSeparator || tn.isSymbol) continue;
            if (tn.tieEnd) playDur += beatsOf(tn.duration) * secPerBeat;
            else break;
          }
        }

        if (n.technique === 'slide') {
          // 滑音：對 source.detune 做連續 ramp → 平滑滑向目標音
          const j = nextPlayable(i);
          const toMidi = j >= 0 ? notes[j].midi : null;
          const semis = toMidi != null ? toMidi - n.midi : 0;
          timers.push(setTimeout(() => {
            const r = playNote(n.midi, stringIdx, { duration: Math.max(dur * 1.1, 0.3) });
            if (semis !== 0) {
              Promise.resolve(r).then(node => {
                const src = node?.source;
                if (!src?.detune) return;
                const ac = src.context;
                const t0 = ac.currentTime;
                try {
                  src.detune.cancelScheduledValues(t0);
                  src.detune.setValueAtTime(0, t0);
                  src.detune.linearRampToValueAtTime(semis * 100, t0 + dur * 0.9);
                } catch { /* ignore */ }
              });
            }
          }, startMs));
        } else if (n.technique === 'vibrato') {
          // 顫音：用 LFO（OscillatorNode）調變 source.detune → 真正的顫音
          timers.push(setTimeout(() => {
            const r = playNote(n.midi, stringIdx, { duration: Math.max(playDur * 1.05, 0.3) });
            Promise.resolve(r).then(node => {
              const src = node?.source;
              if (!src?.detune) return;
              const ac = src.context;
              const t0 = ac.currentTime;
              try {
                const lfo = ac.createOscillator();
                const depth = ac.createGain();
                lfo.frequency.value = 6;   // 6 Hz
                depth.gain.value = 45;     // ±45 cents（明顯）
                lfo.connect(depth);
                depth.connect(src.detune);
                lfo.start(t0);
                lfo.stop(t0 + playDur);
              } catch { /* ignore */ }
            });
          }, startMs));
        } else {
          timers.push(setTimeout(() => playNote(n.midi, stringIdx, { duration: playDur }), startMs));
        }
      }

      elapsed += dur;
    });
    timers.push(setTimeout(() => setPlayingIndex(-1), elapsed * 1000 + 150));
    timersRef.current = timers;
  };

  // —— 存檔（Score JSON 格式，可在 Read 模式用「開啟」載入）——
  const saveScore = () => {
    if (!notes.length) return;
    const score = new Score({
      notes,
      metadata: { name: 'Compose', tempo, key: item.root, viewMode: 'both' },
    });
    const blob = new Blob([JSON.stringify(score.toJSON(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `Compose_${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('已存檔！可到 Read 模式用「開啟」載入此檔。');
  };

  // —— 讀檔（載入 Compose / Read 存的 JSON）——
  const fileInputRef = useRef(null);
  const loadScore = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        const data = json.data ? json.data : json;
        const loaded = (data.notes || []).map(o => Note.fromObject(o));
        stop();
        setTechMode(null);
        setSlidePending(null);
        setNotes(loaded);
        if (data.tempo) setTempo(data.tempo);
        if (data.key) setItem(prev => ({ ...prev, root: data.key }));
      } catch (err) {
        alert('讀檔失敗：' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // 允許重複讀同一個檔
  };

  return (
    <div className="compose-mode">
      {/* 控制列 */}
      <div className="controls-card compose-controls">
        <div className="control-section">
          <label className="section-label">Display</label>
          <div className="btn-group">
            <button className={`sm-btn ${displayMode === 'notes' ? 'active' : ''}`} onClick={() => setDisplayMode('notes')}>ABC</button>
            <button className={`sm-btn ${displayMode === 'intervals' ? 'active' : ''}`} onClick={() => setDisplayMode('intervals')}>123</button>
          </div>
        </div>
        <div className="control-section">
          <label className="section-label">Position</label>
          <div className="btn-group">
            <button className={`sm-btn ${cagedPosition === null ? 'active' : ''}`} onClick={() => setCagedPosition(null)}>All</button>
            {CAGED_SHAPES.map(shape => (
              <button key={shape} className={`sm-btn ${cagedPosition === shape ? 'active' : ''}`} onClick={() => setCagedPosition(shape)}>{shape}</button>
            ))}
          </div>
        </div>
        <div className="control-section">
          <label className="section-label">Sound</label>
          <select className="sm-select" value={guitarType} onChange={(e) => setGuitarType(e.target.value)}>
            {GUITAR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Scale / Chord 選擇器 */}
      <div className="scales-row">
        <PlayItemCard
          index={0}
          item={item}
          onChange={updateItem}
          onToggleNote={toggleItemNote}
          showGhostNotes
        />
      </div>

      {/* 六線譜編寫區（在上） */}
      <div className="compose-score">
        <div className="compose-toolbar">
          <div className="compose-tool-group">
            <label className="section-label">時值</label>
            {DURATIONS.map(d => (
              <button
                key={d.value}
                className={`sm-btn dur-btn ${duration === d.value ? 'active' : ''}`}
                onClick={() => setDuration(d.value)}
                title={d.cn}
              ><NoteIcon type={d.value} /></button>
            ))}
          </div>
          <div className="compose-tool-group">
            <label className="section-label">技巧</label>
            <button
              className={`sm-btn tech-btn ${techMode === 'slide' ? 'active' : ''}`}
              onClick={() => armTech('slide')}
              disabled={notes.length === 0}
              style={{ color: TECH_COLORS.slide, borderColor: TECH_COLORS.slide }}
              title="滑音：先點此鈕，再點兩個相鄰音連接（數字旁顯示 /）"
            >⟋ 滑音</button>
            <button
              className={`sm-btn tech-btn ${techMode === 'tie' ? 'active' : ''}`}
              onClick={() => armTech('tie')}
              disabled={notes.length === 0}
              style={{ color: TECH_COLORS.tie, borderColor: TECH_COLORS.tie }}
              title="延音：先點此鈕，再點一個音（與下一個音相連）"
            >⌣ 延音</button>
            <button
              className={`sm-btn tech-btn ${techMode === 'vibrato' ? 'active' : ''}`}
              onClick={() => armTech('vibrato')}
              disabled={notes.length === 0}
              style={{ color: TECH_COLORS.vibrato, borderColor: TECH_COLORS.vibrato }}
              title="顫音：先點此鈕，再點一個音（數字旁顯示 ~）"
            >〰 顫音</button>
          </div>
          <div className="compose-tool-group">
            <button className="sm-btn" onClick={addRest} title="加入休止符">𝄽 休止</button>
            <button className="sm-btn" onClick={addBar} title="加入小節線">| 小節</button>
            <button className="sm-btn" onClick={undo} disabled={notes.length === 0} title="復原最後一個">↩ 復原</button>
            <button className="sm-btn" onClick={clearAll} disabled={notes.length === 0} title="清空">✕ 清空</button>
          </div>
          <div className="compose-tool-group">
            <label className="section-label">速度</label>
            <input
              type="number"
              className="sm-select tempo-input"
              min={30} max={300} value={tempo}
              onChange={(e) => setTempo(Math.max(30, Math.min(300, Number(e.target.value) || 60)))}
            />
            <button className="sm-btn play-btn" onClick={play} disabled={notes.length === 0} title="播放">▶ 播放</button>
            <button className="sm-btn" onClick={stop} title="停止">⏹ 停止</button>
            <button className="sm-btn" onClick={saveScore} disabled={notes.length === 0} title="存檔（可在 Read 模式開啟）">💾 存檔</button>
            <button className="sm-btn" onClick={() => fileInputRef.current?.click()} title="讀檔（載入 Compose / Read 存的 JSON）">📂 讀檔</button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={loadScore} />
          </div>
        </div>

        {notes.length > 0 && (
          <div className="compose-hint">{techHint}</div>
        )}

        <div className="compose-tab-wrapper">
          {notes.length === 0 ? (
            <div className="compose-empty">點下方指板上的音，開始編寫六線譜 🎸</div>
          ) : (
            <div style={{ width: tabWidth, position: 'relative' }}>
              <TabView
                notes={notes}
                width={tabWidth}
                selectedIndices={slidePending != null ? [slidePending] : EMPTY_SEL}
                onNoteClick={handleNoteClick}
                onNoteCoordinates={setNoteXs}
              />
              {/* 六線譜下方同步顯示簡譜（X 座標與 TAB 對齊） */}
              <JianpuView
                notes={notes}
                noteXCoordinates={noteXs}
                currentNoteIndex={playingIndex}
                color="#eaeaea"
                height={70}
              />
            </div>
          )}
        </div>
      </div>

      {/* 指板（在下）— 點擊任一高亮音寫入上方六線譜 */}
      <div className="fretboard-container">
        <Fretboard
          scales={[fretboardScale]}
          guitarType={guitarType}
          displayMode={displayMode}
          fretCount={fretCount}
          cagedPosition={cagedPosition}
          onFretClick={addFromFret}
          activeNoteKey={activeNoteKey}
        />
      </div>
    </div>
  );
}

export default ComposeMode;
