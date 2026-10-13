// Landmarks: well known places in Helsinki from OpenStreetMap.
//
// 1. Asks Overpass once for museums, sights, stadiums, theatres, churches and
//    similar places that have a Wikidata link (a simple test for "well known"),
//    with their outlines. The answer is cached in data/raw/landmarks; --force asks again.
// 2. Keeps one point per Wikidata item, inside the Helsinki boundary.
// 3. Finds the 3D buildings each landmark covers, using the city's building outlines
//    (data:register): an outline holding the landmark point, or an outline whose
//    middle lies inside the landmark's own OSM outline (a stadium's stands, say).
// 4. Writes public/landmarks.json: [name, lon, lat, kind, buildingIds].
import Flatbush from 'flatbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import {request} from './lib/http.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, readJson, publishJson, datasetSection} from './lib/prepare.mjs';

const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const QUERY = `[out:json][timeout:180];
area["boundary"="administrative"]["admin_level"="8"]["name"="Helsinki"]->.h;
(
  nwr["tourism"~"^(attraction|museum|gallery|zoo|theme_park|viewpoint|aquarium)$"]["wikidata"](area.h);
  nwr["historic"~"^(castle|fort|fortress|monument|ship|manor|palace)$"]["wikidata"](area.h);
  nwr["leisure"="stadium"]["wikidata"](area.h);
  nwr["amenity"~"^(theatre|concert_hall|arts_centre)$"]["wikidata"](area.h);
  nwr["building"~"^(cathedral|church)$"]["wikidata"](area.h);
)->.a;
.a out center tags;
.a out geom;`;

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

const kindOf = t => t.leisure === 'stadium' ? 'stadium'
  : t.tourism === 'museum' || t.tourism === 'gallery' ? 'museum'
  : t.building === 'church' || t.building === 'cathedral' ? 'church'
  : t.amenity ? 'culture'
  : t.historic ? 'historic'
  : 'sight';
// Rides inside an amusement park, information boards, tree stumps, roads and whole
// neighbourhoods are tagged as sights too; they are not landmarks.
const notLandmark = t => ['attraction', 'information', 'natural', 'highway', 'place'].some(k => k in t);

// OSM outline of a way or relation as GeoJSON polygons (closed rings only), or null.
function outlineOf(e) {
  const ring = g => g?.length > 3 && g[0].lat === g.at(-1).lat && g[0].lon === g.at(-1).lon ? g.map(p => [p.lon, p.lat]) : null;
  const rings = e.type === 'way' ? [ring(e.geometry)] : (e.members ?? []).filter(m => m.role === 'outer').map(m => ring(m.geometry));
  const closed = rings.filter(Boolean);
  return closed.length ? {type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon', coordinates: closed.map(r => [r])}} : null;
}

const boundary = await loadBoundary();
const raw = await cached('data/raw/landmarks/overpass-geom.json', overpass);
// The answer lists every element twice: once with its centre, once with its outline.
const outlines = new Map();
for (const e of raw.elements) if (e.geometry || e.members) outlines.set(e.type + e.id, outlineOf(e));

// City outlines -> manifest building ids (by VTJ-PRT, then RATU).
const manifest = await readJson('public/buildings-manifest.json');
const byVtj = new Map(), byRatu = new Map();
const add = (map, key, id) => { if (key) map.set(key, [...(map.get(key) ?? []), id]); };
for (const r of manifest) { add(byVtj, r.sourceIds?.vtjPrt, r.buildingId); add(byRatu, r.sourceIds?.ratu, r.buildingId); }
const footprints = (await readJson('data/raw/register/central.json')).features
  .map(f => ({feature: f, ids: byVtj.get(f.properties.vtj_prt?.trim()) ?? byRatu.get(String(f.properties.ratu ?? '')) ?? []}))
  .filter(f => f.ids.length && f.feature.geometry);
const boxOf = g => { const b = [Infinity, Infinity, -Infinity, -Infinity]; for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (const [x, y] of poly[0]) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } return b; };
const index = new Flatbush(footprints.length);
for (const f of footprints) { f.box = boxOf(f.feature.geometry); index.add(...f.box); }
index.finish();
function buildingsAt(position, outline) {
  const ids = new Set();
  for (const i of index.search(position[0], position[1], position[0], position[1]))
    if (booleanPointInPolygon(position, footprints[i].feature)) footprints[i].ids.forEach(id => ids.add(id));
  if (outline) {
    for (const i of index.search(...boxOf(outline.geometry))) {
      const b = footprints[i].box, middle = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
      if (booleanPointInPolygon(middle, outline)) footprints[i].ids.forEach(id => ids.add(id));
    }
  }
  return [...ids];
}

const seen = new Set(), rows = [], counts = {noName: 0, outside: 0, duplicate: 0, notLandmark: 0, onBuildings: 0};
for (const e of raw.elements) {
  if (e.geometry || (e.members && !e.center)) continue;
  const t = e.tags ?? {}, name = t['name:fi'] ?? t.name;
  if (notLandmark(t)) { counts.notLandmark++; continue; }
  const position = e.type === 'node' ? [e.lon, e.lat] : e.center ? [e.center.lon, e.center.lat] : null;
  if (!name || !position) { counts.noName++; continue; }
  if (!boundary.isInside(position)) { counts.outside++; continue; }
  if (seen.has(t.wikidata)) { counts.duplicate++; continue; }
  seen.add(t.wikidata);
  const buildingIds = buildingsAt(position, outlines.get(e.type + e.id));
  if (buildingIds.length) counts.onBuildings++;
  rows.push([name, Math.round(position[0] * 1e6) / 1e6, Math.round(position[1] * 1e6) / 1e6, kindOf(t), buildingIds]);
}
rows.sort((a, b) => a[0].localeCompare(b[0], 'fi'));
const kinds = {};
for (const r of rows) kinds[r[3]] = (kinds[r[3]] ?? 0) + 1;
const source = {url: raw.server, license: '© OpenStreetMap contributors, ODbL', retrievedAt: raw.retrievedAt};
await publishJson('public/landmarks.json', {schemaVersion: 2, source, landmarks: rows});
await datasetSection('landmarks', {...source, query: QUERY, kept: rows.length, left: counts, kinds,
  buildingMatch: 'City outlines (Rakennukset_alue_rekisteritiedot) holding the landmark point, or whose middle lies inside its OSM outline. Run again after data:city-tiles.'});
console.log('kept', rows.length, counts, kinds);
