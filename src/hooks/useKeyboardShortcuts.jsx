/**
 * useKeyboardShortcuts - 鍵盤快捷鍵 Hook
 * 管理全域和區域快捷鍵
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * 預設快捷鍵配置
 */
export const DEFAULT_SHORTCUTS = {
    // 播放控制
    'space': { action: 'togglePlay', description: 'Play/Pause' },
    'escape': { action: 'stop', description: 'Stop' },

    // 導航
    'arrowleft': { action: 'prevNote', description: 'Previous note' },
    'arrowright': { action: 'nextNote', description: 'Next note' },
    'home': { action: 'goToStart', description: 'Go to start' },
    'end': { action: 'goToEnd', description: 'Go to end' },

    // 速度控制
    'arrowup': { action: 'tempoUp', description: 'Increase tempo' },
    'arrowdown': { action: 'tempoDown', description: 'Decrease tempo' },
    'shift+arrowup': { action: 'tempoUp5', description: 'Increase tempo +5' },
    'shift+arrowdown': { action: 'tempoDown5', description: 'Decrease tempo -5' },

    // 循環控制
    '[': { action: 'setLoopStart', description: 'Set loop start' },
    ']': { action: 'setLoopEnd', description: 'Set loop end' },
    'l': { action: 'toggleLoop', description: 'Toggle loop' },
    'backspace': { action: 'clearLoop', description: 'Clear loop' },

    // 節拍器
    'm': { action: 'toggleMetronome', description: 'Toggle metronome' },

    // 其他
    'r': { action: 'repeat', description: 'Repeat from current' },
    '?': { action: 'showHelp', description: 'Show shortcuts help' }
};

/**
 * 解析鍵盤事件為快捷鍵字串
 */
function parseKeyEvent(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');

    const key = event.key.toLowerCase();
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
        parts.push(key);
    }

    return parts.join('+');
}

/**
 * useKeyboardShortcuts Hook
 * @param {Object} handlers - 動作處理器映射
 * @param {Object} options - 選項
 * @param {boolean} options.enabled - 是否啟用 (預設 true)
 * @param {Object} options.shortcuts - 自訂快捷鍵配置 (會與預設合併)
 * @param {boolean} options.preventDefault - 是否阻止預設行為 (預設 true)
 * @param {Array<string>} options.ignoreElements - 忽略的元素標籤 (預設 ['INPUT', 'TEXTAREA', 'SELECT'])
 * @returns {Object} 快捷鍵管理方法
 */
export function useKeyboardShortcuts(handlers = {}, options = {}) {
    const {
        enabled = true,
        shortcuts = {},
        preventDefault = true,
        ignoreElements = ['INPUT', 'TEXTAREA', 'SELECT']
    } = options;

    // 合併快捷鍵配置
    const mergedShortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts };

    // Refs
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    const shortcutsRef = useRef(mergedShortcuts);
    shortcutsRef.current = mergedShortcuts;

    /**
     * 處理鍵盤事件
     */
    const handleKeyDown = useCallback((event) => {
        if (!enabled) return;

        // 忽略特定元素中的按鍵
        const tagName = event.target.tagName;
        if (ignoreElements.includes(tagName)) {
            // 但允許 Escape 鍵在任何地方觸發
            if (event.key !== 'Escape') {
                return;
            }
        }

        // 解析按鍵
        const shortcutKey = parseKeyEvent(event);
        const shortcut = shortcutsRef.current[shortcutKey];

        if (shortcut) {
            const handler = handlersRef.current[shortcut.action];
            if (handler) {
                if (preventDefault) {
                    event.preventDefault();
                }
                handler(event);
            }
        }
    }, [enabled, preventDefault, ignoreElements]);

    /**
     * 設定事件監聽
     */
    useEffect(() => {
        if (!enabled) return;

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled, handleKeyDown]);

    /**
     * 取得所有快捷鍵列表（用於顯示幫助）
     */
    const getShortcutsList = useCallback(() => {
        return Object.entries(shortcutsRef.current).map(([key, config]) => ({
            key,
            action: config.action,
            description: config.description
        }));
    }, []);

    /**
     * 檢查某個動作是否有對應的處理器
     */
    const hasHandler = useCallback((action) => {
        return typeof handlersRef.current[action] === 'function';
    }, []);

    return {
        getShortcutsList,
        hasHandler,
        shortcuts: mergedShortcuts
    };
}

/**
 * KeyboardShortcutsHelp - 快捷鍵幫助元件
 */
export function KeyboardShortcutsHelp({ shortcuts, onClose }) {
    const shortcutsList = Object.entries(shortcuts).map(([key, config]) => ({
        key,
        ...config
    }));

    // 分組
    const groups = {
        'Playback': ['togglePlay', 'stop', 'repeat'],
        'Navigation': ['prevNote', 'nextNote', 'goToStart', 'goToEnd'],
        'Tempo': ['tempoUp', 'tempoDown', 'tempoUp5', 'tempoDown5'],
        'Loop': ['setLoopStart', 'setLoopEnd', 'toggleLoop', 'clearLoop'],
        'Other': ['toggleMetronome', 'showHelp']
    };

    const groupedShortcuts = {};
    for (const [groupName, actions] of Object.entries(groups)) {
        groupedShortcuts[groupName] = shortcutsList.filter(s => actions.includes(s.action));
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}
            onClick={onClose}
        >
            <div style={{
                background: '#1a1a1a',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                maxHeight: '80vh',
                overflow: 'auto',
                color: '#fff'
            }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0 }}>⌨️ Keyboard Shortcuts</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            fontSize: '20px',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {Object.entries(groupedShortcuts).map(([groupName, items]) => (
                    items.length > 0 && (
                        <div key={groupName} style={{ marginBottom: '16px' }}>
                            <h4 style={{ color: '#4caf50', margin: '0 0 8px 0', fontSize: '14px' }}>
                                {groupName}
                            </h4>
                            <div style={{ display: 'grid', gap: '4px' }}>
                                {items.map(shortcut => (
                                    <div key={shortcut.key} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '6px 12px',
                                        background: '#222',
                                        borderRadius: '4px'
                                    }}>
                                        <span style={{ color: '#888' }}>{shortcut.description}</span>
                                        <kbd style={{
                                            padding: '2px 8px',
                                            background: '#333',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            fontFamily: 'monospace'
                                        }}>
                                            {shortcut.key}
                                        </kbd>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}

                <div style={{
                    marginTop: '20px',
                    padding: '12px',
                    background: '#222',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: '#888',
                    textAlign: 'center'
                }}>
                    Press <kbd style={{ padding: '2px 6px', background: '#333', borderRadius: '4px' }}>?</kbd> or <kbd style={{ padding: '2px 6px', background: '#333', borderRadius: '4px' }}>Escape</kbd> to close
                </div>
            </div>
        </div>
    );
}

export default useKeyboardShortcuts;
