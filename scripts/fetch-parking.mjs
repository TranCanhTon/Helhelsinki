// Street parking, paid zones and resident parking zones, per building.
//
// 1. Downloads the three city WFS layers (all pages, checked).
// 2. Sorts every parking record into a type (src/data/parking.js). No-parking,
//    bicycle, e-scooter and parklet records are left out. Unknown codes stay unknown.
// 3. Keeps records whose centre is inside Helsinki.
// 4. Writes public/parking.json: one point per parking area with its type,
//    estimated cars, hours and time limit, plus the paid and resident zones; and
//    public/parking-zones.json: map strips per group (each area grown by 1.5 m and merged;
//    free over paid over permit).
//    The map works out what is near a building when you open it, so this does
//    not need to run again after data:city-tiles.
// 5. Counts for dataset.json: how many buildings have parking within 200 m and
//    sit in a paid or resident zone.
import {fetchAllFeatures} from './lib/wfs.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, readJson, publishJson, datasetSection} from './lib/prepare.mjs';
import polygonClipping from 'polygon-clipping';
import {simplify} from './lib/simplify.mjs';
import {PARKING_GROUPS, PARKING_TYPES, TYPE_KEYS, classify, capacityOf, centreOf, nearbyIndex, zoneLookup, grownHull} from '../src/data/parking.js';

const boundary = await loadBoundary();
const layer = name => cached('data/raw/parking/' + name + '.json', () =>
  fetchAllFeatures({typeName: 'avoindata:' + name, pageSize: 5000, sortBy: 'id'}));
const raw = await layer('Pysakointipaikat_alue');
const paidRaw = await layer('Pysakoinnin_maksuvyohykkeet_alue');
const residentRaw = await layer('Asukas_ja_yrityspysakointivyohykkeet_alue');

const isArea = f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon';
for (const [name, data] of [['parking', raw], ['paid zones', paidRaw], ['resident zones', residentRaw]]) {
  const bad = data.features.filter(f => !isArea(f));
  if (bad.length) throw new Error(`${name}: ${bad.length} records without polygon geometry, e.g. ${bad[0].id}`);
}

const counts = {exclude: 0, outside: 0};
const segments = [];
for (const f of raw.features) {
  const type = classify(f.properties);
  if (type === 'exclude') { counts.exclude++; continue; }
  const position = centreOf(f.geometry);
  if (!boundary.isInside(position)) { counts.outside++; continue; }
  counts[type] = (counts[type] ?? 0) + 1;
  segments.push({id: f.properties.id, position: position.map(v => Math.round(v * 1e6) / 1e6), type,
    capacity: capacityOf(f.properties), luokka: f.properties.luokka ?? null, tyyppi: f.properties.tyyppi || null,
    hours: f.properties.voimassaolo?.trim() || null, limit: f.properties.kesto?.trim() || null});
}
const unknownCodes = [...new Set(segments.filter(s => s.type === 'unknown').map(s => `luokka=${s.luokka} tyyppi=${s.tyyppi}`))];
console.log('types', counts, 'unknown codes', unknownCodes);

// Zones for the map: per group, every parking area grown by ZONE_M and merged.
// Free wins over paid, paid over permit, so zones never overlap.
// 1.5 m (Ton, 15 Oct 2026, was 6 m): thin strips along the kerb, not wide blobs.
const ZONE_M = 1.5;
const hulls = Object.fromEntries(PARKING_GROUPS.map(g => [g.key, []]));
for (const f of raw.features) {
  const type = classify(f.properties), group = type === 'exclude' ? null : PARKING_TYPES[type].group;
  if (!hulls[group] || !boundary.isInside(centreOf(f.geometry))) continue;
  hulls[group].push([[grownHull(f.geometry, ZONE_M)]]);
}
const unionAll = list => {
  while (list.length > 1) {
    const next = [];
    for (let i = 0; i < list.length; i += 2) next.push(i + 1 < list.length ? polygonClipping.union(list[i], list[i + 1]) : list[i]);
    list = next;
  }
  return list[0] ?? [];
};
const merged = Object.fromEntries(Object.entries(hulls).map(([k, v]) => [k, unionAll(v)]));
const zoneShapes = {free: merged.free};
zoneShapes.paid = merged.free.length ? polygonClipping.difference(merged.paid, merged.free) : merged.paid;
const taken = polygonClipping.union(merged.free, merged.paid);
zoneShapes.permit = taken.length ? polygonClipping.difference(merged.permit, taken) : merged.permit;
// Outlines simplified to 1 m; rings left with fewer than 4 points are dropped.
const roundRing = ring => simplify(ring, 1).map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
for (const [k, shape] of Object.entries(zoneShapes)) zoneShapes[k] = shape.map(polygon => polygon.map(roundRing).filter(r => r.length >= 4)).filter(p => p.length);
console.log('zones', Object.fromEntries(Object.entries(zoneShapes).map(([k, v]) => [k, v.length])));

const paidZoneAt = zoneLookup(paidRaw.features, p => ({number: String(p.vyohykkeen_nro), name: p.nimi}));
const residentZoneAt = zoneLookup(residentRaw.features, p => ({code: p.asukaspysakointitunnus, name: p.alueen_nimi}));
const near = nearbyIndex(segments);
const manifest = await readJson('public/buildings-manifest.json');
const summary = {withSpaces: 0, noRecords: 0, inPaidZone: 0, inResidentZone: 0};
for (const record of manifest) {
  const {groups, other} = near(record.position), list = Object.values(groups);
  if (list.some(g => g.spaces !== null)) summary.withSpaces++;
  if (!list.some(g => g.areas) && !Object.keys(other).length) summary.noRecords++;
  if (paidZoneAt(record.position)) summary.inPaidZone++;
  if (residentZoneAt(record.position)) summary.inResidentZone++;
}

const source = {wfs: 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs', license: 'City of Helsinki, CC BY 4.0',
  segments: 'avoindata:Pysakointipaikat_alue', paidZones: 'avoindata:Pysakoinnin_maksuvyohykkeet_alue',
  residentZones: 'avoindata:Asukas_ja_yrityspysakointivyohykkeet_alue', retrievedAt: raw.retrievedAt,
  updated: raw.features[0]?.properties.paivitetty_tietopalveluun ?? null};
const method = 'Records sorted by luokka (rule class) and tyyppi (use). No-parking, bicycle, e-scooter and parklet records left out. ' +
  'Estimated spaces = sum of positive paikat_ala of general car parking records whose bounding-box centre is within 200 m (straight line) of the building centre. ' +
  'Records with missing, zero or invalid paikat_ala are counted as having no estimate. Zones by point in polygon at the building centre. ' +
  'Not live free spaces, not private parking.';
const zone = (f, props) => ({...props, link: f.properties.linkki ?? null, geometry: f.geometry});
await publishJson('public/parking.json', {schemaVersion: 2, source, method,
  groups: PARKING_GROUPS,
  types: TYPE_KEYS.map(key => ({key, ...PARKING_TYPES[key]})),
  // [id, lon, lat, type index, estimated cars or null, hours or null, time limit or null], as the city wrote them
  segments: segments.map(s => [s.id, ...s.position, TYPE_KEYS.indexOf(s.type), s.capacity, s.hours, s.limit]),

  paidZones: paidRaw.features.map(f => zone(f, {number: String(f.properties.vyohykkeen_nro), name: f.properties.nimi, note: f.properties.lisatiedot ?? null})),
  residentZones: residentRaw.features.map(f => zone(f, {code: f.properties.asukaspysakointitunnus, name: f.properties.alueen_nimi}))});
// Map zones per group as MultiPolygon coordinates, in their own file: the map loads it
// only when the Parking view opens.
await publishJson('public/parking-zones.json', {schemaVersion: 1, updated: source.updated, growM: ZONE_M, order: 'free over paid over permit', zones: zoneShapes});
await datasetSection('parking', {...source, method, sourceRecords: raw.total, kept: segments.length, left: counts,
  unknownCodes, paidZones: paidRaw.total, residentZones: residentRaw.total, buildings: manifest.length, ...summary});
console.log('kept', segments.length, 'of', raw.total, summary);
