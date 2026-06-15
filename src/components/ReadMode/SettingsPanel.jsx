/**
 * SettingsPanel - Read 控制列（採 Compose 的橫向控制列 UI）
 * Display / Position / Sound / 拍子 / 速度 / Ghost / Count-In / YouTube / 顯示模式
 */

import React from 'react';
import { CAGED_SHAPES } from '../../data/scaleData.js';
import InstrumentSelector from './InstrumentSelector.jsx';

function SettingsPanel({
    timeSignature,
    tempo,
    cagedPosition,
    showScaleGuide,
    displayMode,
    enableCountIn,
    showYoutube,
    instrument,
    onTimeSignatureChange,
    onTempoChange,
    onCagedPositionChange,
    onShowScaleGuideChange,
    onDisplayModeChange,
    onEnableCountInChange,
    onShowYoutubeChange,
    onInstrumentChange
}) {
    const dispMode = displayMode || 'notes';
    return (
        <div className="controls-card" style={{ display: 'flex', flexWrap: 'wrap', maxWidth: '100%', alignSelf: 'stretch' }}>
            {/* Display ABC/123 */}
            {onDisplayModeChange && (
                <div className="control-section">
                    <label className="section-label">Display</label>
                    <div className="btn-group">
                        <button className={`sm-btn ${dispMode === 'notes' ? 'active' : ''}`} onClick={() => onDisplayModeChange('notes')}>ABC</button>
                        <button className={`sm-btn ${dispMode === 'intervals' ? 'active' : ''}`} onClick={() => onDisplayModeChange('intervals')}>123</button>
                    </div>
                </div>
            )}

            {/* Position (CAGED) */}
            <div className="control-section">
                <label className="section-label">Position</label>
                <div className="btn-group">
                    <button className={`sm-btn ${cagedPosition === null ? 'active' : ''}`} onClick={() => onCagedPositionChange && onCagedPositionChange(null)}>All</button>
                    {CAGED_SHAPES.map(shape => (
                        <button key={shape} className={`sm-btn ${cagedPosition === shape ? 'active' : ''}`} onClick={() => onCagedPositionChange && onCagedPositionChange(shape)}>{shape}</button>
                    ))}
                </div>
            </div>

            {/* Sound */}
            {onInstrumentChange && (
                <div className="control-section">
                    <label className="section-label">Sound</label>
                    <InstrumentSelector instrument={instrument} onInstrumentChange={onInstrumentChange} />
                </div>
            )}

            {/* 拍子 */}
            <div className="control-section">
                <label className="section-label">拍子</label>
                <select className="sm-select" value={timeSignature} onChange={(e) => onTimeSignatureChange(e.target.value)}>
                    <option value="4/4">4/4</option>
                    <option value="3/4">3/4</option>
                    <option value="2/4">2/4</option>
                    <option value="6/8">6/8</option>
                    <option value="12/8">12/8</option>
                </select>
            </div>

            {/* 速度 */}
            <div className="control-section">
                <label className="section-label">速度</label>
                <input type="range" min="40" max="200" value={tempo} onChange={(e) => onTempoChange(Number(e.target.value))} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '52px' }}>{tempo} BPM</span>
            </div>

            {/* Ghost Notes */}
            <div className="control-section">
                <label className="section-label">Ghost</label>
                <div className="btn-group">
                    <button className={`sm-btn ${showScaleGuide ? 'active' : ''}`} onClick={() => onShowScaleGuideChange(!showScaleGuide)}>{showScaleGuide ? 'On' : 'Off'}</button>
                </div>
            </div>

            {/* Count-In */}
            <div className="control-section">
                <label className="section-label">Count-In</label>
                <div className="btn-group">
                    <button className={`sm-btn ${enableCountIn ? 'active' : ''}`} onClick={() => onEnableCountInChange(!enableCountIn)}>{enableCountIn ? 'On' : 'Off'}</button>
                </div>
            </div>

            {/* YouTube */}
            <div className="control-section">
                <button className="sm-btn" onClick={() => onShowYoutubeChange(!showYoutube)} style={showYoutube ? { background: '#c00', color: '#fff' } : undefined}>
                    {showYoutube ? 'Close YouTube' : 'YouTube'}
                </button>
            </div>
        </div>
    );
}

export default SettingsPanel;
