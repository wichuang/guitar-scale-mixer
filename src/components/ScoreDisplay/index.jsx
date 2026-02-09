/**
 * ScoreDisplay - 譜面顯示主控制器
 * 整合簡譜、五線譜、六線譜視圖
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import JianpuView from './JianpuView.jsx';
import StaffView from './StaffView.jsx';
import TabView from './TabView.jsx';
import NotationSelector from '../NotationSelector/index.jsx';
import './ScoreDisplay.css';

function ScoreDisplay({
    notes,
    notePositions = [],
    timeSignature = '4/4',
    currentNoteIndex = -1,
    notation = 'all',
    onNotationChange,
    showSelector = false
}) {
    const [noteXCoordinates, setNoteXCoordinates] = useState([]);
    const [currentNotation, setCurrentNotation] = useState(notation);
    const scrollContainerRef = useRef(null);

    // 同步外部 notation
    useEffect(() => {
        if (notation !== currentNotation) {
            setCurrentNotation(notation);
        }
    }, [notation]);

    // 捲動至當前音符
    useEffect(() => {
        if (currentNoteIndex >= 0 && noteXCoordinates[currentNoteIndex] && scrollContainerRef.current) {
            const x = noteXCoordinates[currentNoteIndex];
            const container = scrollContainerRef.current;
            const scrollLeft = x - container.clientWidth / 2;
            container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
    }, [currentNoteIndex, noteXCoordinates]);

    const handleNotationChange = (newNotation) => {
        setCurrentNotation(newNotation);
        onNotationChange?.(newNotation);
    };

    const handleNoteCoordinates = useCallback((coords) => {
        setNoteXCoordinates(coords);
    }, []);

    // 決定顯示哪些視圖
    const showJianpu = currentNotation === 'all' || currentNotation === 'jianpu';
    const showStaff = currentNotation === 'all' || currentNotation === 'staff';
    const showTab = currentNotation === 'all' || currentNotation === 'tab';

    // 計算動態高度
    let containerHeight = 100;
    if (showJianpu) containerHeight += 60;
    if (showStaff) containerHeight += 150;
    if (showTab) containerHeight += 150;

    // 計算 stave Y 位置
    const jianpuHeight = showJianpu ? 60 : 0;
    const staffY = showJianpu ? 50 : 20;
    const tabY = showStaff ? (staffY + 110) : (jianpuHeight + 20);

    return (
        <div className="score-display">
            {/* 譜式選擇器 */}
            {showSelector && (
                <div className="score-display-header">
                    <NotationSelector
                        value={currentNotation}
                        onChange={handleNotationChange}
                        size="sm"
                    />
                </div>
            )}

            {/* 譜面容器 */}
            <div
                ref={scrollContainerRef}
                className="score-display-wrapper"
                style={{
                    overflowX: 'auto',
                    backgroundColor: '#1a1a1a',
                    padding: '20px',
                    borderRadius: '8px',
                    position: 'relative',
                    minHeight: `${containerHeight}px`,
                    border: '1px solid #333'
                }}
            >
                {/* 簡譜層 */}
                {showJianpu && (
                    <JianpuView
                        notes={notes}
                        noteXCoordinates={noteXCoordinates}
                        currentNoteIndex={currentNoteIndex}
                        height={60}
                    />
                )}

                {/* 五線譜層 */}
                {showStaff && (
                    <StaffView
                        notes={notes}
                        notePositions={notePositions}
                        timeSignature={timeSignature}
                        currentNoteIndex={currentNoteIndex}
                        onNoteCoordinates={handleNoteCoordinates}
                        staveY={staffY}
                    />
                )}

                {/* 六線譜層 (僅在 all 或 tab 模式時顯示) */}
                {showTab && !showStaff && (
                    <TabView
                        notes={notes}
                        notePositions={notePositions}
                        currentNoteIndex={currentNoteIndex}
                        onNoteCoordinates={!showStaff ? handleNoteCoordinates : undefined}
                        staveY={tabY}
                    />
                )}

                {/* 播放游標 */}
                {currentNoteIndex >= 0 && noteXCoordinates[currentNoteIndex] && (
                    <div
                        className="playhead-cursor"
                        style={{
                            position: 'absolute',
                            top: 20,
                            left: noteXCoordinates[currentNoteIndex],
                            width: '2px',
                            height: `${containerHeight - 40}px`,
                            backgroundColor: '#ff5252',
                            boxShadow: '0 0 8px rgba(255, 82, 82, 0.8)',
                            zIndex: 10,
                            transition: 'left 0.1s linear',
                            pointerEvents: 'none',
                            transform: 'translateX(calc(-50% + 15px))'
                        }}
                    />
                )}
            </div>
        </div>
    );
}

// 匯出子元件供獨立使用
export { JianpuView, StaffView, TabView };

export default ScoreDisplay;
