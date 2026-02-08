/**
 * ImportExport - 匯入匯出面板
 * 整合 MusicXML 匯入和 MIDI/PDF 匯出功能
 */

import React, { useState } from 'react';
import MusicXMLImporter from './MusicXMLImporter.jsx';
import MIDIExporter from './MIDIExporter.jsx';
import TabImageImporter from '../TabImageImporter.jsx';
import StaffImageImporter from '../StaffImageImporter.jsx';
import JianpuImageImporter from '../JianpuImageImporter.jsx';
import CombinedImageImporter from '../CombinedImageImporter.jsx';
import { StaffParser } from '../../parsers/StaffParser.js';

function ImportExportPanel({
    notes,
    tempo,
    timeSignature,
    musicKey,
    onImport,
    fileName = 'score'
}) {
    const [showPanel, setShowPanel] = useState(false);
    const [importError, setImportError] = useState(null);
    const [importMode, setImportMode] = useState('file'); // 'file' | 'tab-ocr' | 'staff-ocr' | 'jianpu-ocr' | 'combined-ocr'

    const handleImport = (result) => {
        setImportError(null);
        onImport?.(result);
        setShowPanel(false);
    };

    const handleImportError = (error) => {
        setImportError(error);
    };

    /**
     * 匯出為 ABC Notation
     */
    const handleExportABC = () => {
        if (!notes || notes.length === 0) {
            alert('沒有可匯出的音符');
            return;
        }

        const parser = new StaffParser();
        const abcText = parser.stringify(notes, {
            title: fileName,
            key: musicKey,
            meter: timeSignature,
            tempo
        });

        const blob = new Blob([abcText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.abc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    };

    /**
     * 匯出為 JSON
     */
    const handleExportJSON = () => {
        if (!notes || notes.length === 0) {
            alert('沒有可匯出的音符');
            return;
        }

        const data = {
            name: fileName,
            data: {
                notes: notes.map(n => ({
                    ...n,
                    midiNote: n.midi || n.midiNote
                })),
                key: musicKey,
                tempo,
                timeSignature
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    };

    if (!showPanel) {
        return (
            <button
                onClick={() => setShowPanel(true)}
                style={{
                    padding: '8px 16px',
                    background: '#555',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}
            >
                Import / Export
            </button>
        );
    }

    return (
        <div
            className="import-export-panel"
            style={{
                background: 'rgba(0, 0, 0, 0.9)',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '20px',
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                minWidth: '400px',
                maxWidth: '90vw'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: '#fff' }}>Import / Export</h3>
                <button
                    onClick={() => setShowPanel(false)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#888',
                        fontSize: '20px',
                        cursor: 'pointer'
                    }}
                >
                    x
                </button>
            </div>

            {/* 匯入區 */}
            <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#aaa', marginBottom: '12px' }}>Import</h4>

                {/* 匯入模式切換 */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                        onClick={() => setImportMode('file')}
                        style={{
                            padding: '8px 16px',
                            background: importMode === 'file' ? '#4caf50' : '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        📄 檔案匯入
                    </button>
                    <button
                        onClick={() => setImportMode('tab-ocr')}
                        style={{
                            padding: '8px 16px',
                            background: importMode === 'tab-ocr' ? '#4caf50' : '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        🎸 Tab 圖片 OCR
                    </button>
                    <button
                        onClick={() => setImportMode('staff-ocr')}
                        style={{
                            padding: '8px 16px',
                            background: importMode === 'staff-ocr' ? '#2196F3' : '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        🎼 五線譜 OMR
                    </button>
                    <button
                        onClick={() => setImportMode('jianpu-ocr')}
                        style={{
                            padding: '8px 16px',
                            background: importMode === 'jianpu-ocr' ? '#ff9800' : '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        簡譜 OCR
                    </button>
                    <button
                        onClick={() => setImportMode('combined-ocr')}
                        style={{
                            padding: '8px 16px',
                            background: importMode === 'combined-ocr' ? '#9c27b0' : '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        Staff+Tab OCR
                    </button>
                </div>

                {/* 檔案匯入 */}
                {importMode === 'file' && (
                    <MusicXMLImporter
                        onImport={handleImport}
                        onError={handleImportError}
                    />
                )}

                {/* Tab 圖片 OCR */}
                {importMode === 'tab-ocr' && (
                    <TabImageImporter
                        onImport={handleImport}
                    />
                )}

                {/* 五線譜 OMR */}
                {importMode === 'staff-ocr' && (
                    <StaffImageImporter
                        onImport={handleImport}
                    />
                )}

                {/* 簡譜 OCR */}
                {importMode === 'jianpu-ocr' && (
                    <JianpuImageImporter
                        onImport={handleImport}
                    />
                )}

                {/* Combined Staff+Tab OCR */}
                {importMode === 'combined-ocr' && (
                    <CombinedImageImporter
                        onImport={handleImport}
                    />
                )}

                {importError && (
                    <div style={{ color: '#ff5252', marginTop: '8px', fontSize: '12px' }}>
                        {importError}
                    </div>
                )}
            </div>

            {/* 匯出區 */}
            <div>
                <h4 style={{ color: '#aaa', marginBottom: '12px' }}>Export</h4>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <MIDIExporter
                        notes={notes}
                        tempo={tempo}
                        timeSignature={timeSignature}
                        fileName={fileName}
                    />
                    <button
                        onClick={handleExportABC}
                        disabled={!notes || notes.length === 0}
                        style={{
                            padding: '8px 16px',
                            background: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            opacity: notes?.length ? 1 : 0.5
                        }}
                    >
                        Export ABC
                    </button>
                    <button
                        onClick={handleExportJSON}
                        disabled={!notes || notes.length === 0}
                        style={{
                            padding: '8px 16px',
                            background: '#FF9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            opacity: notes?.length ? 1 : 0.5
                        }}
                    >
                        Export JSON
                    </button>
                </div>
            </div>
        </div>
    );
}

export { MusicXMLImporter, MIDIExporter };
export default ImportExportPanel;
