import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * 把音符陣列拆成 measures —— 與 JianpuScoreView 相同邏輯：
 * 連續分隔符（如 `:|` 接 `|:`）不會多算一個小節，必須有實際音符才算一個 measure。
 * 回傳陣列每個 element 為 { number, startIdx, endIdx, notes }，number 1-indexed。
 */
function buildMeasures(notes) {
    const result = [];
    if (!Array.isArray(notes)) return result;
    let current = [];
    let currentStart = -1;
    let measureNum = 1;
    notes.forEach((note, idx) => {
        const isSep = note.isSeparator || note._type === 'separator';
        if (isSep) {
            if (current.length > 0) {
                result.push({
                    number: measureNum++,
                    startIdx: currentStart,
                    endIdx: idx - 1,
                    notes: current,
                });
                current = [];
                currentStart = -1;
            }
            // 連續 separator：當前 measure 維持空，繼續吃下一個
        } else {
            if (currentStart === -1) currentStart = idx;
            current.push(note);
        }
    });
    if (current.length > 0) {
        result.push({
            number: measureNum,
            startIdx: currentStart,
            endIdx: notes.length - 1,
            notes: current,
        });
    }
    return result;
}

/**
 * 把選定 measure 範圍轉成打字機字串：0/1-7、+(↑8ve)、-(↓8ve)、|(小節線)
 */
function extractMeasuresAsTypewriterText(measures, startM, endM) {
    const parts = [];
    for (const m of measures) {
        if (m.number < startM || m.number > endM) continue;
        let part = '';
        for (const n of m.notes) {
            if (n.isRest || n._type === 'rest') {
                part += '0';
            } else if (n.jianpu != null) {
                const jp = String(n.jianpu);
                if (jp >= '1' && jp <= '7') {
                    part += jp;
                    const o = (n.octave || 4) - 4;
                    if (o > 0) part += '+'.repeat(o);
                    if (o < 0) part += '-'.repeat(-o);
                }
            }
            // 延音線/符號目前的打字機規格不支援
        }
        if (part) parts.push(part);
    }
    return parts.join('|');
}

/**
 * TypewriterDialog — 打字機介面，輸入 0-7、+、-、| 串入音符
 *  - 0 = 休止符
 *  - 1~7 = 簡譜音
 *  - + = 上一個數字升 8 度（可疊用：1++ = 1 升 2 個八度）
 *  - - = 上一個數字降 8 度（同樣可疊用）
 *  - | = 小節線 (separator)
 *  - 按「輸入」/Enter 確認，在目前選中音符後插入這串音符
 *
 * 另支援從樂譜「複製多小節」為文字，便於在他處貼上。
 */
function TypewriterDialog({ open, onConfirm, onCancel, notes = [], selectedNoteIndex = -1 }) {
    const [text, setText] = useState('');
    const inputRef = useRef(null);

    // 與 JianpuScoreView 一致的 measures 結構（避免連續 separator 造成編號錯位）
    const measures = useMemo(() => buildMeasures(notes), [notes]);
    const totalMeasures = measures.length || 1;

    // 找目前選中音符所在的 measure number
    const currentMeasure = useMemo(() => {
        if (selectedNoteIndex < 0) return 1;
        for (const m of measures) {
            if (selectedNoteIndex >= m.startIdx && selectedNoteIndex <= m.endIdx) return m.number;
        }
        // 落在 separator 上或最後 — 用最接近的 measure
        for (let i = measures.length - 1; i >= 0; i--) {
            if (measures[i].endIdx < selectedNoteIndex) return measures[i].number;
        }
        return 1;
    }, [measures, selectedNoteIndex]);

    const [copyStart, setCopyStart] = useState(1);
    const [copyEnd, setCopyEnd] = useState(1);
    const [copyMsg, setCopyMsg] = useState('');

    useEffect(() => {
        if (open) {
            setText('');
            setCopyStart(currentMeasure);
            setCopyEnd(currentMeasure);
            setCopyMsg('');
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [open, currentMeasure, totalMeasures]);

    if (!open) return null;

    const clampMeasure = (v) => {
        const n = parseInt(v, 10);
        if (isNaN(n)) return 1;
        return Math.max(1, Math.min(totalMeasures, n));
    };

    const handleExtract = () => {
        const s = Math.min(copyStart, copyEnd);
        const e = Math.max(copyStart, copyEnd);
        const extracted = extractMeasuresAsTypewriterText(measures, s, e);
        if (!extracted) {
            setCopyMsg('該範圍無可轉為文字的音符');
            return;
        }
        // 接在現有文字後面，方便重複複製多段
        setText(t => (t ? t + (t.endsWith('|') ? '' : '|') + extracted : extracted));
        setCopyMsg(`已提取第 ${s}–${e} 小節（${extracted.length} 字符）`);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleClipboardCopy = async () => {
        const s = Math.min(copyStart, copyEnd);
        const e = Math.max(copyStart, copyEnd);
        const extracted = extractMeasuresAsTypewriterText(measures, s, e);
        if (!extracted) {
            setCopyMsg('該範圍無可轉為文字的音符');
            return;
        }
        try {
            await navigator.clipboard.writeText(extracted);
            setCopyMsg(`已複製第 ${s}–${e} 小節到剪貼簿`);
        } catch (err) {
            // 退路：填到 input
            setText(extracted);
            setCopyMsg('剪貼簿失敗，已填入下方輸入框');
        }
    };

    const handleClipboardPaste = async () => {
        try {
            const v = await navigator.clipboard.readText();
            if (!v) return;
            const sanitized = v.replace(/[^0-7|+\-]/g, '');
            if (!sanitized) {
                setCopyMsg('剪貼簿內無有效字符');
                return;
            }
            setText(t => t + sanitized);
            setCopyMsg(`已貼上 ${sanitized.length} 字符`);
            setTimeout(() => inputRef.current?.focus(), 0);
        } catch (err) {
            setCopyMsg('讀取剪貼簿失敗（需 https 或 localhost）');
        }
    };

    const sanitize = (v) => v.replace(/[^0-7|+\-]/g, '');

    const append = (ch) => {
        setText(t => t + ch);
        // 按完按鈕後焦點要回到 input，這樣才能繼續用鍵盤接著打
        setTimeout(() => inputRef.current?.focus(), 0);
    };
    const backspace = () => {
        setText(t => t.slice(0, -1));
        setTimeout(() => inputRef.current?.focus(), 0);
    };
    const clear = () => {
        setText('');
        setTimeout(() => inputRef.current?.focus(), 0);
    };
    const confirm = () => onConfirm(text);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
        // 其他字符讓 input 自然處理，再由 onChange 過濾
    };

    // 把已輸入文字渲染成 jianpu 樣式（純預覽）
    const renderPaper = () => {
        if (!text) return <span style={{ opacity: 0.3 }}>輸入 0-7、+、-、| …</span>;
        return text.split('').map((ch, i) => {
            if (ch === '|') {
                return <span key={i} style={{ color: '#ff9800', margin: '0 4px', fontWeight: 800 }}>|</span>;
            }
            if (ch === '0') {
                return <span key={i} style={{ color: '#888', margin: '0 4px' }}>0</span>;
            }
            if (ch === '+') {
                return <span key={i} style={{ color: '#4caf50', margin: '0 2px', fontWeight: 700 }}>+</span>;
            }
            if (ch === '-') {
                return <span key={i} style={{ color: '#42a5f5', margin: '0 2px', fontWeight: 700 }}>-</span>;
            }
            return <span key={i} style={{ color: '#fff', margin: '0 4px' }}>{ch}</span>;
        });
    };

    // 數字鍵盤樣式（compact）
    const padBtnBase = {
        minHeight: '44px',
        padding: '6px 0',
        fontSize: '20px',
        fontWeight: 700,
        background: '#262626',
        color: '#fff',
        border: '1px solid #383838',
        borderRadius: '8px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1px',
        lineHeight: 1,
        userSelect: 'none',
        transition: 'background 0.1s',
    };
    const numKey = { ...padBtnBase };
    const plusKey = { ...padBtnBase, background: '#1f3220', color: '#4caf50', borderColor: '#2e5c30' };
    const minusKey = { ...padBtnBase, background: '#1a2a3a', color: '#42a5f5', borderColor: '#284a6e' };
    const barKey = { ...padBtnBase, background: '#3a2c00', color: '#ff9800', borderColor: '#5a4200' };
    const backKey = { ...padBtnBase, background: '#3a2424', color: '#ff7a7a', borderColor: '#5a2e2e', fontSize: '18px' };

    return (
        <div
            onClick={onCancel}
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#1a1a1a', borderRadius: '12px',
                    padding: '20px', minWidth: '380px', maxWidth: '480px',
                    width: '100%', color: '#fff',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    border: '1px solid #333',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🖨️</span>
                    <strong style={{ fontSize: '15px' }}>打字機 — 插入 / 複製文字音符</strong>
                </div>

                {/* 從樂譜複製多小節（共 {totalMeasures} 小節） */}
                <div style={{
                    background: '#1d1d1d',
                    border: '1px solid #2e2e2e',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '10px',
                    fontSize: '12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: '#ccc', fontWeight: 600 }}>📋 從樂譜複製小節</span>
                        <span style={{ color: '#888' }}>共 {totalMeasures} 小節</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#aaa' }}>第</span>
                        <input
                            type="number" min={1} max={totalMeasures}
                            value={copyStart}
                            onChange={(e) => setCopyStart(clampMeasure(e.target.value))}
                            style={{ width: '54px', padding: '4px 6px', background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}
                        />
                        <span style={{ color: '#aaa' }}>～</span>
                        <input
                            type="number" min={1} max={totalMeasures}
                            value={copyEnd}
                            onChange={(e) => setCopyEnd(clampMeasure(e.target.value))}
                            style={{ width: '54px', padding: '4px 6px', background: '#2a2a2a', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}
                        />
                        <span style={{ color: '#aaa' }}>小節</span>
                        <button
                            onClick={handleExtract}
                            title="把該範圍音符填入下方輸入框"
                            style={{ marginLeft: 'auto', padding: '5px 10px', background: '#1e3a4a', color: '#42a5f5', border: '1px solid #2c5374', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >提取為文字</button>
                        <button
                            onClick={handleClipboardCopy}
                            title="複製該範圍音符到系統剪貼簿"
                            style={{ padding: '5px 10px', background: '#1f3220', color: '#4caf50', border: '1px solid #2e5c30', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >複製 ⧉</button>
                        <button
                            onClick={handleClipboardPaste}
                            title="從系統剪貼簿貼上文字（自動過濾不合法字符）"
                            style={{ padding: '5px 10px', background: '#3a2c00', color: '#ff9800', border: '1px solid #5a4200', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >貼上 ⇲</button>
                    </div>
                    {copyMsg && (
                        <div style={{ marginTop: '6px', color: '#4caf50', fontSize: '11px' }}>{copyMsg}</div>
                    )}
                </div>

                {/* 上方紙張：顯示已輸入內容（預覽） */}
                <div style={{
                    background: '#f5f0e0',
                    color: '#1a1a1a',
                    borderRadius: '6px',
                    padding: '20px 16px',
                    minHeight: '70px',
                    marginBottom: '10px',
                    fontFamily: 'monospace',
                    fontSize: '24px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)',
                    wordBreak: 'break-all',
                    lineHeight: '1.4',
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 27px, rgba(0,0,0,0.05) 28px)',
                }}>
                    <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: '4px', padding: '8px 10px', minHeight: '38px' }}>
                        {renderPaper()}
                    </div>
                </div>

                {/* 真實可見的輸入框（鍵盤輸入的來源） */}
                <input
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={text}
                    onChange={(e) => setText(sanitize(e.target.value))}
                    onKeyDown={handleKeyDown}
                    placeholder="鍵盤直接打：0-7、+、-、|（Enter 確認、Esc 取消）"
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        marginBottom: '12px',
                        background: '#2a2a2a',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: '6px',
                        fontSize: '18px',
                        fontFamily: 'monospace',
                        letterSpacing: '0.06em',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />

                {/* 數字鍵盤 — 3 欄 4 列 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '6px',
                    marginBottom: '10px',
                    padding: '8px',
                    background: '#141414',
                    borderRadius: '10px',
                    border: '1px solid #2a2a2a',
                }}>
                    {/* row 1 */}
                    <button onClick={() => append('1')} style={numKey}>1</button>
                    <button onClick={() => append('2')} style={numKey}>2</button>
                    <button onClick={() => append('3')} style={numKey}>3</button>
                    {/* row 2 */}
                    <button onClick={() => append('4')} style={numKey}>4</button>
                    <button onClick={() => append('5')} style={numKey}>5</button>
                    <button onClick={() => append('6')} style={numKey}>6</button>
                    {/* row 3 */}
                    <button onClick={() => append('7')} style={numKey}>7</button>
                    <button onClick={() => append('+')} style={plusKey} title="升 8 度（套用到上一個數字）">
                        +
                        <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 500 }}>↑8ve</span>
                    </button>
                    <button onClick={() => append('-')} style={minusKey} title="降 8 度（套用到上一個數字）">
                        −
                        <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 500 }}>↓8ve</span>
                    </button>
                    {/* row 4 */}
                    <button onClick={() => append('0')} style={numKey}>0</button>
                    <button onClick={() => append('|')} style={barKey} title="小節線">
                        |
                        <span style={{ fontSize: '10px', opacity: 0.85, fontWeight: 500 }}>小節線</span>
                    </button>
                    <button onClick={backspace} style={backKey} title="刪除最後一個字符">⌫</button>
                </div>

                {/* 清空 */}
                <div style={{ marginBottom: '12px' }}>
                    <button
                        onClick={clear}
                        disabled={!text}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: text ? '#2a2a2a' : '#1f1f1f',
                            color: text ? '#ccc' : '#555',
                            border: '1px solid #3a3a3a',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: text ? 'pointer' : 'default',
                            fontFamily: 'inherit',
                        }}
                    >清空全部</button>
                </div>

                {/* 動作按鈕 */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1, padding: '10px',
                            background: '#333', color: '#ccc',
                            border: '1px solid #555', borderRadius: '6px',
                            cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit',
                        }}
                    >取消</button>
                    <button
                        onClick={confirm}
                        disabled={!text}
                        style={{
                            flex: 2, padding: '10px',
                            background: text ? '#4caf50' : '#2a2a2a',
                            color: '#fff', border: 'none', borderRadius: '6px',
                            cursor: text ? 'pointer' : 'default',
                            fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
                        }}
                    >輸入 ↵</button>
                </div>

                <div style={{ marginTop: '10px', fontSize: '11px', color: '#777', textAlign: 'center', lineHeight: 1.6 }}>
                    例：<code style={{ color: '#bbb' }}>1+ 2 3 - 4 | 5</code> = 1↑8ve、2、3↓8ve、4、小節線、5
                </div>
            </div>
        </div>
    );
}

export default TypewriterDialog;
