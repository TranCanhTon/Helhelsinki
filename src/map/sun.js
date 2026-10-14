import * as Cesium from 'cesium';
import {HELSINKI, sunPosition} from '../data/sun.js';

// Sun tab (Ton, 14 Oct 2026): the light comes from the real sun at the chosen moment
// and the buildings cast shadows on each other and on the ground. Cesium points its
// shadows along scene.light, so one directional light does both. Shadows cost a
// second drawing pass, so they are on only while the Sun tab is open.
export function createSunShadows(viewer, tileset) {
  const scene = viewer.scene, normalLight = scene.light;
  const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(HELSINKI.lon, HELSINKI.lat));
  const light = new Cesium.DirectionalLight({direction: Cesium.Cartesian3.negate(Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3()), intensity: normalLight.intensity});
  const local = new Cesium.Cartesian3();
  const shadowMap = viewer.shadowMap;
  shadowMap.softShadows = true;
  shadowMap.size = 4096;
  let on = false;
  return {
    get on() { return on; },
    setOn(next) {
      on = next;
      viewer.shadows = on;
      tileset.shadows = on ? Cesium.ShadowMode.ENABLED : Cesium.ShadowMode.DISABLED;
      scene.light = on ? light : normalLight;
      scene.requestRender();
    },
    // Moves the light to the sun at ms. Returns the sun's azimuth and height (degrees).
    setTime(ms) {
      const sun = sunPosition(ms);
      // At sunrise and sunset the sun's centre is just under the horizon; the light
      // stays at least half a degree up so the shadows stay drawable.
      const az = Cesium.Math.toRadians(sun.azimuth), el = Cesium.Math.toRadians(Math.max(sun.elevation, 0.5));
      // East, north, up towards the sun; the light travels the other way.
      Cesium.Cartesian3.fromElements(-Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), -Math.sin(el), local);
      Cesium.Matrix4.multiplyByPointAsVector(frame, local, light.direction);
      Cesium.Cartesian3.normalize(light.direction, light.direction);
      scene.requestRender();
      return sun;
    },
  };
}
