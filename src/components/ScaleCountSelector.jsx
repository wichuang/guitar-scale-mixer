import './ScaleCountSelector.css';

function ScaleCountSelector({ count, onCountChange }) {
    return (
        <div className="scale-count-selector">
            <label className="selector-label">Scales</label>
            <div className="count-buttons">
                {[1, 2, 3].map(num => (
                    <button
                        key={num}
                        className={`count-btn ${count === num ? 'active' : ''}`}
                        onClick={() => onCountChange(num)}
                    >
                        {num}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default ScaleCountSelector;
