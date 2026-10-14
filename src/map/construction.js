import * as Cesium from 'cesium';
import {loadJson} from '../data/load.js';
import {nearbyIndex, helsinkiToday, workStatus} from '../data/construction.js';

// Construction work areas (data:construction), drawn under Noise > Construction as a
// see-through fill with a solid outline. One blue, darker for heavier work (lighter
// on the dark map, where light stands out). Blue is the one hue the noise colours
// do not use. Checked with the dataviz ordinal validator on the street and land
// colours of both ground maps. Heavier work also gets a thicker outline.
export const CONSTRUCTION_COLORS = {light: '#2a78d6', medium: '#6da7ec', heavy: '#b7d3f6'};
const STYLE = {
 light: {alpha: 0.45, width: 1.25, height: 0.32},
 medium: {alpha: 0.50, width: 1.75, height: 0.34},
 heavy: {alpha: 0.55, width: 2.5, height: 0.36},
};

export async function loadConstruction(viewer) {
 const data = await loadJson('/construction.json');
 if (data.schemaVersion !== 1) throw new Error('construction.json is out of date. Run npm run data:construction');
 const near = nearbyIndex(data.works, data.radiusM);
 let visible = false, drawn = null;

 const ring = r => Cesium.Cartesian3.fromDegreesArray(r.slice(0, -1).flat());
 const draw = () => {
  if (drawn) { viewer.scene.primitives.remove(drawn.fill); viewer.scene.primitives.remove(drawn.edges); drawn = null; }
  const today = helsinkiToday(), colors = CONSTRUCTION_COLORS, instances = [], edges = new Cesium.PolylineCollection();
  // Light work first, heavy last, so heavy outlines sit on top where areas overlap.
  for (const level of ['light', 'medium', 'heavy']) {
   const style = STYLE[level], color = Cesium.Color.fromCssColorString(colors[level]);
   for (const work of data.works) {
    if (work.level !== level || workStatus(work, today) === 'over') continue;
    for (const [outer, ...holes] of work.polygons) {
     instances.push(new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({polygonHierarchy: new Cesium.PolygonHierarchy(ring(outer), holes.map(h => new Cesium.PolygonHierarchy(ring(h)))),
       height: style.height, vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT}),
      attributes: {color: Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(style.alpha))},
     }));
     edges.add({positions: Cesium.Cartesian3.fromDegreesArrayHeights(outer.flatMap(([x, y]) => [x, y, style.height + 0.2])), width: style.width, material: Cesium.Material.fromType('Color', {color})});
    }
   }
  }
  const fill = new Cesium.Primitive({geometryInstances: instances, appearance: new Cesium.PerInstanceColorAppearance({flat: true, translucent: true})});
  drawn = {fill: viewer.scene.primitives.add(fill), edges: viewer.scene.primitives.add(edges)};
  drawn.fill.show = drawn.edges.show = visible;
  // The fill is cut into triangles in the background; keep drawing until it is ready.
  const wait = () => { viewer.scene.requestRender(); if (drawn?.fill === fill && !fill.ready) setTimeout(wait, 100); };
  wait();
 };

 return {data,
  // Works within 200 m of a point that are not over yet, nearest first.
  near: point => near(point, helsinkiToday()),
  setVisible(on) {
   visible = on;
   if (on && !drawn) draw();
   if (drawn) drawn.fill.show = drawn.edges.show = on;
   viewer.scene.requestRender();
  },
  colors: () => CONSTRUCTION_COLORS,
 };
}
