import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bandIndex,
  bandProblem,
  withAll,
  bandList,
  bandLabel,
  wallPoints,
  loudestNear,
  isApartmentBuilding,
  noiseReason,
} from '../src/data/noise.js';
import {readState} from '../src/data/urlState.js';

const square = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const band = (lo, hi, ...rings) => ({
  type: 'Feature',
  properties: {db_lo: lo, db_hi: hi},
  geometry: {type: 'Polygon', coordinates: rings},
});

test('overlapping bands: the highest wins', () => {
  const at = bandIndex([
    band(55, 60, square(0, 0, 10, 10)),
    band(65, 70, square(4, 4, 6, 6)),
    band(60, 65, square(0, 0, 10, 10)),
  ]);
  assert.equal(at([5, 5]), 65);
  assert.equal(at([1, 1]), 60);
});

test('a point in a hole is not in that band', () => {
  const at = bandIndex([band(50, 55, square(0, 0, 10, 10), square(4, 4, 6, 6))]);
  assert.equal(at([5, 5]), null);
  assert.equal(at([2, 2]), 50);
});

test('missing stays null, not 0 dB', () => {
  const at = bandIndex([band(45, 50, square(0, 0, 1, 1))]);
  assert.equal(at([5, 5]), null);
  assert.equal(bandIndex([])([0, 0]), null);
  assert.equal(withAll({road: null, rail: null, metro: null, tram: null}).all, null);
});

test('All is the highest single mode, never a sum', () => {
  const all = withAll({road: 60, rail: 60, metro: null, tram: 55}).all;
  assert.equal(all, 60);
  assert.notEqual(all, 63); // 60 + 60 dB would add up to about 63 dB
});

test('band checks and labels', () => {
  assert.equal(bandProblem(band(50, 55, square(0, 0, 1, 1))), null);
  assert.equal(bandProblem(band(75, null, square(0, 0, 1, 1))), null);
  assert.match(bandProblem(band(55, 50, square(0, 0, 1, 1))), /db_hi/);
  assert.match(bandProblem(band(null, 50, square(0, 0, 1, 1))), /db_lo/);
  assert.match(
    bandProblem({properties: {db_lo: 50, db_hi: 55}, geometry: {type: 'Point', coordinates: [0, 0]}}),
    /polygon/,
  );
  assert.deepEqual(bandList([band(55, 60, []), band(45, 50, []), band(75, null, [])]), [
    {lo: 45, hi: 50},
    {lo: 55, hi: 60},
    {lo: 75, hi: null},
  ]);
  assert.equal(bandLabel({lo: 75, hi: null}), '75 dB and above');
});

test('noise view and mode come back from the URL', () => {
  const home = {lon: 24.9, lat: 60.2, heading: 0, pitch: -40, range: 1000};
  assert.deepEqual(
    [readState('?view=noise&noise=tram', home).metric, readState('?view=noise&noise=tram', home).noiseMode],
    ['noise', 'tram'],
  );
  assert.equal(readState('?view=noise&noise=jet', home).noiseMode, 'all');
});

test('the wall check finds a band the centre point misses', () => {
  const bandAt = ([x]) => (x > 25.0001 ? 60 : null);
  assert.equal(bandAt([25, 60]), null);
  assert.equal(loudestNear(bandAt, [25, 60], 10), 60);
  assert.equal(
    loudestNear(() => null, [25, 60], 10),
    null,
  );
  assert.equal(wallPoints([25, 60]).length, 9);
});

test('noise colours and cards are for apartment buildings only', () => {
  assert.equal(isApartmentBuilding({classEn: 'Apartment building'}), true);
  assert.equal(isApartmentBuilding({classEn: 'Small apartment building'}), true);
  assert.equal(isApartmentBuilding({classEn: 'Detached house'}), false);
  assert.equal(isApartmentBuilding({classEn: 'Office building'}), false);
  assert.equal(isApartmentBuilding(null), false);
});

test('the reason names the loudest source first, missing stays missing', () => {
  const band = lo => ({lo, hi: lo === 75 ? null : lo + 5});
  assert.equal(
    noiseReason({road: 65, rail: null, metro: null, tram: 55}, band),
    'Road traffic is the loudest source here (65 to 70 dB). Also trams (55 to 60 dB).',
  );
  assert.equal(
    noiseReason({road: null, rail: 75, metro: null, tram: null}, band),
    'Trains are the loudest source here (75 dB and above).',
  );
  assert.equal(noiseReason({road: null, rail: null, metro: null, tram: null}, band), null);
});
