// Browser check: opens the map, clicks 10 buildings spread over the whole
// manifest at their real screen position, and verifies the card shows the
// same building ID that was clicked. Desktop only (the app is desktop-only).
//
// The centre of a building's bounding box can be open ground (an L-shaped
// building, a courtyard), so before clicking we look for a nearby pixel where
// the 3D scene really has that building, then do a real mouse click there.
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
  for (const [name, viewport] of [['desktop', {width: 1440, height: 900}]]) {
    const page = await browser.newPage({viewport});
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(`${name}: ${m.text().slice(0, 200)}`);
    });
    page.on('response', r => {
      if (r.status() >= 400) errors.push(`${name}: HTTP ${r.status()} ${r.url()}`);
    });
    await page.goto(url);
    await page.waitForFunction(() => window.__lens?.ready, null, {timeout: 120000});
    const loadError = await page.evaluate(() => window.__lens.error);
    if (loadError) throw new Error('Map failed to load: ' + loadError);
    await page.waitForTimeout(1500);
    await page.screenshot({path: `${out}/${name}-home.png`});

    // 10 buildings spread evenly through the manifest, so every part of the area is tried.
    const sample = await page.evaluate(() => {
      const all = __lens.buildings.manifest;
      return Array.from({length: 10}, (_, i) => all[Math.floor(((i + 0.5) * all.length) / 10)].buildingId);
    });
    for (const id of sample) {
      // Close the card from the previous building so it can't cover this one.
      await page.evaluate(() => __lens.card.hide());
      // Fly close to the building, then find where its centre is on screen.
      const target = await page.evaluate(async id => {
        const {Cesium, nav, buildings} = window.__lens;
        const r = buildings.records.get(id);
        Object.assign(nav.state, {lon: r.position[0], lat: r.position[1], range: 220, pitch: -60});
        nav.apply();
        // Right after a camera move Cesium hasn't requested the new tiles yet, so
        // "tilesLoaded" is still true from the old view. Wait until it has been
        // true for 10 frames in a row; once loading starts it turns false.
        await new Promise(res => {
          let calm = 0;
          const stop = __lens.viewer.scene.postRender.addEventListener(() => {
            calm = buildings.tileset.tilesLoaded ? calm + 1 : 0;
            if (calm >= 10) {
              stop();
              res();
            }
          });
        });
        // Aim at mid height of the building's roof line.
        const height = (r.heightsN2000.base + r.heightsN2000.top) / 2 - (r.groundOffsetM ?? 0);
        const scene = __lens.viewer.scene;
        const p = Cesium.SceneTransforms.worldToWindowCoordinates(
          scene,
          Cesium.Cartesian3.fromDegrees(r.position[0], r.position[1], height),
        );
        if (!p) return null;
        // Spiral out from the centre until the scene shows this building under the pixel.
        const isThis = (x, y) => scene.pick(new Cesium.Cartesian2(x, y))?.getProperty?.('buildingId') === id;
        for (let radius = 0; radius <= 60; radius += 6) {
          for (let a = 0; a < 360; a += radius ? 30 : 360) {
            const x = p.x + radius * Math.cos((a * Math.PI) / 180),
              y = p.y + radius * Math.sin((a * Math.PI) / 180);
            if (isThis(x, y)) return {x, y};
          }
        }
        return null;
      }, id);
      if (!target) {
        console.log(`  ${name}: ${id} not on screen`);
        failures++;
        continue;
      }
      await page.mouse.click(target.x, target.y);
      await page.waitForTimeout(300);
      const shown = await page.evaluate(
        () => document.querySelector('#building-card:not([hidden]) .sources dd')?.textContent ?? null,
      );
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
