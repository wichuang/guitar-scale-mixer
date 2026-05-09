import React from 'react';
import { INSTRUMENT_CATEGORIES } from '../../hooks/useAudio';

function InstrumentSelector({ instrument, onInstrumentChange }) {
    return (
        <select
            value={instrument}
            onChange={(e) => onInstrumentChange(e.target.value)}
            style={{
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #444',
                background: '#222',
                color: 'white',
                fontSize: '12px',
                width: '100%'
            }}
        >
            {Object.entries(INSTRUMENT_CATEGORIES).map(([category, items]) => (
                <optgroup key={category} label={category}>
                    {Object.entries(items).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

export default InstrumentSelector;
