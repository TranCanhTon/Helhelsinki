// Day care, primary schools (grades 1 to 6) and health stations for the building card,
// from the City of Helsinki service map (api.hel.fi/servicemap, src/data/places.js).
//
// 1. Asks the service map for the units of each kind in Helsinki (municipality=helsinki),
//    page by page. The answers are cached in data/raw/services; --force asks again.
// 2. Keeps points inside the Helsinki boundary only, one row per unit and kind.
// 3. Writes public/services.json: {source, places: [[kind, name, lon, lat], ...]},
//    the same rows as places.json.
import {getJson} from './lib/http.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, publishJson, datasetSection} from './lib/prepare.mjs';
import {SERVICE_KINDS, SERVICE_KEYS} from '../src/data/places.js';

const API = 'https://api.hel.fi/servicemap/v2/unit/';

async function units(services) {
  const out = [];
  let url = `${API}?service=${services.join(',')}&municipality=helsinki&only=id,name,location&page_size=500`;
  while (url) {
    const page = await getJson(url, {timeoutMs: 120000});
    out.push(...page.results);
    url = page.next;
  }
  return out;
}

const boundary = await loadBoundary();
const raw = await cached('data/raw/services/units.json', async () => {
  const kinds = {};
  for (const kind of SERVICE_KINDS) kinds[kind.key] = await units(kind.services);
  return {retrievedAt: new Date().toISOString(), kinds};
});

const rows = [],
  left = {noPosition: 0, outside: 0, repeated: 0};
for (const {key} of SERVICE_KINDS) {
  const seen = new Set();
  for (const unit of raw.kinds[key] ?? []) {
    if (seen.has(unit.id)) {
      left.repeated++;
      continue;
    }
    seen.add(unit.id);
    const position = unit.location?.coordinates;
    if (!position) {
      left.noPosition++;
      continue;
    }
    if (!boundary.isInside(position)) {
      left.outside++;
      continue;
    }
    rows.push([
      key,
      unit.name?.fi ?? unit.name?.sv ?? null,
      Math.round(position[0] * 1e6) / 1e6,
      Math.round(position[1] * 1e6) / 1e6,
    ]);
  }
}
rows.sort((a, b) => SERVICE_KEYS.indexOf(a[0]) - SERVICE_KEYS.indexOf(b[0]) || a[2] - b[2]);
const kinds = Object.fromEntries(SERVICE_KEYS.map(k => [k, rows.filter(r => r[0] === k).length]));
const source = {url: API, license: 'City of Helsinki service map, CC BY 4.0', retrievedAt: raw.retrievedAt};
await publishJson('public/services.json', {schemaVersion: 1, source, places: rows});
await datasetSection('services', {
  ...source,
  services: Object.fromEntries(SERVICE_KINDS.map(k => [k.key, k.services])),
  kept: rows.length,
  kinds,
  left,
  limitations: [
    'Nearest in a straight line, not the school or health station the address belongs to.',
    'Day care: the units the service map lists for day care in Finnish, Swedish or English.',
  ],
});
console.log('kept', rows.length, kinds, 'left out', left);
