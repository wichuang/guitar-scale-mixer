import { useState, useMemo } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Fretboard from './components/Fretboard';
import LiveMode from './components/LiveMode';
import ReadMode from './components/ReadMode/index.jsx';
import ScalePanelCompact from './components/ScalePanelCompact';
import SettingsPage from './components/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';
import YouTubeSync from './components/YouTubeSync';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { usePresets, useAutoSave, getInitialState } from './hooks/usePresets';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useAuth } from './contexts/AuthContext';
import { getScaleNotes } from './data/scaleData';
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

const GUITAR_OPTIONS = [
  { value: 'acoustic_guitar_nylon', label: 'Nylon' },
  { value: 'acoustic_guitar_steel', label: 'Steel' },
  { value: 'electric_guitar_clean', label: 'Clean' },
  { value: 'electric_guitar_jazz', label: 'Jazz' },
  { value: 'distortion_guitar', label: 'Distort' },
];

const DEFAULT_STATE = {
  scaleCount: 2,
  displayMode: 'notes',
  guitarType: 'acoustic_guitar_steel',
  fretCount: 15,
  scales: [
    { root: 'A', scale: 'harmonic-minor', enabledNotes: null },
    { root: 'A', scale: 'minor-pentatonic', enabledNotes: null },
    { root: 'E', scale: 'major', enabledNotes: null },
  ]
};

// Main App Content (Protected)
function MainContent() {
  const [mode, setMode] = useState('scale');
  const [showSettings, setShowSettings] = useState(false);
  const initialState = useMemo(() => getInitialState(DEFAULT_STATE), []);

  const [scaleCount, setScaleCount] = useState(initialState.scaleCount);
  const [displayMode, setDisplayMode] = useState(initialState.displayMode);
  const [scales, setScales] = useState(initialState.scales);
  const [guitarType, setGuitarType] = useState(initialState.guitarType);
  const [fretCount, setFretCount] = useState(initialState.fretCount || 15);

  const { presets, savePreset, deletePreset, loadPreset } = usePresets();
  const pitchDetection = usePitchDetection();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // New features state
  const [showYouTube, setShowYouTube] = useState(false);
  const [blackScreenMode, setBlackScreenMode] = useState(false);

  const currentState = useMemo(() => ({
    scaleCount, displayMode, guitarType, scales, fretCount
  }), [scaleCount, displayMode, guitarType, scales, fretCount]);

  useAutoSave(currentState, true);

  const updateScale = (index, field, value) => {
    setScales(prev => {
      const newScales = [...prev];
      newScales[index] = { ...newScales[index], [field]: value };
      if (field === 'scale' || field === 'root') {
        newScales[index].enabledNotes = null;
      }
      return newScales;
    });
  };

  const toggleNote = (index, note) => {
    setScales(prev => {
      const newScales = [...prev];
      const scale = newScales[index];
      // 如果還沒有自定義過，預設是全部開啟
      const currentNotes = scale.enabledNotes || getScaleNotes(scale.root, scale.scale);

      let nextNotes;
      if (currentNotes.includes(note)) {
        nextNotes = currentNotes.filter(n => n !== note);
      } else {
        nextNotes = [...currentNotes, note];
      }

      newScales[index] = { ...scale, enabledNotes: nextNotes };
      return newScales;
    });
  };

  const handleSavePreset = (name) => savePreset(name, currentState);
  const handleLoadPreset = (id) => {
    const state = loadPreset(id);
    if (state) {
      setScaleCount(state.scaleCount);
      setDisplayMode(state.displayMode);
      setGuitarType(state.guitarType);
      setScales(state.scales);
      setFretCount(state.fretCount || 15);
      setShowSettings(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const activeScales = scales.slice(0, scaleCount);
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
                  className={`mode-btn ${mode === 'scale' ? 'active' : ''}`}
                  onClick={() => setMode('scale')}
                >
                  📚 Scales
                </button>
                <button
                  className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
                  onClick={() => setMode('live')}
                >
                  🎸 Live
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

        {/* Scale Mode */}
        {mode === 'scale' && (
          <div className="scale-mode">

            {/* Controls - Only show if not black screen */}
            {!blackScreenMode && (
              <div className="controls-card">
                <div className="control-section">
                  <label className="section-label">Scales</label>
                  <div className="btn-group">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        className={`sm-btn ${scaleCount === n ? 'active' : ''}`}
                        onClick={() => setScaleCount(n)}
                      >{n}</button>
                    ))}
                  </div>
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

            {/* Scale Selectors */}
            {!blackScreenMode && (
              <div className="scales-row">
                {activeScales.map((s, i) => (
                  <ScalePanelCompact
                    key={i}
                    index={i}
                    root={s.root}
                    scale={s.scale}
                    enabledNotes={s.enabledNotes}
                    onRootChange={(v) => updateScale(i, 'root', v)}
                    onScaleChange={(v) => updateScale(i, 'scale', v)}
                    onToggleNote={(note) => toggleNote(i, note)}
                  />
                ))}
              </div>
            )}

            {/* Fretboard - Always visible */}
            <div className="fretboard-container">
              <Fretboard
                scales={activeScales}
                guitarType={guitarType}
                displayMode={displayMode}
                fretCount={fretCount}
              />
            </div>
          </div>
        )}

        {/* Live Mode */}
        {mode === 'live' && (
          <LiveMode
            guitarType={guitarType}
            scales={activeScales}
            fretCount={fretCount}
            pitchDetection={pitchDetection}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
          />
        )}

        {/* Read Mode */}
        {mode === 'read' && (
          <ReadMode
            guitarType={guitarType}
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
