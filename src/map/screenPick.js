import * as Cesium from 'cesium';
import Flatbush from 'flatbush';

// Finds the map point under the mouse without scene.pick. scene.pick draws the whole
// scene again and waits for the GPU (about 130 ms here), which made hovering laggy.
// This only asks where the mouse meets the ground and compares screen distances.
// points: [[lon, lat], ...] -> find(position, maxPx) -> index of the closest point or -1.
// heightM: how high above the ground the points sit (buildings: about mid height).
export function screenFinder(viewer, points, heightM = 1) {
 const index = new Flatbush(Math.max(1, points.length));
 for (const [lon, lat] of points) index.add(lon, lat, lon, lat);
 if (!points.length) index.add(0, 0, 0, 0);
 index.finish();
 const cartesians = points.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, heightM));
 return (position, maxPx = 8) => {
  const camera = viewer.camera, ground = camera.pickEllipsoid(position);
  if (!ground || !points.length) return -1;
  const c = Cesium.Cartographic.fromCartesian(ground), lon = Cesium.Math.toDegrees(c.longitude), lat = Cesium.Math.toDegrees(c.latitude);
  // Metres per pixel where the mouse meets the ground; a little extra for tilted views.
  const fovy = camera.frustum.fovy ?? Math.PI / 3;
  const metres = Cesium.Cartesian3.distance(camera.positionWC, ground) * 2 * Math.tan(fovy / 2) / viewer.canvas.clientHeight * maxPx * 3;
  const dLat = metres / 111320, dLon = metres / (111320 * Math.cos(c.latitude));
  let best = -1, bestPx = maxPx * maxPx;
  for (const i of index.search(lon - dLon, lat - dLat, lon + dLon, lat + dLat)) {
   const p = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesians[i]);
   if (!p) continue;
   const d = (p.x - position.x) ** 2 + (p.y - position.y) ** 2;
   if (d <= bestPx) { best = i; bestPx = d; }
  }
  return best;
 };
}
