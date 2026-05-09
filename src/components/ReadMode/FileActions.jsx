/**
 * FileActions - 檔案操作元件
 * 儲存、載入、複製、匯出功能
 */

import React, { useRef, useState } from 'react';
import { createMIDI } from '../ImportExport/MIDIExporter.jsx';
import { StaffParser } from '../../parsers/StaffParser.js';

function FileActions({
    editableText,
    notes,
    musicKey,
    scaleType,
    tempo,
    startString,
    octaveOffset,
    youtubeUrl,
    showYoutube,
    youtubeLayout,
    viewMode,
    timeSignature,
    instrument,
    sourceImages,
    onLoadFile,
    fileName = 'guitar_score'
}) {
    const loadInputRef = useRef(null);
    const imgs = Array.isArray(sourceImages) ? sourceImages : [];

    /**
     * 在新視窗開啟原圖（所有頁堆疊顯示）
     */
    const openSourceImagesInNewWindow = () => {
        if (imgs.length === 0) return;
        const win = window.open('', '_blank', 'width=900,height=900,scrollbars=yes');
        if (!win) {
            alert('彈出視窗被阻擋，請允許此網站開啟新視窗');
            return;
        }
        const pages = imgs.map((src, i) => `
            <figure>
                <figcaption>第 ${i + 1} 張 / ${imgs.length}</figcaption>
                <img src="${src}" alt="Page ${i + 1}">
            </figure>
        `).join('');
        const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>OCR 來源圖片 (${imgs.length})</title>
<style>
  body { background:#1a1a1a; color:#fff; font-family:-apple-system,BlinkMacSystemFont,sans-serif; padding:20px; margin:0; }
  h1 { font-size:16px; color:#aaa; margin:0 0 16px; }
  figure { margin:0 0 24px; }
  figcaption { font-size:12px; color:#888; margin-bottom:6px; }
  img { max-width:100%; height:auto; background:#fff; border-radius:6px; display:block; }
</style>
</head>
<body>
  <h1>OCR 來源圖片 — 共 ${imgs.length} 張</h1>
  ${pages}
</body>
</html>`;
        win.document.open();
        win.document.write(html);
        win.document.close();
    };

    /**
     * 儲存檔案
     */
    const handleSaveFile = async () => {
        if (!editableText?.trim()) {
            alert('沒有可儲存的簡譜內容');
            return;
        }

        const scoreData = {
            name: 'GuitarScore',
            data: {
                text: editableText,
                notes: notes,
                key: musicKey,
                scaleType: scaleType,
                tempo: tempo,
                startString: startString,
                octaveOffset: octaveOffset,
                youtubeUrl: youtubeUrl,
                showYoutube: showYoutube,
                youtubeLayout: youtubeLayout,
                viewMode: viewMode,
                instrument: instrument,
                sourceImages: imgs
            }
        };

        const strData = JSON.stringify(scoreData, null, 2);

        // Try File System Access API
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `guitar_score_${new Date().toISOString().slice(0, 10)}.json`,
                    types: [{
                        description: 'Guitar Mixer Score',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(strData);
                await writable.close();
                alert('檔案儲存成功！');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('File Picker failed, falling back to download', err);
            }
        }

        // Fallback: Download Link
        const blob = new Blob([strData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const now = new Date();
        const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const fName = `GuitarScore_${timeStr}.json`;

        a.href = url;
        a.download = fName;
        a.setAttribute('download', fName);
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };

    /**
     * 處理載入檔案
     */
    const handleLoadFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = JSON.parse(ev.target.result);
                onLoadFile(content);
            } catch (err) {
                console.error('Load failed', err);
                alert('載入失敗：無法解析檔案');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    /**
     * 複製到剪貼簿
     */
    const handleCopyCurrentScore = () => {
        const scoreData = {
            name: 'GuitarScore_Copy',
            data: {
                text: editableText,
                notes: notes,
                key: musicKey,
                scaleType: scaleType,
                tempo: tempo,
                startString: startString,
                octaveOffset: octaveOffset
            }
        };
        const jsonStr = JSON.stringify(scoreData, null, 2);

        navigator.clipboard.writeText(jsonStr).then(() => {
            alert('樂譜資料已複製到剪貼簿！');
        }).catch(() => {
            const textArea = document.createElement("textarea");
            textArea.value = jsonStr;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert('樂譜資料已複製到剪貼簿！');
            } catch (err) {
                alert('複製失敗');
            }
            document.body.removeChild(textArea);
        });
    };

    /**
     * 匯出為 ABC Notation
     */
    const handleExportABC = () => {
        if (!notes || notes.length === 0) {
            alert('沒有可匯出的音符');
            return;
        }

        const parser = new StaffParser();
        const abcText = parser.stringify(notes, {
            title: fileName,
            key: musicKey,
            meter: timeSignature,
            tempo
        });

        const blob = new Blob([abcText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.abc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    /**
     * 匯出為 JSON
     */
    const handleExportJSON = () => {
        if (!notes || notes.length === 0) {
            alert('沒有可匯出的音符');
            return;
        }

        const data = {
            name: fileName,
            data: {
                notes: notes.map(n => ({
                    ...n,
                    midiNote: n.midi || n.midiNote
                })),
                key: musicKey,
                tempo,
                timeSignature
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    /**
     * 匯出為 MIDI
     */
    const [exporting, setExporting] = useState(false);
    const handleExportMIDI = async () => {
        if (!notes || notes.length === 0) {
            alert('沒有可匯出的音符');
            return;
        }
        setExporting(true);
        try {
            const midiData = createMIDI(notes, { tempo, timeSignature: timeSignature || '4/4' });
            const blob = new Blob([midiData], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.mid`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('MIDI export error:', error);
            alert('MIDI 匯出失敗');
        } finally {
            setExporting(false);
        }
    };

    const hasNotes = notes && notes.length > 0;

    const actionBtnStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '10px 16px',
        background: '#2a2a2a',
        color: '#ccc',
        border: '1px solid #444',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '11px',
        minWidth: '60px',
        transition: 'all 0.2s ease',
    };

    const exportBtnStyle = (color) => ({
        padding: '8px 14px',
        background: 'transparent',
        color: color,
        border: `1px solid ${color}`,
        borderRadius: '6px',
        cursor: hasNotes ? 'pointer' : 'default',
        fontSize: '12px',
        fontWeight: '500',
        opacity: hasNotes ? 1 : 0.4,
        transition: 'all 0.2s ease',
    });

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            padding: '12px 0',
            flexWrap: 'wrap'
        }}>
            {/* File actions group */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                    onClick={handleSaveFile}
                    title="儲存為 .json 檔案"
                    style={actionBtnStyle}
                >
                    <span style={{ fontSize: '20px' }}>💾</span>
                    <span>Save</span>
                </button>
                <button
                    onClick={() => loadInputRef.current?.click()}
                    title="開啟 .json 檔案"
                    style={actionBtnStyle}
                >
                    <span style={{ fontSize: '20px' }}>📂</span>
                    <span>Open</span>
                </button>
                <button
                    onClick={handleCopyCurrentScore}
                    title="複製到剪貼簿"
                    style={actionBtnStyle}
                >
                    <span style={{ fontSize: '20px' }}>📋</span>
                    <span>Copy</span>
                </button>
                {imgs.length > 0 && (
                    <button
                        onClick={openSourceImagesInNewWindow}
                        title="於新視窗開啟辨識來源圖片"
                        style={actionBtnStyle}
                    >
                        <span style={{ fontSize: '20px' }}>🖼️</span>
                        <span>原圖 ({imgs.length})</span>
                    </button>
                )}
            </div>

            {/* Divider */}
            <div style={{
                width: '1px',
                height: '40px',
                background: '#444',
            }} />

            {/* Export group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#888', fontSize: '12px', marginRight: '4px' }}>Export</span>
                <button
                    onClick={handleExportMIDI}
                    disabled={!hasNotes || exporting}
                    title="匯出 MIDI 檔案"
                    style={exportBtnStyle('#4caf50')}
                >
                    MIDI
                </button>
                <button
                    onClick={handleExportABC}
                    disabled={!hasNotes}
                    title="匯出 ABC Notation"
                    style={exportBtnStyle('#42a5f5')}
                >
                    ABC
                </button>
                <button
                    onClick={handleExportJSON}
                    disabled={!hasNotes}
                    title="匯出 JSON"
                    style={exportBtnStyle('#ffa726')}
                >
                    JSON
                </button>
            </div>

            <input
                ref={loadInputRef}
                type="file"
                accept=".json"
                onChange={handleLoadFileChange}
                hidden
            />

        </div>
    );
}

export default FileActions;
