// Browser check for Phase 1: opens the map, clicks the first buildings in the
// manifest at their real screen position, and verifies the card shows the
// same building ID that was clicked. Saves desktop and phone screenshots.
//
// Usage:  npm run dev  (in another terminal), then
//         node scripts/check-picking.mjs [url] [outputFolder]
// Set CHROME_PATH if Playwright can't find Chrome/Chromium by itself.
import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'screenshots';
await mkdir(out, {recursive: true});
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
let failures = 0;
try {
  for (const [name, viewport] of [['desktop', {width: 1440, height: 900}], ['mobile', {width: 390, height: 844}]]) {
    const page = await browser.newPage({viewport});
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text().slice(0, 200)}`); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${name}: HTTP ${r.status()} ${r.url()}`); });
    await page.goto(url);
    await page.waitForFunction(() => window.__lens?.ready, null, {timeout: 120000});
    const loadError = await page.evaluate(() => window.__lens.error);
    if (loadError) throw new Error('Map failed to load: ' + loadError);
    await page.waitForTimeout(1500);
    await page.screenshot({path: `${out}/${name}-home.png`});

    const sample = await page.evaluate(() => __lens.buildings.manifest.slice(0, 5).map(r => r.buildingId));
    for (const id of sample) {
      // Fly close to the building, then find where its centre is on screen.
      const target = await page.evaluate(async id => {
        const {Cesium, nav, buildings} = window.__lens;
        const r = buildings.records.get(id);
        Object.assign(nav.state, {lon: r.position[0], lat: r.position[1], range: 220, pitch: -60});
        nav.apply();
        await new Promise(res => { const stop = __lens.viewer.scene.postRender.addEventListener(() => { if (buildings.tileset.tilesLoaded) { stop(); res(); } }); });
        // Aim at mid height of the building's roof line.
        const height = (r.heightsN2000.base + r.heightsN2000.top) / 2;
        const p = Cesium.SceneTransforms.worldToWindowCoordinates(__lens.viewer.scene, Cesium.Cartesian3.fromDegrees(r.position[0], r.position[1], height));
        return p ? {x: p.x, y: p.y} : null;
      }, id);
      if (!target) { console.log(`  ${name}: ${id} not on screen`); failures++; continue; }
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(300);
      const shown = await page.evaluate(() => document.querySelector('#building-card:not([hidden]) .card-sources dd')?.textContent ?? null);
      const ok = shown === id;
      // A click can land on a neighbour when the centre point is inside a courtyard; report, don't hide it.
      console.log(`  ${name}: clicked ${id} -> card shows ${shown} ${ok ? 'ok' : 'MISMATCH'}`);
      if (!ok) failures++;
    }
    await page.screenshot({path: `${out}/${name}-selected.png`});
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(errors.length ? 'Browser errors:\n' + errors.join('\n') : 'No browser errors.');
console.log(failures ? `${failures} picking checks did not match.` : 'All picking checks matched.');
process.exitCode = failures || errors.length ? 1 : 0;
