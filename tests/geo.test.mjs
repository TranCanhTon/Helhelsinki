// Checks the coordinate conversion between longitude/latitude and the
// Finnish grid (EPSG:3879) against known values.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lonLatToGrid, gridToLonLat, gridSquare} from '../scripts/lib/geo.mjs';

test('the zone centre meridian 25°E maps to east = 25 500 000 m', () => {
  const [east] = lonLatToGrid([25, 60.17]);
  assert.ok(Math.abs(east - 25500000) < 0.001);
});

test('converting there and back returns the same point', () => {
  const start = [24.9525, 60.1695];
  const [lon, lat] = gridToLonLat(lonLatToGrid(start));
  assert.ok(Math.abs(lon - start[0]) < 1e-9 && Math.abs(lat - start[1]) < 1e-9);
});

test('central Helsinki lands in the expected grid range', () => {
  const [east, north] = lonLatToGrid([24.95, 60.17]);
  assert.ok(east > 25496000 && east < 25498000, `east ${east}`);
  assert.ok(north > 6672000 && north < 6674000, `north ${north}`);
});

test('gridSquare makes a square of the requested size', () => {
  const [x0, y0, x1, y1] = gridSquare([24.95, 60.17], 400);
  assert.equal(x1 - x0, 400);
  assert.equal(y1 - y0, 400);
});
