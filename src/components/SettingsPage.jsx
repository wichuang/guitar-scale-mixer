import { useState } from 'react';
import './SettingsPage.css';

function SettingsPage({
    presets,
    currentState,
    fretCount,
    onFretCountChange,
    onSavePreset,
    onLoadPreset,
    onDeletePreset,
    onClose
}) {
    const [newPresetName, setNewPresetName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);

    // 產生 12 到 22 的選項
    const fretOptions = Array.from({ length: 11 }, (_, i) => i + 12);

    const handleSave = () => {
        if (newPresetName.trim()) {
            onSavePreset(newPresetName.trim());
            setNewPresetName('');
            setShowSaveInput(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="settings-page">
            <div className="settings-container">
                {/* Header */}
                <div className="settings-header">
                    <h2>設定 / Presets</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Fretboard Settings */}
                <div className="settings-section">
                    <h3>顯示設定</h3>
                    <div className="setting-control">
                        <label>琴格數量 (Fretboard Frets):</label>
                        <select
                            className="setting-select"
                            value={fretCount}
                            onChange={(e) => onFretCountChange(Number(e.target.value))}
                        >
                            {fretOptions.map(num => (
                                <option key={num} value={num}>{num} Frets</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Save new preset */}
                <div className="settings-section">
                    <h3>儲存當前設定</h3>
                    {!showSaveInput ? (
                        <button
                            className="save-btn"
                            onClick={() => setShowSaveInput(true)}
                        >
                            + Save Current as Preset
                        </button>
                    ) : (
                        <div className="save-input-row">
                            <input
                                type="text"
                                className="preset-name-input"
                                placeholder="Preset 名稱..."
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                autoFocus
                            />
                            <button className="confirm-btn" onClick={handleSave}>Save</button>
                            <button className="cancel-btn" onClick={() => setShowSaveInput(false)}>Cancel</button>
                        </div>
                    )}
                </div>

                {/* Presets list */}
                <div className="settings-section">
                    <h3>已儲存的 Presets ({presets.length})</h3>
                    {presets.length === 0 ? (
                        <p className="no-presets">尚未儲存任何 preset</p>
                    ) : (
                        <div className="presets-list">
                            {presets.map(preset => (
                                <div key={preset.id} className="preset-item">
                                    <div className="preset-info">
                                        <span className="preset-name">{preset.name}</span>
                                        <span className="preset-date">{formatDate(preset.createdAt)}</span>
                                        <span className="preset-details">
                                            {preset.state.scaleCount} scales • {preset.state.fretCount || 15} frets • {preset.state.guitarType.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                    <div className="preset-actions">
                                        <button
                                            className="load-btn"
                                            onClick={() => onLoadPreset(preset.id)}
                                        >
                                            Load
                                        </button>
                                        <button
                                            className="delete-btn"
                                            onClick={() => onDeletePreset(preset.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Current state info */}
                <div className="settings-section">
                    <h3>目前設定</h3>
                    <div className="current-state-info">
                        <p><strong>Guitar:</strong> {currentState.guitarType.replace(/_/g, ' ')}</p>
                        <p><strong>Display:</strong> {currentState.displayMode === 'notes' ? 'Notes (ABC)' : 'Intervals (123)'}</p>
                        <p><strong>Scales:</strong> {currentState.scaleCount}</p>
                        <p><strong>Frets:</strong> {currentState.fretCount}</p>
                        {currentState.scales.slice(0, currentState.scaleCount).map((s, i) => (
                            <p key={i} className="scale-info">
                                Scale {i + 1}: {s.root} {s.scale.replace(/-/g, ' ')}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SettingsPage;
