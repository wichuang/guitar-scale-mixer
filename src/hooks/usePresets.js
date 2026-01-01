import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'guitar-scale-mixer-presets';
const CURRENT_STATE_KEY = 'guitar-scale-mixer-current';

// Get all saved presets from localStorage
function getSavedPresets() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

// Save presets to localStorage
function savePresetsToStorage(presets) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
        console.error('Failed to save presets:', e);
    }
}

// Get current state from localStorage
function getCurrentState() {
    try {
        const data = localStorage.getItem(CURRENT_STATE_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

// Save current state to localStorage
function saveCurrentState(state) {
    try {
        localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save current state:', e);
    }
}

export function usePresets() {
    const [presets, setPresets] = useState([]);

    // Load presets on mount
    useEffect(() => {
        setPresets(getSavedPresets());
    }, []);

    // Save a new preset
    const savePreset = useCallback((name, state) => {
        const newPreset = {
            id: Date.now().toString(),
            name,
            createdAt: new Date().toISOString(),
            state
        };

        setPresets(prev => {
            const updated = [...prev, newPreset];
            savePresetsToStorage(updated);
            return updated;
        });

        return newPreset;
    }, []);

    // Delete a preset
    const deletePreset = useCallback((id) => {
        setPresets(prev => {
            const updated = prev.filter(p => p.id !== id);
            savePresetsToStorage(updated);
            return updated;
        });
    }, []);

    // Rename a preset
    const renamePreset = useCallback((id, newName) => {
        setPresets(prev => {
            const updated = prev.map(p =>
                p.id === id ? { ...p, name: newName } : p
            );
            savePresetsToStorage(updated);
            return updated;
        });
    }, []);

    // Load a preset (returns the state)
    const loadPreset = useCallback((id) => {
        const preset = presets.find(p => p.id === id);
        return preset ? preset.state : null;
    }, [presets]);

    return {
        presets,
        savePreset,
        deletePreset,
        renamePreset,
        loadPreset
    };
}

// Hook for auto-saving current state
export function useAutoSave(state, enabled = true) {
    useEffect(() => {
        if (enabled && state) {
            saveCurrentState(state);
        }
    }, [state, enabled]);
}

// Get initial state from localStorage or use defaults
export function getInitialState(defaults) {
    const saved = getCurrentState();
    return saved || defaults;
}
