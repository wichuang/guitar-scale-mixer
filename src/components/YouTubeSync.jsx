
import React, { useState, useRef, useEffect } from 'react';

const YouTubeSync = ({ isOpen, onClose }) => {
    const [videoUrl, setVideoUrl] = useState('');
    const [videoId, setVideoId] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);

    // Position state for simple dragging (optional, but let's stick to fixed for now or simple absolute)
    // We'll use fixed positioning in bottom right for simplicity.

    const extractVideoId = (url) => {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : false;
    };

    const handleLoadVideo = () => {
        const id = extractVideoId(videoUrl);
        if (id) {
            setVideoId(id);
        } else {
            // If user pasted just ID
            if (videoUrl.length === 11) {
                setVideoId(videoUrl);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '80px', // Above the player control bar
            right: '20px',
            width: isMinimized ? '200px' : '400px',
            backgroundColor: '#222',
            border: '1px solid #444',
            borderRadius: '8px',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '8px',
                background: '#333',
                display: 'flex',
                justifyContent: 'space-between',
                cursor: 'move', // We aren't implementing drag yet, but visual cue
                alignItems: 'center'
            }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#eee' }}>📺 YouTube Sync</span>
                <div>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', marginRight: '8px' }}
                    >
                        {isMinimized ? '□' : '_'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Content */}
            {!isMinimized && (
                <div style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', marginBottom: '8px', gap: '5px' }}>
                        <input
                            type="text"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                            placeholder="貼上 YouTube 網址或 ID"
                            style={{
                                flex: 1,
                                background: '#111',
                                border: '1px solid #444',
                                color: '#eee',
                                padding: '4px 8px',
                                borderRadius: '4px'
                            }}
                        />
                        <button
                            onClick={handleLoadVideo}
                            style={{
                                background: '#4caf50',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer'
                            }}
                        >
                            載入
                        </button>
                    </div>

                    {videoId ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                            <iframe
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                                src={`https://www.youtube.com/embed/${videoId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    ) : (
                        <div style={{
                            height: '150px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#000',
                            color: '#666',
                            fontSize: '0.8rem'
                        }}>
                            請輸入影片網址以開始
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default YouTubeSync;
