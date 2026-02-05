/**
 * JianpuView - 簡譜視圖元件
 * 渲染數字記譜法的簡譜
 */

import React from 'react';

/**
 * 渲染八度點
 */
const renderOctaveDots = (count, position) => {
    if (count === 0) return null;
    const dots = [];
    for (let i = 0; i < Math.abs(count); i++) {
        dots.push(
            <div
                key={i}
                style={{
                    width: '4px',
                    height: '4px',
                    background: 'white',
                    borderRadius: '50%',
                    margin: '0 2px'
                }}
            />
        );
    }
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            position: 'absolute',
            [position]: '-8px',
            width: '100%'
        }}>
            {dots}
        </div>
    );
};

/**
 * 渲染時值底線
 */
const renderDurationLines = (duration) => {
    let lines = 0;
    if (duration?.includes('eighth') || duration?.includes('8')) lines = 1;
    if (duration?.includes('sixteenth') || duration?.includes('16')) lines = 2;
    if (duration?.includes('thirty') || duration?.includes('32')) lines = 3;

    if (lines === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '0',
            right: '0',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
        }}>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} style={{ height: '2px', background: 'white', width: '100%' }} />
            ))}
        </div>
    );
};

function JianpuView({
    notes,
    noteXCoordinates = [],
    currentNoteIndex = -1,
    showDuration = true,
    height = 60
}) {
    return (
        <div
            className="jianpu-view"
            style={{
                height: `${height}px`,
                position: 'relative',
                width: '100%'
            }}
        >
            {notes.map((note, index) => {
                const x = noteXCoordinates[index];
                if (x === null || x === undefined) return null;

                // 決定顯示字元
                let char = note.displayStr || note.jianpu || '?';
                if (note.isRest) char = '0';
                if (note.isSeparator) char = '|';
                if (note.isExtension) char = '-';

                // 八度差異 (相對於中央 C = 4)
                const octDiff = (note.octave || 4) - 4;

                // 是否為當前播放的音符
                const isActive = index === currentNoteIndex;

                return (
                    <div
                        key={index}
                        style={{
                            position: 'absolute',
                            left: x - 10,
                            top: '20px',
                            width: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            color: isActive ? '#4caf50' : 'white',
                            fontWeight: 'bold',
                            fontSize: '18px',
                            lineHeight: '1',
                            transition: 'color 0.1s ease'
                        }}
                    >
                        {/* 高八度點 */}
                        {octDiff > 0 && renderOctaveDots(octDiff, 'top')}

                        {/* 音符數字 */}
                        <span style={{
                            textShadow: isActive ? '0 0 8px rgba(76, 175, 80, 0.8)' : 'none'
                        }}>
                            {char}
                        </span>

                        {/* 低八度點 */}
                        {octDiff < 0 && renderOctaveDots(Math.abs(octDiff), 'bottom')}

                        {/* 時值底線 */}
                        {showDuration && renderDurationLines(note.duration)}
                    </div>
                );
            })}
        </div>
    );
}

export default JianpuView;
