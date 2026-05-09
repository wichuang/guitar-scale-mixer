/**
 * UploadPanel - 統一匯入面板
 * 整合簡譜 OCR、Tab OCR、五線譜 OMR、Staff+Tab OCR、檔案匯入
 */

import React, { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { parseJianpuText, cleanJianpuText } from '../../parsers/JianpuParser.js';
import TabImageImporter from '../TabImageImporter.jsx';
import StaffImageImporter from '../StaffImageImporter.jsx';
import CombinedImageImporter from '../CombinedImageImporter.jsx';
import MusicXMLImporter from '../ImportExport/MusicXMLImporter.jsx';
import ImageQueue from '../ImageQueue.jsx';
import useOpenCV from '../../hooks/useOpenCV.js';

const MAX_IMAGES = 5;

function UploadPanel({
    musicKey,
    scaleType,
    octaveOffset,
    onNotesChange,
    onTextChange,
    onRawTextChange,
    onImportNotes,
    onSourceImagesChange
}) {
    const [importMode, setImportMode] = useState('jianpu');
    const [images, setImages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrStage, setOcrStage] = useState('');
    const [importError, setImportError] = useState(null);

    const { loaded: cvLoaded } = useOpenCV();

    const modes = [
        { key: 'jianpu', label: '簡譜 OCR', color: '#ff9800' },
        { key: 'tab-ocr', label: 'Tab OCR', color: '#4caf50' },
        { key: 'staff-ocr', label: '五線譜 OMR', color: '#2196F3' },
        { key: 'combined-ocr', label: 'Staff+Tab', color: '#9c27b0' },
        { key: 'file', label: '檔案匯入', color: '#4caf50' },
    ];

    /**
     * 處理 OCR importer 結果（非簡譜 tab）
     */
    const handleImport = (result) => {
        setImportError(null);
        if (result && result.notes) {
            if (result.sourceImages && Array.isArray(result.sourceImages)) {
                onSourceImagesChange?.(result.sourceImages);
            } else if (result.sourceImage) {
                onSourceImagesChange?.([result.sourceImage]);
            }
            onImportNotes?.(result);
        }
    };

    const handleImportError = (error) => {
        setImportError(error);
    };

    // ===== Jianpu-specific handlers =====

    const handleOCR = useCallback(async () => {
        if (images.length === 0) return;

        setIsProcessing(true);
        setOcrProgress(0);
        setImportError(null);

        try {
            const allTextSegments = [];
            const allNotes = [];

            for (let i = 0; i < images.length; i++) {
                setOcrStage(`識別中 ${i + 1}/${images.length}`);
                setOcrProgress(0);
                const result = await Tesseract.recognize(images[i].file, 'chi_tra+eng', {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            setOcrProgress(Math.round(m.progress * 100));
                        }
                    },
                });
                const text = result.data.text;
                const cleanedText = cleanJianpuText(text);
                const pageNotes = parseJianpuText(text, musicKey, scaleType, octaveOffset);

                // 圖片之間自動加 | 小節線
                if (i > 0) {
                    allNotes.push({
                        jianpu: '|', displayStr: '|',
                        isSeparator: true, _type: 'separator',
                        octave: 4, index: 0
                    });
                    allTextSegments.push('|');
                }
                allNotes.push(...pageNotes);
                allTextSegments.push(cleanedText);
            }

            const reIndexed = allNotes.map((n, idx) => ({ ...n, index: idx }));
            onTextChange(allTextSegments.join(' '));
            onNotesChange(reIndexed);
            onSourceImagesChange?.(images.map(img => img.dataUrl));
        } catch (error) {
            console.error('OCR 錯誤:', error);
            setImportError('OCR 辨識失敗，請嘗試其他圖片');
        } finally {
            setIsProcessing(false);
            setOcrStage('');
        }
    }, [images, musicKey, scaleType, octaveOffset, onTextChange, onNotesChange, onSourceImagesChange]);

    const handleManualInput = () => {
        onRawTextChange(' ');
        onTextChange('');
        onNotesChange([]);
    };

    const handleReset = useCallback(() => {
        setImages([]);
        setImportError(null);
        setOcrProgress(0);
        setOcrStage('');
    }, []);

    return (
        <div className="upload-section">
            {/* Import mode tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {modes.map(mode => (
                    <button
                        key={mode.key}
                        onClick={() => { setImportMode(mode.key); setImportError(null); }}
                        style={{
                            padding: '6px 12px',
                            background: importMode === mode.key ? mode.color : '#333',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                        }}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* OpenCV Load Status (Warning if not loaded) */}
            {!cvLoaded && importMode !== 'file' && (
                <div style={{
                    marginBottom: '12px',
                    padding: '8px 12px',
                    background: '#ff980033',
                    border: '1px solid #ff9800',
                    borderRadius: '6px',
                    color: '#ffb74d',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>⏳ 正在載入高效能影像處理模組 (OpenCV.js)... (處理速度將暫時以純 JS 模式進行)</span>
                </div>
            )}

            {/* Jianpu OCR (default) - 多圖佇列版 */}
            {importMode === 'jianpu' && (
                <div style={{
                    background: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '24px',
                    maxWidth: '600px',
                    width: '100%',
                    color: '#fff'
                }}>
                    <h3 style={{ margin: '0 0 20px 0' }}>
                        簡譜圖片識別 (OCR) — 最多 {MAX_IMAGES} 張
                    </h3>

                    <ImageQueue
                        images={images}
                        onChange={setImages}
                        maxImages={MAX_IMAGES}
                        accentColor="#ff9800"
                        disabled={isProcessing}
                    />

                    {/* 處理進度 */}
                    {isProcessing && (
                        <div style={{ marginTop: '16px', marginBottom: '8px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                                fontSize: '14px'
                            }}>
                                <span>{ocrStage || '辨識中...'}</span>
                                <span>{ocrProgress}%</span>
                            </div>
                            <div style={{
                                height: '8px',
                                background: '#333',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${ocrProgress}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, #ff9800, #ffb74d)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* 操作按鈕 */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        {images.length > 0 && !isProcessing && (
                            <>
                                <button
                                    onClick={handleOCR}
                                    style={{
                                        flex: 1,
                                        padding: '14px',
                                        background: '#ff9800',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                >
                                    開始識別 ({images.length})
                                </button>
                                <button
                                    onClick={handleReset}
                                    style={{
                                        padding: '14px 18px',
                                        background: '#333',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    清空
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleManualInput}
                            disabled={isProcessing}
                            style={{
                                padding: '14px 24px',
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: isProcessing ? 'default' : 'pointer',
                                fontSize: '14px',
                                opacity: isProcessing ? 0.5 : 1
                            }}
                        >
                            手動輸入
                        </button>
                    </div>

                    {/* 使用說明 */}
                    <div style={{
                        marginTop: '20px',
                        padding: '12px',
                        background: '#222',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#888'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#aaa' }}>
                            使用提示
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                            <li>支援多張圖片（最多 {MAX_IMAGES} 張），按順序辨識並串接結果</li>
                            <li>圖片之間自動加入 | 小節線</li>
                            <li>圖片應清晰、對比度高，白底黑字最佳</li>
                            <li>需要時點縮圖上的 ✂ 進行裁切</li>
                            <li>識別後可在編輯區手動修正</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Tab OCR */}
            {importMode === 'tab-ocr' && (
                <TabImageImporter onImport={handleImport} />
            )}

            {/* Staff OMR */}
            {importMode === 'staff-ocr' && (
                <StaffImageImporter onImport={handleImport} />
            )}

            {/* Combined Staff+Tab OCR */}
            {importMode === 'combined-ocr' && (
                <CombinedImageImporter onImport={handleImport} />
            )}

            {/* File Import */}
            {importMode === 'file' && (
                <MusicXMLImporter
                    onImport={handleImport}
                    onError={handleImportError}
                />
            )}

            {importError && (
                <div style={{ color: '#ff5252', marginTop: '8px', fontSize: '12px' }}>
                    {importError}
                </div>
            )}
        </div>
    );
}

export default UploadPanel;
