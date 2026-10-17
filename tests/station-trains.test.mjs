// Parked trains at the Central Station: every car on its rail line, pointing along it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RAILS, trainCars} from '../src/data/stationTrains.js';

const KX = 111320 * Math.cos((60.17 * Math.PI) / 180),
  KY = 110540;
// Metres from a point to the straight rail, and the rail's bearing towards its start (south).
const offRail = ([a, b], [x, y]) => {
  const ax = a[0] * KX,
    ay = a[1] * KY,
    dx = b[0] * KX - ax,
    dy = b[1] * KY - ay;
  return Math.abs((x * KX - ax) * dy - (y * KY - ay) * dx) / Math.hypot(dx, dy);
};
const railBearing = ([a, b]) => ((Math.atan2((a[0] - b[0]) * KX, (a[1] - b[1]) * KY) * 180) / Math.PI + 360) % 360;

test('two trains of eight cars, each car on its rail and facing along it', () => {
  assert.equal(RAILS.length, 2);
  for (const rail of RAILS) {
    const cars = trainCars(rail);
    assert.equal(cars.length, 8);
    for (const car of cars) {
      assert.ok(offRail(rail, car.centre) < 0.01, `car ${offRail(rail, car.centre)} m off the rail`);
      assert.ok(Math.abs(car.bearing - railBearing(rail)) < 0.01, `bearing ${car.bearing} vs ${railBearing(rail)}`);
    }
    // Cabs at both ends of each four-car unit.
    assert.deepEqual(
      cars.map(c => c.cab),
      ['front', null, null, 'back', 'front', null, null, 'back'],
    );
  }
});

test('the two trains are far enough apart not to touch', () => {
  const [a, b] = RAILS.map(r => trainCars(r));
  const gap = Math.min(...a.map(c => offRail(RAILS[1], c.centre)));
  assert.ok(gap > 10, `only ${gap} m apart`);
});
