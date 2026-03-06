import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function ImageCropper({ imageSrc, onCrop, onCancel }) {
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [savedCrops, setSavedCrops] = useState([]);
    const [imageLoaded, setImageLoaded] = useState(false);

    const [lastCropY, setLastCropY] = useState(null);
    const [autoSetCropY, setAutoSetCropY] = useState(null);
    const [savedShiftY, setSavedShiftY] = useState(() => {
        try {
            const val = localStorage.getItem('cropDefaultShiftY');
            return val ? parseFloat(val) : null;
        } catch {
            return null;
        }
    });

    // Store original image dimensions for accurate rendering of overlays
    const [imgRefRect, setImgRefRect] = useState({ width: 0, height: 0 });
    const imgRef = useRef(null);

    const onImageLoad = useCallback((e) => {
        const { width, height } = e.currentTarget.getBoundingClientRect();
        setImgRefRect({ width, height });
        setImageLoaded(true);

        setAutoSetCropY(null);
        setLastCropY(null);
        setSavedCrops([]);

        // Provide a default crop box
        let defaultW = 80;
        let defaultH = 15;
        try {
            const savedRange = localStorage.getItem('cropDefaultRange');
            if (savedRange) {
                const parsed = JSON.parse(savedRange);
                if (parsed.w) defaultW = parsed.w;
                if (parsed.h) defaultH = parsed.h;
            }
        } catch (err) { }

        const initialCrop = {
            unit: '%',
            width: defaultW,
            height: defaultH,
            x: 10,
            y: 10
        };
        setCrop(initialCrop);
        setCompletedCrop(initialCrop);
    }, []);

    // Update overlay bounds if window resizes
    useEffect(() => {
        const handleResize = () => {
            if (imgRef.current) {
                const { width, height } = imgRef.current.getBoundingClientRect();
                setImgRefRect({ width, height });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleAddCrop = () => {
        if (!completedCrop || !completedCrop.width || !completedCrop.height) return;

        // Save the percentage-based crop directly
        setSavedCrops(prev => [...prev, completedCrop]);

        if (!crop) return;

        try {
            localStorage.setItem('cropDefaultRange', JSON.stringify({ w: crop.width, h: crop.height }));
        } catch (err) { }

        // Determine if the user manually adjusted the y position
        let isManualMove = false;
        if (autoSetCropY !== null) {
            if (Math.abs(crop.y - autoSetCropY) > 0.1) isManualMove = true;
        } else {
            if (lastCropY !== null) isManualMove = true;
        }

        let newShiftY = savedShiftY;

        if (savedCrops.length === 0) {
            if (newShiftY === null) {
                newShiftY = crop.height + 2;
            }
        } else {
            if (isManualMove && lastCropY !== null) {
                const actualShift = crop.y - lastCropY;
                // Only learn reasonable downward shifts to avoid saving wrap-around glitches
                if (actualShift > 0 && actualShift < 50) {
                    newShiftY = actualShift;
                    setSavedShiftY(newShiftY);
                    try {
                        localStorage.setItem('cropDefaultShiftY', newShiftY.toString());
                    } catch (err) { }
                }
            }
        }

        setLastCropY(crop.y);

        let newY = crop.y + (newShiftY || 10);
        if (newY > 90) newY = 10;

        const newCrop = {
            ...crop,
            y: newY
        };

        setCrop(newCrop);
        setCompletedCrop(newCrop);
        setAutoSetCropY(newY);
    };

    const handleClearCrops = () => {
        setSavedCrops([]);
        setLastCropY(null);
        setAutoSetCropY(null);
    };

    const handleConfirm = async () => {
        if (!imgRef.current) return;

        const image = imgRef.current;
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        // If there are no saved crops but the user clicked confirm, 
        // we assume they want the current active crop.
        const cropsToProcess = savedCrops.length > 0 ? savedCrops :
            (completedCrop && completedCrop.width > 0 ? [completedCrop] : []);

        if (cropsToProcess.length === 0) {
            // No crops at all, just return original
            onCrop(imageSrc);
            return;
        }

        // Calculate total canvas size for all crops
        const GAP = 0; // Removing gap, as artificial gaps break staff line distance detection
        let totalWidth = 0;
        let totalHeight = 0;

        cropsToProcess.forEach((c, idx) => {
            const w = (c.width / 100) * image.naturalWidth;
            const h = (c.height / 100) * image.naturalHeight;
            if (w > totalWidth) totalWidth = w;
            totalHeight += h;
            if (idx > 0) totalHeight += GAP; // add gap between regions
        });

        // Add padding around the stitched image
        const PADDING = 20;
        const canvas = document.createElement('canvas');
        canvas.width = totalWidth + (PADDING * 2);
        canvas.height = totalHeight + (PADDING * 2);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            onCrop(imageSrc);
            return;
        }

        // Fill background with white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Enhance drawing quality for thin staff lines
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        let currentY = PADDING;

        cropsToProcess.forEach(c => {
            const cw = (c.width / 100) * image.naturalWidth;
            const ch = (c.height / 100) * image.naturalHeight;
            const sx = (c.x / 100) * image.naturalWidth;
            const sy = (c.y / 100) * image.naturalHeight;

            // Center each crop horizontally
            const currentX = PADDING + (totalWidth - cw) / 2;

            ctx.drawImage(
                image,
                sx,
                sy,
                cw,
                ch,
                currentX,
                currentY,
                cw,
                ch
            );

            currentY += ch + GAP;
        });

        // Convert canvas back to image Data URL
        const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.95);
        onCrop(croppedImageUrl);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#1a1a1a',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px', // Wider to accommodate buttons and image
            width: '100%',
            color: '#fff'
        }}>
            {/* Title */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                width: '100%'
            }}>
                <h3 style={{ margin: 0 }}>
                    ✂️ 多重區域裁切
                </h3>
                {onCancel && (
                    <button
                        onClick={onCancel}
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

            <div style={{ marginBottom: '16px', fontSize: '13px', color: '#ccc', textAlign: 'left', width: '100%', lineHeight: '1.5' }}>
                如果你有多行簡譜，請使用框選工具框出第一行 <strong>只有簡譜數字</strong> 的部分，然後點擊「加入選擇」。<br />
                接著將框移到下一行，再次「加入選擇」。系統會幫你把這些純數字段落接合起來辨識！
            </div>

            {/* Cropper UI wrapper */}
            <div style={{
                background: '#111',
                padding: '10px',
                borderRadius: '8px',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative', // for absolute overlays
                overflow: 'hidden'
            }}>
                {/* Visual Overlays for saved crops */}
                {imageLoaded && imgRef.current && savedCrops.map((c, idx) => (
                    <div key={idx} style={{
                        position: 'absolute',
                        left: `calc(50% - ${imgRefRect.width / 2}px + ${(c.x / 100) * imgRefRect.width}px)`,
                        top: `${(c.y / 100) * imgRefRect.height + 10}px`, /* 10px is outer padding from parent */
                        width: `${(c.width / 100) * imgRefRect.width}px`,
                        height: `${(c.height / 100) * imgRefRect.height}px`,
                        backgroundColor: 'rgba(76, 175, 80, 0.4)', // green tint
                        border: '2px dashed #4caf50',
                        boxSizing: 'border-box',
                        pointerEvents: 'none', // pass clicks through to ReactCrop
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start'
                    }}>
                        <span style={{
                            background: '#4caf50',
                            color: '#fff',
                            fontSize: '10px',
                            padding: '2px 4px',
                            borderBottomRightRadius: '4px'
                        }}>
                            區域 {idx + 1}
                        </span>
                    </div>
                ))}

                <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(pixelCrop, percentCrop) => setCompletedCrop(percentCrop || pixelCrop)}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        onLoad={onImageLoad}
                        style={{ maxWidth: '100%', maxHeight: '500px', display: 'block' }}
                        alt="Crop me"
                        crossOrigin="anonymous"
                    />
                </ReactCrop>
            </div>

            {/* Selection Controls */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
                <span style={{ marginRight: 'auto', fontSize: '13px', color: '#888' }}>
                    已選擇 {savedCrops.length} 個區域
                </span>

                {savedCrops.length > 0 && (
                    <button
                        onClick={handleClearCrops}
                        style={{
                            padding: '8px 12px',
                            background: 'transparent',
                            color: '#ff5252',
                            border: '1px solid #ff5252',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        清除所有選擇
                    </button>
                )}

                <button
                    onClick={handleAddCrop}
                    style={{
                        padding: '8px 16px',
                        background: '#2196f3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>➕ 加入選擇</span>
                </button>
            </div>

            {/* Main Actions */}
            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '20px' }}>
                <button
                    onClick={() => onCrop(imageSrc)}
                    style={{
                        padding: '12px 20px',
                        background: '#333',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    不裁切 (使用完整圖片)
                </button>
                <button
                    onClick={handleConfirm}
                    style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    {savedCrops.length > 1 ? '確認並結合所有區域' : '確認裁切範圍'}
                </button>
            </div>
        </div>
    );
}

export default ImageCropper;
