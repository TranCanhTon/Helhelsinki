// Areas we download 3D buildings for.
//
// Two kinds of area:
//   square:    {center: [longitude, latitude], size: metres}
//   districts: {districts: [district codes] or 'all'}, using the official district
//              shapes in public/map/district-boundaries.json (npm run data:boundary)
//
// A building belongs to an area when its centre point is inside it.
import {readFileSync} from 'node:fs';
import {pointFinder} from './lib/point-finder.mjs';
import {gridSquare, lonLatToGrid} from './lib/geo.mjs';

export const AREAS = {
  // About 400 m around Senate Square and the Cathedral.
  pilot: {center: [24.9522, 60.17], size: 400},
  // The city's "Keskinen suurpiiri" (Central major district), 11 districts.
  central: {
    label: 'Central major district',
    districts: ['10', '11', '12', '17', '21', '22', '23', '24', '25', '26', '27'],
  },
  // Every district: the whole city (Ton, 13 Oct 2026).
  helsinki: {label: 'All of Helsinki', districts: 'all'},
};

const DISTRICTS_FILE = new URL('../public/map/district-boundaries.json', import.meta.url);

function districtFeatures(codes) {
  let data;
  try {
    data = JSON.parse(readFileSync(DISTRICTS_FILE, 'utf8'));
  } catch {
    throw new Error('District shapes missing. Run npm run data:boundary first.');
  }
  if (codes === 'all') return data.features;
  const features = data.features.filter(f => codes.includes(f.properties.id));
  const missing = codes.filter(c => !features.some(f => f.properties.id === c));
  if (missing.length) throw new Error(`Unknown district codes: ${missing.join(', ')}`);
  return features;
}

function getArea(name) {
  const area = AREAS[name];
  if (!area) throw new Error(`Unknown area "${name}". Known areas: ${Object.keys(AREAS).join(', ')}`);
  return area;
}

// EPSG:3879 bounding box [minEast, minNorth, maxEast, maxNorth] of an area.
export function areaBbox(name) {
  const area = getArea(name);
  if (area.center) return gridSquare(area.center, area.size);
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of districtFeatures(area.districts)) {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons)
      for (const point of polygon[0]) {
        const [e, n] = lonLatToGrid(point);
        box[0] = Math.min(box[0], e);
        box[1] = Math.min(box[1], n);
        box[2] = Math.max(box[2], e);
        box[3] = Math.max(box[3], n);
      }
  }
  return box.map(v => Math.round(v));
}

// isInside([lon, lat]) for an area. Districts: exact shape test, holes respected.
export function areaInsideTest(name) {
  const area = getArea(name);
  if (area.center) {
    const [x0, y0, x1, y1] = gridSquare(area.center, area.size);
    return lonLat => {
      const [e, n] = lonLatToGrid(lonLat);
      return e >= x0 && e <= x1 && n >= y0 && n <= y1;
    };
  }
  const find = pointFinder(districtFeatures(area.districts));
  return lonLat => find(lonLat) !== null;
}

// Which district of the area a point is in (null for square areas).
export function areaDistrictOf(name) {
  const area = getArea(name);
  if (area.center) return () => null;
  const find = pointFinder(districtFeatures(area.districts));
  return lonLat => find(lonLat)?.properties ?? null;
}

// Reads --area=name from the command line (default: pilot).
export function areaFromArgs(argv = process.argv) {
  return argv.find(a => a.startsWith('--area='))?.slice(7) || 'pilot';
}

export const CITYGML_WFS = 'https://kartta.hel.fi/3d/citydb-wfs/wfs';
