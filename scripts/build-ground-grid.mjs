// Ground heights under the buildings, for the textured city buildings.
//
// The city's textured buildings stand at their real height (base about 17 to 80 m
// above the ellipsoid); our ground map is flat at 0. The map lowers every textured
// vertex by the value of this grid under it (src/map/buildings.js).
//
// Grid: 20 m cells in our tile frame (east/north metres from ORIGIN). A cell gets the
// HIGHEST base height (groundOffsetM) of every building whose footprint box (grown by
// MARGIN_M) touches it, rounded up. Lowering by at least a building's own base means it
// can sink a little into the flat ground but never floats. Footprint boxes come from
// our own grey tiles (data:city-tiles). One byte per cell: 0 = no building, otherwise
// ceil((height - MIN_M) / STEP_M) + 1.
// Writes public/ground-grid.bin and public/ground-grid.json.
import {readFile, writeFile} from 'node:fs/promises';
import {readJson, publishJson, ROOT, datasetSection} from './lib/prepare.mjs';
import {decodeB3dm} from './lib/b3dm.mjs';
import {fromGltfAxes, ORIGIN} from './lib/tiles.mjs';
import {contentTiles} from './lib/split-buildings.mjs';

const CELL_M = 10,
  MIN_M = -10,
  STEP_M = 0.5,
  MARGIN_M = 1;
const manifest = await readJson('public/buildings-manifest.json');
const tileset = await readJson('public/tileset/tileset.json');

// Footprint box per building, in the tile frame.
const boxes = [];
const byTile = new Map();
for (const r of manifest) {
  if (!byTile.has(r.tileContentUri)) byTile.set(r.tileContentUri, []);
  byTile.get(r.tileContentUri).push(r);
}
for (const tile of contentTiles(tileset)) {
  const uri = tile.content.uri,
    records = byTile.get(uri) ?? [];
  const decoded = decodeB3dm(await readFile(new URL('public/tileset/' + uri, ROOT)));
  const box = records.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
  for (let v = 0; v < decoded.batchIds.length; v++) {
    const [e, n] = fromGltfAxes([decoded.positions[v * 3], decoded.positions[v * 3 + 1], decoded.positions[v * 3 + 2]]);
    const b = box[decoded.batchIds[v]];
    b[0] = Math.min(b[0], e);
    b[1] = Math.min(b[1], n);
    b[2] = Math.max(b[2], e);
    b[3] = Math.max(b[3], n);
  }
  for (const r of records) boxes.push({box: box[r.tileFeatureId], ground: r.groundOffsetM});
}
if (boxes.length !== manifest.length) throw new Error(`Footprints for ${boxes.length} of ${manifest.length} buildings`);

const all = boxes.reduce(
  (a, {box}) => [Math.min(a[0], box[0]), Math.min(a[1], box[1]), Math.max(a[2], box[2]), Math.max(a[3], box[3])],
  [Infinity, Infinity, -Infinity, -Infinity],
);
const minE = Math.floor(all[0] / CELL_M) * CELL_M - CELL_M,
  minN = Math.floor(all[1] / CELL_M) * CELL_M - CELL_M;
const width = Math.ceil((all[2] - minE) / CELL_M) + 2,
  height = Math.ceil((all[3] - minN) / CELL_M) + 2;
const highest = new Float32Array(width * height).fill(-Infinity);
for (const {box, ground} of boxes) {
  const x0 = Math.floor((box[0] - MARGIN_M - minE) / CELL_M),
    x1 = Math.floor((box[2] + MARGIN_M - minE) / CELL_M);
  const y0 = Math.floor((box[1] - MARGIN_M - minN) / CELL_M),
    y1 = Math.floor((box[3] + MARGIN_M - minN) / CELL_M);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (ground > highest[i]) highest[i] = ground;
    }
}
const grid = new Uint8Array(width * height);
let filled = 0,
  clipped = 0;
for (let i = 0; i < grid.length; i++) {
  if (highest[i] === -Infinity) continue;
  let value = Math.ceil((highest[i] - MIN_M) / STEP_M) + 1;
  if (value < 1 || value > 255) {
    clipped++;
    value = Math.min(255, Math.max(1, value));
  }
  grid[i] = value;
  filled++;
}
const grounds = boxes.map(b => b.ground).sort((a, b) => a - b);
const meta = {
  schemaVersion: 1,
  origin: ORIGIN,
  cellM: CELL_M,
  minE,
  minN,
  width,
  height,
  minM: MIN_M,
  stepM: STEP_M,
  // Used where a textured vertex falls in an empty cell (should not happen).
  fallbackM: grounds[Math.floor(grounds.length / 2)],
  rows: 'row 0 is the southernmost; value 0 = no building',
  buildings: boxes.length,
  cellsWithBuildings: filled,
  clipped,
};
await writeFile(new URL('public/ground-grid.bin', ROOT), grid);
await publishJson('public/ground-grid.json', meta);
await datasetSection('groundGrid', {
  ...meta,
  method:
    'Highest groundOffsetM (rounded up) of every building whose footprint box (from our LOD2 tiles, grown by ' +
    MARGIN_M +
    ' m) touches the cell.',
});
console.log(
  `Ground grid ${width} x ${height} cells of ${CELL_M} m, ${filled} with buildings, ${(grid.length / 1048576).toFixed(1)} MB; median base ${meta.fallbackM} m; clipped ${clipped}.`,
);
