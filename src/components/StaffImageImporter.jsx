/**
 * StaffImageImporter - 五線譜圖片匯入元件
 * 支援上傳五線譜圖片並進行 OMR 識別
 */

import React, { useState, useCallback } from 'react';
import { recognizeStaffImage } from '../ocr/StaffOCR.js';
import NotePreview from './NotePreview.jsx';
import ImageQueue from './ImageQueue.jsx';

const MAX_IMAGES = 5;

function StaffImageImporter({ onImport, onClose }) {
    const [images, setImages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ status: '', percent: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [clef, setClef] = useState('treble');

    const handleRecognize = useCallback(async () => {
        if (images.length === 0) return;

        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const aggregatedNotes = [];
            let totalConfidence = 0;
            let firstError = null;

            for (let i = 0; i < images.length; i++) {
                const omrResult = await recognizeStaffImage(
                    images[i].file,
                    (status, percent) => {
                        setProgress({ status: `${status} (${i + 1}/${images.length})`, percent });
                    },
                    { clef }
                );
                if (i > 0) {
                    aggregatedNotes.push({
                        jianpu: '|', displayStr: '|',
                        isSeparator: true, _type: 'separator',
                        octave: 4, index: 0
                    });
                }
                aggregatedNotes.push(...(omrResult.notes || []));
                totalConfidence += (omrResult.confidence || 0);
                if (!firstError && omrResult.error) firstError = omrResult.error;
            }

            const reIndexed = aggregatedNotes.map((n, idx) => ({ ...n, index: idx }));
            const merged = {
                notes: reIndexed,
                confidence: totalConfidence / images.length,
                error: firstError
            };
            setResult(merged);

            if (merged.notes.filter(n => n.isNote).length === 0) {
                setError(firstError || '無法識別任何音符，請嘗試其他圖片或調整圖片品質');
            }
        } catch (err) {
            console.error('OMR Error:', err);
            setError('識別失敗：' + (err.message || '未知錯誤'));
        } finally {
            setIsProcessing(false);
        }
    }, [images, clef]);

    const handleConfirmImport = useCallback(() => {
        if (result && result.notes.length > 0) {
            onImport?.({
                notes: result.notes,
                format: 'staff-ocr',
                sourceImages: images.map(img => img.dataUrl),
                metadata: {
                    confidence: result.confidence,
                    source: 'image',
                    clef
                }
            });
        }
    }, [result, images, onImport, clef]);

    const handleReset = useCallback(() => {
        setImages([]);
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

            {/* 多圖佇列 */}
            <div style={{ marginBottom: '16px' }}>
                <ImageQueue
                    images={images}
                    onChange={setImages}
                    maxImages={MAX_IMAGES}
                    accentColor="#2196F3"
                    disabled={isProcessing || !!result}
                />
            </div>

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
                                {result.rawData?.staffGroups?.length || 0}
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
                {images.length > 0 && !isProcessing && !result && (
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
                        開始識別 ({images.length})
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
