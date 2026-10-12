// Turns one 3D polygon (outer ring + holes) into triangles.
//
// GPUs only draw triangles. A wall or roof in CityGML is a flat polygon that
// can have any number of corners and holes (a courtyard, for example).
// earcut cuts 2D polygons into triangles, so for each polygon we:
//  1. find the direction the polygon faces (its normal)
//  2. lay the polygon flat on its own plane (2D coordinates on that plane)
//  3. let earcut triangulate it, holes included
//  4. use the triangle corner indexes on the original 3D points
// Just dropping the height (using x, y only) would squash every vertical wall
// into a line, which is why step 2 projects onto the polygon's own plane.
import earcut from 'earcut';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = a => Math.hypot(a[0], a[1], a[2]);
const normalize = a => { const l = length(a); return l ? [a[0] / l, a[1] / l, a[2] / l] : null; };

// Newell's method: a stable normal even for polygons that are slightly
// non-flat or have many nearly-collinear points.
export function polygonNormal(ring) {
  const n = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return normalize(n);
}

// Returns {positions: [[x,y,z]...], indices: [i0,i1,i2, ...], normal} or null
// when the polygon has no area (all points on one line).
export function triangulatePolygon(rings) {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const normal = polygonNormal(outer);
  if (!normal) return null;

  // Two perpendicular directions lying in the polygon's plane.
  const helper = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(helper, normal));
  const v = cross(normal, u);

  const positions = rings.flat();
  const origin = outer[0];
  const flat = [];
  for (const p of positions) {
    const d = sub(p, origin);
    flat.push(dot(d, u), dot(d, v));
  }
  const holes = [];
  let offset = outer.length;
  for (const ring of rings.slice(1)) { holes.push(offset); offset += ring.length; }

  const raw = earcut(flat, holes, 2);
  const indices = [];
  for (let i = 0; i < raw.length; i += 3) {
    let [a, b, c] = [raw[i], raw[i + 1], raw[i + 2]];
    const triangleNormal = cross(sub(positions[b], positions[a]), sub(positions[c], positions[a]));
    const area2 = length(triangleNormal);
    if (area2 < 1e-6) continue; // sliver with no area
    // Keep every triangle facing the same way as the polygon.
    if (dot(triangleNormal, normal) < 0) [b, c] = [c, b];
    indices.push(a, b, c);
  }
  return indices.length ? {positions, indices, normal} : null;
}

// Total surface area of the triangles, used by tests to check nothing is lost.
export function triangulatedArea({positions, indices}) {
  let area = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [positions[indices[i]], positions[indices[i + 1]], positions[indices[i + 2]]];
    area += length(cross(sub(b, a), sub(c, a))) / 2;
  }
  return area;
}
