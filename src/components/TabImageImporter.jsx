/**
 * TabImageImporter - 六線譜圖片匯入元件
 * 支援上傳/拍攝 Tab 圖片並 OCR 識別
 */

import React, { useState, useRef, useCallback } from 'react';
import { recognizeTabImage } from '../ocr/TabOCR.js';
import NotePreview from './NotePreview.jsx';

function TabImageImporter({ onImport, onClose }) {
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ status: '', percent: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

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
            setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
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
            const ocrResult = await recognizeTabImage(imageFile, (status, percent) => {
                setProgress({ status, percent });
            });

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
    }, [imageFile]);

    /**
     * 確認匯入
     */
    const handleConfirmImport = useCallback(() => {
        if (result && result.notes.length > 0) {
            onImport?.({
                notes: result.notes,
                format: 'tab-ocr',
                metadata: {
                    confidence: result.confidence,
                    source: 'image'
                }
            });
        }
    }, [result, onImport]);

    /**
     * 重新選擇圖片
     */
    const handleReset = useCallback(() => {
        setImageFile(null);
        setImagePreview(null);
        setResult(null);
        setError(null);
        setProgress({ status: '', percent: 0 });
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
            {/* 標題 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <h3 style={{ margin: 0 }}>
                    🎸 Tab 圖片識別 (OCR)
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
                        點擊或拖放 Tab 圖片
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
                            alt="Tab preview"
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
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                            識別結果
                        </span>
                        <span style={{ color: '#888', fontSize: '12px' }}>
                            信心度: {Math.round(result.confidence)}%
                        </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
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
                                {result.notes.filter(n => n.isSeparator).length}
                            </div>
                            <div style={{ fontSize: '12px', color: '#888' }}>小節</div>
                        </div>
                    </div>

                    {/* 音符預覽 */}
                    {result.notes.filter(n => n.isNote).length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <NotePreview notes={result.notes} height={100} />
                        </div>
                    )}

                    {/* 原始 OCR 文字（可折疊） */}
                    <details style={{ marginTop: '12px' }}>
                        <summary style={{
                            cursor: 'pointer',
                            color: '#888',
                            fontSize: '12px'
                        }}>
                            查看 OCR 原始文字
                        </summary>
                        <pre style={{
                            marginTop: '8px',
                            padding: '12px',
                            background: '#111',
                            borderRadius: '4px',
                            fontSize: '11px',
                            overflow: 'auto',
                            maxHeight: '150px',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {result.rawText || '(無)'}
                        </pre>
                    </details>
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
                            background: '#4caf50',
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
                    <li>圖片應清晰、對比度高</li>
                    <li>最好是白底黑字的 Tab 譜</li>
                    <li>確保六條弦線完整可見</li>
                    <li>識別結果可能需要手動校正</li>
                </ul>
            </div>
        </div>
    );
}

export default TabImageImporter;
