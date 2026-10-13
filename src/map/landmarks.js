import * as Cesium from 'cesium';
import {loadJson} from '../data/load.js';
import {screenFinder} from './screenPick.js';
import {landmarkPin} from './pinIcons.js';

// Landmark icons (data:landmarks), in every view, once the scale bar reads 70 m or
// less. pick() returns the landmark under the mouse so a click can zoom in on it.
// at(buildingId) gives the landmark a 3D building belongs to, for the card title.
const SHOW_AT_M = 70;

export async function loadLandmarks(viewer, nav) {
 const data = await loadJson('/landmarks.json');
 if (data.schemaVersion !== 2) throw new Error('landmarks.json is out of date. Run npm run data:landmarks');
 const landmarks = data.landmarks.map(([name, lon, lat, kind, buildingIds]) => ({name, position: [lon, lat], kind, buildingIds}));
 // buildingId -> landmark, for the card title.
 const byBuilding = new Map(landmarks.flatMap(l => l.buildingIds.map(id => [id, l])));
 const find = screenFinder(viewer, landmarks.map(l => l.position));
 const icons = viewer.scene.primitives.add(new Cesium.BillboardCollection({scene: viewer.scene}));
 const pin = landmarkPin();
 for (const l of landmarks) icons.add({position: Cesium.Cartesian3.fromDegrees(...l.position, 1), image: pin.image, width: pin.width, height: pin.height,
  disableDepthTestDistance: Number.POSITIVE_INFINITY});
 const zoomedIn = () => Math.round(nav.metersPerPixel() * 80 / 10) * 10 <= SHOW_AT_M;
 icons.show = zoomedIn();
 viewer.scene.postRender.addEventListener(() => {
  const now = zoomedIn();
  if (now !== icons.show) { icons.show = now; viewer.scene.requestRender(); }
 });
 viewer.scene.requestRender();
 return {data, landmarks,
  at: buildingId => byBuilding.get(buildingId) ?? null,
  pick(position) {
   if (!icons.show) return null;
   const i = find(position, 15);
   return i < 0 ? null : landmarks[i];
  },
 };
}
