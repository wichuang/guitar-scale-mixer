import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];
const errors = [];
page.on('console', msg => {
    const text = msg.text();
    logs.push('[' + msg.type() + '] ' + text);
    // Print important ones in real-time
    if (text.includes('[DEBUG]') || text.includes('Error') || text.includes('error') ||
        text.includes('warn') || text.includes('Instrument') || text.includes('playNote')) {
        console.log('  BROWSER: ' + text);
    }
});
page.on('pageerror', err => {
    errors.push('PAGE ERROR: ' + err.message);
    console.log('  PAGE ERROR: ' + err.message);
});

console.log('Opening app...');
await page.goto('http://localhost:5173/guitar-scale-mixer/', { timeout: 15000 });
await page.waitForTimeout(2000);

// Switch to Read mode
console.log('Switching to Read mode...');
const readBtn = await page.$('button:has-text("Read")');
if (readBtn) {
    await readBtn.click();
    await page.waitForTimeout(1000);
}

// Type some jianpu text
console.log('Looking for textarea...');
const textarea = await page.$('textarea');
if (textarea) {
    console.log('Found textarea, entering notes...');
    await textarea.fill('1 2 3 4 5 6 7 1.');
    await textarea.blur();
    await page.waitForTimeout(1000);
} else {
    console.log('No textarea found');
}

// Check state
const stateInfo = await page.evaluate(() => {
    // Check if notes exist via React internals or DOM
    const noteChips = document.querySelectorAll('.note-chip');
    const playBtn = document.querySelector('.play-btn') || document.querySelector('button.control-btn.play');
    return {
        noteChipCount: noteChips.length,
        hasPlayButton: !!playBtn,
        playBtnText: playBtn?.textContent || 'N/A'
    };
});
console.log('State:', JSON.stringify(stateInfo));

// Try to click Play
const playBtn = await page.$('.play-btn');
if (playBtn) {
    console.log('Clicking Play...');
    await playBtn.click();
    await page.waitForTimeout(5000);
} else {
    // Try the PlaybackControlsBar Play button
    const ctrlPlayBtn = await page.$('button:has-text("Play"):not(.play-btn)');
    if (ctrlPlayBtn) {
        console.log('Clicking control Play...');
        await ctrlPlayBtn.click();
        await page.waitForTimeout(5000);
    } else {
        console.log('No Play button found');
    }
}

// Check final state
const finalInfo = await page.evaluate(() => {
    const activeChip = document.querySelector('.note-chip.active');
    return {
        activeNoteExists: !!activeChip,
        activeNoteText: activeChip?.textContent || 'none'
    };
});
console.log('After play:', JSON.stringify(finalInfo));

console.log('\n=== PAGE ERRORS ===');
errors.forEach(e => console.log(e));

console.log('\n=== ALL CONSOLE (filtered) ===');
logs.filter(l => !l.includes('vite') && !l.includes('React DevTools') && !l.includes('DEPRECATED'))
    .forEach(l => console.log(l));

await browser.close();
console.log('\nDone.');
