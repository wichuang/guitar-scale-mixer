import { useEffect, useRef, useState } from 'react';

/**
 * TypewriterDialog — 像打字機介面，輸入 0-7 與 | 串入音符與小節線
 *  - 0 = 休止符
 *  - 1~7 = 簡譜音
 *  - | = 小節線 (separator)
 *  - 按「輸入」/Enter 確認，在目前選中音符後插入這串音符
 */
function TypewriterDialog({ open, onConfirm, onCancel }) {
    const [text, setText] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setText('');
            // 自動 focus 隱藏 input 接鍵盤事件
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    if (!open) return null;

    const append = (ch) => setText(t => t + ch);
    const backspace = () => setText(t => t.slice(0, -1));
    const clear = () => setText('');
    const confirm = () => onConfirm(text);

    const handleKeyDown = (e) => {
        // 接受 0-7 / | / Backspace / Enter / Escape
        if (e.key >= '0' && e.key <= '7') {
            e.preventDefault();
            append(e.key);
        } else if (e.key === '|' || e.key === '｜') {
            e.preventDefault();
            append('|');
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            backspace();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            confirm();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    // 把輸入文字渲染成 jianpu 樣式
    const renderPaper = () => {
        if (!text) return <span style={{ opacity: 0.3 }}>輸入 0-7 與 | …</span>;
        return text.split('').map((ch, i) => {
            if (ch === '|') {
                return <span key={i} style={{ color: '#ff9800', margin: '0 4px', fontWeight: 800 }}>|</span>;
            }
            if (ch === '0') {
                return <span key={i} style={{ color: '#888', margin: '0 4px' }}>0</span>;
            }
            return <span key={i} style={{ color: '#fff', margin: '0 4px' }}>{ch}</span>;
        });
    };

    const keyBtnStyle = {
        padding: '10px 0',
        fontSize: '20px',
        fontWeight: 700,
        background: '#2a2a2a',
        color: '#fff',
        border: '1px solid #555',
        borderRadius: '6px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        minWidth: '48px',
    };

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
                    <strong style={{ fontSize: '15px' }}>打字機 — 插入文字音符</strong>
                </div>

                {/* 上方紙張：顯示已輸入內容 */}
                <div style={{
                    background: '#f5f0e0',
                    color: '#1a1a1a',
                    borderRadius: '6px',
                    padding: '20px 16px',
                    minHeight: '70px',
                    marginBottom: '14px',
                    fontFamily: 'monospace',
                    fontSize: '24px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)',
                    wordBreak: 'break-all',
                    lineHeight: '1.4',
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent 0, transparent 27px, rgba(0,0,0,0.05) 28px)',
                }}>
                    <div style={{ background: '#1a1a1a', color: '#fff', borderRadius: '4px', padding: '8px 10px' }}>
                        {renderPaper()}
                    </div>
                </div>

                {/* 鍵盤 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
                    {['1', '2', '3', '4'].map(k => (
                        <button key={k} onClick={() => append(k)} style={keyBtnStyle}>{k}</button>
                    ))}
                    {['5', '6', '7', '0'].map(k => (
                        <button key={k} onClick={() => append(k)} style={keyBtnStyle}>{k}</button>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '14px' }}>
                    <button onClick={() => append('|')} style={{ ...keyBtnStyle, background: '#3d2c00', color: '#ff9800' }}>
                        | <span style={{ fontSize: '11px', opacity: 0.8 }}> 小節線</span>
                    </button>
                    <button onClick={backspace} style={{ ...keyBtnStyle, background: '#3a2424', fontSize: '14px' }}>⌫ 退格</button>
                    <button onClick={clear} style={{ ...keyBtnStyle, background: '#2a2a2a', fontSize: '14px' }}>清空</button>
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

                <div style={{ marginTop: '10px', fontSize: '11px', color: '#777', textAlign: 'center' }}>
                    可直接用實體鍵盤輸入 0-7 與 | ；Enter 確認、Esc 取消
                </div>

                {/* 隱藏 input：用來接鍵盤事件 */}
                <input
                    ref={inputRef}
                    onKeyDown={handleKeyDown}
                    onChange={() => {}}
                    value=""
                    style={{
                        position: 'absolute', opacity: 0, width: 0, height: 0,
                        pointerEvents: 'none',
                    }}
                />
            </div>
        </div>
    );
}

export default TypewriterDialog;
