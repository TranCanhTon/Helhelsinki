// Checks the sun calculator against known Helsinki values.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sunPosition, sunDay, helsinkiOffset, compassPoint} from '../src/data/sun.js';

// Helsinki clock time "HH:MM" of a moment.
const clock = ms => new Date(ms).toLocaleTimeString('en-GB', {timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit'});
const minutesApart = (a, b) => {
  const m = s => +s.slice(0, 2) * 60 + +s.slice(3);
  return Math.abs(m(a) - m(b));
};

test('Helsinki clock is UTC+3 in summer and UTC+2 in winter', () => {
  assert.equal(helsinkiOffset(Date.UTC(2026, 5, 21, 12)), 180);
  assert.equal(helsinkiOffset(Date.UTC(2026, 11, 21, 12)), 120);
});

test('midsummer: sunrise about 03:54, sunset about 22:50', () => {
  const day = sunDay(2026, 5);
  assert.ok(minutesApart(clock(day.sunrise), '03:54') <= 3, clock(day.sunrise));
  assert.ok(minutesApart(clock(day.sunset), '22:50') <= 3, clock(day.sunset));
  assert.equal(new Date(day.midnight).toISOString(), '2026-06-20T21:00:00.000Z');
});

test('midwinter: sunrise about 09:24, sunset about 15:13', () => {
  const day = sunDay(2026, 11);
  assert.ok(minutesApart(clock(day.sunrise), '09:24') <= 3, clock(day.sunrise));
  assert.ok(minutesApart(clock(day.sunset), '15:13') <= 3, clock(day.sunset));
});

test('at solar noon the sun is due south at 90 - latitude ± tilt', () => {
  const june = sunPosition(sunDay(2026, 5).noon), december = sunPosition(sunDay(2026, 11).noon);
  assert.ok(Math.abs(june.azimuth - 180) < 0.5, `azimuth ${june.azimuth}`);
  assert.ok(Math.abs(june.elevation - 53.3) < 0.3, `elevation ${june.elevation}`);
  assert.ok(Math.abs(december.elevation - 6.5) < 0.3, `elevation ${december.elevation}`);
});

test('at sunrise and sunset the sun sits on the horizon, rising in the east, setting in the west', () => {
  const day = sunDay(2026, 2), rise = sunPosition(day.sunrise), set = sunPosition(day.sunset);
  assert.ok(rise.elevation > -0.6 && rise.elevation < 0, `rise ${rise.elevation}`);
  assert.ok(set.elevation > -0.6 && set.elevation < 0, `set ${set.elevation}`);
  assert.ok(Math.abs(rise.azimuth - 90) < 5 && Math.abs(set.azimuth - 270) < 5, `${rise.azimuth} ${set.azimuth}`);
});

test('compass points', () => {
  assert.deepEqual([0, 44, 46, 180, 225, 350].map(compassPoint), [0, 1, 1, 4, 5, 0]);
});
