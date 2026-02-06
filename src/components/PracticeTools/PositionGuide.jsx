/**
 * PositionGuide - 指板位置指南元件
 * 顯示音階把位和建議指法
 */

import React, { useMemo } from 'react';
import { SCALES, STRING_TUNINGS, NOTES } from '../../data/scaleData.js';

// 把位名稱
const POSITION_NAMES = {
    0: 'Open Position',
    1: '1st Position',
    2: '2nd Position',
    3: '3rd Position',
    4: '4th Position',
    5: '5th Position',
    6: '6th Position',
    7: '7th Position',
    8: '8th Position',
    9: '9th Position',
    10: '10th Position',
    11: '11th Position',
    12: '12th Position'
};

// 建議指法（基於把位起始琴格）
const FINGER_PATTERNS = {
    // 3NPS 指法模式
    '3nps': [1, 2, 4], // 食指、中指、小指
    // CAGED 指法模式
    'caged': {
        'C': [1, 2, 3, 4],
        'A': [1, 2, 3, 4],
        'G': [1, 2, 3, 4],
        'E': [1, 2, 3, 4],
        'D': [1, 2, 3, 4]
    }
};

/**
 * 計算音階在指板上的位置
 */
function calculateScalePositions(musicKey, scaleType, startFret = 0, fretRange = 4) {
    const keyOffset = NOTES.indexOf(musicKey);
    if (keyOffset === -1) return [];

    const scaleMapping = {
        'Major': 'major',
        'Minor': 'aeolian',
        'Dorian': 'dorian',
        'Phrygian': 'phrygian',
        'Lydian': 'lydian',
        'Mixolydian': 'mixolydian',
        'Locrian': 'locrian',
        'HarmonicMinor': 'harmonic-minor',
        'MelodicMinor': 'melodic-minor'
    };

    const internalType = scaleMapping[scaleType] || 'major';
    const scale = SCALES[internalType];
    if (!scale) return [];

    const positions = [];

    // 對每條弦計算音階音符位置
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
        const openNote = STRING_TUNINGS[stringIdx];

        for (let fret = startFret; fret < startFret + fretRange; fret++) {
            const midiNote = openNote + fret;
            const noteInScale = (midiNote - keyOffset - 60 + 1200) % 12;

            // 檢查是否在音階中
            const scaleIndex = scale.intervals.indexOf(noteInScale);
            if (scaleIndex !== -1) {
                const noteName = NOTES[(midiNote % 12 + 12) % 12];
                const isRoot = noteInScale === 0;

                positions.push({
                    stringIdx,
                    fret,
                    noteName,
                    scaleIndex: scaleIndex + 1, // 1-7
                    isRoot,
                    midiNote,
                    // 建議指法（基於相對位置）
                    suggestedFinger: getSuggestedFinger(fret, startFret)
                });
            }
        }
    }

    return positions;
}

/**
 * 根據琴格位置建議指法
 */
function getSuggestedFinger(fret, startFret) {
    const relativePos = fret - startFret;
    if (relativePos === 0) return 1; // 食指
    if (relativePos === 1) return 2; // 中指
    if (relativePos === 2) return 3; // 無名指
    if (relativePos === 3) return 4; // 小指
    return 1;
}

/**
 * 指法標記
 */
const FINGER_LABELS = {
    1: { label: '1', color: '#4caf50', name: 'Index' },
    2: { label: '2', color: '#2196F3', name: 'Middle' },
    3: { label: '3', color: '#ff9800', name: 'Ring' },
    4: { label: '4', color: '#f44336', name: 'Pinky' }
};

function PositionGuide({
    musicKey = 'C',
    scaleType = 'Major',
    currentPosition = 0,
    showFingerNumbers = true,
    showNoteNames = false,
    showScaleDegrees = true,
    fretRange = 4,
    onPositionChange
}) {
    // 計算音階位置
    const scalePositions = useMemo(() =>
        calculateScalePositions(musicKey, scaleType, currentPosition, fretRange),
        [musicKey, scaleType, currentPosition, fretRange]
    );

    // 可用的把位
    const availablePositions = [0, 2, 4, 5, 7, 9, 12];

    // 渲染迷你指板
    const renderMiniFretboard = () => {
        const strings = [];
        const fretWidth = 40;
        const stringHeight = 20;

        for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
            const stringNotes = scalePositions.filter(p => p.stringIdx === stringIdx);

            strings.push(
                <div
                    key={stringIdx}
                    style={{
                        display: 'flex',
                        height: `${stringHeight}px`,
                        borderBottom: '1px solid #444'
                    }}
                >
                    {Array.from({ length: fretRange }).map((_, fretOffset) => {
                        const fret = currentPosition + fretOffset;
                        const note = stringNotes.find(n => n.fret === fret);

                        return (
                            <div
                                key={fretOffset}
                                style={{
                                    width: `${fretWidth}px`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRight: '1px solid #555',
                                    background: note?.isRoot ? 'rgba(255,82,82,0.2)' : 'transparent'
                                }}
                            >
                                {note && (
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: note.isRoot
                                            ? '#ff5252'
                                            : (showFingerNumbers ? FINGER_LABELS[note.suggestedFinger]?.color : '#4caf50'),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        color: '#fff'
                                    }}>
                                        {showFingerNumbers
                                            ? note.suggestedFinger
                                            : (showScaleDegrees ? note.scaleIndex : (showNoteNames ? note.noteName : ''))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
            <div style={{ background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
                {/* 琴格編號 */}
                <div style={{
                    display: 'flex',
                    borderBottom: '2px solid #555',
                    fontSize: '10px',
                    color: '#888'
                }}>
                    {Array.from({ length: fretRange }).map((_, i) => (
                        <div
                            key={i}
                            style={{
                                width: `${fretWidth}px`,
                                textAlign: 'center',
                                padding: '4px 0'
                            }}
                        >
                            {currentPosition + i}
                        </div>
                    ))}
                </div>
                {strings}
            </div>
        );
    };

    return (
        <div className="position-guide" style={{
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '16px',
            color: '#fff'
        }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#aaa' }}>
                Position Guide - {musicKey} {scaleType}
            </h4>

            {/* 把位選擇 */}
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                    Select Position
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {availablePositions.map(pos => (
                        <button
                            key={pos}
                            onClick={() => onPositionChange?.(pos)}
                            style={{
                                padding: '6px 12px',
                                background: currentPosition === pos ? '#4caf50' : '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            {pos === 0 ? 'Open' : `Fret ${pos}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* 把位名稱 */}
            <div style={{
                padding: '8px 12px',
                background: '#222',
                borderRadius: '4px',
                marginBottom: '16px',
                textAlign: 'center'
            }}>
                <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                    {POSITION_NAMES[currentPosition] || `Position at Fret ${currentPosition}`}
                </span>
            </div>

            {/* 迷你指板 */}
            <div style={{ marginBottom: '16px' }}>
                {renderMiniFretboard()}
            </div>

            {/* 指法圖例 */}
            {showFingerNumbers && (
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    fontSize: '11px'
                }}>
                    {Object.entries(FINGER_LABELS).map(([num, info]) => (
                        <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: info.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 'bold'
                            }}>
                                {num}
                            </div>
                            <span style={{ color: '#888' }}>{info.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* 顯示選項 */}
            <div style={{
                display: 'flex',
                gap: '16px',
                justifyContent: 'center',
                fontSize: '12px',
                color: '#888'
            }}>
                <span>
                    <span style={{ color: '#ff5252', fontWeight: 'bold' }}>●</span> Root ({musicKey})
                </span>
                <span>Notes in position: {scalePositions.length}</span>
            </div>
        </div>
    );
}

export default PositionGuide;
