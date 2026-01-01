import { useState, useEffect, useMemo } from 'react';
import Fretboard from './components/Fretboard';
import ScalePanel from './components/ScalePanel';
import GuitarSelector from './components/GuitarSelector';
import ScaleCountSelector from './components/ScaleCountSelector';
import DisplayModeSelector from './components/DisplayModeSelector';
import SettingsPage from './components/SettingsPage';
import { usePresets, useAutoSave, getInitialState } from './hooks/usePresets';
import './App.css';

// Background images for each guitar type (use base URL for Vite)
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

// Default state
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
  // Settings page visibility
  const [showSettings, setShowSettings] = useState(false);

  // Initialize state from localStorage or defaults
  const initialState = useMemo(() => getInitialState(DEFAULT_STATE), []);

  // Scale count (1, 2, or 3)
  const [scaleCount, setScaleCount] = useState(initialState.scaleCount);

  // Display mode: 'notes' or 'intervals'
  const [displayMode, setDisplayMode] = useState(initialState.displayMode);

  // Scale states with enabled notes tracking
  const [scales, setScales] = useState(initialState.scales);

  // Guitar instrument
  const [guitarType, setGuitarType] = useState(initialState.guitarType);

  // Presets management
  const { presets, savePreset, deletePreset, loadPreset } = usePresets();

  // Current state for auto-save and preset operations
  const currentState = useMemo(() => ({
    scaleCount,
    displayMode,
    guitarType,
    scales
  }), [scaleCount, displayMode, guitarType, scales]);

  // Auto-save current state
  useAutoSave(currentState, true);

  // Update a specific scale field
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

  // Toggle a specific note in a scale
  const toggleNote = (scaleIndex, noteName, allNotes) => {
    setScales(prev => {
      const newScales = prev.map((scale, idx) => {
        if (idx !== scaleIndex) return scale;

        const current = scale.enabledNotes;
        let enabledArray;
        if (current === null || current === undefined) {
          enabledArray = allNotes.filter(n => n !== noteName);
        } else {
          if (current.includes(noteName)) {
            enabledArray = current.filter(n => n !== noteName);
          } else {
            enabledArray = [...current, noteName];
          }
        }

        return { ...scale, enabledNotes: enabledArray };
      });

      return newScales;
    });
  };

  // Handle save preset
  const handleSavePreset = (name) => {
    savePreset(name, currentState);
  };

  // Handle load preset
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
    <div
      className="app"
      style={{
        backgroundImage: `url(${backgroundImage})`,
      }}
    >
      {/* Background overlay */}
      <div className="app-overlay" />

      {/* Content */}
      <div className="app-content">
        {/* Header */}
        <header className="app-header">
          <h1 className="app-title">Scale Mixer</h1>
          <p className="app-subtitle">Interactive Guitar Scale Visualization</p>
        </header>

        {/* Controls Row */}
        <div className="controls-bar">
          <GuitarSelector
            currentGuitar={guitarType}
            onGuitarChange={setGuitarType}
          />
          <ScaleCountSelector
            count={scaleCount}
            onCountChange={setScaleCount}
          />
          <DisplayModeSelector
            mode={displayMode}
            onModeChange={setDisplayMode}
          />
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings & Presets"
          >
            ⚙️
          </button>
        </div>

        {/* Fretboard */}
        <Fretboard
          scales={activeScales}
          guitarType={guitarType}
          displayMode={displayMode}
        />

        {/* Scale Panels */}
        <div className="main-content">
          {activeScales.map((scaleData, index) => (
            <ScalePanel
              key={index}
              scaleIndex={index}
              root={scaleData.root}
              scale={scaleData.scale}
              enabledNotes={scaleData.enabledNotes}
              onRootChange={(value) => updateScale(index, 'root', value)}
              onScaleChange={(value) => updateScale(index, 'scale', value)}
              onToggleNote={(noteName, allNotes) => toggleNote(index, noteName, allNotes)}
              guitarType={guitarType}
            />
          ))}
        </div>
      </div>

      {/* Settings Page */}
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
