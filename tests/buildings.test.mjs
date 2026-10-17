// Tests for the CityGML -> 3D Tiles pipeline, using invented test shapes
// (tests/fixtures/synthetic-citygml.mjs), never the published map data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCityGml, buildingIds} from '../scripts/lib/citygml.mjs';
import {triangulatePolygon, triangulatedArea, polygonNormal} from '../scripts/lib/triangulate.mjs';
import {encodeB3dm, decodeB3dm} from '../scripts/lib/b3dm.mjs';
import {enuFrame, geodeticToEcef} from '../scripts/lib/frame.mjs';
import {buildRegisterIndex, joinRegister} from '../scripts/lib/register-join.mjs';
import {syntheticCityGml} from './fixtures/synthetic-citygml.mjs';

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

test('courtyard: the hole stays a hole after triangulation', () => {
  const outer = [
    [0, 0, 0],
    [20, 0, 0],
    [20, 20, 0],
    [0, 20, 0],
  ];
  const hole = [
    [6, 6, 0],
    [14, 6, 0],
    [14, 14, 0],
    [6, 14, 0],
  ];
  const result = triangulatePolygon([outer, hole]);
  assert.ok(near(triangulatedArea(result), 400 - 64), `area ${triangulatedArea(result)}`);
});

test('vertical wall: keeps its full area instead of collapsing to a line', () => {
  const wall = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 0, 6],
    [0, 0, 6],
  ];
  const result = triangulatePolygon([wall]);
  assert.ok(near(triangulatedArea(result), 60));
  assert.ok(near(Math.abs(result.normal[1]), 1), 'wall should face along the y axis');
});

test('pitched roof: sloped polygon keeps its true (sloped) area', () => {
  const roof = [
    [0, 0, 6],
    [10, 0, 6],
    [10, 5, 9],
    [0, 5, 9],
  ];
  const result = triangulatePolygon([roof]);
  assert.ok(near(triangulatedArea(result), 10 * Math.hypot(5, 3)));
  assert.ok(result.normal[2] > 0.5, 'roof faces upwards');
});

test('every triangle faces the same way as its polygon', () => {
  const result = triangulatePolygon([
    [
      [0, 0, 0],
      [10, 0, 0],
      [10, 10, 0],
      [5, 3, 0],
      [0, 10, 0],
    ],
  ]);
  const n = polygonNormal(result.positions);
  for (let i = 0; i < result.indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(k => result.positions[result.indices[i + k]]);
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    assert.ok(cross * n[2] > 0);
  }
});

test('CityGML parsing: highest LOD only, building parts merged, planned flagged', () => {
  const {buildings, srsNames} = parseCityGml(syntheticCityGml);
  assert.deepEqual(srsNames, ['EPSG:3879']);
  const byId = Object.fromEntries(buildings.map(b => [b.id, b]));
  assert.deepEqual(Object.keys(byId).sort(), ['TEST_A', 'TEST_B', 'TEST_C', 'TEST_D']);
  // A: ground + roof + 8 walls at LOD2; the LOD1 solid is ignored.
  assert.equal(byId.TEST_A.lod, 2);
  assert.equal(byId.TEST_A.polygons.length, 10);
  assert.equal(byId.TEST_A.polygons[0].length, 2, 'ground keeps its courtyard hole');
  // C: two parts x (ground + roof + 4 walls).
  assert.equal(byId.TEST_C.parts, 2);
  assert.equal(byId.TEST_C.polygons.length, 12);
  assert.equal(byId.TEST_D.planned, true);
  assert.equal(byId.TEST_A.planned, false);
});

test('building IDs: RATU is normalised, VTJ-PRT is read', () => {
  const {buildings} = parseCityGml(syntheticCityGml);
  const byId = Object.fromEntries(buildings.map(b => [b.id, buildingIds(b.attributes)]));
  assert.deepEqual(byId.TEST_A, {ratu: '1001', vtjPrt: '100000001A'});
  assert.deepEqual(byId.TEST_B, {ratu: '1002', vtjPrt: null});
});

test('closing point of a ring is removed', () => {
  const {buildings} = parseCityGml(syntheticCityGml);
  const ring = buildings.find(b => b.id === 'TEST_B').polygons[0][0];
  assert.equal(ring.length, 4);
});

test('B3DM: what we write is what we read back', () => {
  const mesh = {
    positions: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 5, 5, 6, 5, 5, 5, 6, 5]),
    normals: Float32Array.from(Array(6).fill([0, 0, 1]).flat()),
    batchIds: Uint32Array.from([0, 0, 0, 1, 1, 1]),
    indices: Uint32Array.from([0, 1, 2, 3, 4, 5]),
  };
  const bytes = encodeB3dm(mesh, {buildingId: ['A', 'B']});
  assert.equal(bytes.length % 8, 0);
  const tile = decodeB3dm(bytes);
  assert.equal(tile.featureTable.BATCH_LENGTH, 2);
  assert.deepEqual(tile.batchTable.buildingId, ['A', 'B']);
  assert.deepEqual([...tile.batchIds], [0, 0, 0, 1, 1, 1]);
  assert.deepEqual([...tile.positions], [...mesh.positions]);
  assert.deepEqual([...tile.indices], [...mesh.indices]);
});

test('local frame: matches Cesium eastNorthUpToFixedFrame', async () => {
  const {Cartesian3, Transforms} = await import('cesium');
  const ours = enuFrame(24.95, 60.17, 0).matrix;
  const theirs = Array.from(Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(24.95, 60.17, 0)));
  ours.forEach((v, i) => assert.ok(Math.abs(v - theirs[i]) < 1e-6, `element ${i}: ${v} vs ${theirs[i]}`));
});

test('local frame: a point 100 m up is [0, 0, 100] locally', () => {
  const frame = enuFrame(24.95, 60.17, 0);
  const [e, n, u] = frame.toLocal(geodeticToEcef(24.95, 60.17, 100));
  assert.ok(near(e, 0, 1e-6) && near(n, 0, 1e-6) && near(u, 100, 1e-6));
});

test('register join: several addresses kept, conflicting type left unknown', () => {
  const index = buildRegisterIndex([
    {
      properties: {
        ratu: 5,
        vtj_prt: '1X',
        tila: 'voimassa',
        katunimi_suomi: 'Unioninkatu',
        katunimi_ruotsi: 'Unionsgatan',
        osoitenumero: '27',
        postinumero: '00170',
        tyyppi: 'Liikerakennus',
      },
    },
    {
      properties: {
        ratu: 5,
        vtj_prt: '1X',
        tila: 'voimassa',
        katunimi_suomi: 'Aleksanterinkatu',
        katunimi_ruotsi: 'Alexandersgatan',
        osoitenumero: '20',
        postinumero: '00170',
        tyyppi: 'Asuinrakennus',
      },
    },
  ]);
  const result = joinRegister({ratu: '5', vtjPrt: null}, index);
  assert.equal(result.registerJoin, 'matched-by-ratu');
  assert.deepEqual(result.addresses, ['Aleksanterinkatu 20', 'Unioninkatu 27']);
  assert.equal(result.addressSv, 'Alexandersgatan 20');
  assert.equal(result.postcode, '00170');
  assert.equal(result.use, null);
  assert.equal(joinRegister({ratu: '999', vtjPrt: null}, index).registerJoin, 'no-register-match');
});
