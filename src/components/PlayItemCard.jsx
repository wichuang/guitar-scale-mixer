import React from 'react';
import { NOTES, SCALES, getScaleNotes, getIntervalForNote } from '../data/scaleData';
import { CHORD_ROOTS, CHORD_EXTENSIONS, CHORD_QUALITIES, getChordNotes } from '../data/chordData';
import { getPitchColor } from '../data/pitchColors';
import './PlayItemCard.css';
// 沿用 .note-toggle-btn / .note-name / .note-interval 等樣式（原本由 ScalePanelCompact 帶入）
import './ScalePanelCompact.css';

const ITEM_COLORS = ['#2196f3', '#ff9800', '#e91e63', '#4caf50']; // 1~4 對應指板顏色

/**
 * PlayItemCard — 一個 Play 項目卡，使用者先選 Scale 或 Chord，再選內容。
 *
 * props:
 *  - index: 0-3
 *  - item: { type:'scale'|'chord', root, scale?, quality?, extension?, enabledNotes }
 *  - onChange(patch): 更新此 item 的部分屬性
 *  - onToggleNote(note): 切換 note picker 中的單個音
 *  - onRemove(): 移除此項目（itemCount > 1 時可用）
 */
function PlayItemCard({ index, item, onChange, onToggleNote, onRemove }) {
    const color = ITEM_COLORS[index % ITEM_COLORS.length];

    const handleTypeChange = (newType) => {
        if (newType === item.type) return;
        if (newType === 'scale') {
            const root = item.root || 'A';
            const scale = item.scale || 'major-pentatonic';
            onChange({
                type: 'scale',
                root,
                scale,
                enabledNotes: null,
                // 保留 chord 欄位以便切回來
            });
        } else {
            const root = item.root || 'C';
            const quality = item.quality || 'Major';
            const extension = item.extension || '3';
            onChange({
                type: 'chord',
                root,
                quality,
                extension,
                enabledNotes: getChordNotes(root, quality, extension),
            });
        }
    };

    return (
        <div className="play-item-card" style={{ borderColor: color }}>
            <div className="play-item-header">
                <span className="play-item-num" style={{ background: color }}>{index + 1}</span>
                <div className="play-item-type-switch">
                    <button
                        className={`play-item-type-btn ${item.type === 'scale' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('scale')}
                        title="Scale 音階"
                    >📚 Scale</button>
                    <button
                        className={`play-item-type-btn ${item.type === 'chord' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('chord')}
                        title="Chord 和弦"
                    >🎹 Chord</button>
                </div>
                {onRemove && (
                    <button className="play-item-remove" onClick={onRemove} title="移除此項目">✕</button>
                )}
            </div>

            {item.type === 'scale' ? (
                <ScaleContent item={item} onChange={onChange} onToggleNote={onToggleNote} color={color} />
            ) : (
                <ChordContent item={item} onChange={onChange} onToggleNote={onToggleNote} color={color} />
            )}
        </div>
    );
}

function ScaleContent({ item, onChange, onToggleNote }) {
    const root = item.root || 'A';
    const scale = item.scale || 'major-pentatonic';
    const enabledNotes = item.enabledNotes;
    const scaleOptions = Object.entries(SCALES).map(([key, val]) => ({ value: key, label: val.name }));
    const scaleNotes = getScaleNotes(root, scale);

    return (
        <>
            <div className="play-item-selectors">
                <select
                    className="play-item-select"
                    value={root}
                    onChange={(e) => onChange({ root: e.target.value, enabledNotes: null })}
                    title="Root 音"
                >
                    {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select
                    className="play-item-select play-item-select-wide"
                    value={scale}
                    onChange={(e) => onChange({ scale: e.target.value, enabledNotes: null })}
                    title="Scale"
                >
                    {scaleOptions.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>
            <div className="play-item-notes">
                {scaleNotes.map((note) => {
                    const isEnabled = !enabledNotes || enabledNotes.includes(note);
                    let interval = getIntervalForNote(note, root, scale);
                    const isRoot = interval === '1';
                    if (isRoot) interval = 'R';
                    const pc = getPitchColor(note);
                    const pillStyle = isEnabled
                        ? { background: pc.bg, color: pc.fg, borderColor: 'transparent' }
                        : { background: `${pc.bg}33`, color: pc.fg, borderColor: `${pc.bg}66` };
                    return (
                        <button
                            key={note}
                            className={`note-toggle-btn ${isEnabled ? 'enabled' : 'disabled'} ${isRoot ? 'is-root' : ''}`}
                            onClick={() => onToggleNote(note)}
                            title={`${note} (${interval})`}
                            style={pillStyle}
                        >
                            <span className="note-name">{note}</span>
                            <span className="note-interval">{interval}</span>
                        </button>
                    );
                })}
            </div>
        </>
    );
}

function ChordContent({ item, onChange, onToggleNote }) {
    const root = item.root || 'C';
    const quality = item.quality || 'Major';
    const extension = item.extension || '3';
    const enabledNotes = item.enabledNotes || [];
    const chordNotes = getChordNotes(root, quality, extension);

    const handleField = (field, value) => {
        const merged = { root, quality, extension, [field]: value };
        onChange({
            [field]: value,
            enabledNotes: getChordNotes(merged.root, merged.quality, merged.extension),
        });
    };

    return (
        <>
            <div className="play-item-selectors">
                <select
                    className="play-item-select"
                    value={root}
                    onChange={(e) => handleField('root', e.target.value)}
                    title="Root"
                >
                    {CHORD_ROOTS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                    className="play-item-select"
                    value={quality}
                    onChange={(e) => handleField('quality', e.target.value)}
                    title="Quality"
                >
                    {CHORD_QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <select
                    className="play-item-select"
                    value={extension}
                    onChange={(e) => handleField('extension', e.target.value)}
                    title="Extension"
                >
                    {CHORD_EXTENSIONS.map(ext => (
                        <option key={ext} value={ext}>{ext === 3 ? 'Triad (3)' : ext}</option>
                    ))}
                </select>
            </div>
            <div className="play-item-notes">
                {NOTES.map(note => {
                    const isEnabled = enabledNotes.includes(note);
                    const isChordTone = chordNotes.includes(note);
                    const isRoot = note === root;
                    let interval = getIntervalForNote(note, root, 'chromatic') || '';
                    if (isRoot) interval = 'R';

                    const pc = getPitchColor(note, { passing: isEnabled && !isChordTone });
                    const isPassing = isEnabled && !isChordTone;
                    const basePc = getPitchColor(note);
                    const pillStyle = isEnabled
                        ? {
                            background: pc.bg,
                            color: pc.fg,
                            borderColor: pc.border || 'transparent',
                            borderStyle: 'solid',
                            borderWidth: isPassing ? '2px' : '1px',
                        }
                        : {
                            background: `${basePc.bg}22`,
                            color: pc.fg,
                            borderColor: `${basePc.bg}55`,
                            borderStyle: 'solid',
                            borderWidth: '1px',
                        };

                    const isLocked = isChordTone;
                    return (
                        <button
                            key={note}
                            className={`note-toggle-btn ${isEnabled ? 'enabled' : 'disabled'} ${isRoot ? 'is-root' : ''}`}
                            onClick={isLocked ? undefined : () => onToggleNote(note)}
                            disabled={isLocked}
                            style={{ ...pillStyle, cursor: isLocked ? 'not-allowed' : 'pointer' }}
                            title={
                                isLocked
                                    ? `${note}（${isRoot ? 'root' : 'chord tone'} · 鎖定）`
                                    : `${note}（passing） · ${interval}`
                            }
                        >
                            <span className="note-name">{note}</span>
                            <span className="note-interval">{interval}</span>
                        </button>
                    );
                })}
            </div>
        </>
    );
}

export default PlayItemCard;
