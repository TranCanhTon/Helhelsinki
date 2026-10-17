// features (GeoJSON polygons) -> find([lon, lat]) -> the first feature containing the
// point, or null. A box search first, so the exact test runs on one or two shapes
// instead of every one; with the whole city that is tens of thousands of lookups.
import Flatbush from 'flatbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

export function pointFinder(features) {
  const usable = features.filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon');
  if (!usable.length) return () => null;
  const index = new Flatbush(usable.length);
  for (const f of usable) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons)
      for (const [x, y] of polygon[0]) {
        b[0] = Math.min(b[0], x);
        b[1] = Math.min(b[1], y);
        b[2] = Math.max(b[2], x);
        b[3] = Math.max(b[3], y);
      }
    index.add(...b);
  }
  index.finish();
  return ([x, y]) => {
    // Lowest index first, so the answer matches a plain features.find().
    const hits = index.search(x, y, x, y).sort((a, b) => a - b);
    for (const i of hits) if (booleanPointInPolygon([x, y], usable[i])) return usable[i];
    return null;
  };
}
