import { GUITAR_INSTRUMENTS } from '../hooks/useAudio';
import './GuitarSelector.css';

function GuitarSelector({ currentGuitar, onGuitarChange }) {
    return (
        <div className="guitar-selector">
            <label className="selector-label">Guitar</label>
            <select
                className="guitar-dropdown"
                value={currentGuitar}
                onChange={(e) => onGuitarChange(e.target.value)}
            >
                {Object.entries(GUITAR_INSTRUMENTS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                ))}
            </select>
        </div>
    );
}

export default GuitarSelector;
