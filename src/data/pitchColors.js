// 12 音名的顏色 — 配對「flat 暗 / natural 亮」的 interval 配色
// 假設 root = C 時對應到：I(白) bII/II(藍) bIII/III(紅) IV/bV(青) V(橙) bVI/VI(紫) bVII/VII(灰)
export const PITCH_COLORS = {
    'C':  { bg: '#FFFFFF', fg: '#1a1a1a' },  // I
    'C#': { bg: '#1E40AF', fg: '#FFFFFF' },  // bII 深藍
    'Db': { bg: '#1E40AF', fg: '#FFFFFF' },
    'D':  { bg: '#3B82F6', fg: '#FFFFFF' },  // II  亮藍
    'D#': { bg: '#991B1B', fg: '#FFFFFF' },  // bIII 深紅
    'Eb': { bg: '#991B1B', fg: '#FFFFFF' },
    'E':  { bg: '#EF4444', fg: '#FFFFFF' },  // III  亮紅
    'F':  { bg: '#0F766E', fg: '#FFFFFF' },  // IV   深青綠
    'F#': { bg: '#14B8A6', fg: '#FFFFFF' },  // bV   亮青綠
    'Gb': { bg: '#14B8A6', fg: '#FFFFFF' },
    'G':  { bg: '#F59E0B', fg: '#1a1a1a' },  // V    橙
    'G#': { bg: '#6D28D9', fg: '#FFFFFF' },  // bVI  深紫
    'Ab': { bg: '#6D28D9', fg: '#FFFFFF' },
    'A':  { bg: '#A855F7', fg: '#FFFFFF' },  // VI   亮紫
    'A#': { bg: '#4B5563', fg: '#FFFFFF' },  // bVII 深灰
    'Bb': { bg: '#4B5563', fg: '#FFFFFF' },
    'B':  { bg: '#6B7280', fg: '#FFFFFF' },  // VII  亮灰
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
 * 回傳 { bg, fg, border }；passing 為 true 時為「空心」樣式（透明中心 + 飽和色邊框），
 * 與 chord tone 的滿色實心強烈區隔。
 */
export function getPitchColor(noteName, { passing = false } = {}) {
    const base = PITCH_COLORS[noteName] || { bg: '#888888', fg: '#FFFFFF' };
    if (passing) {
        // 空心：完全透明中心 + 飽和色邊框 + 白字（深色 bg 上易讀）
        return {
            bg: 'transparent',
            fg: '#FFFFFF',
            border: base.bg,
        };
    }
    return { ...base, border: 'transparent' };
}
