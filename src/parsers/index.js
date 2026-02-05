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

export {
    TabParser,
    TUNINGS,
    TECHNIQUES,
    STRING_NAMES
} from './TabParser.js';

export {
    StaffParser,
    ABC_NOTES,
    ABC_DURATIONS,
    KEY_SIGNATURES
} from './StaffParser.js';
