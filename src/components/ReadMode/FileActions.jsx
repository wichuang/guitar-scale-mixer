/**
 * FileActions - 檔案操作元件
 * 儲存、載入、複製功能
 */

import React, { useRef, useState } from 'react';
import ImportExportPanel from '../ImportExport/index.jsx';

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
    onLoadFile,
    onImportNotes
}) {
    const loadInputRef = useRef(null);
    const [showImportExport, setShowImportExport] = useState(false);

    /**
     * 處理匯入結果
     */
    const handleImport = (result) => {
        if (result && result.notes) {
            onImportNotes?.(result);
            setShowImportExport(false);
        }
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
                viewMode: viewMode
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
        const fileName = `GuitarScore_${timeStr}.json`;

        a.href = url;
        a.download = fileName;
        a.setAttribute('download', fileName);
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
        }).catch(err => {
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

    return (
        <div className="score-actions">
            <button
                className="score-btn save"
                onClick={handleSaveFile}
                title="儲存為 .json 檔案"
            >
                Save
            </button>
            <button
                className="score-btn load"
                onClick={() => loadInputRef.current?.click()}
                title="開啟 .json 檔案"
            >
                Open
            </button>
            <button
                className="score-btn copy"
                style={{
                    background: '#FF9800',
                    color: 'white'
                }}
                onClick={handleCopyCurrentScore}
                title="複製到剪貼簿"
            >
                Copy
            </button>
            <button
                className="score-btn import-export"
                style={{
                    background: '#9c27b0',
                    color: 'white'
                }}
                onClick={() => setShowImportExport(true)}
                title="匯入 MusicXML/ABC/Tab 或匯出 MIDI/ABC"
            >
                Import/Export
            </button>
            <input
                ref={loadInputRef}
                type="file"
                accept=".json"
                onChange={handleLoadFileChange}
                hidden
            />

            {/* Import/Export 面板 */}
            {showImportExport && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999
                }}
                    onClick={() => setShowImportExport(false)}
                >
                    <div onClick={e => e.stopPropagation()}>
                        <ImportExportPanel
                            notes={notes}
                            tempo={tempo}
                            timeSignature={timeSignature || '4/4'}
                            musicKey={musicKey}
                            onImport={handleImport}
                            fileName="guitar_score"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export default FileActions;
