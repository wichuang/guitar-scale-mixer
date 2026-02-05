/**
 * Parsers - Barrel Export
 */

export {
    JianpuParser,
    // 向後相容獨立函數
    jianpuToNote,
    parseJianpuText,
    notesToJianpuString,
    cleanJianpuText,
    // 3NPS 相關
    SCALE_MAPPING,
    KEY_OFFSETS,
    GUITAR_POSITIONS,
    getPositionsForNote,
    getBestPosition,
    calculate3NPSPositions,
    get3NPSInfo,
    generate3NPSMap
} from './JianpuParser.js';
