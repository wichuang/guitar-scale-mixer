/**
 * SettingsPanel - 設定面板元件
 * 調號、音階、拍子、速度、指法模式等設定
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
    viewMode,
    instrument,
    onTimeSignatureChange,
    onTempoChange,
    onStartStringChange,
    onCagedPositionChange,
    onShowScaleGuideChange,
    onDisplayModeChange,
    onEnableCountInChange,
    onShowYoutubeChange,
    onViewModeChange,
    onInstrumentChange
}) {
    const dispBtn = (val, label) => (
        <button
            onClick={() => onDisplayModeChange && onDisplayModeChange(val)}
            style={{
                padding: '3px 12px', borderRadius: '4px', border: '1px solid #444',
                background: (displayMode || 'notes') === val ? '#2196F3' : '#222',
                color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: 600
            }}
        >{label}</button>
    );
    return (
        <div className="settings-section">
            {onInstrumentChange && (
                <div className="setting-row">
                    <label>音色</label>
                    <InstrumentSelector
                        instrument={instrument}
                        onInstrumentChange={onInstrumentChange}
                    />
                </div>
            )}

            {/* 調號 / 音階改由上方 Scale/Chord 選擇器（PlayItemCard）控制 */}

            <div className="setting-row">
                <label>拍子</label>
                <select
                    value={timeSignature}
                    onChange={(e) => onTimeSignatureChange(e.target.value)}
                >
                    <option value="4/4">4/4</option>
                    <option value="3/4">3/4</option>
                    <option value="2/4">2/4</option>
                    <option value="6/8">6/8</option>
                    <option value="12/8">12/8</option>
                </select>
            </div>

            {onDisplayModeChange && (
                <div className="setting-row mode-info">
                    <label>Display</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {dispBtn('notes', 'ABC')}
                        {dispBtn('intervals', '123')}
                    </div>
                </div>
            )}

            <div className="setting-row mode-info">
                <label>Position</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => onCagedPositionChange && onCagedPositionChange(null)}
                        style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid #444',
                            background: cagedPosition === null ? '#2196F3' : '#222',
                            color: '#fff',
                            fontSize: '12px',
                            cursor: 'pointer',
                            minWidth: '32px'
                        }}
                    >All</button>
                    {CAGED_SHAPES.map(shape => (
                        <button
                            key={shape}
                            onClick={() => onCagedPositionChange && onCagedPositionChange(shape)}
                            style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: '1px solid #444',
                                background: cagedPosition === shape ? '#2196F3' : '#222',
                                color: '#fff',
                                fontSize: '12px',
                                cursor: 'pointer',
                                minWidth: '28px',
                                fontWeight: 600
                            }}
                        >{shape}</button>
                    ))}
                </div>
            </div>

            <div className="setting-row">
                <label>速度</label>
                <input
                    type="range"
                    min="40"
                    max="200"
                    value={tempo}
                    onChange={(e) => onTempoChange(Number(e.target.value))}
                />
                <span>{tempo} BPM</span>
            </div>

            <div className="setting-row" style={{ marginTop: '5px' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                    <input
                        type="checkbox"
                        checked={showScaleGuide}
                        onChange={(e) => onShowScaleGuideChange(e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                    />
                    <span>顯示背景音階 (Ghost Notes)</span>
                </label>
            </div>

            <div className="setting-row" style={{ marginTop: '5px' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                    <input
                        type="checkbox"
                        checked={enableCountIn}
                        onChange={(e) => onEnableCountInChange(e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                    />
                    <span>播放前倒數 (Count-In)</span>
                </label>
            </div>

            <div className="setting-row" style={{ marginTop: '5px' }}>
                <button
                    onClick={() => onShowYoutubeChange(!showYoutube)}
                    style={{
                        background: showYoutube ? '#ff0000' : '#444',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    }}
                >
                    {showYoutube ? 'Close YouTube' : 'Open YouTube'}
                </button>
            </div>

            {/* View Mode Toggle */}
            <div className="setting-row" style={{ marginTop: '10px', padding: '5px 0', borderTop: '1px solid #444' }}>
                <span style={{ fontSize: '12px', color: '#ccc', marginBottom: '4px', display: 'block' }}>顯示模式</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                        onClick={() => onViewModeChange('both')}
                        style={{
                            flex: 1, padding: '4px', fontSize: '12px', cursor: 'pointer',
                            background: viewMode === 'both' ? '#2196F3' : '#444',
                            color: 'white', border: 'none', borderRadius: '4px'
                        }}
                    >全部</button>
                    <button
                        onClick={() => onViewModeChange('text')}
                        style={{
                            flex: 1, padding: '4px', fontSize: '12px', cursor: 'pointer',
                            background: viewMode === 'text' ? '#2196F3' : '#444',
                            color: 'white', border: 'none', borderRadius: '4px'
                        }}
                    >簡譜</button>
                    <button
                        onClick={() => onViewModeChange('score')}
                        style={{
                            flex: 1, padding: '4px', fontSize: '12px', cursor: 'pointer',
                            background: viewMode === 'score' ? '#2196F3' : '#444',
                            color: 'white', border: 'none', borderRadius: '4px'
                        }}
                    >譜面</button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPanel;
