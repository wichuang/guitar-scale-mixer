/**
 * MIDIExporter - MIDI 匯出元件
 * 支援匯出 MIDI 檔案
 */

import React, { useState } from 'react';

// MIDI 常數
const MIDI_HEADER = [0x4D, 0x54, 0x68, 0x64]; // "MThd"
const MIDI_TRACK_HEADER = [0x4D, 0x54, 0x72, 0x6B]; // "MTrk"
const META_END_OF_TRACK = [0xFF, 0x2F, 0x00];
const META_TEMPO = [0xFF, 0x51, 0x03];
const META_TIME_SIG = [0xFF, 0x58, 0x04];

/**
 * 將數字轉為可變長度數量 (Variable Length Quantity)
 */
function toVLQ(value) {
    if (value < 0) return [0];
    if (value < 128) return [value];

    const bytes = [];
    let v = value;
    bytes.push(v & 0x7F);
    v >>= 7;

    while (v > 0) {
        bytes.push((v & 0x7F) | 0x80);
        v >>= 7;
    }

    return bytes.reverse();
}

/**
 * 將數字轉為固定長度位元組陣列
 */
function toBytes(value, length) {
    const bytes = [];
    for (let i = length - 1; i >= 0; i--) {
        bytes.push((value >> (i * 8)) & 0xFF);
    }
    return bytes;
}

/**
 * 建立 MIDI 檔案
 */
function createMIDI(notes, options = {}) {
    const {
        tempo = 120,
        timeSignature = '4/4',
        channel = 0,
        velocity = 80,
        ticksPerBeat = 480
    } = options;

    // 計算 tempo 的微秒數
    const microsecondsPerBeat = Math.round(60000000 / tempo);

    // 解析拍號
    const [numerator, denominator] = timeSignature.split('/').map(Number);
    const denomLog = Math.log2(denominator);

    // Track data
    const trackData = [];

    // Tempo meta event
    trackData.push(0x00); // Delta time
    trackData.push(...META_TEMPO);
    trackData.push(...toBytes(microsecondsPerBeat, 3));

    // Time signature meta event
    trackData.push(0x00);
    trackData.push(...META_TIME_SIG);
    trackData.push(numerator, denomLog, 24, 8);

    // Program change (Guitar: 25 for Acoustic Steel)
    trackData.push(0x00);
    trackData.push(0xC0 | channel, 25);

    // Note events
    let currentTick = 0;
    const noteDuration = ticksPerBeat; // Quarter note

    for (const note of notes) {
        if (note.isSeparator || note.isSymbol || note.isExtension) {
            continue;
        }

        if (note.isRest) {
            // 休止符只增加時間
            currentTick += noteDuration;
            continue;
        }

        const midi = note.midi || note.midiNote;
        if (!midi || midi < 0 || midi > 127) continue;

        // Note On
        trackData.push(...toVLQ(0)); // Delta time (relative to previous)
        trackData.push(0x90 | channel, midi, velocity);

        // Note Off (after duration)
        trackData.push(...toVLQ(noteDuration));
        trackData.push(0x80 | channel, midi, 0);
    }

    // End of track
    trackData.push(0x00);
    trackData.push(...META_END_OF_TRACK);

    // Build complete MIDI file
    const midi = [];

    // Header chunk
    midi.push(...MIDI_HEADER);
    midi.push(...toBytes(6, 4));        // Header length
    midi.push(...toBytes(0, 2));        // Format 0
    midi.push(...toBytes(1, 2));        // Number of tracks
    midi.push(...toBytes(ticksPerBeat, 2)); // Ticks per beat

    // Track chunk
    midi.push(...MIDI_TRACK_HEADER);
    midi.push(...toBytes(trackData.length, 4));
    midi.push(...trackData);

    return new Uint8Array(midi);
}

function MIDIExporter({
    notes,
    tempo = 120,
    timeSignature = '4/4',
    fileName = 'score'
}) {
    const [exporting, setExporting] = useState(false);

    const handleExport = async () => {
        if (!notes || notes.length === 0) {
            alert('沒有可匯出的音符');
            return;
        }

        setExporting(true);

        try {
            const midiData = createMIDI(notes, { tempo, timeSignature });

            // 建立下載連結
            const blob = new Blob([midiData], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}.mid`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('MIDI export error:', error);
            alert('MIDI 匯出失敗');
        } finally {
            setExporting(false);
        }
    };

    return (
        <button
            className="midi-export-btn"
            onClick={handleExport}
            disabled={exporting || !notes || notes.length === 0}
            style={{
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                opacity: exporting ? 0.5 : 1
            }}
        >
            {exporting ? '匯出中...' : 'Export MIDI'}
        </button>
    );
}

// 匯出工具函數供外部使用
export { createMIDI, toVLQ, toBytes };

export default MIDIExporter;
