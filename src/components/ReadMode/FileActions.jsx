/**
 * FileActions - 檔案操作元件
 * 儲存、載入、複製功能
 */

import React, { useRef } from 'react';

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
    onLoadFile
}) {
    const loadInputRef = useRef(null);

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
