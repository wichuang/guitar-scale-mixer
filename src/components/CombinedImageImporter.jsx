/**
 * CombinedImageImporter - Combined Staff+Tab image importer
 * Handles multi-system guitar score images with header metadata,
 * chord symbols, and technique mark detection.
 */

import React, { useState, useRef, useCallback } from 'react';
import { recognizeCombinedImage } from '../ocr/CombinedSheetOCR.js';
import NotePreview from './NotePreview.jsx';

function CombinedImageImporter({ onImport, onClose }) {
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ status: '', percent: 0 });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    const handleFileSelect = useCallback((file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        setImageFile(file);
        setError(null);
        setResult(null);

        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('drag-over');
        handleFileSelect(e.dataTransfer.files[0]);
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

    const handleRecognize = useCallback(async () => {
        if (!imageFile) return;

        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const ocrResult = await recognizeCombinedImage(
                imageFile,
                (status, percent) => setProgress({ status, percent })
            );

            setResult(ocrResult);

            if (ocrResult.notes.length === 0) {
                setError('No notes detected. Try a different image or check image quality.');
            }
        } catch (err) {
            console.error('Combined OCR Error:', err);
            setError('Recognition failed: ' + (err.message || 'Unknown error'));
        } finally {
            setIsProcessing(false);
        }
    }, [imageFile]);

    const handleConfirmImport = useCallback(() => {
        if (result && result.notes.length > 0) {
            onImport?.({
                notes: result.notes,
                format: 'combined-ocr',
                metadata: {
                    confidence: result.confidence,
                    source: 'image',
                    systemCount: result.systemCount,
                    ...(result.metadata?.title && { title: result.metadata.title }),
                    ...(result.metadata?.key && { key: result.metadata.key }),
                    ...(result.metadata?.tempo && { tempo: result.metadata.tempo }),
                    ...(result.metadata?.timeSignature && { timeSignature: result.metadata.timeSignature }),
                    ...(result.metadata?.capo && { capo: result.metadata.capo }),
                    ...(result.metadata?.composer && { composer: result.metadata.composer }),
                    ...(result.metadata?.lyricist && { lyricist: result.metadata.lyricist }),
                }
            });
        }
    }, [result, onImport]);

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
            {/* Title */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <h3 style={{ margin: 0 }}>
                    Combined Staff+Tab OCR
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
                        x
                    </button>
                )}
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                style={{ display: 'none' }}
            />

            {/* Upload zone */}
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
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                        <span role="img" aria-label="guitar">&#127928;</span>
                    </div>
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>
                        Drop or click to upload guitar score image
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        Supports JPG, PNG, GIF - Staff+Tab paired scores
                    </div>
                </div>
            )}

            {/* Image preview */}
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
                            alt="Score preview"
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
                                Change image
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Progress */}
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
                            background: 'linear-gradient(90deg, #9c27b0, #e040fb)',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            {/* Error */}
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
                    {error}
                </div>
            )}

            {/* Result */}
            {result && result.notes.length > 0 && (
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
                        <span style={{ color: '#e040fb', fontWeight: 'bold' }}>
                            Recognition Result
                        </span>
                        <span style={{ color: '#888', fontSize: '12px' }}>
                            Confidence: {Math.round(result.confidence)}%
                        </span>
                    </div>

                    {/* Metadata from header */}
                    {result.metadata && (result.metadata.title || result.metadata.key || result.metadata.tempo) && (
                        <div style={{
                            background: '#2a2a2a',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '12px',
                            fontSize: '13px'
                        }}>
                            {result.metadata.title && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Title: </span>
                                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{result.metadata.title}</span>
                                </div>
                            )}
                            {result.metadata.key && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Key: </span>
                                    <span style={{ color: '#4caf50' }}>{result.metadata.key}</span>
                                </div>
                            )}
                            {result.metadata.tempo && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Tempo: </span>
                                    <span style={{ color: '#ff9800' }}>{result.metadata.tempo} BPM</span>
                                </div>
                            )}
                            {result.metadata.timeSignature && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Time: </span>
                                    <span>{result.metadata.timeSignature}</span>
                                </div>
                            )}
                            {result.metadata.capo != null && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Capo: </span>
                                    <span>{result.metadata.capo}</span>
                                </div>
                            )}
                            {result.metadata.composer && (
                                <div style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#888' }}>Composer: </span>
                                    <span>{result.metadata.composer}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px',
                        marginBottom: '12px'
                    }}>
                        <div style={{
                            background: '#333',
                            padding: '10px',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                {result.notes.filter(n => !n.isSeparator).length}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>Notes</div>
                        </div>
                        <div style={{
                            background: '#333',
                            padding: '10px',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                {result.systemCount || 0}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>Systems</div>
                        </div>
                        <div style={{
                            background: '#333',
                            padding: '10px',
                            borderRadius: '6px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                {result.notes.filter(n => n.chordSymbol).length}
                            </div>
                            <div style={{ fontSize: '11px', color: '#888' }}>Chords</div>
                        </div>
                    </div>

                    {/* Note preview */}
                    {result.notes.filter(n => !n.isSeparator).length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                            <NotePreview notes={result.notes} height={100} />
                        </div>
                    )}
                </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
                {imagePreview && !isProcessing && !result && (
                    <button
                        onClick={handleRecognize}
                        style={{
                            flex: 1,
                            padding: '14px',
                            background: '#9c27b0',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Start Recognition
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
                            Reset
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            style={{
                                flex: 1,
                                padding: '14px',
                                background: '#9c27b0',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            Import {result.notes.filter(n => !n.isSeparator).length} Notes
                        </button>
                    </>
                )}
            </div>

            {/* Tips */}
            <div style={{
                marginTop: '20px',
                padding: '12px',
                background: '#222',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#888'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#aaa' }}>
                    Tips
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    <li>Best for images with 5-line staff paired with 6-line TAB below</li>
                    <li>Detects header metadata (title, key, tempo, capo)</li>
                    <li>Processes all systems in the image (multi-row)</li>
                    <li>Recognizes chord symbols above the staff</li>
                </ul>
            </div>
        </div>
    );
}

export default CombinedImageImporter;
