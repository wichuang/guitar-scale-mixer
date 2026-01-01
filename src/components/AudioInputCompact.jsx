import './AudioInputCompact.css';

function AudioInputCompact({
    isListening, devices, selectedDevice, onDeviceChange,
    detectedNote, volume, noteHistory, onStart, onStop, onRefresh
}) {
    return (
        <div className={`audio-compact ${isListening ? 'active' : ''}`}>
            <div className="audio-left">
                <span className="audio-label">🎸 Live</span>

                <select
                    className="device-sel"
                    value={selectedDevice}
                    onChange={(e) => onDeviceChange(e.target.value)}
                    disabled={isListening}
                >
                    {devices.length === 0 ? (
                        <option value="">No devices</option>
                    ) : (
                        devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Input ${d.deviceId.slice(0, 6)}`}
                            </option>
                        ))
                    )}
                </select>

                <button className="ref-btn" onClick={onRefresh} disabled={isListening}>↻</button>

                <button
                    className={`listen-btn ${isListening ? 'stop' : ''}`}
                    onClick={isListening ? onStop : onStart}
                >
                    {isListening ? '⏹' : '▶'}
                </button>
            </div>

            <div className="audio-center">
                {isListening && (
                    <>
                        <div className="vol-bar">
                            <div className="vol-fill" style={{ width: `${volume * 100}%` }} />
                        </div>
                        {detectedNote && <span className="det-note">{detectedNote}</span>}
                    </>
                )}
            </div>

            <div className="audio-right">
                {noteHistory.slice(0, 8).map((h, i) => (
                    <span key={h.time} className={`hist-note ${i === 0 ? 'latest' : ''}`}>
                        {h.note}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default AudioInputCompact;
