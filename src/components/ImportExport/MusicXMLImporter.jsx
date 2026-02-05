/**
 * MusicXMLImporter - MusicXML 匯入元件
 * 支援匯入 MusicXML 和 ABC Notation 檔案
 */

import React, { useRef, useState } from 'react';
import { StaffParser } from '../../parsers/StaffParser.js';
import { TabParser } from '../../parsers/TabParser.js';

function MusicXMLImporter({
    onImport,
    onError,
    acceptFormats = ['.xml', '.musicxml', '.abc', '.txt']
}) {
    const fileInputRef = useRef(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const staffParser = new StaffParser();
    const tabParser = new TabParser();

    /**
     * 處理檔案選擇
     */
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await processFile(file);
        }
        // Reset input
        e.target.value = '';
    };

    /**
     * 處理拖放
     */
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

        try {
            const text = await file.text();
            const fileName = file.name.toLowerCase();
            let notes = [];
            let format = 'unknown';

            // 根據副檔名或內容判斷格式
            if (fileName.endsWith('.xml') || fileName.endsWith('.musicxml') || text.includes('<score-partwise')) {
                // MusicXML
                notes = staffParser.parseMusicXML(text);
                format = 'musicxml';
            } else if (fileName.endsWith('.abc') || text.includes('X:') || text.includes('K:')) {
                // ABC Notation
                notes = staffParser.parseABC(text);
                format = 'abc';
            } else if (tabParser.validate(text)) {
                // Guitar Tab
                notes = tabParser.parse(text);
                format = 'tab';
            } else {
                // 嘗試作為 ABC 解析
                notes = staffParser.parse(text);
                format = 'text';
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
                            支援 MusicXML, ABC Notation, Guitar Tab
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
