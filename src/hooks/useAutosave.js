/**
 * useAutosave - 自動儲存 Hook
 * 處理 localStorage 的自動儲存和讀取
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const DEFAULT_AUTOSAVE_KEY = 'guitar-mixer-readmode-autosave';
const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * useAutosave Hook
 * @param {Object} options
 * @param {string} options.key - localStorage key
 * @param {number} options.debounceMs - debounce 時間（毫秒）
 * @returns {Object}
 */
export function useAutosave({
    key = DEFAULT_AUTOSAVE_KEY,
    debounceMs = DEFAULT_DEBOUNCE_MS
} = {}) {
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const saveTimeoutRef = useRef(null);

    /**
     * 儲存資料到 localStorage
     * @param {Object} data
     */
    const save = useCallback((data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            setLastSavedAt(new Date());
        } catch (e) {
            console.error('Autosave failed:', e);
        }
    }, [key]);

    /**
     * 延遲儲存（debounced）
     * @param {Object} data
     */
    const debouncedSave = useCallback((data) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            save(data);
        }, debounceMs);
    }, [save, debounceMs]);

    /**
     * 從 localStorage 讀取資料
     * @returns {Object|null}
     */
    const load = useCallback(() => {
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load autosave:', e);
        }
        return null;
    }, [key]);

    /**
     * 清除 localStorage 資料
     */
    const clear = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setLastSavedAt(null);
        } catch (e) {
            console.error('Failed to clear autosave:', e);
        }
    }, [key]);

    /**
     * 清理 timeout
     */
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    return {
        save,
        debouncedSave,
        load,
        clear,
        lastSavedAt
    };
}

/**
 * useAutosaveState - 結合狀態管理的自動儲存 Hook
 * 自動在狀態變化時儲存，並在掛載時恢復狀態
 *
 * @param {Object} initialState - 初始狀態
 * @param {Object} options - 選項
 * @param {string} options.key - localStorage key
 * @param {number} options.debounceMs - debounce 時間
 * @param {Function} options.onRestore - 恢復狀態後的回調
 * @returns {[Object, Function, Object]}
 */
export function useAutosaveState(initialState, options = {}) {
    const {
        key = DEFAULT_AUTOSAVE_KEY,
        debounceMs = DEFAULT_DEBOUNCE_MS,
        onRestore
    } = options;

    const { save, debouncedSave, load, clear, lastSavedAt } = useAutosave({ key, debounceMs });

    // Load initial state from localStorage or use provided initialState
    const [state, setState] = useState(() => {
        const saved = load();
        if (saved) {
            onRestore?.(saved);
            return { ...initialState, ...saved };
        }
        return initialState;
    });

    // Auto-save on state change
    useEffect(() => {
        debouncedSave(state);
    }, [state, debouncedSave]);

    /**
     * 更新狀態
     * @param {Object|Function} updates
     */
    const updateState = useCallback((updates) => {
        setState(prev => {
            if (typeof updates === 'function') {
                return updates(prev);
            }
            return { ...prev, ...updates };
        });
    }, []);

    /**
     * 重置狀態
     */
    const resetState = useCallback(() => {
        clear();
        setState(initialState);
    }, [clear, initialState]);

    return [
        state,
        updateState,
        {
            save: () => save(state),
            clear,
            reset: resetState,
            lastSavedAt
        }
    ];
}

export default useAutosave;
