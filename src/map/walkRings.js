import * as Cesium from 'cesium';
import {num} from '../ui/i18n.js';

// Two faint dashed rings around the picked building, 500 m and 1 km (Ton, 16 Oct 2026):
// the same distances the card uses for shops and services. Straight-line distance,
// not walking time.
const RINGS_M = [500, 1000],
  STEPS = 160,
  HEIGHT_M = 0.6;
const LINE = Cesium.Color.fromCssColorString('#e6eee9').withAlpha(0.55);
const GAP = Cesium.Color.fromCssColorString('#101413').withAlpha(0.25);
const INK = Cesium.Color.fromCssColorString('#e6eee9'),
  HALO = Cesium.Color.fromCssColorString('#101413');

const ringPoints = ([lon, lat], metres) => {
  const dLat = metres / 111320,
    dLon = metres / (111320 * Math.cos((lat * Math.PI) / 180)),
    out = [];
  for (let i = 0; i <= STEPS; i++) {
    const a = (i / STEPS) * 2 * Math.PI;
    out.push(lon + dLon * Math.sin(a), lat + dLat * Math.cos(a), HEIGHT_M);
  }
  return Cesium.Cartesian3.fromDegreesArrayHeights(out);
};

export function createWalkRings(viewer) {
  let entities = [];
  return {
    // [lon, lat] or null to remove.
    show(position) {
      for (const e of entities) viewer.entities.remove(e);
      entities = [];
      if (position)
        for (const metres of RINGS_M) {
          const text = metres >= 1000 ? num(metres / 1000) + ' km' : num(metres) + ' m';
          entities.push(
            viewer.entities.add({
              polyline: {
                positions: ringPoints(position, metres),
                width: 1.6,
                arcType: Cesium.ArcType.NONE,
                material: new Cesium.PolylineDashMaterialProperty({color: LINE, gapColor: GAP, dashLength: 14}),
              },
            }),
          );
          // The label sits on the ring's south side, which faces the camera at the base angle.
          entities.push(
            viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(position[0], position[1] - metres / 111320, HEIGHT_M),
              label: {
                text,
                font: '600 16px Khand, sans-serif',
                fillColor: INK,
                outlineColor: HALO,
                outlineWidth: 4,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
            }),
          );
        }
      viewer.scene.requestRender();
    },
  };
}
