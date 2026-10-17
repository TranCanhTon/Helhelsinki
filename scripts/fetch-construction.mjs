// Construction work near buildings: digging notices and street area rentals.
//
// 1. Downloads both city WFS layers fresh every run (the city updates them several
//    times a day). Raw copies go to data/raw/construction/.
// 2. Groups areas into works: one permit at one address with one date range
//    (area rentals can have several of each).
// 3. Drops works that are already over and areas outside Helsinki.
// 4. Sorts each work into heavy, medium or light (src/data/construction.js). Works no rule
//    recognises (unknown) are left out and only counted.
// 5. Writes public/construction.json. The map works out what is near a building when
//    you open it, so this does not need to run again after data:city-tiles.
// Temporary traffic arrangements (mostly events and parking trials) and the old
// Winkki layers are left out on purpose.
import {fetchAllFeatures} from './lib/wfs.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {writeJson, readJson, publishJson, datasetSection} from './lib/prepare.mjs';
import {simplify} from './lib/simplify.mjs';
import {
  PERMIT_KINDS,
  CONSTRUCTION_LEVELS,
  LEVEL_KEYS,
  RULES,
  classify,
  mainPurpose,
  helsinkiToday,
  nearbyIndex,
} from '../src/data/construction.js';

const today = helsinkiToday();
const boundary = await loadBoundary();
const round = ([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];
const ringCentre = ring => {
  const xs = ring.map(p => p[0]),
    ys = ring.map(p => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
};

const works = new Map();
const counts = {areas: 0, over: 0, outside: 0, noDates: 0, unknown: 0};
const sources = {};
for (const [kind, {layer}] of Object.entries(PERMIT_KINDS)) {
  const raw = await fetchAllFeatures({typeName: 'avoindata:' + layer, pageSize: 2000, sortBy: 'id'});
  await writeJson(`data/raw/construction/${layer}.json`, raw);
  sources[kind] = {layer: 'avoindata:' + layer, records: raw.total, retrievedAt: raw.retrievedAt};
  for (const f of raw.features) {
    const p = f.properties;
    counts.areas++;
    if (f.geometry?.type !== 'Polygon' && f.geometry?.type !== 'MultiPolygon')
      throw new Error(`${layer} ${f.id}: no polygon geometry`);
    if (!p.tyo_alkaa && !p.tyo_paattyy) {
      counts.noDates++;
      continue;
    }
    if (p.tyo_paattyy && p.tyo_paattyy < today) {
      counts.over++;
      continue;
    }
    const all = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const inside = all.filter(polygon => boundary.isInside(ringCentre(polygon[0])));
    counts.outside += all.length - inside.length;
    const polygons = inside.map(polygon =>
      polygon.map(ring => {
        const s = simplify(ring, 0.5);
        return (s.length >= 4 ? s : ring).map(round);
      }),
    );
    if (!polygons.length) continue;
    const address = p.osoite?.trim() || null;
    const key = [p.hakemustunnus, p.tyo_alkaa, p.tyo_paattyy, address].join('|');
    const work = works.get(key);
    if (work) {
      work.polygons.push(...polygons);
      continue;
    }
    const {level, rule} = classify(p.tyon_tarkoitus);
    works.set(key, {
      id: p.hakemustunnus,
      kind,
      level,
      rule,
      start: p.tyo_alkaa ?? null,
      end: p.tyo_paattyy ?? null,
      address,
      district: p.kaupunginosa ?? null,
      purpose: mainPurpose(p.tyon_tarkoitus) || null,
      polygons,
    });
  }
}
const unknown = [...works.values()].filter(w => w.level === 'unknown');
counts.unknown = unknown.length;
const list = [...works.values()]
  .filter(w => w.level !== 'unknown')
  .sort((a, b) => a.id.localeCompare(b.id) || String(a.start).localeCompare(String(b.start)));
const byLevel = Object.fromEntries(LEVEL_KEYS.map(k => [k, list.filter(w => w.level === k).length]));
const upcoming = list.filter(w => w.start > today).length;
console.log('areas', counts, 'works', list.length, byLevel, 'upcoming', upcoming);

// How many buildings have work within 200 m (for dataset.json).
const near = nearbyIndex(list, 200);
const manifest = await readJson('public/buildings-manifest.json');
const summary = {withWork: 0, withHeavy: 0};
for (const record of manifest) {
  const found = near(record.position, today);
  if (found.length) summary.withWork++;
  if (found.some(n => n.work.level === 'heavy')) summary.withHeavy++;
}

const source = {
  wfs: 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs',
  license: 'City of Helsinki, CC BY 4.0',
  dataset: 'Yleisten alueiden tapahtuma- ja maankäyttölupajärjestelmä (HRI)',
  layers: sources,
  preparedFor: today,
};
const method =
  'Areas grouped into works (permit, address, dates). Works whose end date has passed are left out; the status field is not used. ' +
  'Heavy, medium or light from keyword rules on the purpose text with later change notes cut off; first matching rule wins; no match = unknown, left out. ' +
  'Distance = straight line from the building centre to the nearest edge of a work area. Not a noise level. Private sites that rent no street space are missing.';
await publishJson('public/construction.json', {
  schemaVersion: 1,
  source,
  method,
  radiusM: 200,
  levels: CONSTRUCTION_LEVELS,
  rules: RULES.map(([level, label]) => ({level, label})),
  // kind: dig | rent; rule: index in rules or null; polygons: MultiPolygon coordinates
  works: list,
});
await datasetSection('construction', {
  ...source,
  method,
  areas: counts.areas,
  over: counts.over,
  outsideHelsinki: counts.outside,
  noDates: counts.noDates,
  unknownLeftOut: counts.unknown,
  unknownExamples: unknown.slice(0, 20).map(w => w.purpose),
  works: list.length,
  upcoming,
  byLevel,
  buildings: manifest.length,
  ...summary,
});
console.log('buildings', manifest.length, summary);
