// Phase 2: draw the dark ground map as image tiles.
//
// Input:  data/raw/basemap/*.json (npm run data:basemap:fetch), lon/lat GeoJSON
// Output: public/basemap/<theme>/<z>/<x>/<y>.webp  and  public/basemap/basemap.json
//
// Tiles use the standard Web Mercator grid (the same one as most web maps),
// 256 x 256 pixels. Two sets of zoom levels:
//   base    zoom 10-15 for all of Helsinki (down to about 2.4 m per pixel)
//   detail  zoom 16-17 for the central area only (about 0.6 m per pixel)
// Everything outside the Helsinki boundary is one flat "outside" colour.
// Roads get an asphalt grain from zoom 15 up (scripts/lib/asphalt.mjs), a look only.
//
// For each tile we pick the shapes that touch it (spatial index), convert
// lon/lat to tile pixels, write an SVG drawing in style order, and let sharp
// turn it into a WebP image. Tiles are written to data/staging first, checked,
// and only then copied to public/.
//
// Run: npm run data:basemap:build  [--max-zoom=17]
import {readFile, writeFile, mkdir, rm, cp, readdir} from 'node:fs/promises';
import sharp from 'sharp';
import Flatbush from 'flatbush';
import polygonClipping from 'polygon-clipping';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import {loadBoundary} from './lib/boundary.mjs';
import {CLASSES, THEMES} from './lib/basemap-style.mjs';
import {asphaltPattern} from './lib/asphalt.mjs';
import {AREAS} from './config.mjs';
import {datasetSection} from './lib/prepare.mjs';

const ROOT = new URL('../', import.meta.url);
const RAW = new URL('data/raw/basemap/', ROOT);
const STAGING = new URL('data/staging/basemap/', ROOT);
const PUBLIC = new URL('public/basemap/', ROOT);
const TILE = 256;
const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const themes = ['dusk'];
const maxZoom = Number(arg('max-zoom') ?? 17);
const LEVELS = {base: {min: 10, max: 15}, detail: {min: 16, max: 17}};
// Road texture (Ton, 14 Oct 2026) from this zoom up; below it roads are too thin to show it.
const TEXTURE_MIN_ZOOM = 15;
const ASPHALT = await asphaltPattern('asphalt');

// ---- Web Mercator -------------------------------------------------------
// mx, my in 0..1 for the whole world; pixel = m * 256 * 2^z.
const mercX = lon => (lon + 180) / 360;
const mercY = lat => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const tileLon = (x, z) => (x / 2 ** z) * 360 - 180;
const tileLat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
const tileRange = ([w, s, e, n], z) => ({
  x0: Math.floor(mercX(w) * 2 ** z),
  x1: Math.floor(mercX(e) * 2 ** z),
  y0: Math.floor(mercY(n) * 2 ** z),
  y1: Math.floor(mercY(s) * 2 ** z),
});

// ---- Load and classify --------------------------------------------------
const boundary = await loadBoundary();
const bboxOf = coords => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = c => {
    if (typeof c[0] === 'number') {
      b[0] = Math.min(b[0], c[0]);
      b[1] = Math.min(b[1], c[1]);
      b[2] = Math.max(b[2], c[0]);
      b[3] = Math.max(b[3], c[1]);
    } else c.forEach(visit);
  };
  visit(coords);
  return b;
};
const helsinkiBox = bboxOf(boundary.geometry.coordinates);
const centralBox = await (async () => {
  const districts = JSON.parse(await readFile(new URL('public/map/district-boundaries.json', ROOT), 'utf8'));
  const b = bboxOf(
    districts.features.filter(f => AREAS.central.districts.includes(f.properties.id)).map(f => f.geometry.coordinates),
  );
  const margin = 0.006; // about 300-600 m, so the detail area doesn't end at the last building
  return [b[0] - margin, b[1] - margin, b[2] + margin, b[3] + margin];
})();

// Rings as Float64Array [mx0, my0, mx1, my1, ...] for fast per-tile projection.
const toRing = ring => {
  const a = new Float64Array(ring.length * 2);
  ring.forEach(([lon, lat], i) => {
    a[2 * i] = mercX(lon);
    a[2 * i + 1] = mercY(lat);
  });
  return a;
};

const streetSource = JSON.parse(await readFile(new URL('streets.json', RAW), 'utf8'));
const excludedStreets = new Set(
  streetSource.features
    .filter(f => ['Rakentamaton', 'Rakentaminen kesken'].includes(f.properties.rakentamisen_tila))
    .map(f => String(f.properties.katualue_id)),
);
const features = [];
const counts = {};
const sources = [];
for (const file of (await readdir(RAW)).filter(f => f.endsWith('.json')).sort()) {
  const layer = file.replace('.json', '');
  const data = JSON.parse(await readFile(new URL(file, RAW), 'utf8'));
  sources.push({
    name: layer,
    layer: data.layer,
    scope: data.scope,
    retrievedAt: data.retrievedAt,
    license: data.license,
    features: data.features.length,
  });
  for (const f of data.features) {
    if (!f.geometry) continue;
    if (layer === 'lanes' && excludedStreets.has(String(f.properties.katualueen_id))) continue;
    const classIndex = CLASSES.findIndex(c => c.test(layer, f.properties ?? {}));
    if (classIndex < 0) continue;
    const g = f.geometry;
    const cls = CLASSES[classIndex];
    let parts;
    if (cls.stroke) {
      if (g.type === 'LineString') parts = [[g.coordinates]];
      else if (g.type === 'MultiLineString') parts = g.coordinates.map(l => [l]);
      else continue;
    } else {
      if (g.type === 'Polygon') parts = [g.coordinates];
      else if (g.type === 'MultiPolygon') parts = g.coordinates;
      else continue;
    }
    const box = bboxOf(g.coordinates);
    if (box[2] < helsinkiBox[0] || box[0] > helsinkiBox[2] || box[3] < helsinkiBox[1] || box[1] > helsinkiBox[3])
      continue;
    features.push({classIndex, box, parts: parts.map(p => p.map(toRing))});
    counts[cls.id] = (counts[cls.id] ?? 0) + 1;
  }
}
// Draw order = class order; inside a class keep download order.
features.sort((a, b) => a.classIndex - b.classIndex);
const index = new Flatbush(features.length);
for (const f of features) index.add(f.box[0], f.box[1], f.box[2], f.box[3]);
index.finish();
console.log(
  `${features.length} shapes to draw:`,
  Object.entries(counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(', '),
);

// ---- One tile -----------------------------------------------------------
const boundaryPolys = boundary.geometry.coordinates;
const tileBox = (x, y, z, pad = 0) => {
  const p = pad / TILE;
  return [tileLon(x - p, z), tileLat(y + 1 + p, z), tileLon(x + 1 + p, z), tileLat(y - p, z)];
};

function ringPath(ring, z, x, y) {
  const scale = TILE * 2 ** z,
    ox = x * TILE,
    oy = y * TILE;
  let d = '',
    lastX = NaN,
    lastY = NaN;
  for (let i = 0; i < ring.length; i += 2) {
    const px = ring[i] * scale - ox,
      py = ring[i + 1] * scale - oy;
    // Skip points closer than 0.3 px to the last one: invisible, but costly.
    if (i > 0 && i < ring.length - 2 && Math.abs(px - lastX) < 0.3 && Math.abs(py - lastY) < 0.3) continue;
    d += `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
    lastX = px;
    lastY = py;
  }
  return d;
}

// The part of Helsinki inside this tile, as an SVG clip path.
// null = tile is completely outside, '' = completely inside (no clip needed).
function helsinkiClip(x, y, z) {
  const [w, s, e, n] = tileBox(x, y, z, 2);
  const rect = [
    [
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ],
  ];
  const inside = polygonClipping.intersection(boundaryPolys, rect);
  if (!inside.length) return null;
  const area = poly =>
    poly.reduce((sum, ring, i) => {
      let a = 0;
      for (let k = 0, j = ring.length - 1; k < ring.length; j = k++)
        a += (ring[j][0] + ring[k][0]) * (ring[j][1] - ring[k][1]);
      return sum + (i ? -1 : 1) * Math.abs(a / 2);
    }, 0);
  const rectArea = (e - w) * (n - s);
  if (inside.reduce((sum, p) => sum + area(p), 0) > rectArea * 0.9999) return '';
  return inside.map(poly => poly.map(r => ringPath(toRing(r), z, x, y) + 'Z').join('')).join('');
}

function tileSvg(x, y, z, theme) {
  const colors = THEMES[theme];
  const clip = helsinkiClip(x, y, z);
  let body = '';
  if (clip !== null) {
    body += `<rect width="${TILE}" height="${TILE}" fill="${colors.sea}"/>`;
    const [w, s, e, n] = tileBox(x, y, z, 8);
    // Shore: all land edges get the sea-side band first, then the land fills cover the
    // land side. Collected here and written before the first non-land shape.
    let shore = [],
      fills = '';
    const flushShore = () => {
      if (!shore.length) return;
      const d = shore.join(''),
        cls = CLASSES.find(c => c.shore);
      body += `<path d="${d}" fill="none" stroke="${colors.shoreWide}" stroke-width="${cls.shore.wide(z).toFixed(2)}" stroke-linejoin="round"/>`;
      body += `<path d="${d}" fill="none" stroke="${colors.shoreNear}" stroke-width="${cls.shore.near(z).toFixed(2)}" stroke-linejoin="round"/>`;
      body += fills;
      shore = [];
      fills = '';
    };
    for (const i of index.search(w, s, e, n).sort((a, b) => a - b)) {
      const f = features[i];
      const cls = CLASSES[f.classIndex];
      if (z < (cls.minZoom ?? 0)) continue;
      if (cls.shore) {
        const d = f.parts.map(p => p.map(r => ringPath(r, z, x, y) + 'Z').join('')).join('');
        shore.push(d);
        fills += `<path d="${d}" fill="${colors[cls.fill]}" fill-rule="evenodd"/>`;
        continue;
      }
      flushShore();
      if (cls.stroke) {
        const d = f.parts.map(p => ringPath(p[0], z, x, y)).join('');
        const width = cls.width(z).toFixed(2);
        body += `<path d="${d}" fill="none" stroke="${colors[cls.stroke]}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (cls.dash)
          body += `<path d="${d}" fill="none" stroke="${colors[cls.dash]}" stroke-width="${(cls.width(z) * 0.45).toFixed(2)}" stroke-dasharray="${(cls.width(z) * 2.5).toFixed(1)} ${(cls.width(z) * 2.5).toFixed(1)}"/>`;
      } else {
        const d = f.parts.map(p => p.map(r => ringPath(r, z, x, y) + 'Z').join('')).join('');
        const casing = cls.outline ? cls.outline(z) : 0;
        if (casing > 0)
          body += `<path d="${d}" fill="${colors[cls.outlineColor]}" stroke="${colors[cls.outlineColor]}" stroke-width="${casing.toFixed(2)}" stroke-linejoin="round" fill-rule="evenodd"/>`;
        const inner =
          casing > 0
            ? ` stroke="${colors[cls.fill]}" stroke-width="${(casing * 0.5).toFixed(2)}" stroke-linejoin="round"`
            : '';
        body += `<path d="${d}" fill="${colors[cls.fill]}"${inner} fill-rule="evenodd"/>`;
        if (cls.texture && z >= TEXTURE_MIN_ZOOM) body += `<path d="${d}" fill="url(#asphalt)" fill-rule="evenodd"/>`;
      }
    }
    flushShore();
  }
  const clipPath = clip ? `<clipPath id="h"><path d="${clip}" clip-rule="evenodd"/></clipPath>` : '';
  const texture = clip !== null && z >= TEXTURE_MIN_ZOOM ? ASPHALT : '';
  const defs = clipPath || texture ? `<defs>${clipPath}${texture}</defs>` : '';
  const group = clip ? `<g clip-path="url(#h)">${body}</g>` : body;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TILE}" height="${TILE}" viewBox="0 0 ${TILE} ${TILE}">` +
    `<rect width="${TILE}" height="${TILE}" fill="${colors.outside}"/>${defs}${group}</svg>`
  );
}

// ---- Render all tiles ---------------------------------------------------
await rm(STAGING, {recursive: true, force: true});
const jobs = [];
const expected = {};
for (const [level, {min, max}] of Object.entries(LEVELS)) {
  const box = level === 'base' ? helsinkiBox : centralBox;
  for (let z = min; z <= Math.min(max, maxZoom); z++) {
    const {x0, x1, y0, y1} = tileRange(box, z);
    for (const theme of themes) {
      expected[`${theme}/${z}`] = (x1 - x0 + 1) * (y1 - y0 + 1);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push({theme, z, x, y});
    }
  }
}
console.log(`Rendering ${jobs.length} tiles (${themes.join(', ')}; zoom 10-${maxZoom})...`);

const written = {};
let bytes = 0,
  done = 0,
  failed = [];
const started = Date.now();
const made = new Set();
async function worker() {
  while (jobs.length) {
    const {theme, z, x, y} = jobs.shift();
    try {
      const dir = new URL(`${theme}/${z}/${x}/`, STAGING);
      const key = dir.href;
      if (!made.has(key)) {
        await mkdir(dir, {recursive: true});
        made.add(key);
      }
      const image = await sharp(Buffer.from(tileSvg(x, y, z, theme)))
        .webp({quality: 82, effort: 4})
        .toBuffer();
      await writeFile(new URL(`${y}.webp`, dir), image);
      bytes += image.length;
      written[`${theme}/${z}`] = (written[`${theme}/${z}`] ?? 0) + 1;
    } catch (error) {
      failed.push(`${theme}/${z}/${x}/${y}: ${error.message}`);
    }
    if (++done % 500 === 0) console.log(`  ${done} tiles, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}
await Promise.all(Array.from({length: 8}, worker));

// ---- Checks -------------------------------------------------------------
const problems = [...failed];
for (const [key, n] of Object.entries(expected))
  if (written[key] !== n) problems.push(`${key}: wrote ${written[key] ?? 0} of ${n} tiles`);

// Alignment: buildings should stand on land, not in the sea or a lake.
const manifest = JSON.parse(await readFile(new URL('public/buildings-manifest.json', ROOT), 'utf8').catch(() => '[]'));
const landGeo = JSON.parse(await readFile(new URL('land.json', RAW), 'utf8')).features;
const guideWater = JSON.parse(await readFile(new URL('guide.json', RAW), 'utf8')).features.filter(f =>
  ['meri', 'joki', 'lampi', 'allas'].includes(f.properties.luokka),
);
const pointIn = (point, list) =>
  list.some(f => {
    const b = bboxOf(f.geometry.coordinates);
    return (
      point[0] >= b[0] && point[0] <= b[2] && point[1] >= b[1] && point[1] <= b[3] && booleanPointInPolygon(point, f)
    );
  });
const offLand = manifest.filter(r => r.address && !pointIn(r.position, landGeo));
const inWater = manifest.filter(r => r.address && pointIn(r.position, guideWater));
const alignment = {
  buildingsChecked: manifest.filter(r => r.address).length,
  notOnLandShape: offLand.length,
  insideWaterShape: inWater.length,
  examplesNotOnLand: offLand.slice(0, 5).map(r => r.address),
  examplesInWater: inWater.slice(0, 5).map(r => r.address),
};

if (problems.length) {
  console.error('Problems; public/ was NOT changed:\n' + problems.slice(0, 20).join('\n'));
  process.exit(1);
}

const meta = {
  generatedAt: new Date().toISOString(),
  tileSize: TILE,
  tilingScheme: 'Web Mercator (EPSG:3857), XYZ',
  format: 'webp',
  themes,
  levels: {
    base: {...LEVELS.base, max: Math.min(LEVELS.base.max, maxZoom), rectangle: helsinkiBox},
    detail:
      maxZoom >= LEVELS.detail.min
        ? {...LEVELS.detail, max: Math.min(LEVELS.detail.max, maxZoom), rectangle: centralBox}
        : null,
  },
  tiles: written,
  bytes,
  shapes: counts,
  alignment,
  sources,
  notes: [
    'Drawn from City of Helsinki open data (CC BY 4.0); only the area inside the Helsinki boundary is drawn.',
    'Planned roads, underground rail and metro, tunnels and power lines are not drawn.',
    'Tram tracks are not in these layers and are not drawn.',
    `Roads from zoom ${TEXTURE_MIN_ZOOM} up carry a drawn asphalt grain; it is a look only, not data.`,
  ],
};
await writeFile(new URL('basemap.json', STAGING), JSON.stringify(meta, null, 2));
await rm(PUBLIC, {recursive: true, force: true});
await cp(STAGING, PUBLIC, {recursive: true});
await datasetSection('basemap', meta);

console.log(
  `\nDone in ${((Date.now() - started) / 1000).toFixed(0)} s: ${Object.values(written).reduce((a, b) => a + b, 0)} tiles, ${(bytes / 1024 / 1024).toFixed(1)} MB.`,
);
for (const theme of themes)
  console.log(
    `  ${theme}: ` +
      Object.entries(written)
        .filter(([k]) => k.startsWith(theme))
        .map(([k, n]) => `z${k.split('/')[1]} ${n}`)
        .join(', '),
  );
console.log(
  `Alignment: ${alignment.notOnLandShape} of ${alignment.buildingsChecked} buildings are not on a land shape, ${alignment.insideWaterShape} are inside a water shape.`,
);
if (alignment.examplesNotOnLand.length) console.log('  not on land, e.g.:', alignment.examplesNotOnLand.join(', '));
if (alignment.examplesInWater.length) console.log('  in water, e.g.:', alignment.examplesInWater.join(', '));
