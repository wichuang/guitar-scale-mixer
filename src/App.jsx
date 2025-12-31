import { useState } from 'react';
import Fretboard from './components/Fretboard';
import ScalePanel from './components/ScalePanel';
import GuitarSelector from './components/GuitarSelector';
import ScaleCountSelector from './components/ScaleCountSelector';
import './App.css';

// Background images for each guitar type
const GUITAR_BACKGROUNDS = {
  'acoustic_guitar_nylon': '/backgrounds/acoustic_guitar_nylon.png',
  'acoustic_guitar_steel': '/backgrounds/acoustic_guitar_steel.png',
  'electric_guitar_clean': '/backgrounds/electric_guitar_clean.png',
  'electric_guitar_muted': '/backgrounds/electric_guitar_muted.png',
  'electric_guitar_jazz': '/backgrounds/electric_guitar_jazz.png',
  'overdriven_guitar': '/backgrounds/overdriven_guitar.png',
  'distortion_guitar': '/backgrounds/distortion_guitar.png',
};

function App() {
  // Scale count (1, 2, or 3)
  const [scaleCount, setScaleCount] = useState(2);

  // Scale states with enabled notes tracking
  const [scales, setScales] = useState([
    { root: 'A', scale: 'harmonic-minor', enabledNotes: null },
    { root: 'A', scale: 'minor-pentatonic', enabledNotes: null },
    { root: 'E', scale: 'major', enabledNotes: null },
  ]);

  // Guitar instrument
  const [guitarType, setGuitarType] = useState('acoustic_guitar_nylon');

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
        </div>

        {/* Fretboard */}
        <Fretboard
          scales={activeScales}
          guitarType={guitarType}
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
    </div>
  );
}

export default App;
