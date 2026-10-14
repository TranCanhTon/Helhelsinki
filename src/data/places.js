// Shops and services near a building (Ton, 14 Oct 2026): grocery stores, pharmacies,
// gyms and similar from OpenStreetMap (npm run data:places, public/places.json).
import Flatbush from 'flatbush';
import {metresBetween} from './parking.js';

export const PLACE_KINDS = [
  {key: 'grocery', label: 'Grocery store'},
  {key: 'pharmacy', label: 'Pharmacy'},
  {key: 'gym', label: 'Gym'},
  {key: 'alko', label: 'Alko'},
  {key: 'restaurant', label: 'Restaurant'},
  {key: 'cafe', label: 'Café'},
];
export const PLACE_KEYS = PLACE_KINDS.map(k => k.key);
export const NEAR_M = 1000;

// Petrol station shops are tagged like corner shops; they are not grocery stores.
const FUEL_SHOP = /^(neste|st1|shell|abc|teboil)\b/i;
// OpenStreetMap tags -> one of PLACE_KEYS, or null. Small K-Markets and Alepas are
// tagged as corner shops (convenience), so those count as grocery stores too.
export function placeKind(tags = {}) {
  if (tags.shop === 'supermarket') return 'grocery';
  if (tags.shop === 'convenience' && !FUEL_SHOP.test(tags.brand ?? tags.name ?? '')) return 'grocery';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (tags.leisure === 'fitness_centre') return 'gym';
  if (tags.shop === 'alcohol' && /^alko\b/i.test(tags.brand ?? tags.name ?? '')) return 'alko';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'cafe') return 'cafe';
  return null;
}

// rows: [kind, name or null, lon, lat] -> point -> {kind: {name, distanceM} or null}
// The nearest place of each kind within radiusM, in a straight line.
export function nearestPlaces(rows, radiusM = NEAR_M) {
  const index = new Flatbush(Math.max(1, rows.length));
  for (const [, , lon, lat] of rows) index.add(lon, lat, lon, lat);
  if (!rows.length) index.add(0, 0, 0, 0);
  index.finish();
  return point => {
    const best = Object.fromEntries(PLACE_KEYS.map(k => [k, null]));
    if (!rows.length) return best;
    const dLat = radiusM / 111320, dLon = radiusM / (111320 * Math.cos(point[1] * Math.PI / 180));
    for (const i of index.search(point[0] - dLon, point[1] - dLat, point[0] + dLon, point[1] + dLat)) {
      const [kind, name, lon, lat] = rows[i], d = metresBetween(point, [lon, lat]);
      if (d <= radiusM && kind in best && d < (best[kind]?.distanceM ?? Infinity)) best[kind] = {name, distanceM: d};
    }
    for (const k of PLACE_KEYS) if (best[k]) best[k].distanceM = Math.round(best[k].distanceM);
    return best;
  };
}
