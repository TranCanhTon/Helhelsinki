import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeIndex, decodeIndex, detailFile} from '../src/data/buildingIndex.js';
import {flatTileset, contentTiles} from '../scripts/lib/split-buildings.mjs';

const record = (id, extra = {}) => ({
  buildingId: id,
  position: [24.9544981234, 60.1812334567],
  classEn: 'Apartment building',
  useEn: 'Residential building',
  district: {id: '10', nameFi: 'SÖRNÄINEN', nameSv: 'SÖRNÄS'},
  tileContentUri: '50994-13348.b3dm',
  address: 'Hämeentie 5b',
  sourceIds: {gmlId: id, ratu: '1879', vtjPrt: 'X'},
  noise: {road: 65, rail: null, metro: null, tram: 60, all: 65},
  facts: {floors: 8},
  ...extra,
});

test('the index keeps what the map needs and shares repeated texts', () => {
  const manifest = [record('A'), record('B', {classEn: null, noise: undefined, address: null, district: null})];
  const index = encodeIndex(manifest);
  assert.equal(index.classes.length, 1);
  assert.equal(index.districts.length, 1);
  const [a, b] = decodeIndex(JSON.parse(JSON.stringify(index)));
  assert.deepEqual(a, {
    buildingId: 'A',
    position: [24.954498, 60.181233],
    classEn: 'Apartment building',
    useEn: 'Residential building',
    district: {id: '10', nameFi: 'SÖRNÄINEN', nameSv: 'SÖRNÄS'},
    tileContentUri: '50994-13348.b3dm',
    address: 'Hämeentie 5b',
    sourceIds: {ratu: '1879'},
    noise: {road: 65, rail: null, metro: null, tram: 60, all: 65},
  });
  // Missing stays missing: no class, no noise run, no address, no district.
  assert.equal(b.classEn, null);
  assert.equal(b.noise, null);
  assert.equal(b.address, null);
  assert.equal(b.district, null);
  assert.equal(a.facts, undefined, 'full facts stay in the detail files');
});

test('an old index is refused with the command to run', () => {
  assert.throws(() => decodeIndex({schemaVersion: 0, buildings: []}), /data:split/);
  assert.equal(detailFile('50994-13348.b3dm'), '50994-13348.json');
});

test('a tree of tiles becomes one flat list again, every tile loading when in view', () => {
  const box = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
  const leaf = uri => ({boundingVolume: {box}, geometricError: 0, content: {uri}});
  const tree = {
    asset: {version: '1.0'},
    geometricError: 1e5,
    root: {
      transform: [1],
      boundingVolume: {box},
      geometricError: 1e5,
      refine: 'REPLACE',
      children: ['a.b3dm', 'b.b3dm'].map(uri => ({
        boundingVolume: {box},
        geometricError: 100,
        refine: 'REPLACE',
        children: [leaf(uri)],
      })),
    },
  };
  const flat = flatTileset(tree);
  assert.deepEqual(flat.root.transform, [1]);
  assert.equal(flat.root.refine, 'ADD');
  assert.deepEqual(flat.root.children, [leaf('a.b3dm'), leaf('b.b3dm')]);
  assert.deepEqual(
    contentTiles(flat).map(t => t.content.uri),
    ['a.b3dm', 'b.b3dm'],
  );
  assert.deepEqual(flatTileset(flat), flat);
});
