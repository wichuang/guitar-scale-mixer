import React, { useCallback, useRef, useState } from 'react';
import ImageCropper from './ImageCropper.jsx';

let _idSeed = 0;
const nextId = () => `img_${Date.now()}_${++_idSeed}`;

async function dataUrlToFile(dataUrl, name = 'image.jpg') {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 多圖佇列：上傳、拖放、裁切、移除（最多 maxImages 張）
 * Props:
 *   images: Array<{ id, file, dataUrl }>
 *   onChange: (next) => void
 *   maxImages: number (default 5)
 *   accentColor: string
 *   disabled: boolean
 */
function ImageQueue({ images, onChange, maxImages = 5, accentColor = '#4caf50', disabled = false }) {
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);
    const [cropIndex, setCropIndex] = useState(-1);

    const remaining = maxImages - images.length;

    const handleAddFiles = useCallback(async (fileList) => {
        if (!fileList || fileList.length === 0 || disabled) return;
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;
        const slice = files.slice(0, remaining);
        const additions = await Promise.all(
            slice.map(async (file) => ({
                id: nextId(),
                file,
                dataUrl: await readAsDataUrl(file)
            }))
        );
        onChange([...images, ...additions]);
    }, [images, onChange, remaining, disabled]);

    const handleRemove = (index) => {
        if (disabled) return;
        onChange(images.filter((_, i) => i !== index));
    };

    const handleCropConfirm = async (croppedDataUrl) => {
        const idx = cropIndex;
        setCropIndex(-1);
        if (idx < 0 || idx >= images.length) return;
        const file = await dataUrlToFile(croppedDataUrl, images[idx].file?.name || 'cropped.jpg');
        const next = [...images];
        next[idx] = { ...next[idx], file, dataUrl: croppedDataUrl };
        onChange(next);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('drag-over');
        handleAddFiles(e.dataTransfer.files);
    };
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.add('drag-over');
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZoneRef.current?.classList.remove('drag-over');
    };

    if (cropIndex >= 0 && cropIndex < images.length) {
        return (
            <ImageCropper
                imageSrc={images[cropIndex].dataUrl}
                onCrop={handleCropConfirm}
                onCancel={() => setCropIndex(-1)}
            />
        );
    }

    return (
        <div>
            {/* 縮圖列 */}
            {images.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginBottom: '12px'
                }}>
                    {images.map((img, i) => (
                        <div
                            key={img.id}
                            style={{
                                position: 'relative',
                                width: '110px',
                                height: '110px',
                                background: '#111',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                border: `1px solid ${accentColor}55`
                            }}
                        >
                            <img
                                src={img.dataUrl}
                                alt={`Page ${i + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {/* 頁碼標記 */}
                            <div style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px',
                                padding: '2px 6px',
                                background: 'rgba(0,0,0,0.65)',
                                color: '#fff',
                                fontSize: '11px',
                                borderRadius: '3px'
                            }}>
                                {i + 1}/{images.length}
                            </div>
                            {!disabled && (
                                <>
                                    <button
                                        onClick={() => setCropIndex(i)}
                                        title="裁切"
                                        style={{
                                            position: 'absolute',
                                            bottom: '4px',
                                            left: '4px',
                                            padding: '2px 6px',
                                            background: 'rgba(0,0,0,0.7)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >✂</button>
                                    <button
                                        onClick={() => handleRemove(i)}
                                        title="移除"
                                        style={{
                                            position: 'absolute',
                                            top: '4px',
                                            right: '4px',
                                            width: '22px',
                                            height: '22px',
                                            background: 'rgba(0,0,0,0.7)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            lineHeight: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >×</button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 上傳區 */}
            {!disabled && remaining > 0 && (
                <div
                    ref={dropZoneRef}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    style={{
                        border: '2px dashed #444',
                        borderRadius: '8px',
                        padding: images.length > 0 ? '20px' : '40px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ fontSize: images.length > 0 ? '28px' : '48px', marginBottom: '8px' }}>📷</div>
                    <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                        {images.length === 0 ? '點擊或拖放圖片' : `加入更多圖片（剩 ${remaining} 張）`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                        最多 {maxImages} 張 · JPG / PNG / GIF
                    </div>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                    handleAddFiles(e.target.files);
                    e.target.value = '';
                }}
                style={{ display: 'none' }}
            />
        </div>
    );
}

export default ImageQueue;
