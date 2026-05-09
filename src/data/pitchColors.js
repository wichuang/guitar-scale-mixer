// 12 音名的顏色（自然音與半音）— 模仿傳統教學配色
// E=紅 / F=青綠 / G=橙 / A=紫 / B=灰 / C=白 / D=藍；半音用較淺/變體色
// 共用於 Fretboard、ScalePanelCompact 等元件
export const PITCH_COLORS = {
    'C':  { bg: '#F5F5F5', fg: '#1a1a1a' },
    'C#': { bg: '#D6D6D6', fg: '#1a1a1a' },
    'Db': { bg: '#D6D6D6', fg: '#1a1a1a' },
    'D':  { bg: '#3B82F6', fg: '#FFFFFF' },
    'D#': { bg: '#60A5FA', fg: '#FFFFFF' },
    'Eb': { bg: '#60A5FA', fg: '#FFFFFF' },
    'E':  { bg: '#DC2626', fg: '#FFFFFF' },
    'F':  { bg: '#0D9488', fg: '#FFFFFF' },
    'F#': { bg: '#14B8A6', fg: '#FFFFFF' },
    'Gb': { bg: '#14B8A6', fg: '#FFFFFF' },
    'G':  { bg: '#F97316', fg: '#1a1a1a' },
    'G#': { bg: '#FB923C', fg: '#1a1a1a' },
    'Ab': { bg: '#FB923C', fg: '#1a1a1a' },
    'A':  { bg: '#9333EA', fg: '#FFFFFF' },
    'A#': { bg: '#A78BFA', fg: '#1a1a1a' },
    'Bb': { bg: '#A78BFA', fg: '#1a1a1a' },
    'B':  { bg: '#6B7280', fg: '#FFFFFF' },
};

// 將 hex 顏色與白色混合，amount 0=原色 1=純白
function lighten(hex, amount = 0.55) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return '#' + lr.toString(16).padStart(2, '0') + lg.toString(16).padStart(2, '0') + lb.toString(16).padStart(2, '0');
}

/**
 * 取得音名顏色
 * @param {string} noteName
 * @param {object} options
 * @param {boolean} options.passing - 是否為 passing tone（非 chord tone 但被 user toggle on）
 *
 * 回傳 { bg, fg, border }；passing 為 true 時回傳「非常淡的填色 + 原音名色邊框」，
 * 與 chord tone 的滿色實心形成清楚視覺層級。
 */
export function getPitchColor(noteName, { passing = false } = {}) {
    const base = PITCH_COLORS[noteName] || { bg: '#888888', fg: '#FFFFFF' };
    if (passing) {
        return {
            bg: lighten(base.bg, 0.82),
            fg: '#1a1a1a',
            border: base.bg,
        };
    }
    return { ...base, border: 'transparent' };
}
