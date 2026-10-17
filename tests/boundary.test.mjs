import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unionDistricts, makeInsideTest, multiPolygonAreaKm2} from '../scripts/lib/boundary.mjs';

// Two invented neighbouring square "districts" and one separate "island".
const square = (x, y, s) => [
  [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
    [x, y],
  ],
];
const districts = [
  {properties: {nimi_fi: 'A'}, geometry: {type: 'Polygon', coordinates: square(24.9, 60.1, 0.1)}},
  {properties: {nimi_fi: 'B'}, geometry: {type: 'Polygon', coordinates: square(25.0, 60.1, 0.1)}},
  {properties: {nimi_fi: 'Island'}, geometry: {type: 'MultiPolygon', coordinates: [square(25.3, 60.0, 0.01)]}},
];

test('neighbouring districts merge into one piece, the island stays separate', () => {
  const merged = unionDistricts(districts);
  assert.equal(merged.type, 'MultiPolygon');
  assert.equal(merged.coordinates.length, 2);
});

test('inside test: inside, outside and island points', () => {
  const isInside = makeInsideTest(unionDistricts(districts));
  assert.equal(isInside([24.95, 60.15]), true);
  assert.equal(isInside([25.05, 60.15]), true);
  assert.equal(isInside([25.305, 60.005]), true);
  assert.equal(isInside([24.8, 60.15]), false);
  assert.equal(isInside([25.2, 60.15]), false);
});

test('area: a merged 0.2° x 0.1° rectangle at 60°N is about 124 km²', () => {
  const rectangle = [
    [
      [24.9, 60.1],
      [25.1, 60.1],
      [25.1, 60.2],
      [24.9, 60.2],
      [24.9, 60.1],
    ],
  ];
  const area = multiPolygonAreaKm2({type: 'MultiPolygon', coordinates: [rectangle]});
  assert.ok(area > 120 && area < 128, `area ${area}`);
});
