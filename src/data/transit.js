// Public transport from the HSL timetable (GTFS).
//
// A "stop" here is what a rider calls a stop: the platforms with the same name
// and the same type of vehicle that lie close together (both sides of a street,
// all tracks of a station). Departures are counted on one weekday, both
// directions together. Timetable, not live data.
import Flatbush from 'flatbush';
import {metresBetween} from './parking.js';

// Order = which type a platform shows when several types use it.
export const MODES = [
  {key: 'metro', label: 'Metro'},
  {key: 'train', label: 'Train'},
  {key: 'tram', label: 'Tram'},
  {key: 'ferry', label: 'Ferry'},
  {key: 'bus', label: 'Bus'},
];
export const MODE_KEYS = MODES.map(m => m.key);

// GTFS route_type -> mode key, or null for a type we do not know. HSL uses the
// basic types for tram, metro and ferry and the extended ones for train (109),
// bus (700s) and the light rail line 15 (900).
export function modeOf(routeType) {
  const t = Number(routeType);
  if (t === 0 || (t >= 900 && t < 1000)) return 'tram';
  if (t === 1 || (t >= 400 && t < 500)) return 'metro';
  if (t === 2 || (t >= 100 && t < 200)) return 'train';
  if (t === 4 || (t >= 1000 && t < 1300)) return 'ferry';
  if (t === 3 || (t >= 700 && t < 800)) return 'bus';
  return null;
}

// Line numbers in reading order: 2, 7, 9, 23, 55, 71N, M1, M2.
export const compareLines = (a, b) => a.localeCompare(b, 'en', {numeric: true});

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const dayOf = date =>
  new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8))).getUTCDay();

// calendar rows + calendar_dates rows -> Set of service_ids running on date 'YYYYMMDD'.
export function activeServices(calendar, exceptions, date) {
  const day = WEEKDAYS[dayOf(date)],
    out = new Set();
  for (const c of calendar) if (c[day] === '1' && c.start_date <= date && date <= c.end_date) out.add(c.service_id);
  for (const e of exceptions) {
    if (e.date !== date) continue;
    if (e.exception_type === '1') out.add(e.service_id);
    else if (e.exception_type === '2') out.delete(e.service_id);
  }
  return out;
}

// stops: [{name, mode, position}] -> group number per stop. Same name and mode,
// and within maxM of the group's first platform.
export function groupStops(stops, maxM = 300) {
  const firsts = new Map(),
    out = [];
  let next = 0;
  for (const stop of stops) {
    const key = stop.name + '\u0000' + stop.mode,
      list = firsts.get(key) ?? [];
    let group = list.find(g => metresBetween(g.position, stop.position) <= maxM);
    if (!group) {
      group = {id: next++, position: stop.position};
      list.push(group);
      firsts.set(key, list);
    }
    out.push(group.id);
  }
  return out;
}

// platforms: [[lon, lat, group]] -> nearest(point) -> up to `count` groups within
// radiusM, closest first, each measured to its closest platform (straight line).
export function nearestStops(platforms, {count = 3, radiusM = 1500} = {}) {
  const index = new Flatbush(Math.max(1, platforms.length));
  for (const [lon, lat] of platforms) index.add(lon, lat, lon, lat);
  if (!platforms.length) index.add(0, 0, 0, 0);
  index.finish();
  return point => {
    if (!platforms.length) return [];
    const dLat = radiusM / 111320,
      dLon = radiusM / (111320 * Math.cos((point[1] * Math.PI) / 180));
    const best = new Map();
    for (const i of index.search(point[0] - dLon, point[1] - dLat, point[0] + dLon, point[1] + dLat)) {
      const [lon, lat, group] = platforms[i],
        d = metresBetween(point, [lon, lat]);
      if (d <= radiusM && d < (best.get(group) ?? Infinity)) best.set(group, d);
    }
    return [...best]
      .sort((a, b) => a[1] - b[1])
      .slice(0, count)
      .map(([group, d]) => ({group, distanceM: Math.round(d)}));
  };
}

// Departures in the counted window -> words for the card. Missing stays missing.
export function perHourText(departures, hours) {
  if (departures == null) return null;
  if (departures === 0) return 'no departures';
  const perHour = departures / hours;
  return perHour < 1 ? 'under 1 per hour' : `${Math.round(perHour)} per hour`;
}
