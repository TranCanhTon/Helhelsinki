// The Helsinki boundary: the one rule every dataset passes through.
//
// We build it from the city's 60 official districts (Kaupunginosajako),
// merged into one shape. Anything whose representative point is outside
// this shape is dropped, which is how Espoo and Vantaa stay out.
import {readFile} from 'node:fs/promises';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import polygonClipping from 'polygon-clipping';

export const BOUNDARY_FILE = new URL('../../public/map/helsinki-boundary.json', import.meta.url);

// Merge district polygons into one MultiPolygon. Holes and islands are kept:
// polygon-clipping returns every separate piece of land/sea area as its own polygon.
export function unionDistricts(features) {
  const shapes = features.map(f => {
    const g = f.geometry;
    if (g?.type === 'Polygon') return [g.coordinates];
    if (g?.type === 'MultiPolygon') return g.coordinates;
    throw new Error(`District ${f.properties?.nimi_fi} has no polygon geometry`);
  });
  return {type: 'MultiPolygon', coordinates: polygonClipping.union(...shapes)};
}

// Area of a [lon, lat] ring in square kilometres (good enough for a sanity check at 60°N).
export function ringAreaKm2(ring) {
  const kmPerDegLat = 111.32;
  const lat0 = (ring[0][1] * Math.PI) / 180;
  const kmPerDegLon = kmPerDegLat * Math.cos(lat0);
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum +=
      ring[j][0] * kmPerDegLon * (ring[i][1] * kmPerDegLat) - ring[i][0] * kmPerDegLon * (ring[j][1] * kmPerDegLat);
  }
  return Math.abs(sum) / 2;
}

export function multiPolygonAreaKm2(geometry) {
  return geometry.coordinates.reduce(
    (total, polygon) =>
      total + ringAreaKm2(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringAreaKm2(ring), 0),
    0,
  );
}

// Returns a fast test function: isInside([lon, lat]) -> true/false.
// A bounding-box check runs first so most far-away points skip the exact test.
export function makeInsideTest(geometry) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of geometry.coordinates)
    for (const [x, y] of polygon[0]) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  const feature = {type: 'Feature', properties: {}, geometry};
  return ([lon, lat]) =>
    lon >= minX && lon <= maxX && lat >= minY && lat <= maxY && booleanPointInPolygon([lon, lat], feature);
}

export async function loadBoundary() {
  const data = JSON.parse(await readFile(BOUNDARY_FILE, 'utf8'));
  return {...data, isInside: makeInsideTest(data.geometry)};
}
