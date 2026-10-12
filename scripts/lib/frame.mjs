// Earth-centred coordinates and a local "east / north / up" frame.
//
// Cesium places 3D content in ECEF: X, Y, Z in metres from the centre of the
// Earth. Those numbers are millions of metres, too big to store precisely in
// the 32-bit floats that 3D models use, so buildings would visibly jitter.
// The standard fix: pick one origin point in Helsinki, store every vertex as
// small "metres east / north / up of the origin" numbers, and give Cesium one
// matrix (the tileset transform) that places that local frame on the globe.

const A = 6378137.0;                 // WGS84 equatorial radius (m)
const F = 1 / 298.257223563;         // WGS84 flattening
const E2 = F * (2 - F);              // eccentricity squared
const RAD = Math.PI / 180;

// Longitude/latitude in degrees and height in metres -> ECEF [x, y, z].
export function geodeticToEcef(lon, lat, height = 0) {
  const sinLat = Math.sin(lat * RAD), cosLat = Math.cos(lat * RAD);
  const sinLon = Math.sin(lon * RAD), cosLon = Math.cos(lon * RAD);
  const n = A / Math.sqrt(1 - E2 * sinLat * sinLat);
  return [(n + height) * cosLat * cosLon, (n + height) * cosLat * sinLon, (n * (1 - E2) + height) * sinLat];
}

// Builds the local frame at an origin. Same result as Cesium's
// Transforms.eastNorthUpToFixedFrame (a test checks this).
export function enuFrame(lon, lat, height = 0) {
  const origin = geodeticToEcef(lon, lat, height);
  const sinLat = Math.sin(lat * RAD), cosLat = Math.cos(lat * RAD);
  const sinLon = Math.sin(lon * RAD), cosLon = Math.cos(lon * RAD);
  const east = [-sinLon, cosLon, 0];
  const north = [-sinLat * cosLon, -sinLat * sinLon, cosLat];
  const up = [cosLat * cosLon, cosLat * sinLon, sinLat];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return {
    origin,
    // 4x4 matrix, column by column, as 3D Tiles expects in "transform".
    matrix: [...east, 0, ...north, 0, ...up, 0, ...origin, 1],
    // ECEF point -> [east, north, up] metres from the origin.
    toLocal(point) {
      const d = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
      return [dot(d, east), dot(d, north), dot(d, up)];
    },
  };
}
