/**
 * Automated test for Combined Staff+Tab OCR using Playwright
 * Uses a dedicated test HTML page served by Vite dev server
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_IMAGE = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, 'ocr-samples', 'test-staff-tab.png');
const TEST_URL = 'http://localhost:5173/guitar-scale-mixer/test-ocr.html';

async function run() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

    const consoleLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        consoleLogs.push(text);
        // Print key logs in real-time
        if (text.includes('[SystemDetector]') || text.includes('[CombinedOCR]') ||
            text.includes('[TabOCR]') || text.includes('[TEST]') || text.includes('[LINEDEBUG]') ||
            text.includes('[detectLines]') ||
            text.includes('RESULTS') || text.includes('SUCCESS') || text.includes('FAILED') ||
            text.includes('Notes:') || text.includes('Confidence:') || text.includes('Systems:') ||
            text.includes('MIDI=') || text.includes('Error:') || text.includes('Metadata:')) {
            console.log(`  ${text}`);
        }
    });
    page.on('pageerror', err => console.error('  PAGE ERROR:', err.message));

    try {
        console.log(`Navigating to ${TEST_URL}...`);
        await page.goto(TEST_URL, { timeout: 15000 });
        await page.waitForTimeout(1000);

        // Upload test image
        console.log(`Uploading: ${TEST_IMAGE}`);
        const fileInput = await page.$('#fileInput');
        await fileInput.setInputFiles(TEST_IMAGE);
        await page.waitForTimeout(500);

        // Click Run Test
        console.log('Running OCR test...');
        await page.click('#runTest');

        // Wait for completion (poll for SUCCESS or FAILED text)
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
            // Print latest progress line
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length > 0) {
                const lastLine = lines[lines.length - 1];
                console.log(`  [${elapsed}s] ${lastLine}`);
            }
        }

        if (!completed) {
            console.log('  Timed out after 180s');
        }

        // Print full log output
        const logText = await page.textContent('#log');
        console.log('\n=== FULL TEST OUTPUT ===');
        console.log(logText);

        // Take screenshot
        await page.screenshot({ path: path.join(__dirname, 'test-ss-result.png') });

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
