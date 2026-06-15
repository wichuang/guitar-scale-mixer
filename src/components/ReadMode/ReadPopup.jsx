import { useEffect, useRef, useState } from 'react';
import ReadFretboard from '../ReadFretboard';
import ScoreDisplay from '../ScoreDisplay';
import { useAudio } from '../../hooks/useAudio';
import FretboardControlsBar from './FretboardControlsBar.jsx';

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

                {/* 指板控制列（與主畫面 inline 指板共用同一元件；雙向同步主視窗）*/}
                {view === 'fretboard' && (
                    <FretboardControlsBar
                        displayMode={state.displayMode || 'notes'}
                        musicKey={state.musicKey || 'C'}
                        scaleType={state.scaleType || 'Major'}
                        tempo={state.tempo ?? 120}
                        rangeOctave={state.rangeOctave ?? 0}
                        cagedPosition={state.cagedPosition ?? null}
                        onDisplay={(v) => send('set-display', v)}
                        onKey={(v) => send('set-key', v)}
                        onScale={(v) => send('set-scale', v)}
                        onTempo={(v) => send('set-tempo', v)}
                        onOctave={(v) => send('set-octave', v)}
                        onCaged={(v) => send('set-caged', v)}
                    />
                )}

                {state.isPlaying && <span style={{ color: '#4caf50' }}>● 播放中</span>}
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
