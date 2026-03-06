/**
 * UploadPanel - 統一匯入面板
 * 整合簡譜 OCR、Tab OCR、五線譜 OMR、Staff+Tab OCR、檔案匯入
 */

import React, { useRef, useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { parseJianpuText, cleanJianpuText } from '../../parsers/JianpuParser.js';
import TabImageImporter from '../TabImageImporter.jsx';
import StaffImageImporter from '../StaffImageImporter.jsx';
import CombinedImageImporter from '../CombinedImageImporter.jsx';
import MusicXMLImporter from '../ImportExport/MusicXMLImporter.jsx';
import ImageCropper from '../ImageCropper.jsx';
import useOpenCV from '../../hooks/useOpenCV.js';

function UploadPanel({
    musicKey,
    scaleType,
    octaveOffset,
    onImageChange,
    onNotesChange,
    onTextChange,
    onRawTextChange,
    onImportNotes
}) {
    const [importMode, setImportMode] = useState('jianpu');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [originalImagePreview, setOriginalImagePreview] = useState(null);
    const [cropMode, setCropMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [importError, setImportError] = useState(null);
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

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
            onImportNotes?.(result);
        }
    };

    const handleImportError = (error) => {
        setImportError(error);
    };

    // ===== Jianpu-specific handlers =====

    const handleFileSelect = useCallback((file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setImportError('請選擇圖片檔案');
            return;
        }

        setImage(file);
        setImportError(null);

        // 建立預覽... 
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            setOriginalImagePreview(dataUrl);
            setCropMode(true);
            setImagePreview(null);
        };
        reader.readAsDataURL(file);

        onNotesChange([]);
        onRawTextChange('');
        onTextChange('');
    }, [onNotesChange, onRawTextChange, onTextChange]);

    const handleCrop = useCallback(async (croppedDataUrl) => {
        setImagePreview(croppedDataUrl);
        setCropMode(false);

        try {
            const res = await fetch(croppedDataUrl);
            const blob = await res.blob();
            const croppedFile = new File([blob], image?.name || 'cropped.jpg', { type: blob.type });
            setImage(croppedFile);
            onImageChange?.(croppedFile);
        } catch (e) {
            console.error("Failed to convert cropped image to file:", e);
        }
    }, [image, onImageChange]);

    const handleCancelCrop = useCallback(() => {
        setCropMode(false);
        setImage(null);
        setOriginalImagePreview(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('drag-over');
        handleFileSelect(e.dataTransfer.files?.[0]);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.add('drag-over');
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('drag-over');
    }, []);

    const handleOCR = useCallback(async () => {
        if (!image) return;

        setIsProcessing(true);
        setOcrProgress(0);
        setImportError(null);

        try {
            const result = await Tesseract.recognize(image, 'chi_tra+eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                    }
                },
            });

            const text = result.data.text;

            const cleanedText = cleanJianpuText(text);
            onTextChange(cleanedText);

            const parsedNotes = parseJianpuText(text, musicKey, scaleType, octaveOffset);
            onNotesChange(parsedNotes);
        } catch (error) {
            console.error('OCR 錯誤:', error);
            setImportError('OCR 辨識失敗，請嘗試其他圖片');
        } finally {
            setIsProcessing(false);
        }
    }, [image, musicKey, scaleType, octaveOffset, onRawTextChange, onTextChange, onNotesChange]);

    const handleManualInput = () => {
        onRawTextChange(' ');
        onTextChange('');
        onNotesChange([]);
    };

    const handleReset = useCallback(() => {
        setImage(null);
        setImagePreview(null);
        setOriginalImagePreview(null);
        setCropMode(false);
        setImportError(null);
        setOcrProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
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

            {/* Jianpu OCR (default) - styled like TabImageImporter */}
            {importMode === 'jianpu' && (
                cropMode && originalImagePreview ? (
                    <ImageCropper
                        imageSrc={originalImagePreview}
                        onCrop={handleCrop}
                        onCancel={handleCancelCrop}
                    />
                ) : (
                    <div style={{
                        background: '#1a1a1a',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '600px',
                        width: '100%',
                        color: '#fff'
                    }}>
                        <h3 style={{ margin: '0 0 20px 0' }}>
                            簡譜圖片識別 (OCR)
                        </h3>

                        {/* 上傳區域 */}
                        {!imagePreview && (
                            <div
                                ref={dropZoneRef}
                                onClick={() => fileInputRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                style={{
                                    border: '2px dashed #444',
                                    borderRadius: '8px',
                                    padding: '40px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
                                <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                                    點擊或拖放簡譜圖片
                                </div>
                                <div style={{ fontSize: '12px', color: '#888' }}>
                                    支援 JPG, PNG, GIF 格式
                                </div>
                            </div>
                        )}

                        {/* 圖片預覽 */}
                        {imagePreview && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    position: 'relative',
                                    background: '#111',
                                    borderRadius: '8px',
                                    overflow: 'hidden'
                                }}>
                                    <img
                                        src={imagePreview}
                                        alt="簡譜預覽"
                                        style={{
                                            width: '100%',
                                            maxHeight: '300px',
                                            objectFit: 'contain'
                                        }}
                                    />
                                    {!isProcessing && (
                                        <button
                                            onClick={handleReset}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                padding: '4px 8px',
                                                background: 'rgba(0,0,0,0.7)',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            更換圖片
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 處理進度 */}
                        {isProcessing && (
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '8px',
                                    fontSize: '14px'
                                }}>
                                    <span>辨識中...</span>
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
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {imagePreview && !isProcessing && (
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
                                    開始識別
                                </button>
                            )}
                            <button
                                onClick={handleManualInput}
                                style={{
                                    padding: '14px 24px',
                                    background: '#333',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                手動輸入
                            </button>
                        </div>

                        {/* 隱藏檔案輸入 */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e.target.files?.[0])}
                            style={{ display: 'none' }}
                        />

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
                                <li>圖片應清晰、對比度高</li>
                                <li>支援數字簡譜 (1234567) 格式</li>
                                <li>識別結果會自動填入編輯區</li>
                                <li>可在編輯區手動修正後更新</li>
                            </ul>
                        </div>
                    </div>
                )
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
