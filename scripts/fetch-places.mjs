// Shops and services for the building card: grocery stores, pharmacies, gyms, Alko,
// restaurants and cafés from OpenStreetMap (src/data/places.js).
//
// 1. Asks Overpass once for these places in Helsinki. The answer is cached in
//    data/raw/places; --force asks again.
// 2. Keeps points inside the Helsinki boundary only (a place without a name keeps no name).
// 3. Writes public/places.json: {source, places: [[kind, name, lon, lat], ...]}.
import {request} from './lib/http.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, publishJson, datasetSection} from './lib/prepare.mjs';
import {placeKind, PLACE_KEYS} from '../src/data/places.js';

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const QUERY = `[out:json][timeout:180];
area["boundary"="administrative"]["admin_level"="8"]["name"="Helsinki"]->.h;
(
  nwr["shop"~"^(supermarket|convenience|alcohol)$"](area.h);
  nwr["amenity"~"^(pharmacy|restaurant|cafe)$"](area.h);
  nwr["leisure"="fitness_centre"](area.h);
);
out center tags;`;

async function overpass() {
  let lastError;
  for (const server of SERVERS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await request(server, {method: 'POST', body: new URLSearchParams({data: QUERY}),
          headers: {'Content-Type': 'application/x-www-form-urlencoded'}, timeoutMs: 240000});
        if (response.ok) return {retrievedAt: new Date().toISOString(), server, ...(await response.json())};
        lastError = new Error(`${server}: HTTP ${response.status}`);
      } catch (error) { lastError = error; }
      console.warn(String(lastError.message ?? lastError), '- waiting before the next try');
      await new Promise(r => setTimeout(r, 15000 * (attempt + 1)));
    }
  }
  throw lastError;
}

const boundary = await loadBoundary();
const raw = await cached('data/raw/places/overpass.json', overpass);
const rows = [], left = {otherKind: 0, noPosition: 0, outside: 0};
for (const e of raw.elements) {
  const tags = e.tags ?? {}, kind = placeKind(tags);
  if (!kind) { left.otherKind++; continue; }
  const position = e.type === 'node' ? [e.lon, e.lat] : e.center ? [e.center.lon, e.center.lat] : null;
  if (!position) { left.noPosition++; continue; }
  if (!boundary.isInside(position)) { left.outside++; continue; }
  rows.push([kind, tags['name:fi'] ?? tags.name ?? null, Math.round(position[0] * 1e6) / 1e6, Math.round(position[1] * 1e6) / 1e6]);
}
rows.sort((a, b) => PLACE_KEYS.indexOf(a[0]) - PLACE_KEYS.indexOf(b[0]) || a[2] - b[2]);
const kinds = Object.fromEntries(PLACE_KEYS.map(k => [k, rows.filter(r => r[0] === k).length]));
const source = {url: raw.server, license: '© OpenStreetMap contributors, ODbL', retrievedAt: raw.retrievedAt};
await publishJson('public/places.json', {schemaVersion: 1, source, places: rows});
await datasetSection('places', {...source, query: QUERY, kept: rows.length, kinds, left});
console.log('kept', rows.length, kinds, 'left out', left);
