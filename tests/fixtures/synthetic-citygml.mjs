// SYNTHETIC TEST DATA. These buildings are invented shapes for automated
// tests only. They are never published or shown on the map.
//
// It builds a small CityGML 2.0 document with the tricky cases the converter
// must handle: a courtyard (hole in roof and floor), vertical walls, a pitched
// roof, a building made of two parts, a building that has both an LOD1 and an
// LOD2 version, and a planned (not built) building.

const E = 25497250, N = 6672950; // near Senate Square, EPSG:3879 metres

const ring = points => {
  const closed = [...points, points[0]];
  return `<gml:LinearRing><gml:posList srsDimension="3">${closed.flat().join(' ')}</gml:posList></gml:LinearRing>`;
};
let polygonCounter = 0;
export const polygon = (outer, holes = [], id = `poly_${++polygonCounter}`) =>
  `<gml:Polygon gml:id="${id}"><gml:exterior>${ring(outer)}</gml:exterior>${holes.map(h => `<gml:interior>${ring(h)}</gml:interior>`).join('')}</gml:Polygon>`;
const surface = (type, polygons, lod = 2) =>
  `<bldg:boundedBy><bldg:${type}><bldg:lod${lod}MultiSurface><gml:MultiSurface>${polygons.map(p => `<gml:surfaceMember>${p}</gml:surfaceMember>`).join('')}</gml:MultiSurface></bldg:lod${lod}MultiSurface></bldg:${type}></bldg:boundedBy>`;
const square = (x0, y0, size, z) => [[x0, y0, z], [x0 + size, y0, z], [x0 + size, y0 + size, z], [x0, y0 + size, z]];
const walls = (corners, z0, z1) => corners.map((a, i) => {
  const b = corners[(i + 1) % corners.length];
  return polygon([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]);
});
const generic = (name, value) => `<gen:stringAttribute name="${name}"><gen:value>${value}</gen:value></gen:stringAttribute>`;

// A: 20 m x 20 m block with an 8 m x 8 m courtyard, 15 m tall, LOD2,
// plus an LOD1 solid of the same building that must be ignored.
const outerA = square(E, N, 20, 0).map(p => p.slice(0, 2)), holeA = square(E + 6, N + 6, 8, 0).map(p => p.slice(0, 2));
const at = (pts, z) => pts.map(([x, y]) => [x, y, z]);
const buildingA = `<bldg:Building gml:id="TEST_A">
  ${generic('RATU', '1001')}${generic('VTJ_PRT', '100000001A')}
  <bldg:lod1Solid><gml:Solid><gml:exterior><gml:CompositeSurface><gml:surfaceMember>${polygon(at(outerA, 15))}</gml:surfaceMember></gml:CompositeSurface></gml:exterior></gml:Solid></bldg:lod1Solid>
  ${surface('GroundSurface', [polygon(at(outerA, 0), [at(holeA, 0)])])}
  ${surface('RoofSurface', [polygon(at(outerA, 15), [at(holeA, 15)])])}
  ${surface('WallSurface', [...walls(outerA, 0, 15), ...walls(holeA, 0, 15)])}
</bldg:Building>`;

// B: 10 m x 10 m house with a pitched roof (ridge along x at 9 m, eaves at 6 m).
const x = E + 40, y = N;
const buildingB = `<bldg:Building gml:id="TEST_B">
  ${generic('Rakennustunnus_(RATU)', '1002.0')}
  ${surface('GroundSurface', [polygon(square(x, y, 10, 0))])}
  ${surface('RoofSurface', [
    polygon([[x, y, 6], [x + 10, y, 6], [x + 10, y + 5, 9], [x, y + 5, 9]]),
    polygon([[x, y + 5, 9], [x + 10, y + 5, 9], [x + 10, y + 10, 6], [x, y + 10, 6]]),
  ])}
  ${surface('WallSurface', [
    polygon([[x, y, 0], [x + 10, y, 0], [x + 10, y, 6], [x, y, 6]]),
    polygon([[x, y + 10, 0], [x + 10, y + 10, 0], [x + 10, y + 10, 6], [x, y + 10, 6]]),
    polygon([[x, y, 0], [x, y + 10, 0], [x, y + 10, 6], [x, y + 5, 9], [x, y, 6]]),
    polygon([[x + 10, y, 0], [x + 10, y + 10, 0], [x + 10, y + 10, 6], [x + 10, y + 5, 9], [x + 10, y, 6]]),
  ])}
</bldg:Building>`;

// C: two building parts (10 m and 5 m tall boxes) belonging to one building.
const box = (x0, y0, size, h) => [
  surface('GroundSurface', [polygon(square(x0, y0, size, 0))]),
  surface('RoofSurface', [polygon(square(x0, y0, size, h))]),
  surface('WallSurface', walls(square(x0, y0, size, 0), 0, h)),
].join('');
const buildingC = `<bldg:Building gml:id="TEST_C">
  ${generic('RATU', '1003')}
  <bldg:consistsOfBuildingPart><bldg:BuildingPart gml:id="TEST_C_1">${box(E, N + 40, 10, 10)}</bldg:BuildingPart></bldg:consistsOfBuildingPart>
  <bldg:consistsOfBuildingPart><bldg:BuildingPart gml:id="TEST_C_2">${box(E + 10, N + 40, 6, 5)}</bldg:BuildingPart></bldg:consistsOfBuildingPart>
</bldg:Building>`;

// D: planned building, must be skipped.
const buildingD = `<bldg:Building gml:id="TEST_D">
  ${generic('SUUNNITELMA_ALUE', 'suunnitteilla')}
  ${box(E + 40, N + 40, 5, 5)}
</bldg:Building>`;

export const syntheticCityGml = `<?xml version="1.0" encoding="UTF-8"?>
<core:CityModel xmlns:core="http://www.opengis.net/citygml/2.0" xmlns:bldg="http://www.opengis.net/citygml/building/2.0"
  xmlns:gen="http://www.opengis.net/citygml/generics/2.0" xmlns:gml="http://www.opengis.net/gml">
  <gml:boundedBy><gml:Envelope srsName="EPSG:3879" srsDimension="3"><gml:lowerCorner>${E} ${N} 0</gml:lowerCorner><gml:upperCorner>${E + 50} ${N + 50} 15</gml:upperCorner></gml:Envelope></gml:boundedBy>
  <core:cityObjectMember>${buildingA}</core:cityObjectMember>
  <core:cityObjectMember>${buildingB}</core:cityObjectMember>
  <core:cityObjectMember>${buildingC}</core:cityObjectMember>
  <core:cityObjectMember>${buildingD}</core:cityObjectMember>
</core:CityModel>`;
