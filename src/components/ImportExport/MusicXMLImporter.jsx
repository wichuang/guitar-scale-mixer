/**
 * MusicXMLImporter - MusicXML 匯入元件
 * 支援匯入 MusicXML、ABC Notation、Guitar Pro 檔案
 * Guitar Pro 支援音軌選擇
 */

import React, { useRef, useState, useCallback } from 'react';
import { StaffParser } from '../../parsers/StaffParser.js';
import { TabParser } from '../../parsers/TabParser.js';
import { GuitarProParser } from '../../parsers/GuitarProParser.js';

function MusicXMLImporter({
    onImport,
    onError,
    acceptFormats = ['.xml', '.musicxml', '.abc', '.txt', '.gp', '.gpx', '.gp5', '.gp4', '.gp3']
}) {
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    // GP 音軌選擇狀態
    const [gpTracks, setGpTracks] = useState(null);
    const [gpParser, setGpParser] = useState(null);
    const [gpFileName, setGpFileName] = useState('');
    const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);

    const staffParser = new StaffParser();
    const tabParser = new TabParser();

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
        e.target.value = '';
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            await processFile(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setDragOver(false);
    };

    /**
     * 處理檔案
     */
    const processFile = async (file) => {
        setIsLoading(true);
        setGpTracks(null);

        try {
            const fileName = file.name.toLowerCase();
            let notes = [];
            let format = 'unknown';

            const isGuitarPro = fileName.endsWith('.gp') ||
                fileName.endsWith('.gpx') ||
                fileName.endsWith('.gp5') ||
                fileName.endsWith('.gp4') ||
                fileName.endsWith('.gp3');

            if (isGuitarPro) {
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const parser = new GuitarProParser();
                const { tracks } = parser.parseSong(uint8Array, file.name);

                if (tracks.length > 1) {
                    // 多音軌：顯示選擇 UI
                    setGpParser(parser);
                    setGpTracks(tracks);
                    setGpFileName(file.name);
                    // 預設選擇音符最多的音軌
                    const bestIdx = tracks.reduce((best, t, i) =>
                        t.noteCount > tracks[best].noteCount ? i : best, 0);
                    setSelectedTrackIndex(bestIdx);
                    setIsLoading(false);
                    return;
                }

                // 單音軌：直接匯入
                notes = parser.convertTrack(0);
                format = 'guitarpro';

                staffParser.title = parser.title;
                staffParser.key = parser.key || 'C';
                staffParser.timeSignature = parser.timeSignature || '4/4';
                staffParser.tempo = parser.tempo || 120;
            } else {
                const text = await file.text();
                if (fileName.endsWith('.xml') || fileName.endsWith('.musicxml') || text.includes('<score-partwise')) {
                    notes = staffParser.parseMusicXML(text);
                    format = 'musicxml';
                } else if (fileName.endsWith('.abc') || text.includes('X:') || text.includes('K:')) {
                    notes = staffParser.parseABC(text);
                    format = 'abc';
                } else if (tabParser.validate(text)) {
                    notes = tabParser.parse(text);
                    format = 'tab';
                } else {
                    notes = staffParser.parse(text);
                    format = 'text';
                }
            }

            if (notes.length > 0) {
                onImport?.({
                    notes,
                    format,
                    fileName: file.name,
                    metadata: {
                        title: staffParser.title,
                        key: staffParser.key,
                        timeSignature: staffParser.timeSignature,
                        tempo: staffParser.tempo
                    }
                });
            } else {
                onError?.('無法解析檔案內容');
            }
        } catch (error) {
            console.error('Import error:', error);
            onError?.(error.message || '匯入失敗');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 確認選擇音軌並匯入
     */
    const handleConfirmTrack = useCallback(() => {
        if (!gpParser) return;

        try {
            const notes = gpParser.convertTrack(selectedTrackIndex);

            if (notes.length > 0) {
                onImport?.({
                    notes,
                    format: 'guitarpro',
                    fileName: gpFileName,
                    metadata: {
                        title: gpParser.title,
                        key: gpParser.key || 'C',
                        timeSignature: gpParser.timeSignature || '4/4',
                        tempo: gpParser.tempo || 120
                    }
                });
            } else {
                onError?.('此音軌沒有音符');
            }
        } catch (error) {
            console.error('Track convert error:', error);
            onError?.(error.message || '音軌轉換失敗');
        }

        setGpTracks(null);
        setGpParser(null);
    }, [gpParser, selectedTrackIndex, gpFileName, onImport, onError]);

    /**
     * 取消音軌選擇
     */
    const handleCancelTrackSelect = useCallback(() => {
        setGpTracks(null);
        setGpParser(null);
        setGpFileName('');
    }, []);

    // ===== 音軌選擇 UI =====
    if (gpTracks) {
        return (
            <div className="musicxml-importer">
                <div style={{
                    background: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #444'
                }}>
                    {/* 標題 */}
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '16px' }}>
                            選擇音軌
                        </h3>
                        <div style={{ color: '#888', fontSize: '12px' }}>
                            {gpFileName} — {gpParser?.title} {gpParser?.artist ? `(${gpParser.artist})` : ''}
                            {' '}| Key: {gpParser?.key} | BPM: {gpParser?.tempo} | {gpParser?.timeSignature}
                        </div>
                    </div>

                    {/* 音軌列表 */}
                    <div style={{
                        maxHeight: '320px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginBottom: '16px'
                    }}>
                        {gpTracks.map((track) => (
                            <div
                                key={track.index}
                                onClick={() => setSelectedTrackIndex(track.index)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 14px',
                                    background: selectedTrackIndex === track.index
                                        ? 'rgba(33, 150, 243, 0.2)'
                                        : 'rgba(255, 255, 255, 0.04)',
                                    border: selectedTrackIndex === track.index
                                        ? '2px solid #2196F3'
                                        : '2px solid transparent',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {/* 音軌編號 */}
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: selectedTrackIndex === track.index ? '#2196F3' : '#444',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    flexShrink: 0
                                }}>
                                    {track.index + 1}
                                </div>

                                {/* 音軌資訊 */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        color: '#fff',
                                        fontSize: '14px',
                                        fontWeight: selectedTrackIndex === track.index ? 'bold' : 'normal',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {track.name}
                                    </div>
                                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
                                        {track.noteCount} 音符 | {track.bars} 小節
                                        {track.tuning ? ` | ${track.tuning}` : ''}
                                        {track.capo > 0 ? ` | Capo ${track.capo}` : ''}
                                    </div>
                                </div>

                                {/* 音符數量標籤 */}
                                <div style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: track.noteCount > 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    color: track.noteCount > 0 ? '#81c784' : '#666',
                                    fontSize: '11px',
                                    flexShrink: 0
                                }}>
                                    {track.noteCount > 0 ? `${track.noteCount}` : '空'}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 操作按鈕 */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleConfirmTrack}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            匯入第 {selectedTrackIndex + 1} 軌
                        </button>
                        <button
                            onClick={handleCancelTrackSelect}
                            style={{
                                padding: '10px 20px',
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}
                        >
                            取消
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ===== 預設匯入 UI =====
    return (
        <div className="musicxml-importer">
            <div
                className={`import-dropzone ${dragOver ? 'drag-over' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                style={{
                    padding: '20px',
                    border: `2px dashed ${dragOver ? '#2196F3' : '#555'}`,
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: dragOver ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.2s ease'
                }}
            >
                {isLoading ? (
                    <span>匯入中...</span>
                ) : (
                    <>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>Import</div>
                        <div style={{ color: '#888', fontSize: '12px' }}>
                            支援 MusicXML, ABC Notation, Guitar Tab, Guitar Pro (.gp5, 等)
                        </div>
                        <div style={{ color: '#666', fontSize: '11px', marginTop: '4px' }}>
                            點擊或拖放檔案
                        </div>
                    </>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={acceptFormats.join(',')}
                onChange={handleFileSelect}
                hidden
            />
        </div>
    );
}

export default MusicXMLImporter;
