import './AudioInputPanel.css';

function AudioInputPanel({
    isListening,
    devices,
    selectedDevice,
    onDeviceChange,
    detectedNote,
    detectedFrequency,
    centsDeviation,
    volume,
    noteHistory,
    onStartListening,
    onStopListening,
    onRefreshDevices,
    onClearHistory
}) {
    return (
        <div className="audio-input-panel">
            <div className="panel-header">
                <span className="panel-label">🎸 Live Input</span>
                {isListening && (
                    <span className="listening-indicator">
                        <span className="pulse-dot" />
                        Listening
                    </span>
                )}
            </div>

            <div className="panel-content">
                {/* Device selector */}
                <div className="device-row">
                    <select
                        className="device-select"
                        value={selectedDevice}
                        onChange={(e) => onDeviceChange(e.target.value)}
                        disabled={isListening}
                    >
                        {devices.length === 0 ? (
                            <option value="">No devices found</option>
                        ) : (
                            devices.map(device => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Audio Input ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))
                        )}
                    </select>
                    <button
                        className="refresh-btn"
                        onClick={onRefreshDevices}
                        disabled={isListening}
                        title="Refresh devices"
                    >
                        ↻
                    </button>
                </div>

                {/* Start/Stop button */}
                <button
                    className={`listen-btn ${isListening ? 'active' : ''}`}
                    onClick={isListening ? onStopListening : onStartListening}
                >
                    {isListening ? '⏹ Stop' : '▶ Listen'}
                </button>

                {/* Detected note display */}
                {isListening && (
                    <div className="detection-display">
                        <div className="volume-bar">
                            <div
                                className="volume-fill"
                                style={{ width: `${volume * 100}%` }}
                            />
                        </div>

                        {detectedNote ? (
                            <div className="note-display">
                                <span className="detected-note">{detectedNote}</span>
                                <span className="detected-freq">{detectedFrequency} Hz</span>
                                <div className={`cents-display ${centsDeviation > 10 ? 'sharp' : centsDeviation < -10 ? 'flat' : 'tune'}`}>
                                    {centsDeviation > 0 ? '+' : ''}{centsDeviation}¢
                                </div>
                            </div>
                        ) : (
                            <div className="no-note">
                                <span>Play a note...</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Note History */}
                {noteHistory && noteHistory.length > 0 && (
                    <div className="note-history">
                        <div className="history-header">
                            <span className="history-label">Recent Notes</span>
                            <button
                                className="clear-history-btn"
                                onClick={onClearHistory}
                                title="Clear history"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="history-notes">
                            {noteHistory.slice(0, 12).map((item, idx) => (
                                <span
                                    key={item.time}
                                    className={`history-note ${idx === 0 ? 'latest' : ''}`}
                                    style={{ opacity: 1 - idx * 0.06 }}
                                >
                                    {item.note}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AudioInputPanel;
