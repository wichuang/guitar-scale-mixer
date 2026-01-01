import { useState, useMemo } from 'react';
import Fretboard from './components/Fretboard';
import LiveMode from './components/LiveMode';
import ScalePanelCompact from './components/ScalePanelCompact';
import SettingsPage from './components/SettingsPage';
import { usePresets, useAutoSave, getInitialState } from './hooks/usePresets';
import { usePitchDetection } from './hooks/usePitchDetection';
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
  guitarType: 'acoustic_guitar_nylon',
  scales: [
    { root: 'A', scale: 'harmonic-minor', enabledNotes: null },
    { root: 'A', scale: 'minor-pentatonic', enabledNotes: null },
    { root: 'E', scale: 'major', enabledNotes: null },
  ]
};

function App() {
  // Mode: 'scale' or 'live'
  const [mode, setMode] = useState('scale');
  const [showSettings, setShowSettings] = useState(false);
  const initialState = useMemo(() => getInitialState(DEFAULT_STATE), []);

  const [scaleCount, setScaleCount] = useState(initialState.scaleCount);
  const [displayMode, setDisplayMode] = useState(initialState.displayMode);
  const [scales, setScales] = useState(initialState.scales);
  const [guitarType, setGuitarType] = useState(initialState.guitarType);

  const { presets, savePreset, deletePreset, loadPreset } = usePresets();
  const pitchDetection = usePitchDetection();

  const currentState = useMemo(() => ({
    scaleCount, displayMode, guitarType, scales
  }), [scaleCount, displayMode, guitarType, scales]);

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

  const handleSavePreset = (name) => savePreset(name, currentState);
  const handleLoadPreset = (id) => {
    const state = loadPreset(id);
    if (state) {
      setScaleCount(state.scaleCount);
      setDisplayMode(state.displayMode);
      setGuitarType(state.guitarType);
      setScales(state.scales);
      setShowSettings(false);
    }
  };

  const activeScales = scales.slice(0, scaleCount);
  const backgroundImage = GUITAR_BACKGROUNDS[guitarType];

  return (
    <div className="app" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="app-overlay" />

      <div className="app-content">
        {/* Top Navigation */}
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
            </div>
          </div>

          <div className="nav-right">
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
              ⚙️
            </button>
          </div>
        </nav>

        {/* Scale Mode */}
        {mode === 'scale' && (
          <div className="scale-mode">
            {/* Controls */}
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

            {/* Scale Selectors */}
            <div className="scales-row">
              {activeScales.map((s, i) => (
                <ScalePanelCompact
                  key={i}
                  index={i}
                  root={s.root}
                  scale={s.scale}
                  onRootChange={(v) => updateScale(i, 'root', v)}
                  onScaleChange={(v) => updateScale(i, 'scale', v)}
                />
              ))}
            </div>

            {/* Fretboard */}
            <Fretboard
              scales={activeScales}
              guitarType={guitarType}
              displayMode={displayMode}
            />
          </div>
        )}

        {/* Live Mode */}
        {mode === 'live' && (
          <LiveMode
            pitchDetection={pitchDetection}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            scales={activeScales}
          />
        )}
      </div>

      {showSettings && (
        <SettingsPage
          presets={presets}
          currentState={currentState}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={deletePreset}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
