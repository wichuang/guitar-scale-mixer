/**
 * JianpuImageImporter - 簡譜圖片匯入元件
 * 支援上傳/拍攝簡譜圖片並 OCR 識別
 */

import React, { useState, useRef, useCallback } from 'react';
import { recognizeJianpuImage } from '../ocr/JianpuOCR.js';
import NotePreview from './NotePreview.jsx';
import ImageCropper from './ImageCropper.jsx';

// 調號選項
const KEY_OPTIONS = [
    { value: 'C', label: 'C 大調' },
    { value: 'G', label: 'G 大調' },
    { value: 'D', label: 'D 大調' },
    { value: 'A', label: 'A 大調' },
    { value: 'E', label: 'E 大調' },
    { value: 'B', label: 'B 大調' },
    { value: 'F', label: 'F 大調' },
    { value: 'Bb', label: 'B♭ 大調' },
    { value: 'Eb', label: 'E♭ 大調' },
    { value: 'Ab', label: 'A♭ 大調' },
];

function JianpuImageImporter({ onImport, onClose }) {
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [originalImagePreview, setOriginalImagePreview] = useState(null);
    const [cropMode, setCropMode] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ status: '', percent: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [key, setKey] = useState('C');

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    /**
     * 處理檔案選擇
     */
    const handleFileSelect = useCallback((file) => {
        if (!file) return;

        // 驗證檔案類型
        if (!file.type.startsWith('image/')) {
            setError('請選擇圖片檔案');
            return;
        }

        setImageFile(file);
        setError(null);
        setResult(null);

        // 建立預覽
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            setOriginalImagePreview(dataUrl);
            setCropMode(true);
            setImagePreview(null);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleCrop = useCallback(async (croppedDataUrl) => {
        setImagePreview(croppedDataUrl);
        setCropMode(false);

        try {
            const res = await fetch(croppedDataUrl);
            const blob = await res.blob();
            const croppedFile = new File([blob], imageFile?.name || 'cropped.jpg', { type: blob.type });
            setImageFile(croppedFile);
        } catch (e) {
            console.error("Failed to convert cropped image to file:", e);
        }
    }, [imageFile]);

    const handleCancelCrop = useCallback(() => {
        setCropMode(false);
        setImageFile(null);
        setOriginalImagePreview(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    /**
     * 處理拖放
     */
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        handleFileSelect(file);
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

    /**
     * 執行 OCR 識別
     */
    const handleRecognize = useCallback(async () => {
        if (!imageFile) return;

        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const ocrResult = await recognizeJianpuImage(
                imageFile,
                (status, percent) => {
                    setProgress({ status, percent });
                },
                { key }
            );

            setResult(ocrResult);

            if (ocrResult.notes.length === 0) {
                setError('無法識別任何音符，請嘗試其他圖片或調整圖片品質');
            }
        } catch (err) {
            console.error('OCR Error:', err);
            setError('識別失敗：' + (err.message || '未知錯誤'));
        } finally {
            setIsProcessing(false);
        }
    }, [imageFile, key]);

    /**
     * 確認匯入
     */
    const handleConfirmImport = useCallback(() => {
        if (result && result.notes.length > 0) {
            onImport?.({
                notes: result.notes,
                format: 'jianpu-ocr',
                metadata: {
                    confidence: result.confidence,
                    source: 'image',
                    key
                }
            });
        }
    }, [result, onImport, key]);

    /**
     * 重新選擇圖片
     */
    const handleReset = useCallback(() => {
        setImageFile(null);
        setImagePreview(null);
        setOriginalImagePreview(null);
        setCropMode(false);
        setResult(null);
        setError(null);
        setProgress({ status: '', percent: 0 });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    return (
        <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            color: '#fff'
        }}>
            {cropMode && originalImagePreview ? (
                <ImageCropper
                    imageSrc={originalImagePreview}
                    onCrop={handleCrop}
                    onCancel={handleCancelCrop}
                />
            ) : (
                <>
                    {/* 標題 */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ margin: 0 }}>
                            🎵 簡譜圖片識別 (OCR)
                        </h3>
                        {onClose && (
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#888',
                                    fontSize: '20px',
                                    cursor: 'pointer'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* 調號選擇 */}
                    <div style={{
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <span style={{ color: '#888', fontSize: '14px' }}>調號：</span>
                        <select
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            style={{
                                padding: '8px 12px',
                                background: '#333',
                                color: '#fff',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                fontSize: '14px',
                                cursor: 'pointer'
                            }}
                        >
                            {KEY_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 隱藏的檔案輸入 */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e.target.files[0])}
                        style={{ display: 'none' }}
                    />

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
                                    alt="Jianpu preview"
                                    style={{
                                        width: '100%',
                                        maxHeight: '300px',
                                        objectFit: 'contain'
                                    }}
                                />
                                <button
                                    onClick={handleReset}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: 'rgba(0,0,0,0.7)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '28px',
                                        height: '28px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 進度條 */}
                    {isProcessing && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '8px',
                                fontSize: '13px'
                            }}>
                                <span>{progress.status}</span>
                                <span>{Math.round(progress.percent)}%</span>
                            </div>
                            <div style={{
                                height: '6px',
                                background: '#333',
                                borderRadius: '3px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${progress.percent}%`,
                                    background: 'linear-gradient(90deg, #4caf50, #8bc34a)',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* 錯誤訊息 */}
                    {error && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(255, 82, 82, 0.15)',
                            border: '1px solid rgba(255, 82, 82, 0.3)',
                            borderRadius: '6px',
                            marginBottom: '16px',
                            color: '#ff5252',
                            fontSize: '13px'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* 辨識結果 */}
                    {result && result.notes.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px'
                            }}>
                                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    辨識結果
                                </span>
                                <span style={{
                                    fontSize: '12px',
                                    color: result.confidence > 70 ? '#4caf50' :
                                        result.confidence > 50 ? '#ff9800' : '#f44336'
                                }}>
                                    信心度: {Math.round(result.confidence)}%
                                </span>
                            </div>

                            {/* 原始文字 */}
                            {result.cleanedText && (
                                <div style={{
                                    padding: '12px',
                                    background: '#222',
                                    borderRadius: '6px',
                                    marginBottom: '12px',
                                    fontFamily: 'monospace',
                                    fontSize: '14px',
                                    letterSpacing: '2px',
                                    wordBreak: 'break-all'
                                }}>
                                    {result.cleanedText}
                                </div>
                            )}

                            {/* 音符預覽 */}
                            <NotePreview
                                notes={result.notes}
                                displayMode="jianpu"
                                maxDisplay={30}
                            />
                        </div>
                    )}

                    {/* 操作按鈕 */}
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end'
                    }}>
                        {imagePreview && !result && (
                            <button
                                onClick={handleRecognize}
                                disabled={isProcessing}
                                style={{
                                    padding: '10px 24px',
                                    background: isProcessing ? '#555' : '#4caf50',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                }}
                            >
                                {isProcessing ? '辨識中...' : '開始辨識'}
                            </button>
                        )}

                        {result && result.notes.length > 0 && (
                            <>
                                <button
                                    onClick={handleReset}
                                    style={{
                                        padding: '10px 24px',
                                        background: '#333',
                                        color: '#fff',
                                        border: '1px solid #444',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    重新選擇
                                </button>
                                <button
                                    onClick={handleConfirmImport}
                                    style={{
                                        padding: '10px 24px',
                                        background: '#2196f3',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    確認匯入 ({result.notes.filter(n => !n.isSeparator).length} 個音符)
                                </button>
                            </>
                        )}
                    </div>

                    {/* 使用提示 */}
                    <div style={{
                        marginTop: '20px',
                        padding: '12px',
                        background: '#222',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#888'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#aaa' }}>
                            💡 使用提示
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                            <li>確保圖片清晰，數字清楚可見</li>
                            <li>建議使用白底黑字的簡譜圖片</li>
                            <li>系統會嘗試偵測八度點（數字上/下方的點）和時值線（下劃線）</li>
                            <li>辨識結果可能需要手動修正</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}

export default JianpuImageImporter;
