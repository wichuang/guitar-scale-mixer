/**
 * Converters - Barrel Export
 */

export { NoteConverter } from './NoteConverter.js';

// 便捷轉換函數
export const convertToJianpu = (notes, key = 'C', scaleType = 'Major') => {
    const { NoteConverter } = require('./NoteConverter.js');
    return notes.map(note => NoteConverter.toJianpu(note, key, scaleType));
};

export const convertToStaff = (notes) => {
    const { NoteConverter } = require('./NoteConverter.js');
    return notes.map(note => NoteConverter.toStaff(note));
};

export const convertToTab = (notes, options = {}) => {
    const { NoteConverter } = require('./NoteConverter.js');
    return notes.map(note => NoteConverter.toTab(note, options));
};
