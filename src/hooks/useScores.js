import { useState, useEffect, useCallback } from 'react';

const SCORES_STORAGE_KEY = 'guitar-scale-mixer-scores';

/**
 * 從 localStorage 獲取已儲存的樂譜
 */
function getSavedScores() {
    try {
        const data = localStorage.getItem(SCORES_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * 儲存樂譜到 localStorage
 */
function saveScoresToStorage(scores) {
    try {
        localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(scores));
    } catch (e) {
        console.error('Failed to save scores:', e);
    }
}

/**
 * 樂譜儲存 Hook
 */
export function useScores() {
    const [scores, setScores] = useState([]);

    // 載入樂譜
    useEffect(() => {
        setScores(getSavedScores());
    }, []);

    // 儲存新樂譜
    const saveScore = useCallback((name, data) => {
        const newScore = {
            id: Date.now().toString(),
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            data: {
                text: data.text,           // 簡譜文字
                notes: data.notes,         // 解析後的音符
                key: data.key,             // 調號
                scaleType: data.scaleType, // 音階類型
                position: data.position,   // 預設把位
                tempo: data.tempo,         // 速度
            }
        };

        setScores(prev => {
            const updated = [...prev, newScore];
            saveScoresToStorage(updated);
            return updated;
        });

        return newScore;
    }, []);

    // 更新樂譜
    const updateScore = useCallback((id, data) => {
        setScores(prev => {
            const updated = prev.map(s =>
                s.id === id
                    ? {
                        ...s,
                        updatedAt: new Date().toISOString(),
                        data: { ...s.data, ...data }
                    }
                    : s
            );
            saveScoresToStorage(updated);
            return updated;
        });
    }, []);

    // 刪除樂譜
    const deleteScore = useCallback((id) => {
        setScores(prev => {
            const updated = prev.filter(s => s.id !== id);
            saveScoresToStorage(updated);
            return updated;
        });
    }, []);

    // 重新命名樂譜
    const renameScore = useCallback((id, newName) => {
        setScores(prev => {
            const updated = prev.map(s =>
                s.id === id ? { ...s, name: newName } : s
            );
            saveScoresToStorage(updated);
            return updated;
        });
    }, []);

    // 載入樂譜 (返回資料)
    const loadScore = useCallback((id) => {
        const score = scores.find(s => s.id === id);
        return score ? score.data : null;
    }, [scores]);

    // 獲取樂譜資訊
    const getScore = useCallback((id) => {
        return scores.find(s => s.id === id) || null;
    }, [scores]);

    return {
        scores,
        saveScore,
        updateScore,
        deleteScore,
        renameScore,
        loadScore,
        getScore,
    };
}
