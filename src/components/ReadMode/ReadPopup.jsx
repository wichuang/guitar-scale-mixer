import { useEffect, useRef, useState } from 'react';
import ReadFretboard from '../ReadFretboard';
import ScoreDisplay from '../ScoreDisplay';
import { CAGED_SHAPES, NOTES } from '../../data/scaleData';
import { useAudio } from '../../hooks/useAudio';

export const READ_SYNC_CHANNEL = 'guitar-scale-mixer-read-sync';

/**
 * ReadPopup — Read 模式 Guitar / Score 新視窗檢視
 * 透過 BroadcastChannel 從主視窗接收最新狀態（含 currentNoteIndex 同步播放高亮）
 */
function ReadPopup({ view }) {
    const [state, setState] = useState(null);
    const [connected, setConnected] = useState(false);
    const bcRef = useRef(null);

    useEffect(() => {
        const bc = new BroadcastChannel(READ_SYNC_CHANNEL);
        bcRef.current = bc;
        bc.onmessage = (e) => {
            if (e.data?.type === 'state') {
                setState(e.data.payload);
                setConnected(true);
            }
        };
        bc.postMessage({ type: 'request-state' });
        return () => { bc.close(); bcRef.current = null; };
    }, []);

    // popup 本地發聲（獨立 AudioContext；隨主視窗同步的樂器載入）
    const { playNote, resumeAudio } = useAudio(state?.instrument);

    // popup 對主視窗送指令
    const send = (type, value) => bcRef.current?.postMessage({ type, value });
    const setCagedPosition = (pos) => send('set-caged', pos);

    if (!state) {
        return (
            <div style={{
                background: '#0a0a0a', minHeight: '100vh', padding: 20, color: '#888',
                fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif'
            }}>
                等待主視窗同步…（主視窗 Read 模式必須開啟）
            </div>
        );
    }

    const title = view === 'fretboard' ? '🎸 Guitar' : '🎼 Score';

    return (
        <div style={{
            background: '#0a0a0a', minHeight: '100vh', padding: 12,
            fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif', color: '#fff'
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '6px 10px', marginBottom: '10px',
                background: '#1a1a1a', borderRadius: '6px', fontSize: '13px',
                flexWrap: 'wrap'
            }}>
                <strong>{title}</strong>

                {/* Display ABC/123（雙向同步主視窗）*/}
                {view === 'fretboard' && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '11px' }}>Display</span>
                        {['notes', 'intervals'].map(m => (
                            <button key={m}
                                onClick={() => send('set-display', m)}
                                style={{
                                    padding: '2px 8px', fontSize: '12px', fontWeight: 600,
                                    background: (state.displayMode || 'notes') === m ? '#2196F3' : '#222',
                                    color: '#fff', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer'
                                }}
                            >{m === 'notes' ? 'ABC' : '123'}</button>
                        ))}
                    </div>
                )}

                {/* 調號 + 速度 + 整首移調（雙向同步主視窗）*/}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ color: '#888', fontSize: '11px' }}>Key</span>
                    <select
                        value={state.musicKey}
                        onChange={(e) => send('set-key', e.target.value)}
                        style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', padding: '2px 4px' }}
                    >
                        {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select
                        value={state.scaleType}
                        onChange={(e) => send('set-scale', e.target.value)}
                        style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', padding: '2px 4px' }}
                    >
                        <option value="Major">Major</option>
                        <option value="Minor">Minor</option>
                    </select>

                    <span style={{ color: '#888', fontSize: '11px', marginLeft: '4px' }}>BPM</span>
                    <input
                        type="number" min="40" max="240" value={state.tempo}
                        onChange={(e) => send('set-tempo', Number(e.target.value))}
                        style={{ width: '52px', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', padding: '2px 4px' }}
                    />

                    <span style={{ color: '#888', fontSize: '11px', marginLeft: '4px' }}>8ve</span>
                    <button onClick={() => send('set-octave', (state.rangeOctave ?? 0) - 1)}
                        style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}>−</button>
                    <span style={{ color: '#fff', fontSize: '12px', minWidth: '20px', textAlign: 'center' }}>
                        {(state.rangeOctave ?? 0) > 0 ? `+${state.rangeOctave}` : (state.rangeOctave ?? 0)}
                    </span>
                    <button onClick={() => send('set-octave', (state.rangeOctave ?? 0) + 1)}
                        style={{ background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px', fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}>＋</button>
                    {state.isPlaying && <span style={{ color: '#4caf50', marginLeft: '4px' }}>● 播放中</span>}
                </div>

                {/* CAGED position 選擇器（與 Scale/Chord 一致；雙向同步） */}
                {view === 'fretboard' && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '11px' }}>Position:</span>
                        <button
                            onClick={() => setCagedPosition(null)}
                            style={{
                                padding: '2px 8px', fontSize: '12px',
                                background: state.cagedPosition == null ? '#2196F3' : '#222',
                                color: '#fff', border: '1px solid #444', borderRadius: '4px',
                                cursor: 'pointer', minWidth: '32px'
                            }}
                        >All</button>
                        {CAGED_SHAPES.map(shape => (
                            <button
                                key={shape}
                                onClick={() => setCagedPosition(shape)}
                                style={{
                                    padding: '2px 8px', fontSize: '12px',
                                    background: state.cagedPosition === shape ? '#2196F3' : '#222',
                                    color: '#fff', border: '1px solid #444', borderRadius: '4px',
                                    cursor: 'pointer', minWidth: '28px', fontWeight: 600
                                }}
                            >{shape}</button>
                        ))}
                    </div>
                )}

                <span style={{ marginLeft: 'auto', color: connected ? '#4caf50' : '#f00', fontSize: '11px' }}>
                    {connected ? '已同步' : '中斷'}
                </span>
            </div>

            {view === 'fretboard' ? (
                <ReadFretboard
                    notes={state.notes || []}
                    currentNoteIndex={state.currentNoteIndex ?? -1}
                    fretCount={state.fretCount || 22}
                    onNoteClick={() => { /* popup 不改譜，只發聲 */ }}
                    onPlayMidi={(midi) => { resumeAudio?.(); playNote(midi); }}
                    startString={state.startString ?? 5}
                    rangeOctave={state.rangeOctave ?? 0}
                    cagedPosition={state.cagedPosition ?? null}
                    musicKey={state.musicKey || 'C'}
                    scaleType={state.scaleType || 'Major'}
                    scaleNotes={state.scaleNotes || null}
                    intervalScale={state.intervalScale || null}
                    showScaleGuide={state.showScaleGuide ?? false}
                    displayMode={state.displayMode || 'notes'}
                />
            ) : (
                <div style={{ padding: '8px' }}>
                    <ScoreDisplay
                        notes={state.notes || []}
                        notePositions={state.notePositions || []}
                        timeSignature={state.timeSignature || '4/4'}
                        currentNoteIndex={state.currentNoteIndex ?? -1}
                    />
                </div>
            )}
        </div>
    );
}

export default ReadPopup;
