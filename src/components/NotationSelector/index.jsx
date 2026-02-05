/**
 * NotationSelector - 譜式選擇器元件
 * 切換顯示格式：簡譜 / 五線譜 / 六線譜 / 全部
 */

import React, { useState, useEffect } from 'react';
import './NotationSelector.css';

// 譜式選項
const NOTATION_OPTIONS = [
    { id: 'all', label: '全部', icon: '📋', description: '同時顯示所有譜式' },
    { id: 'jianpu', label: '簡譜', icon: '🔢', description: '數字記譜法' },
    { id: 'staff', label: '五線譜', icon: '🎼', description: '標準五線譜' },
    { id: 'tab', label: '六線譜', icon: '🎸', description: '吉他指法譜' },
];

// localStorage key
const STORAGE_KEY = 'guitar-mixer-notation-preference';

/**
 * NotationSelector 元件
 * @param {Object} props
 * @param {string} props.value - 當前選擇的譜式
 * @param {Function} props.onChange - 變更回調
 * @param {boolean} props.showIcons - 是否顯示圖示
 * @param {boolean} props.showLabels - 是否顯示文字標籤
 * @param {string} props.size - 大小 ('sm' | 'md' | 'lg')
 * @param {boolean} props.vertical - 是否垂直排列
 */
function NotationSelector({
    value = 'all',
    onChange,
    showIcons = true,
    showLabels = true,
    size = 'md',
    vertical = false
}) {
    const [selected, setSelected] = useState(value);

    // 從 localStorage 讀取偏好
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved && NOTATION_OPTIONS.some(opt => opt.id === saved)) {
                setSelected(saved);
                onChange?.(saved);
            }
        } catch (e) {
            console.warn('Failed to load notation preference');
        }
    }, []);

    // 同步外部 value
    useEffect(() => {
        if (value !== selected) {
            setSelected(value);
        }
    }, [value]);

    const handleSelect = (notationId) => {
        setSelected(notationId);
        onChange?.(notationId);

        // 儲存偏好
        try {
            localStorage.setItem(STORAGE_KEY, notationId);
        } catch (e) {
            console.warn('Failed to save notation preference');
        }
    };

    return (
        <div className={`notation-selector ${size} ${vertical ? 'vertical' : 'horizontal'}`}>
            {NOTATION_OPTIONS.map(option => (
                <button
                    key={option.id}
                    className={`notation-option ${selected === option.id ? 'active' : ''}`}
                    onClick={() => handleSelect(option.id)}
                    title={option.description}
                >
                    {showIcons && <span className="notation-icon">{option.icon}</span>}
                    {showLabels && <span className="notation-label">{option.label}</span>}
                </button>
            ))}
        </div>
    );
}

/**
 * NotationTabs - 標籤頁樣式選擇器
 */
export function NotationTabs({ value, onChange, className = '' }) {
    return (
        <div className={`notation-tabs ${className}`}>
            <NotationSelector
                value={value}
                onChange={onChange}
                showIcons={true}
                showLabels={true}
                size="md"
            />
        </div>
    );
}

/**
 * NotationDropdown - 下拉選單樣式選擇器
 */
export function NotationDropdown({ value, onChange, className = '' }) {
    return (
        <select
            className={`notation-dropdown ${className}`}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        >
            {NOTATION_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>
                    {option.icon} {option.label}
                </option>
            ))}
        </select>
    );
}

/**
 * NotationToggle - 切換按鈕樣式
 */
export function NotationToggle({ value, onChange, options = ['jianpu', 'staff', 'tab'] }) {
    const filteredOptions = NOTATION_OPTIONS.filter(opt => options.includes(opt.id));

    return (
        <div className="notation-toggle">
            {filteredOptions.map(option => (
                <button
                    key={option.id}
                    className={`toggle-btn ${value === option.id ? 'active' : ''}`}
                    onClick={() => onChange?.(option.id)}
                >
                    {option.icon}
                </button>
            ))}
        </div>
    );
}

// 匯出選項供外部使用
export { NOTATION_OPTIONS, STORAGE_KEY };

export default NotationSelector;
