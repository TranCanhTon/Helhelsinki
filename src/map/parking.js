import * as Cesium from 'cesium';
import {loadJson} from '../data/load.js';
import {nearbyIndex, zoneLookup, zonePrice, PARKING_GROUPS} from '../data/parking.js';

// Parking view (data:parking): thin strips along the kerb where the city mapped
// free, paid and resident permit parking. Each strip is the mapped parking areas
// grown by 1.5 m and merged, drawn as a near solid fill in its group's colour, no
// outline (Ton, 15 Oct 2026: the wide outlined blobs looked ugly).
// Zones load the first time the view opens.
// Colours checked with the dataviz palette validator (all pairs, light and dark map).
export const PARKING_COLORS = {free: '#199e70', paid: '#d95926', permit: '#3987e5', other: '#7d847f'};
const FILL_ALPHA = 0.85;

export async function loadParking(viewer) {
  const data = await loadJson('/parking.json');
  if (data.schemaVersion !== 2) throw new Error('parking.json is out of date. Run npm run data:parking');
  const types = data.types;
  const segments = data.segments.map(([id, lon, lat, type, capacity]) => ({
    id,
    position: [lon, lat],
    type: types[type].key,
    group: types[type].group,
    capacity,
  }));
  const near = nearbyIndex(segments);
  const asFeatures = zones => zones.map(z => ({type: 'Feature', properties: z, geometry: z.geometry}));
  const paidZoneAt = zoneLookup(asFeatures(data.paidZones), z => ({
    number: z.number,
    name: z.name,
    price: zonePrice(z.note),
    link: z.link,
  }));
  const residentZoneAt = zoneLookup(asFeatures(data.residentZones), z => ({code: z.code, name: z.name}));
  let visible = false,
    zones = null,
    drawn = null,
    loading = null;

  const ring = r => Cesium.Cartesian3.fromDegreesArray(r.slice(0, -1).flat());
  const draw = () => {
    if (drawn) {
      viewer.scene.primitives.remove(drawn.fill);
      drawn = null;
    }
    if (!zones) return;
    const colors = PARKING_COLORS,
      instances = [];
    for (const {key} of PARKING_GROUPS) {
      const color = Cesium.Color.fromCssColorString(colors[key]);
      for (const [outer, ...holes] of zones.zones[key]) {
        instances.push(
          new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(
                ring(outer),
                holes.map(h => new Cesium.PolygonHierarchy(ring(h))),
              ),
              height: 0.3,
              vertexFormat: Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
            }),
            attributes: {color: Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(FILL_ALPHA))},
          }),
        );
      }
    }
    const fill = new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({flat: true, translucent: true}),
    });
    drawn = {fill: viewer.scene.primitives.add(fill)};
    drawn.fill.show = visible;
    // The fill is cut into triangles in the background; keep drawing until it is ready.
    const wait = () => {
      viewer.scene.requestRender();
      if (drawn?.fill === fill && !fill.ready) setTimeout(wait, 100);
    };
    wait();
  };

  return {
    data,
    // Summary for a point: spaces per group within 200 m, other places, zones.
    near: point => ({...near(point), paidZone: paidZoneAt(point), residentZone: residentZoneAt(point)}),
    setVisible(on) {
      visible = on;
      if (drawn) drawn.fill.show = on;
      if (on && !zones)
        loading ??= loadJson('/parking-zones.json')
          .then(z => {
            zones = z;
            draw();
          })
          .catch(error => console.warn('Parking zones unavailable', error));
      viewer.scene.requestRender();
    },
    colors: () => PARKING_COLORS,
  };
}
