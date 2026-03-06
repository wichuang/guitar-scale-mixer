/**
 * StaffImageImporter - 五線譜圖片匯入元件
 * 支援上傳五線譜圖片並進行 OMR 識別
 */

import React, { useState, useRef, useCallback } from 'react';
import { recognizeStaffImage } from '../ocr/StaffOCR.js';
import NotePreview from './NotePreview.jsx';
import ImageCropper from './ImageCropper.jsx';

function StaffImageImporter({ onImport, onClose }) {
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ status: '', percent: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [clef, setClef] = useState('treble');
    const [cropMode, setCropMode] = useState(false);
    const [originalImagePreview, setOriginalImagePreview] = useState(null);

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    /**
     * 處理檔案選擇
     */
    const handleFileSelect = useCallback((file) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('請選擇圖片檔案');
            return;
        }

        setImageFile(file);
        setError(null);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            setOriginalImagePreview(e.target.result);
            setCropMode(true);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleCrop = async (croppedImageUrl) => {
        setCropMode(false);
        setImagePreview(croppedImageUrl);

        const response = await fetch(croppedImageUrl);
        const blob = await response.blob();
        const newFile = new File([blob], "cropped_staff.jpg", { type: "image/jpeg" });
        setImageFile(newFile);
    };

    const handleCancelCrop = () => {
        setCropMode(false);
        setOriginalImagePreview(null);
        setImageFile(null);
    };

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
     * 執行 OMR 識別
     */
    const handleRecognize = useCallback(async () => {
        if (!imageFile) return;

        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const omrResult = await recognizeStaffImage(
                imageFile,
                (status, percent) => {
                    setProgress({ status, percent });
                },
                { clef }
            );

            setResult(omrResult);

            if (omrResult.notes.length === 0) {
                setError(omrResult.error || '無法識別任何音符，請嘗試其他圖片或調整圖片品質');
            }
        } catch (err) {
            console.error('OMR Error:', err);
            setError('識別失敗：' + (err.message || '未知錯誤'));
        } finally {
            setIsProcessing(false);
        }
    }, [imageFile, clef]);

    /**
     * 確認匯入
     */
    const handleConfirmImport = useCallback(() => {
        if (result && result.notes.length > 0) {
            onImport?.({
                notes: result.notes,
                format: 'staff-ocr',
                metadata: {
                    confidence: result.confidence,
                    source: 'image',
                    clef
                }
            });
        }
    }, [result, onImport, clef]);

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
    }, []);

    if (cropMode && originalImagePreview) {
        return (
            <ImageCropper
                imageSrc={originalImagePreview}
                onCrop={handleCrop}
                onCancel={handleCancelCrop}
            />
        );
    }

    return (
        <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '100%',
            color: '#fff'
        }}>
            {/* 標題 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <h3 style={{ margin: 0 }}>
                    🎼 五線譜圖片識別 (OMR)
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

            {/* 譜號選擇 */}
            <div style={{
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <span style={{ color: '#888', fontSize: '14px' }}>譜號：</span>
                <button
                    onClick={() => setClef('treble')}
                    style={{
                        padding: '6px 12px',
                        background: clef === 'treble' ? '#4caf50' : '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    🎼 高音譜號
                </button>
                <button
                    onClick={() => setClef('bass')}
                    style={{
                        padding: '6px 12px',
                        background: clef === 'bass' ? '#4caf50' : '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    🎻 低音譜號
                </button>
            </div>

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
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎼</div>
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                        點擊或拖放五線譜圖片
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
                            alt="Staff preview"
                            style={{
                                width: '100%',
                                maxHeight: '300px',
                                objectFit: 'contain'
                            }}
                        />
                        {!isProcessing && !result && (
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
                        <span>{progress.status}</span>
                        <span>{Math.round(progress.percent)}%</span>
                    </div>
                    <div style={{
                        height: '8px',
                        background: '#333',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress.percent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #2196F3, #64B5F6)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            {/* 錯誤訊息 */}
            {error && (
                <div style={{
                    padding: '12px',
                    background: 'rgba(255,82,82,0.2)',
                    border: '1px solid #ff5252',
                    borderRadius: '8px',
                    color: '#ff5252',
                    marginBottom: '20px',
                    fontSize: '14px'
                }}>
                    {error}
                </div>
            )}

            {/* 識別結果 */}
            {result && (
                <div style={{
                    background: '#222',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                    }}>
                        <span style={{ color: '#2196F3', fontWeight: 'bold' }}>
                            識別結果
                        </span>
                        <span style={{ color: '#888', fontSize: '12px' }}>
                            信心度: {Math.round(result.confidence)}%
                        </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '12px',
                        marginBottom: '12px'
                    }}>
                        <div style={{
                            background: '#333',
                            padding: '12px',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {result.notes.filter(n => n.isNote).length}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>音符數</div>
                        </div>
                        <div style={{
                            background: '#333',
                            padding: '12px',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {result.rawData.staffGroups?.length || 0}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>五線譜組</div>
                        </div>
                        <div style={{
                            background: '#333',
                            padding: '12px',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {result.notes.filter(n => n.isSeparator).length}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>小節</div>
                        </div>
                    </div>

                    {/* 音符預覽 */}
                    {result.notes.filter(n => n.isNote).length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            <NotePreview notes={result.notes} height={100} />
                        </div>
                    )}
                </div>
            )}

            {/* 操作按鈕 */}
            <div style={{ display: 'flex', gap: '12px' }}>
                {imagePreview && !isProcessing && !result && (
                    <button
                        onClick={handleRecognize}
                        style={{
                            flex: 1,
                            padding: '14px',
                            background: '#2196F3',
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

                {result && result.notes.length > 0 && (
                    <>
                        <button
                            onClick={handleReset}
                            style={{
                                padding: '14px 24px',
                                background: '#333',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            重新選擇
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            style={{
                                flex: 1,
                                padding: '14px',
                                background: '#4caf50',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            匯入 {result.notes.filter(n => n.isNote).length} 個音符
                        </button>
                    </>
                )}
            </div>

            {/* 隱藏的檔案輸入 */}
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
                    💡 使用提示
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    <li>適合簡單的單聲部旋律</li>
                    <li>圖片應清晰、對比度高</li>
                    <li>最好是白底黑字的印刷譜</li>
                    <li>五條線應完整且清晰可見</li>
                    <li>複雜的譜（和弦、多聲部）可能辨識不準確</li>
                    <li>識別結果可能需要手動校正</li>
                </ul>
            </div>
        </div>
    );
}

export default StaffImageImporter;
