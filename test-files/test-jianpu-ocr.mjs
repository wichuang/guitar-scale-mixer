/**
 * Automated test for Jianpu OCR using Playwright
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '舊紅顏.png');
const TEST_URL = 'http://localhost:5173/guitar-scale-mixer/test-ocr-jianpu.html';

async function run() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

    const consoleLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push(text);
        if (text.includes('RESULTS') || text.includes('SUCCESS') || text.includes('FAILED') ||
            text.includes('Notes:') || text.includes('Confidence:') || text.includes('Quality') ||
            text.includes('inverted') || text.includes('Scale') || text.includes('Dimensions') ||
            text.includes('MIDI=') || text.includes('Error') || text.includes('Raw text')) {
            console.log(`  ${text}`);
        }
    });
    page.on('pageerror', err => console.error('  PAGE ERROR:', err.message));

    try {
        console.log(`Navigating to ${TEST_URL}...`);
        await page.goto(TEST_URL, { timeout: 15000 });
        await page.waitForTimeout(1000);

        console.log(`Uploading: ${TEST_IMAGE}`);
        const fileInput = await page.$('#fileInput');
        await fileInput.setInputFiles(TEST_IMAGE);
        await page.waitForTimeout(500);

        console.log('Running Jianpu OCR test...');
        await page.click('#runTest');

        const startTime = Date.now();
        let completed = false;
        while (Date.now() - startTime < 180000) {
            await page.waitForTimeout(3000);
            const text = await page.textContent('#log');
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            if (text.includes('SUCCESS') || text.includes('FAILED')) {
                console.log(`\n  Completed in ${elapsed}s`);
                completed = true;
                break;
            }
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                console.log(`  [${elapsed}s] ${lines[lines.length - 1]}`);
            }
        }

        if (!completed) {
            console.log('  Timed out after 180s');
        }

        const logText = await page.textContent('#log');
        console.log('\n=== FULL TEST OUTPUT ===');
        console.log(logText);

    } catch (err) {
        console.error('Test error:', err.message);
        console.log('\n=== ALL BROWSER CONSOLE ===');
        for (const log of consoleLogs) {
            console.log(log);
        }
    } finally {
        await browser.close();
        console.log('\nDone.');
    }
}

run().catch(console.error);
