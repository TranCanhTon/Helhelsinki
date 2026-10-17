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
import {buildRegisterIndex, joinRegister, yearFromDate, EMPTY_FACTS} from './lib/register-join.mjs';
import {CLASS} from './lib/register-codes.mjs';
import {pointFinder} from './lib/point-finder.mjs';
import {FRAME, LIMITATIONS, N2000_LIMITATION} from './lib/tiles.mjs';
import {publishBuildings} from './lib/publish-buildings.mjs';
import {areaBbox, areaFromArgs, areaInsideTest, areaDistrictOf, AREAS} from './config.mjs';

export const CITY_LOD2_TILESET =
  'https://kartta.hel.fi/3d/datasource-data/16fc3fd5-df6d-4f48-bfd5-9aeee430a02f/tileset.json';
const CELL = 500;
const GROUNDED_LIMITATION =
  'There is no terrain model. Each building is lowered by its own lowest point (groundOffsetM) so it stands on the flat ground map; heightsN2000 keeps the source heights. On a slope the uphill side can sit slightly above the ground, and neighbouring buildings on different ground levels show steps.';

// "Up" at a longitude/latitude: the direction heights are measured in (unit ECEF vector).
const upAt = ([lon, lat]) => {
  const r = Math.PI / 180;
  return [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)];
};

const area = areaFromArgs();
const bbox = areaBbox(area);
const insideArea = areaInsideTest(area);
const districtOf = areaDistrictOf(area);
const bundlePath = process.argv.find(a => a.startsWith('--bundle='))?.slice(9);
const root = new URL('../', import.meta.url);
const tileDir = new URL(`data/raw/buildings/${area}/city-tiles/`, root);
const registerFile = new URL(`data/raw/register/${area}.json`, root);
await mkdir(tileDir, {recursive: true});
await mkdir(new URL('data/raw/register/', root), {recursive: true});
const exists = path =>
  access(path).then(
    () => true,
    () => false,
  );
const fileFor = uri => new URL(uri.replaceAll('/', '_'), tileDir);
const boundary = await loadBoundary().catch(() => {
  throw new Error('Run npm run data:boundary first.');
});

// ---- 1 + 2. Get the tiles ------------------------------------------------
let source;
if (bundlePath) {
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  for (const tile of bundle.tiles) await writeFile(fileFor(tile.uri), Buffer.from(tile.base64, 'base64'));
  if (bundle.register) {
    await writeFile(
      registerFile,
      JSON.stringify({
        area,
        requests: [bundle.register.request],
        retrievedAt: bundle.register.retrievedAt,
        total: bundle.register.totalFeatures,
        features: bundle.register.features,
      }),
    );
    if (bundle.register.features.length !== bundle.register.totalFeatures)
      throw new Error('Bundle register is incomplete');
  }
  source = {
    ...bundle.source,
    retrievedAt: bundle.createdAt,
    tiles: bundle.tiles.map(t => t.uri),
    via: 'browser bundle',
  };
  console.log(
    `Unpacked ${bundle.tiles.length} tiles and ${bundle.register?.features.length ?? 0} register records from the bundle.`,
  );
} else {
  const tileset = await getJson(CITY_LOD2_TILESET);
  const base = new URL('./', CITY_LOD2_TILESET);
  // The city's tiles use "region" bounds: [west, south, east, north] in radians.
  const [w, s] = gridToLonLat([bbox[0], bbox[1]]),
    [e, n] = gridToLonLat([bbox[2], bbox[3]]);
  const box = [w, s, e, n].map(v => (v * Math.PI) / 180);
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
  source = {
    tileset: CITY_LOD2_TILESET,
    tilesetVersion: tileset.asset?.tilesetVersion,
    layer: 'Rakennukset_LOD2',
    license: 'City of Helsinki, CC BY 4.0',
    retrievedAt: new Date().toISOString(),
    tiles: uris,
  };
}
await writeFile(new URL('source.json', tileDir), JSON.stringify(source, null, 2));

// ---- 3. Buildings out of the tiles --------------------------------------
// Two passes, so the whole city fits in memory. Pass 1 reads every city tile but
// keeps only what each building is and where it stands; its shape is dropped with
// the tile. Pass 2 builds our 500 m cells one at a time and reads the shapes again
// from the few city tiles each cell needs.
const register = existsSync(registerFile) ? JSON.parse(await readFile(registerFile, 'utf8')) : null;
const registerIndex = register ? buildRegisterIndex(register.features) : null;
if (!register) console.warn('No register file; run npm run data:register -- --area=' + area);

// Plan protection: match on the building number first, then by location.
const protectedFile = new URL(`data/raw/register/${area}-protected.json`, root);
const protectedAreas = existsSync(protectedFile) ? JSON.parse(await readFile(protectedFile, 'utf8')) : null;
if (!protectedAreas) console.warn('No plan protection file; run npm run data:register -- --area=' + area);
const protectedByNumber = new Map();
for (const f of protectedAreas?.features ?? []) {
  const number = String(f.properties.pys_raknro ?? '').trim();
  if (number) protectedByNumber.set(number, f);
}
const protectedAt = pointFinder(protectedAreas?.features ?? []);
const protectionOf = (ratu, position) => {
  const f = (ratu && protectedByNumber.get(ratu)) || protectedAt(position);
  if (!f) return null;
  const p = f.properties;
  const rule = [1, 2, 3, 4, 5, 6]
    .map(i => p[i === 1 ? 'kaavaselitys' : `kaavaselitys${i}`])
    .filter(Boolean)
    .join('')
    .trim();
  return {
    marking: [p.s_merk, p.s_merk_2].filter(Boolean).join(', ') || null,
    plan: p.kaava ?? null,
    inForce: p.voimaantulo_pvm ?? null,
    ruleFi: rule || null,
    matchedBy: ratu && protectedByNumber.get(ratu) === f ? 'building number' : 'location',
  };
};

// Sub-districts (e.g. Kalasatama), from npm run data:boundary.
const subdistrictFile = new URL('data/raw/boundary/Maavesi_osa_alueet.json', root);
const subdistricts = existsSync(subdistrictFile) ? JSON.parse(await readFile(subdistrictFile, 'utf8')).features : [];
if (!subdistricts.length) console.warn('No sub-districts; run npm run data:boundary');
const subdistrictAt = pointFinder(subdistricts);
const subdistrictOf = position => subdistrictAt(position)?.properties ?? null;

// Building parts point to their parent row; they belong to the parent building.
const rootRow = (rows, batchId) => {
  let row = rows[batchId];
  while (row.parent >= 0) row = rows[row.parent];
  return row;
};
const files = (await readdir(tileDir)).filter(f => f.endsWith('.b3dm')).sort();

// Pass 1: per building its source tile, ground, top and footprint box.
const found = new Map();
const report = {duplicates: 0, outsideArea: 0, outsideHelsinki: 0, tiles: 0};
for (const file of files) {
  const {rows, buildings} = readCityTile(await readFile(new URL(file, tileDir)));
  report.tiles++;
  for (const [batchId, geometry] of buildings) {
    const row = rootRow(rows, batchId);
    const entry = found.get(row.id) ?? {
      row,
      file,
      parts: 0,
      ground: Infinity,
      top: -Infinity,
      box: [Infinity, Infinity, -Infinity, -Infinity],
    };
    // The same building in a second tile would be drawn twice: keep the first copy.
    if (entry.file !== file) {
      report.duplicates++;
      continue;
    }
    entry.parts++;
    for (const p of geometry.positions) {
      const [lon, lat, h] = ecefToGeodetic(p);
      entry.ground = Math.min(entry.ground, h);
      entry.top = Math.max(entry.top, h);
      entry.box[0] = Math.min(entry.box[0], lon);
      entry.box[1] = Math.min(entry.box[1], lat);
      entry.box[2] = Math.max(entry.box[2], lon);
      entry.box[3] = Math.max(entry.box[3], lat);
    }
    found.set(row.id, entry);
  }
  if (report.tiles % 100 === 0) console.log(`  read ${report.tiles} / ${files.length} city tiles`);
}

const keep = [];
for (const [id, {row, file, parts, ground, top, box}] of found) {
  const position = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  if (!insideArea(position)) {
    report.outsideArea++;
    continue;
  }
  if (!boundary.isInside(position)) {
    report.outsideHelsinki++;
    continue;
  }
  const [east, north] = lonLatToGrid(position);
  // Our ground map lies at height 0 and there is no terrain, so a building drawn
  // at its N2000 height floats above its footprint (median 17 m in the centre).
  // Lower each building by its own lowest point so its base sits on the ground.
  const lowered = upAt(position).map(c => c * ground);
  const district = districtOf(position);

  const a = row.attributes ?? {};
  const ids = {ratu: Number(a.RATU) > 0 ? String(Number(a.RATU)) : null, vtjPrt: a.VTJ_PRT?.trim() || null};
  let joined = registerIndex
    ? joinRegister(ids, registerIndex)
    : {
        registerJoin: 'register-not-loaded',
        address: null,
        addresses: [],
        addressSv: null,
        postcode: null,
        use: null,
        useEn: null,
        yearBuilt: null,
        facts: EMPTY_FACTS,
      };
  if (!joined.address && a.Address?.Street) {
    // The city model carries an address too; use it only when the register has none.
    const address = [a.Address.Street, a.Address.HouseNumber].filter(Boolean).join(' ');
    joined = {
      ...joined,
      registerJoin: `${joined.registerJoin}; address from city model`,
      address,
      addresses: [address],
      postcode: a.Address.PostalCode ?? null,
    };
  }
  keep.push({
    id,
    file,
    lowered,
    cell: `${Math.floor(east / CELL)}-${Math.floor(north / CELL)}`,
    record: {
      buildingId: id,
      sourceIds: {gmlId: id, ...ids},
      position: position.map(v => Math.round(v * 1e7) / 1e7),
      // Source heights, kept as they are. The drawn building is lowered by groundOffsetM.
      heightsN2000: {base: Math.round(ground * 100) / 100, top: Math.round(top * 100) / 100},
      groundOffsetM: Math.round(ground * 100) / 100,
      ...joined,
      // The city model carries a few facts of its own. The register wins when both have one.
      yearBuilt: joined.yearBuilt ?? yearFromDate(a.yearOfConstruction),
      yearSource: joined.yearBuilt ? 'register' : yearFromDate(a.yearOfConstruction) ? 'city 3D model' : null,
      facts: {
        ...joined.facts,
        floors: joined.facts.floors ?? (Number(a.storeysAboveGround) > 0 ? Number(a.storeysAboveGround) : null),
      },
      // From the geometry: lowest to highest point. The model's measuredHeight agrees
      // for 98% of buildings, but some are plainly wrong (0.9 m for 15 floors).
      heightM: Math.round((top - ground) * 10) / 10,
      classFi: a.class ?? null,
      classEn: a.class ? (CLASS[a.class] ?? null) : null,
      protection: protectionOf(ids.ratu, position),
      district: district ? {id: district.id, nameFi: district.nameFi, nameSv: district.nameSv} : null,
      subdistrict: (s => (s ? {id: s.tunnus, nameFi: s.nimi_fi, nameSv: s.nimi_se} : null))(subdistrictOf(position)),
      lod: 2,
      buildingParts: parts > 1 ? parts : 0,
      geometrySource: 'helsinki-lod2-3dtiles',
    },
  });
}
found.clear();
console.log(
  `${keep.length + report.outsideArea + report.outsideHelsinki} buildings in ${report.tiles} tiles (${report.duplicates} duplicate copies skipped); ${keep.length} inside area "${area}" and Helsinki (outside area: ${report.outsideArea}, outside Helsinki: ${report.outsideHelsinki}).`,
);

// Pass 2: shapes again, one cell at a time. The last TILE_CACHE city tiles stay decoded.
const TILE_CACHE = 24;
const decoded = new Map();
let decodes = 0;
const shapesIn = async file => {
  if (decoded.has(file)) {
    const v = decoded.get(file);
    decoded.delete(file);
    decoded.set(file, v);
    return v;
  }
  const {rows, buildings} = readCityTile(await readFile(new URL(file, tileDir)));
  decodes++;
  const byBuilding = new Map();
  for (const [batchId, geometry] of buildings) {
    const id = rootRow(rows, batchId).id;
    if (!byBuilding.has(id)) byBuilding.set(id, []);
    byBuilding.get(id).push(geometry);
  }
  decoded.set(file, byBuilding);
  if (decoded.size > TILE_CACHE) decoded.delete(decoded.keys().next().value);
  return byBuilding;
};
const byCell = new Map();
for (const k of keep) {
  if (!byCell.has(k.cell)) byCell.set(k.cell, []);
  byCell.get(k.cell).push(k);
}
async function* cells() {
  for (const [cell, list] of [...byCell].sort(([a], [b]) => a.localeCompare(b))) {
    const items = [];
    for (const {id, file, lowered, record} of list) {
      const parts = (await shapesIn(file)).get(id);
      items.push({
        record,
        meshes: parts.map(part => ({
          positions: part.positions.map(p => FRAME.toLocal([p[0] - lowered[0], p[1] - lowered[1], p[2] - lowered[2]])),
          normals: part.normals.map(n => {
            const v = n ? FRAME.toLocalVector(n) : [0, 0, 1];
            const l = Math.hypot(...v) || 1;
            return v.map(c => c / l);
          }),
          indices: part.triangles.flat(),
        })),
      });
    }
    yield [cell, items];
  }
}

await publishBuildings({
  root,
  cells: cells(),
  boundary,
  dataset: {
    coverage: {
      areas: {[area]: {...AREAS[area], bbox3879: bbox}},
      rule: 'A building is included when the centre of its bounding box is inside the area (a square, or the listed district shapes) and inside the Helsinki boundary.',
    },
    counts: {
      skipped: {
        duplicates: report.duplicates,
        outsideArea: report.outsideArea,
        outsideHelsinki: report.outsideHelsinki,
      },
    },
    sources: {
      buildings: source,
      register: register
        ? {
            layer: 'avoindata:Rakennukset_alue_rekisteritiedot',
            retrievedAt: register.retrievedAt,
            license: 'City of Helsinki, CC BY 4.0',
          }
        : null,
      planProtection: protectedAreas
        ? {
            layer: 'avoindata:Asemakaavoissa_suojellut_rakennukset_alue',
            retrievedAt: protectedAreas.retrievedAt,
            license: 'City of Helsinki, CC BY 4.0',
          }
        : null,
      subdistricts: subdistricts.length
        ? {layer: 'avoindata:Maavesi_osa_alueet', license: 'City of Helsinki, CC BY 4.0'}
        : null,
      boundary: boundary.properties.source,
    },
    limitations: [
      ...LIMITATIONS.filter(l => l !== N2000_LIMITATION),
      GROUNDED_LIMITATION,
      "Geometry comes from the city's published LOD2 3D tiles (same city model as the CityGML service), because the CityGML WFS was unavailable.",
    ],
  },
});
console.log(`City tiles decoded in pass 2: ${decodes}.`);
