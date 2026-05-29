import { useState, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Fretboard from './components/Fretboard';
import LiveMode from './components/LiveMode';
import ReadMode from './components/ReadMode/index.jsx';
import ReadPopup from './components/ReadMode/ReadPopup.jsx';
import PlayItemCard from './components/PlayItemCard';
import ComposeMode from './components/ComposeMode';
import SettingsPage from './components/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';
import YouTubeSync from './components/YouTubeSync';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { usePresets, useAutoSave, getInitialState } from './hooks/usePresets';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useAuth } from './contexts/AuthContext';
import { getScaleNotes, CAGED_SHAPES } from './data/scaleData';
import { getChordNotes } from './data/chordData';
import './App.css';

const getBackgroundPath = (name) => `${import.meta.env.BASE_URL}backgrounds/${name}.png`;

const GUITAR_BACKGROUNDS = {
  'acoustic_guitar_nylon': getBackgroundPath('acoustic_guitar_nylon'),
  'acoustic_guitar_steel': getBackgroundPath('acoustic_guitar_steel'),
  'electric_guitar_clean': getBackgroundPath('electric_guitar_clean'),
  'electric_guitar_muted': getBackgroundPath('electric_guitar_muted'),
  'electric_guitar_jazz': getBackgroundPath('electric_guitar_jazz'),
  'overdriven_guitar': getBackgroundPath('overdriven_guitar'),
  'distortion_guitar': getBackgroundPath('distortion_guitar'),
};

export const GUITAR_OPTIONS = [
  { value: 'acoustic_guitar_nylon', label: 'Nylon' },
  { value: 'acoustic_guitar_steel', label: 'Steel' },
  { value: 'electric_guitar_clean', label: 'Clean' },
  { value: 'electric_guitar_jazz', label: 'Jazz' },
  { value: 'distortion_guitar', label: 'Distort' },
];

// 預設 Play 項目（最多 4 個，使用者可選 scale / chord）
const DEFAULT_PLAY_ITEMS = [
  { type: 'scale', root: 'A', scale: 'major-pentatonic', enabledNotes: null },
  { type: 'chord', root: 'C', quality: 'Major', extension: '7',
    enabledNotes: getChordNotes('C', 'Major', '7') },
  { type: 'chord', root: 'G', quality: 'Dominant', extension: '7',
    enabledNotes: getChordNotes('G', 'Dominant', '7') },
  { type: 'scale', root: 'A', scale: 'natural-minor', enabledNotes: null },
];

const DEFAULT_STATE = {
  itemCount: 2,
  displayMode: 'notes',
  guitarType: 'acoustic_guitar_steel',
  fretCount: 26,
  playItems: DEFAULT_PLAY_ITEMS,
};

/**
 * 把舊版 state（scales / scaleCount）轉成新版（playItems / itemCount）。
 * 若已是新版則直接回傳，並補齊 4 個項目以避免 itemCount=4 時越界。
 */
function migrateLegacyState(state) {
  if (!state) return DEFAULT_STATE;
  const base = { ...DEFAULT_STATE, ...state };
  if (!base.playItems && Array.isArray(state.scales)) {
    base.playItems = state.scales.map(s => ({ type: 'scale', ...s }));
    if (typeof state.scaleCount === 'number') base.itemCount = state.scaleCount;
  }
  // 確保 playItems 至少 4 個（不足補預設）
  const items = Array.isArray(base.playItems) ? [...base.playItems] : [];
  while (items.length < 4) items.push(DEFAULT_PLAY_ITEMS[items.length] || DEFAULT_PLAY_ITEMS[0]);
  base.playItems = items;
  if (!base.itemCount) base.itemCount = 2;
  base.itemCount = Math.max(1, Math.min(4, base.itemCount));
  return base;
}

// Main App Content (Protected)
function MainContent() {
  const [mode, setMode] = useState('play');
  const [showSettings, setShowSettings] = useState(false);
  const initialState = useMemo(() => migrateLegacyState(getInitialState(DEFAULT_STATE)), []);

  const [itemCount, setItemCount] = useState(initialState.itemCount);
  const [displayMode, setDisplayMode] = useState(initialState.displayMode);
  const [playItems, setPlayItems] = useState(initialState.playItems);
  const [guitarType, setGuitarType] = useState(initialState.guitarType);
  const [fretCount, setFretCount] = useState(initialState.fretCount || 15);

  const { presets, savePreset, deletePreset, loadPreset } = usePresets();
  const pitchDetection = usePitchDetection();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // New features state
  const [showYouTube, setShowYouTube] = useState(false);
  const [blackScreenMode, setBlackScreenMode] = useState(false);
  const [cagedPosition, setCagedPosition] = useState(null);
  const [disabledFrets, setDisabledFrets] = useState(new Set());

  // 切換 CAGED position（含「All」）時重設 fret toggle 狀態
  const handleSetCagedPosition = (pos) => {
    setCagedPosition(pos);
    setDisabledFrets(new Set());
  };

  const toggleFret = (fret) => {
    if (fret <= 0) return;
    setDisabledFrets(prev => {
      const next = new Set(prev);
      if (next.has(fret)) next.delete(fret);
      else next.add(fret);
      return next;
    });
  };
  const [fretboardLayout, setFretboardLayout] = useState('overlay'); // 'overlay' | 'separate'

  const currentState = useMemo(() => ({
    itemCount, displayMode, guitarType, playItems, fretCount
  }), [itemCount, displayMode, guitarType, playItems, fretCount]);

  useAutoSave(currentState, true);

  // 更新某項目（patch 為部分屬性）
  const updateItem = (index, patch) => {
    setPlayItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  // 切換 note picker 中的單個音（Scale: 自由開關；Chord: chord tones 鎖定，passing tones 可切）
  const toggleItemNote = (index, note) => {
    setPlayItems(prev => {
      const next = [...prev];
      const it = next[index];
      if (it.type === 'scale') {
        const baseline = getScaleNotes(it.root, it.scale);
        const current = it.enabledNotes || baseline;
        const newNotes = current.includes(note)
          ? current.filter(n => n !== note)
          : [...current, note];
        next[index] = { ...it, enabledNotes: newNotes };
      } else {
        const chordTones = getChordNotes(it.root, it.quality, it.extension);
        if (chordTones.includes(note)) return prev; // chord tones 鎖定
        const current = it.enabledNotes || chordTones;
        const newNotes = current.includes(note)
          ? current.filter(n => n !== note)
          : [...current, note];
        next[index] = { ...it, enabledNotes: newNotes };
      }
      return next;
    });
  };

  const handleSavePreset = (name) => savePreset(name, currentState);
  const handleLoadPreset = (id) => {
    const state = loadPreset(id);
    if (state) {
      const migrated = migrateLegacyState(state);
      setItemCount(migrated.itemCount);
      setDisplayMode(migrated.displayMode);
      setGuitarType(migrated.guitarType);
      setPlayItems(migrated.playItems);
      setFretCount(migrated.fretCount || 15);
      setShowSettings(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const activeItems = playItems.slice(0, itemCount);

  // 把 Play 項目轉成 Fretboard 吃的 scales 結構：
  //  - scale 項目原樣傳遞
  //  - chord 項目轉為 chromatic + enabledNotes + chordNotes + isChord
  const itemToFretboardScale = (it) => {
    if (it.type === 'chord') {
      return {
        root: it.root,
        scale: 'chromatic',
        enabledNotes: it.enabledNotes,
        chordNotes: getChordNotes(it.root, it.quality, it.extension),
        isChord: true,
      };
    }
    return { root: it.root, scale: it.scale, enabledNotes: it.enabledNotes };
  };
  const fretboardScales = activeItems.map(itemToFretboardScale);
  const activeScaleItems = activeItems.filter(it => it.type === 'scale');

  const backgroundImage = GUITAR_BACKGROUNDS[guitarType];

  return (
    <div className={`app ${blackScreenMode ? 'black-screen-mode' : ''}`} style={{ backgroundImage: blackScreenMode ? 'none' : `url(${backgroundImage})` }}>
      <div className="app-overlay" />

      <div className="app-content">
        {/* Top Navigation */}
        {!blackScreenMode && (
          <nav className="top-nav">
            <div className="nav-left">
              <h1 className="logo">Scale Mixer</h1>

              {/* Mode Toggle */}
              <div className="mode-toggle">
                <button
                  className={`mode-btn ${mode === 'play' ? 'active' : ''}`}
                  onClick={() => setMode('play')}
                >
                  🎼 Play
                </button>
                <button
                  className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
                  onClick={() => setMode('live')}
                >
                  🎸 Live
                </button>
                <button
                  className={`mode-btn ${mode === 'compose' ? 'active' : ''}`}
                  onClick={() => setMode('compose')}
                >
                  ✏️ Compose
                </button>
                <button
                  className={`mode-btn ${mode === 'read' ? 'active' : ''}`}
                  onClick={() => setMode('read')}
                >
                  📖 Read
                </button>
              </div>
            </div>

            <div className="nav-right">
              {/* New Features: YouTube & Black BG */}
              <div style={{ display: 'flex', gap: '8px', marginRight: '16px', borderRight: '1px solid #444', paddingRight: '16px' }}>
                <button
                  className={`icon-btn ${showYouTube ? 'active' : ''}`}
                  onClick={() => setShowYouTube(!showYouTube)}
                  title="Toggle YouTube Video"
                >
                  📺
                </button>
                <button
                  className={`icon-btn ${blackScreenMode ? 'active' : ''}`}
                  onClick={() => setBlackScreenMode(!blackScreenMode)}
                  title="Black Screen Mode (For CapCut)"
                  style={{ color: blackScreenMode ? '#ff5555' : 'inherit' }}
                >
                  ⬛ BG
                </button>
              </div>

              {/* User Info */}
              {user && (
                <div className="user-info">
                  <span className="user-name">{profile?.display_name || user.email}</span>
                  <span className="user-role">{profile?.role || 'student'}</span>
                </div>
              )}
              <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
                ⚙️
              </button>
              <button className="icon-btn" onClick={handleSignOut} title="登出">
                🚪
              </button>
            </div>
          </nav>
        )}

        {/* Floating Controls for Black Screen Mode */}
        {blackScreenMode && (
          <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 9999 }}>
            <button
              className="icon-btn active"
              onClick={() => setBlackScreenMode(false)}
              style={{ background: '#333', color: '#ff5555', border: '1px solid #555' }}
            >
              ❌ Exit
            </button>
          </div>
        )}

        {/* Play Mode — 整合 Scale + Chord，可混選最多 4 個項目 */}
        {mode === 'play' && (
          <div className="scale-mode">

            {/* Controls */}
            {!blackScreenMode && (
              <div className="controls-card">
                <div className="control-section">
                  <label className="section-label">Items</label>
                  <div className="btn-group">
                    {[1, 2, 3, 4].map(n => (
                      <button
                        key={n}
                        className={`sm-btn ${itemCount === n ? 'active' : ''}`}
                        onClick={() => setItemCount(n)}
                      >{n}</button>
                    ))}
                  </div>
                  {itemCount > 1 && (
                    <div className="btn-group" style={{ marginLeft: '8px' }}>
                      <button
                        className={`sm-btn ${fretboardLayout === 'overlay' ? 'active' : ''}`}
                        onClick={() => setFretboardLayout('overlay')}
                        title="合併顯示在同一指板"
                      >合併</button>
                      <button
                        className={`sm-btn ${fretboardLayout === 'separate' ? 'active' : ''}`}
                        onClick={() => setFretboardLayout('separate')}
                        title="各自顯示在獨立指板"
                      >分開</button>
                    </div>
                  )}
                </div>

                <div className="control-section">
                  <label className="section-label">Display</label>
                  <div className="btn-group">
                    <button
                      className={`sm-btn ${displayMode === 'notes' ? 'active' : ''}`}
                      onClick={() => setDisplayMode('notes')}
                    >ABC</button>
                    <button
                      className={`sm-btn ${displayMode === 'intervals' ? 'active' : ''}`}
                      onClick={() => setDisplayMode('intervals')}
                    >123</button>
                  </div>
                </div>

                <div className="control-section">
                  <label className="section-label">Position</label>
                  <div className="btn-group">
                    <button
                      className={`sm-btn ${cagedPosition === null ? 'active' : ''}`}
                      onClick={() => handleSetCagedPosition(null)}
                    >All</button>
                    {CAGED_SHAPES.map(shape => (
                      <button
                        key={shape}
                        className={`sm-btn ${cagedPosition === shape ? 'active' : ''}`}
                        onClick={() => handleSetCagedPosition(shape)}
                      >{shape}</button>
                    ))}
                  </div>
                </div>

                <div className="control-section">
                  <label className="section-label">Sound</label>
                  <select
                    className="sm-select"
                    value={guitarType}
                    onChange={(e) => setGuitarType(e.target.value)}
                  >
                    {GUITAR_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Item Cards — 每張卡片可切 Scale / Chord */}
            {!blackScreenMode && (
              <div className="scales-row">
                {activeItems.map((it, i) => (
                  <PlayItemCard
                    key={i}
                    index={i}
                    item={it}
                    onChange={(patch) => updateItem(i, patch)}
                    onToggleNote={(note) => toggleItemNote(i, note)}
                  />
                ))}
              </div>
            )}

            {/* Fretboard */}
            {fretboardLayout === 'separate' && itemCount > 1 ? (
              <div className="fretboards-separate">
                {fretboardScales.map((sc, idx) => (
                  <div key={idx} className="fretboard-container">
                    <Fretboard
                      scales={[sc]}
                      guitarType={guitarType}
                      displayMode={displayMode}
                      fretCount={fretCount}
                      cagedPosition={cagedPosition}
                      colorOffset={idx}
                      disabledFrets={disabledFrets}
                      onToggleFret={toggleFret}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="fretboard-container">
                <Fretboard
                  scales={fretboardScales}
                  guitarType={guitarType}
                  displayMode={displayMode}
                  fretCount={fretCount}
                  cagedPosition={cagedPosition}
                  disabledFrets={disabledFrets}
                  onToggleFret={toggleFret}
                />
              </div>
            )}
          </div>
        )}

        {/* Live Mode — 只看 scale 類項目作為 pitch guide */}
        {mode === 'live' && (
          <LiveMode
            guitarType={guitarType}
            scales={activeScaleItems.length > 0 ? activeScaleItems : [DEFAULT_PLAY_ITEMS[0]]}
            fretCount={fretCount}
            pitchDetection={pitchDetection}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
          />
        )}

        {/* Compose Mode — 指板選 scale/chord + 編寫六線譜 */}
        {mode === 'compose' && (
          <ComposeMode
            guitarType={guitarType}
            setGuitarType={setGuitarType}
            fretCount={fretCount}
          />
        )}

        {/* Read Mode */}
        {mode === 'read' && (
          <ReadMode
            guitarType={guitarType}
            setGuitarType={setGuitarType}
            fretCount={fretCount}
            pitchDetection={pitchDetection}
          />
        )}
      </div>

      <YouTubeSync isOpen={showYouTube} onClose={() => setShowYouTube(false)} />

      {showSettings && (
        <SettingsPage
          presets={presets}
          currentState={currentState}
          fretCount={fretCount}
          onFretCountChange={setFretCount}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={deletePreset}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function App() {
  // Popup 視窗檢視（Guitar / Score）— 繞過 auth，純檢視 + BroadcastChannel 同步
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'read-fretboard') return <ReadPopup view="fretboard" />;
  if (view === 'read-score') return <ReadPopup view="score" />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainContent />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
