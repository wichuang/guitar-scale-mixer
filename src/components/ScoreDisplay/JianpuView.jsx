/**
 * JianpuView - 簡譜視圖元件
 * 渲染數字記譜法的簡譜，支援完整音符時值
 *
 * 簡譜時值表示法：
 *   全音符:      1 - - -    (數字後接三個延長線)
 *   二分音符:    1 -        (數字後接一個延長線)
 *   四分音符:    1          (無底線)
 *   八分音符:    1          (一條底線)
 *              ─
 *   十六分音符:  1          (兩條底線)
 *              ═
 *   三十二分音符: 1          (三條底線)
 *              ≡
 *   附點:       1·         (音符右側加點)
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
                    background: 'currentColor',
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
            [position]: position === 'top' ? '-10px' : '-12px',
            width: '100%'
        }}>
            {dots}
        </div>
    );
};

/**
 * 取得時值底線數量
 * 八分音符 = 1 條, 十六分 = 2 條, 三十二分 = 3 條
 */
function getUnderlineCount(duration) {
    if (!duration) return 0;
    if (duration.includes('32') || duration.includes('thirty')) return 3;
    if (duration.includes('16') || duration.includes('sixteenth')) return 2;
    if (duration.includes('eighth') || duration === '8th' || duration === '8') return 1;
    return 0;
}

/**
 * 判斷是否為長時值音符（二分或全音符）
 */
function isLongDuration(duration) {
    if (!duration) return null;
    if (duration === 'whole') return 'whole';
    if (duration === 'half') return 'half';
    return null;
}

/**
 * 渲染時值底線（短音符：八分、十六分、三十二分）
 */
const renderDurationLines = (duration, color) => {
    const lines = getUnderlineCount(duration);
    if (lines === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '1px',
            right: '1px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
        }}>
            {Array.from({ length: lines }).map((_, i) => (
                <div key={i} style={{
                    height: '2px',
                    background: color || 'white',
                    width: '100%',
                    borderRadius: '1px'
                }} />
            ))}
        </div>
    );
};

/**
 * 渲染附點符號
 */
const renderDottedSymbol = (dotted, color) => {
    if (!dotted || dotted < 1) return null;

    return (
        <span style={{
            position: 'absolute',
            right: '-6px',
            top: '0px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: color || 'white',
            lineHeight: '1'
        }}>
            {'·'.repeat(dotted)}
        </span>
    );
};

/**
 * 渲染長時值記號（二分音符加底線，全音符加底線加延長線）
 */
const renderLongDuration = (duration, color) => {
    const longType = isLongDuration(duration);
    if (!longType) return null;

    // 二分音符：數字下方一條長底線
    // 全音符：數字下方一條長底線（延長線由 extension notes 處理）
    return (
        <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '-2px',
            right: '-2px',
            height: '2px',
            background: color || 'white',
            borderRadius: '1px'
        }} />
    );
};

function JianpuView({
    notes,
    noteXCoordinates = [],
    currentNoteIndex = -1,
    showDuration = true,
    height = 80
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
                if (note.isExtension) char = '–';

                // 八度差異 (相對於中央 C = 4)
                const octDiff = (note.octave || 4) + (note.displayOctaveShift || 0) - 4;

                // 是否為當前播放的音符
                const isActive = index === currentNoteIndex;

                const noteColor = isActive ? '#4caf50' : 'white';

                // 是否為特殊符號（分隔線、延長線等不需要時值標記）
                const isSpecial = note.isSeparator || note.isExtension || note.isSymbol;

                return (
                    <div
                        key={index}
                        style={{
                            position: 'absolute',
                            left: x - 12,
                            top: '20px',
                            width: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            color: noteColor,
                            fontWeight: 'bold',
                            fontSize: '18px',
                            lineHeight: '1',
                            transition: 'color 0.1s ease'
                        }}
                    >
                        {/* 高八度點 */}
                        {!isSpecial && octDiff > 0 && renderOctaveDots(octDiff, 'top')}

                        {/* 音符數字 + 附點 */}
                        <span style={{
                            position: 'relative',
                            textShadow: isActive ? '0 0 8px rgba(76, 175, 80, 0.8)' : 'none'
                        }}>
                            {char}
                            {/* 附點符號 */}
                            {showDuration && !isSpecial && renderDottedSymbol(note.dotted, noteColor)}
                        </span>

                        {/* 低八度點 */}
                        {!isSpecial && octDiff < 0 && renderOctaveDots(Math.abs(octDiff), 'bottom')}

                        {/* 時值標記 */}
                        {showDuration && !isSpecial && (
                            <>
                                {/* 短音符底線 (八分、十六分、三十二分) */}
                                {renderDurationLines(note.duration, noteColor)}
                                {/* 長音符底線 (二分、全音符) */}
                                {renderLongDuration(note.duration, noteColor)}
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default JianpuView;
