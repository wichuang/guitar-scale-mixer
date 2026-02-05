/**
 * UploadPanel - 上傳區元件
 * 處理圖片上傳、拖放、OCR 辨識
 */

import React, { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { parseJianpuText, cleanJianpuText } from '../../parsers/JianpuParser.js';

function UploadPanel({
    musicKey,
    scaleType,
    octaveOffset,
    onImageChange,
    onNotesChange,
    onTextChange,
    onRawTextChange
}) {
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const fileInputRef = useRef(null);

    /**
     * 處理檔案上傳
     */
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    /**
     * 處理拖放
     */
    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    /**
     * 處理檔案
     */
    const processFile = (file) => {
        if (!file.type.startsWith('image/')) {
            alert('請上傳圖片檔案 (JPG, PNG)');
            return;
        }

        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);

        // 重置狀態
        onNotesChange([]);
        onRawTextChange('');
        onTextChange('');
        onImageChange?.(file);
    };

    /**
     * OCR 辨識
     */
    const handleOCR = async () => {
        if (!image) return;

        setIsProcessing(true);
        setOcrProgress(0);

        try {
            const result = await Tesseract.recognize(image, 'chi_tra+eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setOcrProgress(Math.round(m.progress * 100));
                    }
                },
            });

            const text = result.data.text;
            onRawTextChange(text);

            // 自動清理非簡譜字符
            const cleanedText = cleanJianpuText(text);
            onTextChange(cleanedText);

            // 解析簡譜
            const parsedNotes = parseJianpuText(text, musicKey, scaleType, octaveOffset);
            onNotesChange(parsedNotes);
        } catch (error) {
            console.error('OCR 錯誤:', error);
            alert('OCR 辨識失敗，請嘗試其他圖片');
        } finally {
            setIsProcessing(false);
            setOcrProgress(100);
        }
    };

    /**
     * 手動輸入模式
     */
    const handleManualInput = () => {
        onRawTextChange(' '); // Enable text area
        onTextChange('');
        onNotesChange([]);
    };

    return (
        <div className="upload-section">
            <div
                className="upload-area"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                {imagePreview ? (
                    <img src={imagePreview} alt="樂譜預覽" className="preview-image" />
                ) : (
                    <div className="upload-placeholder">
                        <span className="upload-icon">Image</span>
                        <span>點擊或拖放簡譜圖片</span>
                        <span className="upload-hint">支援 JPG, PNG</span>
                    </div>
                )}
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
            />

            <div className="upload-actions">
                {imagePreview && (
                    <button
                        className="ocr-btn"
                        onClick={handleOCR}
                        disabled={isProcessing}
                    >
                        {isProcessing ? `辨識中...${ocrProgress}%` : 'OCR'}
                    </button>
                )}
                <button
                    className="manual-btn"
                    onClick={handleManualInput}
                >
                    Manual
                </button>
            </div>
        </div>
    );
}

export default UploadPanel;
