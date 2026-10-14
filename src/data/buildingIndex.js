// The browser no longer loads the whole building list (buildings-manifest.json).
// It loads:
//   buildings-index.json       one short row per building: what the map needs at once
//                              (position, type, district, tile, address, noise bands)
//   buildings/<tile>.json      the full records of one 3D tile, when a card opens
// Repeated texts (types, districts, tiles) are stored once and referred to by number.
import {NOISE_MODES} from './noise.js';

export const INDEX_SCHEMA = 1;
const NOISE_KEYS = [...NOISE_MODES.map(m => m.key), 'all'];
export const detailFile = tileContentUri => tileContentUri.replace(/\.b3dm$/, '.json');

// manifest records -> index object (scripts).
export function encodeIndex(manifest) {
  const lists = {classes: [], uses: [], districts: [], tiles: []}, seen = {classes: new Map(), uses: new Map(), districts: new Map(), tiles: new Map()};
  const ref = (list, key, value) => {
    if (value === null || value === undefined) return null;
    if (!seen[list].has(key)) { seen[list].set(key, lists[list].length); lists[list].push(value); }
    return seen[list].get(key);
  };
  const round = v => Math.round(v * 1e6) / 1e6;
  const buildings = manifest.map(r => [
    r.buildingId, round(r.position[0]), round(r.position[1]),
    ref('classes', r.classEn, r.classEn), ref('uses', r.useEn, r.useEn),
    ref('districts', r.district?.id, r.district ? {id: r.district.id, nameFi: r.district.nameFi, nameSv: r.district.nameSv ?? null} : null),
    ref('tiles', r.tileContentUri, r.tileContentUri),
    r.address ?? null, r.sourceIds?.ratu ?? null,
    r.noise ? NOISE_KEYS.map(k => r.noise[k] ?? null) : null,
  ]);
  return {schemaVersion: INDEX_SCHEMA, noiseKeys: NOISE_KEYS, ...lists, buildings};
}

// index object -> short records with the same field names as the full records (browser).
export function decodeIndex(index) {
  if (index.schemaVersion !== INDEX_SCHEMA) throw new Error('buildings-index.json is out of date. Run npm run data:split');
  const at = (list, i) => i === null ? null : list[i];
  return index.buildings.map(([buildingId, lon, lat, cls, use, district, tile, address, ratu, noise]) => ({
    buildingId, position: [lon, lat], classEn: at(index.classes, cls), useEn: at(index.uses, use),
    district: at(index.districts, district), tileContentUri: at(index.tiles, tile), address, sourceIds: {ratu},
    noise: noise ? Object.fromEntries(index.noiseKeys.map((k, i) => [k, noise[i]])) : null,
  }));
}
