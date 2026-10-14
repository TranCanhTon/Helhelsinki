// Two commuter trains parked at Helsinki Central Station (Ton, 14 Oct 2026). They do not
// move and use no live data: a picture of the station, not a timetable.
//
// They stand on two rail lines of the city's guide map line layer (Opaskartta_muuviiva,
// "rautatie", ids 534 and 533), the same lines the ground map draws, so the cars sit
// on the drawn rails. Both lines start at the platform end by the station building and
// run straight north for about 375 m; only that first stretch is used.
export const RAILS = [
  [[24.94115103, 60.17157738], [24.94077464, 60.17504876]],   // line 534
  [[24.94154049, 60.17158757], [24.94119231, 60.17497746]],   // line 533
];
// Each train: two Sm5-style units of four cars, the front FRONT_M from the platform end.
const CAR_M = 18.75, GAP_M = 0.6, CARS_PER_UNIT = 4, UNITS = 2, FRONT_M = 15;
const KX = 111320 * Math.cos(60.17 * Math.PI / 180), KY = 110540;

// [lon, lat] at metres along a rail from its first point.
function pointAt(rail, along) {
  let left = along;
  for (let i = 1; i < rail.length; i++) {
    const [a, b] = [rail[i - 1], rail[i]], d = Math.hypot((b[0] - a[0]) * KX, (b[1] - a[1]) * KY);
    if (left <= d) return [a[0] + (b[0] - a[0]) * left / d, a[1] + (b[1] - a[1]) * left / d];
    left -= d;
  }
  return null;
}

// The cars of one train, front first: centre, bearing (degrees from north, towards the
// front) and which end shows a cab. The front faces the buffer end, south.
export function trainCars(rail) {
  const cars = [];
  for (let i = 0; i < CARS_PER_UNIT * UNITS; i++) {
    const front = FRONT_M + i * (CAR_M + GAP_M), back = front + CAR_M;
    const a = pointAt(rail, front), b = pointAt(rail, back);
    if (!a || !b) continue;
    const inUnit = i % CARS_PER_UNIT;
    cars.push({centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      bearing: (Math.atan2((a[0] - b[0]) * KX, (a[1] - b[1]) * KY) * 180 / Math.PI + 360) % 360,
      cab: inUnit === 0 ? 'front' : inUnit === CARS_PER_UNIT - 1 ? 'back' : null});
  }
  return cars;
}
