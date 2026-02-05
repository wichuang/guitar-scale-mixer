/**
 * YouTubePlayer - YouTube 整合元件
 * 可拖曳、可調整大小的 YouTube 播放器視窗
 */

import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import YouTube from 'react-youtube';

/**
 * 從 URL 提取 YouTube 影片 ID
 */
const extractYouTubeId = (url) => {
    if (!url) return '';
    let videoId = '';
    try {
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('embed/')) {
            videoId = url.split('embed/')[1].split('?')[0];
        }
    } catch (e) {
        return '';
    }
    return videoId;
};

function YouTubePlayer({
    show,
    youtubeUrl,
    youtubeLayout,
    enableCountIn,
    tempo,
    onClose,
    onUrlChange,
    onLayoutChange,
    onCountInPlay
}) {
    const nodeRef = useRef(null);
    const playerRef = useRef(null);

    /**
     * 播放前倒數
     */
    const handleCountInPlay = () => {
        if (enableCountIn) {
            onCountInPlay?.(() => {
                if (playerRef.current) {
                    playerRef.current.playVideo();
                }
            });
        } else {
            if (playerRef.current) {
                playerRef.current.playVideo();
            }
        }
    };

    if (!show) return null;

    return (
        <Draggable
            nodeRef={nodeRef}
            handle=".yt-handle"
            defaultPosition={{ x: youtubeLayout.x, y: youtubeLayout.y }}
            onStop={(e, data) => onLayoutChange(prev => ({ ...prev, x: data.x, y: data.y }))}
        >
            <div ref={nodeRef} className="youtube-floating-window" style={{
                position: 'fixed', zIndex: 1000,
                width: youtubeLayout.width, height: youtubeLayout.height,
                background: '#222', border: '1px solid #444',
                resize: 'both', overflow: 'hidden', display: 'flex', flexDirection: 'column',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                paddingBottom: '16px'
            }}>
                <div className="yt-handle" style={{
                    padding: '5px', background: '#333', cursor: 'move', color: '#fff',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none'
                }}>
                    <span style={{ fontSize: '12px' }}>YouTube (拖曳標題移動 / 右下角縮放)</span>
                    <button onClick={onClose} style={{ background: 'red', border: 'none', color: 'white', width: '20px', cursor: 'pointer' }}>x</button>
                </div>
                <div style={{ flex: 1, position: 'relative', background: '#111' }}>
                    {!youtubeUrl ? (
                        <div style={{ padding: '10px', color: '#ccc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <input
                                type="text"
                                placeholder="貼上 YouTube 網址..."
                                onBlur={(e) => onUrlChange(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') onUrlChange(e.currentTarget.value); }}
                                style={{ width: '90%', padding: '4px', background: '#222', color: 'white', border: '1px solid #555' }}
                            />
                            <p style={{ fontSize: '12px', marginTop: '4px' }}>貼上網址後按 Enter 或點擊外部</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '40px' }}>
                                <YouTube
                                    videoId={extractYouTubeId(youtubeUrl)}
                                    opts={{
                                        height: '100%',
                                        width: '100%',
                                        playerVars: {
                                            autoplay: 0,
                                            controls: 1,
                                        },
                                    }}
                                    onReady={(e) => playerRef.current = e.target}
                                    style={{ height: '100%' }}
                                    className={'youtube-player-iframe'}
                                />
                            </div>

                            {/* YouTube Control Bar */}
                            <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: '#222', padding: '0 8px', borderTop: '1px solid #444'
                            }}>
                                <button
                                    onClick={handleCountInPlay}
                                    style={{
                                        background: '#4CAF50', color: 'white', border: 'none',
                                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                                        fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                >
                                    Play w/ Count-In
                                </button>

                                <button
                                    onClick={() => onUrlChange('')}
                                    style={{
                                        background: '#555', color: 'white', border: 'none',
                                        padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                                        fontSize: '11px'
                                    }}
                                >
                                    更換影片
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Draggable>
    );
}

export default YouTubePlayer;
