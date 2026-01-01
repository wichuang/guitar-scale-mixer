import './DisplayModeSelector.css';

function DisplayModeSelector({ mode, onModeChange }) {
    return (
        <div className="display-mode-selector">
            <label className="selector-label">Display</label>
            <div className="mode-buttons">
                <button
                    className={`mode-btn ${mode === 'notes' ? 'active' : ''}`}
                    onClick={() => onModeChange('notes')}
                >
                    A B C
                </button>
                <button
                    className={`mode-btn ${mode === 'intervals' ? 'active' : ''}`}
                    onClick={() => onModeChange('intervals')}
                >
                    1 2 3
                </button>
            </div>
        </div>
    );
}

export default DisplayModeSelector;
