import * as Cesium from 'cesium';
import {HELSINKI, sunPosition} from '../data/sun.js';

// Sun tab (Ton, 14 Oct 2026): the light comes from the real sun at the chosen moment
// and the buildings cast shadows on each other and on the ground. Cesium points its
// shadows along scene.light, so one directional light does both.
//
// Other tabs (Ton, 15 Oct 2026): a calm sunset. A warm light from the west-south-west,
// 38 degrees up, so shadows stay short (about 1.3 times the building height) and soft
// shading sits under the buildings. Kept light on the GPU: a 2048 px shadow map that
// only covers the nearest 2.5 km, and the map draws only when something changes.
const CALM = {azimuth: 245, elevation: 38, color: new Cesium.Color(1, 0.9, 0.78), darkness: 0.55};
const ownColor = Cesium.Color.WHITE;
export function createSunShadows(viewer, tileset) {
  const scene = viewer.scene, intensity = scene.light.intensity;
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(HELSINKI.lon, HELSINKI.lat));
  const light = new Cesium.DirectionalLight({direction: Cesium.Cartesian3.negate(Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3()), intensity, color: ownColor});
  const local = new Cesium.Cartesian3();
  // Light direction from the sun's azimuth and height (degrees): east, north, up towards
  // the sun; the light travels the other way.
  const aim = (direction, azimuth, elevation) => {
    const az = Cesium.Math.toRadians(azimuth), el = Cesium.Math.toRadians(elevation);
    Cesium.Cartesian3.fromElements(-Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), -Math.sin(el), local);
    Cesium.Matrix4.multiplyByPointAsVector(frame, local, direction);
    return Cesium.Cartesian3.normalize(direction, direction);
  };
  const calmLight = new Cesium.DirectionalLight({direction: aim(new Cesium.Cartesian3(), CALM.azimuth, CALM.elevation), intensity: intensity * 1.1, color: CALM.color});
  const shadowMap = viewer.shadowMap;
  shadowMap.softShadows = true;
  shadowMap.maximumDistance = 2500;
  viewer.shadows = true;
  tileset.shadows = Cesium.ShadowMode.ENABLED;
  let on = false;
  const apply = () => {
    shadowMap.size = on ? 4096 : 2048;
    shadowMap.darkness = on ? 0.3 : CALM.darkness;
    scene.light = on ? light : calmLight;
    scene.requestRender();
  };
  apply();
  return {
    get on() { return on; },
    setOn(next) { on = next; apply(); },
    // Moves the light to the sun at ms. Returns the sun's azimuth and height (degrees).
    setTime(ms) {
      const sun = sunPosition(ms);
      // At sunrise and sunset the sun's centre is just under the horizon; the light
      // stays at least half a degree up so the shadows stay drawable.
      aim(light.direction, sun.azimuth, Math.max(sun.elevation, 0.5));
      scene.requestRender();
      return sun;
    },
  };
}
