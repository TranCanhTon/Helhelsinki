// Opens the running dev server in a headless browser, waits for the map,
// saves screenshots and prints any browser console errors.
//
// Usage:  npm run dev   (in one terminal)
//         node scripts/screenshot.mjs [url] [outputFolder]
// Set CHROME_PATH if Playwright can't find a browser on its own.
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'screenshots';
await mkdir(out, {recursive: true});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
try {
  for (const [name, viewport] of [['desktop', {width: 1440, height: 900}], ['mobile', {width: 390, height: 844}]]) {
    const page = await browser.newPage({viewport});
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text().slice(0, 300)}`); });
    page.on('requestfailed', r => errors.push(`${name}: request failed ${r.url()}`));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${name}: HTTP ${r.status()} ${r.url()}`); });
    await page.goto(url);
    await page.waitForFunction(() => window.__lens?.ready === true, null, {timeout: 120000});
    await page.waitForTimeout(1500);
    await page.screenshot({path: `${out}/${name}.png`});
    if (process.env.SCREENSHOT_EVAL) console.log(name, await page.evaluate(process.env.SCREENSHOT_EVAL));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(errors.length ? 'Browser errors:\n' + errors.join('\n') : 'No browser errors.');
