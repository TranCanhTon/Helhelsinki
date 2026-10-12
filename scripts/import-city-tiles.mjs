// Phase 1, alternative source: the city's published LOD2 building tiles.
//
// Use this when the CityGML WFS is down. Same official city model, same
// building IDs, published by the city as 3D tiles for its own 3D map:
//   https://kartta.hel.fi/3d/datasource-data/16fc3fd5-df6d-4f48-bfd5-9aeee430a02f/tileset.json
//   (layer "Rakennukset (LOD2)", City of Helsinki, CC BY 4.0)
//
// Steps:
//   1. read the city's tileset.json and find the tiles that overlap the area
//   2. download those tiles (cached in data/raw/buildings/<area>/city-tiles/)
//   3. take every building out of them, keep it only if its centre is inside
//      the area AND inside Helsinki, and rebuild our own tiles + manifest
//
// Run:  npm run data:city-tiles -- --area=pilot
//   or, with a bundle file prepared in the browser:
//       npm run data:city-tiles -- --area=pilot --bundle=path/to/bundle.json
import {readFile, writeFile, mkdir, access, readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {getJson, request} from './lib/http.mjs';
import {readCityTile, ecefToGeodetic} from './lib/city-tiles.mjs';
import {lonLatToGrid, gridToLonLat} from './lib/geo.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {buildRegisterIndex, joinRegister} from './lib/register-join.mjs';
import {FRAME, LIMITATIONS} from './lib/tiles.mjs';
import {publishBuildings} from './lib/publish-buildings.mjs';
import {areaBbox, areaFromArgs, AREAS} from './config.mjs';

export const CITY_LOD2_TILESET = 'https://kartta.hel.fi/3d/datasource-data/16fc3fd5-df6d-4f48-bfd5-9aeee430a02f/tileset.json';
const CELL = 500;

const area = areaFromArgs();
const bbox = areaBbox(area);
const bundlePath = process.argv.find(a => a.startsWith('--bundle='))?.slice(9);
const root = new URL('../', import.meta.url);
const tileDir = new URL(`data/raw/buildings/${area}/city-tiles/`, root);
const registerFile = new URL(`data/raw/register/${area}.json`, root);
await mkdir(tileDir, {recursive: true});
await mkdir(new URL('data/raw/register/', root), {recursive: true});
const exists = path => access(path).then(() => true, () => false);
const fileFor = uri => new URL(uri.replaceAll('/', '_'), tileDir);
const boundary = await loadBoundary().catch(() => { throw new Error('Run npm run data:boundary first.'); });

// ---- 1 + 2. Get the tiles ------------------------------------------------
let source;
if (bundlePath) {
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  for (const tile of bundle.tiles) await writeFile(fileFor(tile.uri), Buffer.from(tile.base64, 'base64'));
  if (bundle.register) {
    await writeFile(registerFile, JSON.stringify({area, requests: [bundle.register.request], retrievedAt: bundle.register.retrievedAt, total: bundle.register.totalFeatures, features: bundle.register.features}));
    if (bundle.register.features.length !== bundle.register.totalFeatures) throw new Error('Bundle register is incomplete');
  }
  source = {...bundle.source, retrievedAt: bundle.createdAt, tiles: bundle.tiles.map(t => t.uri), via: 'browser bundle'};
  console.log(`Unpacked ${bundle.tiles.length} tiles and ${bundle.register?.features.length ?? 0} register records from the bundle.`);
} else {
  const tileset = await getJson(CITY_LOD2_TILESET);
  const base = new URL('./', CITY_LOD2_TILESET);
  // The city's tiles use "region" bounds: [west, south, east, north] in radians.
  const [w, s] = gridToLonLat([bbox[0], bbox[1]]), [e, n] = gridToLonLat([bbox[2], bbox[3]]);
  const box = [w, s, e, n].map(v => v * Math.PI / 180);
  const uris = [];
  const walk = node => {
    const r = node.boundingVolume?.region;
    if (r && (r[2] < box[0] || r[0] > box[2] || r[3] < box[1] || r[1] > box[3])) return;
    // Only the most detailed tiles (geometricError 0); parents hold simplified copies.
    if (node.content?.uri && node.geometricError === 0) uris.push(node.content.uri);
    (node.children ?? []).forEach(walk);
  };
  walk(tileset.root);
  console.log(`${uris.length} city tiles overlap area "${area}".`);
  for (const uri of uris) {
    if (await exists(fileFor(uri))) continue;
    const response = await request(new URL(uri, base), {timeoutMs: 120000});
    if (!response.ok) throw new Error(`Tile ${uri}: HTTP ${response.status}`);
    await writeFile(fileFor(uri), Buffer.from(await response.arrayBuffer()));
    console.log(`  downloaded ${uri}`);
  }
  source = {tileset: CITY_LOD2_TILESET, tilesetVersion: tileset.asset?.tilesetVersion, layer: 'Rakennukset_LOD2', license: 'City of Helsinki, CC BY 4.0', retrievedAt: new Date().toISOString(), tiles: uris};
}
await writeFile(new URL('source.json', tileDir), JSON.stringify(source, null, 2));

// ---- 3. Buildings out of the tiles --------------------------------------
const register = existsSync(registerFile) ? JSON.parse(await readFile(registerFile, 'utf8')) : null;
const registerIndex = register ? buildRegisterIndex(register.features) : null;
if (!register) console.warn('No register file; run npm run data:register -- --area=' + area);

const found = new Map();
const report = {duplicates: 0, outsideArea: 0, outsideHelsinki: 0, tiles: 0};
for (const file of (await readdir(tileDir)).filter(f => f.endsWith('.b3dm')).sort()) {
  const {rows, buildings} = readCityTile(await readFile(new URL(file, tileDir)));
  report.tiles++;
  for (const [batchId, geometry] of buildings) {
    // Building parts point to their parent row; merge them into the parent building.
    let row = rows[batchId];
    while (row.parent >= 0) row = rows[row.parent];
    const entry = found.get(row.id) ?? {row, parts: [], file};
    // The same building in a second tile would be drawn twice: keep the first copy.
    if (entry.file !== file) { report.duplicates++; continue; }
    entry.parts.push(geometry);
    found.set(row.id, entry);
  }
}

const items = [];
for (const [id, {row, parts}] of found) {
  const geodetic = parts.flatMap(p => p.positions.map(ecefToGeodetic));
  const lons = geodetic.map(g => g[0]), lats = geodetic.map(g => g[1]), hs = geodetic.map(g => g[2]);
  const position = [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
  const [east, north] = lonLatToGrid(position);
  if (east < bbox[0] || east > bbox[2] || north < bbox[1] || north > bbox[3]) { report.outsideArea++; continue; }
  if (!boundary.isInside(position)) { report.outsideHelsinki++; continue; }

  const a = row.attributes ?? {};
  const ids = {ratu: Number(a.RATU) > 0 ? String(Number(a.RATU)) : null, vtjPrt: a.VTJ_PRT?.trim() || null};
  let joined = registerIndex ? joinRegister(ids, registerIndex) : {registerJoin: 'register-not-loaded', address: null, addresses: [], addressSv: null, postcode: null, use: null};
  if (!joined.address && a.Address?.Street) {
    // The city model carries an address too; use it only when the register has none.
    const address = [a.Address.Street, a.Address.HouseNumber].filter(Boolean).join(' ');
    joined = {...joined, registerJoin: `${joined.registerJoin}; address from city model`, address, addresses: [address], postcode: a.Address.PostalCode ?? null};
  }
  items.push({
    cell: `${Math.floor(east / CELL)}-${Math.floor(north / CELL)}`,
    record: {
      buildingId: id,
      sourceIds: {gmlId: id, ...ids},
      position: position.map(v => Math.round(v * 1e7) / 1e7),
      heightsN2000: {base: Math.round(Math.min(...hs) * 100) / 100, top: Math.round(Math.max(...hs) * 100) / 100},
      ...joined,
      lod: 2,
      buildingParts: parts.length > 1 ? parts.length : 0,
      geometrySource: 'helsinki-lod2-3dtiles',
    },
    meshes: parts.map(part => ({
      positions: part.positions.map(p => FRAME.toLocal(p)),
      normals: part.normals.map(n => {
        const v = n ? FRAME.toLocalVector(n) : [0, 0, 1];
        const l = Math.hypot(...v) || 1;
        return v.map(c => c / l);
      }),
      indices: part.triangles.flat(),
    })),
  });
}
console.log(`${found.size} buildings in ${report.tiles} tiles (${report.duplicates} duplicate copies skipped); ${items.length} inside area "${area}" and Helsinki (outside area: ${report.outsideArea}, outside Helsinki: ${report.outsideHelsinki}).`);

await publishBuildings({
  root,
  items,
  boundary,
  dataset: {
    coverage: {
      areas: {[area]: {...AREAS[area], bbox3879: bbox}},
      rule: 'A building is included when the centre of its bounding box is inside the area square and inside the Helsinki boundary.',
    },
    counts: {skipped: {duplicates: report.duplicates, outsideArea: report.outsideArea, outsideHelsinki: report.outsideHelsinki}},
    sources: {
      buildings: source,
      register: register ? {layer: 'avoindata:Rakennukset_alue_rekisteritiedot', retrievedAt: register.retrievedAt, license: 'City of Helsinki, CC BY 4.0'} : null,
      boundary: boundary.properties.source,
    },
    limitations: [
      ...LIMITATIONS,
      'Geometry comes from the city\'s published LOD2 3D tiles (same city model as the CityGML service), because the CityGML WFS was unavailable.',
    ],
  },
});
