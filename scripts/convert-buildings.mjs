// Phase 1, step 4: CityGML -> 3D Tiles that the browser can stream.
//
// Input:  data/raw/buildings/<area>/*.gml        (WFS pages or a file you added)
//         data/raw/register/<area>.json          (building register, optional)
//         public/map/helsinki-boundary.json      (from npm run data:boundary)
// Output: public/tileset/tileset.json + *.b3dm   (the 3D buildings)
//         public/buildings-manifest.json         (one record per building)
//         public/dataset.json                    (counts, sources, limits)
//
// Steps for each building:
//   parse XML -> keep highest LOD -> skip planned ones -> keep only if its
//   centre is inside the area AND inside Helsinki -> convert every corner to
//   local metres -> triangulate each polygon -> group into ~500 m tiles.
// Everything is written to data/staging first, checked, and only then copied
// to public/, so a broken run never replaces working files.
//
// Run:  npm run data:convert -- --area=pilot
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {parseCityGml, buildingIds} from './lib/citygml.mjs';
import {triangulatePolygon} from './lib/triangulate.mjs';
import {gridToLonLat} from './lib/geo.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {buildRegisterIndex, joinRegister} from './lib/register-join.mjs';
import {gridPointToLocal, LIMITATIONS} from './lib/tiles.mjs';
import {publishBuildings} from './lib/publish-buildings.mjs';
import {areaBbox, areaFromArgs, AREAS} from './config.mjs';

const CELL = 500; // tile size in metres
const area = areaFromArgs();
const bbox = areaBbox(area);
const root = new URL('../', import.meta.url);
const inputDir = new URL(`data/raw/buildings/${area}/`, root);

const boundary = await loadBoundary().catch(() => {
  throw new Error('Run npm run data:boundary first (public/map/helsinki-boundary.json is missing)');
});

// ---- 1. Read every CityGML file for the area ---------------------------
const files = existsSync(inputDir)
  ? (await readdir(inputDir)).filter(f => f.toLowerCase().endsWith('.gml')).sort()
  : [];
if (!files.length)
  throw new Error(
    `No .gml files in data/raw/buildings/${area}/. Run npm run data:buildings -- --area=${area} or add a CityGML file there.`,
  );

const buildings = new Map();
const report = {
  files: files.length,
  parsed: 0,
  duplicatesDropped: 0,
  planned: 0,
  noGeometry: 0,
  outsideArea: 0,
  outsideHelsinki: 0,
  warnings: [],
  srsNames: new Set(),
};
for (const file of files) {
  const {buildings: found, srsNames, warnings} = parseCityGml(await readFile(new URL(file, inputDir), 'utf8'));
  srsNames.forEach(s => report.srsNames.add(s));
  report.warnings.push(...warnings);
  for (const b of found) {
    report.parsed++;
    b.sourceFile = file;
    const previous = buildings.get(b.id);
    // Same building in two pages/files: keep the higher level of detail.
    if (previous) {
      report.duplicatesDropped++;
      if (b.lod <= previous.lod) continue;
    }
    buildings.set(b.id, b);
  }
}
const badSrs = [...report.srsNames].filter(s => !/3879/.test(s));
if (badSrs.length)
  throw new Error(`Unexpected coordinate system(s): ${badSrs.join(', ')}. This converter expects EPSG:3879.`);
console.log(`Parsed ${report.parsed} building records from ${files.length} file(s); ${buildings.size} unique.`);

// ---- 2. Register (addresses), if downloaded ----------------------------
const registerFile = new URL(`data/raw/register/${area}.json`, root);
const register = existsSync(registerFile) ? JSON.parse(await readFile(registerFile, 'utf8')) : null;
const registerIndex = register ? buildRegisterIndex(register.features) : null;
if (!register) console.warn('No register file; addresses will be empty. Run npm run data:register first.');

// ---- 3. Filter and convert each building -------------------------------
const kept = [];
for (const b of buildings.values()) {
  if (b.planned) {
    report.planned++;
    continue;
  }
  const points = b.polygons.flat(2);
  if (!points.length) {
    report.noGeometry++;
    continue;
  }
  // Representative point: centre of the building's footprint bounding box.
  const xs = points.map(p => p[0]),
    ys = points.map(p => p[1]),
    zs = points.map(p => p[2]);
  const center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  if (center[0] < bbox[0] || center[0] > bbox[2] || center[1] < bbox[1] || center[1] > bbox[3]) {
    report.outsideArea++;
    continue;
  }
  const [lon, lat] = gridToLonLat(center);
  if (!boundary.isInside([lon, lat])) {
    report.outsideHelsinki++;
    continue;
  }

  const ids = buildingIds(b.attributes);
  const joined = registerIndex
    ? joinRegister(ids, registerIndex)
    : {registerJoin: 'register-not-loaded', address: null, addresses: [], addressSv: null, postcode: null, use: null};
  kept.push({
    building: b,
    cell: `${Math.floor(center[0] / CELL)}-${Math.floor(center[1] / CELL)}`,
    record: {
      buildingId: b.id,
      sourceIds: {gmlId: b.id, ratu: ids.ratu, vtjPrt: ids.vtjPrt},
      position: [round(lon, 7), round(lat, 7)],
      heightsN2000: {base: round(Math.min(...zs), 2), top: round(Math.max(...zs), 2)},
      ...joined,
      lod: b.lod,
      buildingParts: b.parts,
      geometrySource: b.sourceFile.startsWith('wfs-') ? 'helsinki-citydb-wfs' : `citygml-file:${b.sourceFile}`,
    },
  });
}
function round(v, digits) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
if (!kept.length) throw new Error('No buildings left after filtering; check the area and boundary.');

// ---- 4. Triangulate, write tiles, check, publish -----------------------
const items = kept.map(({building, record, cell}) => ({
  record,
  cell,
  meshes: building.polygons.map(rings => {
    const result = triangulatePolygon(rings.map(ring => ring.map(gridPointToLocal)));
    return result
      ? {positions: result.positions, normals: result.positions.map(() => result.normal), indices: result.indices}
      : {positions: [], normals: [], indices: []};
  }),
}));

const provenanceFile = new URL('provenance.json', inputDir);
const provenance = existsSync(provenanceFile) ? JSON.parse(await readFile(provenanceFile, 'utf8')) : null;
if (report.warnings.length)
  await writeFile(new URL(`data/raw/buildings/${area}-warnings.txt`, root), report.warnings.join('\n'));
await publishBuildings({
  root,
  items,
  boundary,
  dataset: {
    coverage: {
      areas: {[area]: {...AREAS[area], bbox3879: bbox}},
      rule: 'A building is included when the centre of its bounding box is inside the area square and inside the Helsinki boundary.',
    },
    counts: {
      skipped: {
        duplicates: report.duplicatesDropped,
        planned: report.planned,
        noGeometry: report.noGeometry,
        outsideArea: report.outsideArea,
        outsideHelsinki: report.outsideHelsinki,
      },
      warnings: report.warnings.length,
    },
    sources: {
      buildings: provenance ?? {note: 'CityGML file(s) added manually', files},
      register: register
        ? {
            layer: 'avoindata:Rakennukset_alue_rekisteritiedot',
            retrievedAt: register.retrievedAt,
            license: 'City of Helsinki, CC BY 4.0',
          }
        : null,
      boundary: boundary.properties.source,
    },
    limitations: LIMITATIONS,
  },
});
console.log(
  `Skipped: ${JSON.stringify({duplicates: report.duplicatesDropped, planned: report.planned, noGeometry: report.noGeometry, outsideArea: report.outsideArea, outsideHelsinki: report.outsideHelsinki})}; ${report.warnings.length} geometry warnings.`,
);
