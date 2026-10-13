// Public transport: HSL stops, lines and route shapes inside Helsinki.
//
// 1. Downloads the HSL timetable (GTFS zip, about 80 MB) once. --force downloads it again.
// 2. Picks one ordinary weekday: the Tuesday, Wednesday or Thursday with the most
//    trips in the next three weeks of the timetable. Only trips running that day count.
// 3. Keeps platforms inside Helsinki where a line picks up passengers that day and
//    groups them into stops (same name and type, close together; src/data/transit.js).
// 4. Counts departures from 7:00 to 9:00 per stop, both directions together.
// 5. Per line and direction: the shape most trips use, simplified and cut at the
//    Helsinki border, so the map can draw it.
// 6. Writes public/transit.json and public/transit-routes.json. Line numbers only:
//    long names and headsigns name places in Espoo and Vantaa.
import {createWriteStream} from 'node:fs';
import {stat, rename, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {request} from './lib/http.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {ROOT, publishJson, datasetSection} from './lib/prepare.mjs';
import {openGtfs, parseCsvLine} from './lib/gtfs.mjs';
import {simplify} from './lib/simplify.mjs';
import {MODES, MODE_KEYS, modeOf, compareLines, activeServices, dayOf, groupStops} from '../src/data/transit.js';

const GTFS_URL = 'https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip';
const ZIP = 'data/raw/transit/hsl.zip';
const WINDOW = {from: 7 * 3600, to: 9 * 3600};

async function download() {
  const file = new URL(ZIP, ROOT);
  if (!process.argv.includes('--force')) {
    try { await stat(file); return; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  await mkdir(new URL('./', file), {recursive: true});
  console.log('downloading', GTFS_URL);
  const response = await request(GTFS_URL, {timeoutMs: 15 * 60000});
  if (!response.ok) throw new Error(`HSL timetable: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(new URL(ZIP + '.part', ROOT)));
  await rename(new URL(ZIP + '.part', ROOT), file);
}

const seconds = time => { const [h, m, s] = time.split(':').map(Number); return h * 3600 + m * 60 + s; };
const ymd = date => date.toISOString().slice(0, 10).replaceAll('-', '');
const dashed = date => `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

await download();
const boundary = await loadBoundary();
const gtfs = await openGtfs(fileURLToPath(new URL(ZIP, ROOT)));
const feed = (await gtfs.rows('feed_info.txt'))[0];
const calendar = await gtfs.rows('calendar.txt');
const exceptions = await gtfs.rows('calendar_dates.txt');

// Lines: one per line number and mode (HSL has several route_ids for some lines).
const lines = [], lineIndex = new Map(), routeLine = new Map(), unknownTypes = {};
for (const r of await gtfs.rows('routes.txt')) {
  const mode = modeOf(r.route_type);
  if (!mode) { unknownTypes[r.route_type] = (unknownTypes[r.route_type] ?? 0) + 1; continue; }
  const key = r.route_short_name + '|' + mode;
  if (!lineIndex.has(key)) { lineIndex.set(key, lines.length); lines.push({short: r.route_short_name, mode}); }
  routeLine.set(r.route_id, lineIndex.get(key));
}

const trips = [], tripsPerService = new Map();
await gtfs.each('trips.txt', (line, column) => {
  const f = parseCsvLine(line);
  const trip = {id: f[column('trip_id')], route: f[column('route_id')], service: f[column('service_id')],
    direction: f[column('direction_id')], shape: f[column('shape_id')]};
  trips.push(trip);
  tripsPerService.set(trip.service, (tripsPerService.get(trip.service) ?? 0) + 1);
});

// The counted day: Tuesday to Thursday with the most trips, in the next three weeks of the timetable.
const first = new Date(Math.max(Date.now(), Date.parse(dashed(feed.feed_start_date))));
let date = null, dateTrips = 0;
for (let i = 0; i < 21; i++) {
  const d = ymd(new Date(first.getTime() + i * 86400000));
  if (d > feed.feed_end_date) break;
  if (![2, 3, 4].includes(dayOf(d))) continue;
  const services = activeServices(calendar, exceptions, d);
  const count = [...services].reduce((sum, s) => sum + (tripsPerService.get(s) ?? 0), 0);
  if (count > dateTrips) { date = d; dateTrips = count; }
}
if (!date) throw new Error(`No Tuesday to Thursday in the timetable (${feed.feed_start_date} to ${feed.feed_end_date})`);
const services = activeServices(calendar, exceptions, date);
const activeTrips = new Map(), shapeUse = new Map();
for (const t of trips) {
  if (!services.has(t.service) || !routeLine.has(t.route)) continue;
  const line = routeLine.get(t.route);
  activeTrips.set(t.id, line);
  if (!t.shape) continue;
  const key = line + '|' + t.direction, use = shapeUse.get(key) ?? new Map();
  use.set(t.shape, (use.get(t.shape) ?? 0) + 1);
  shapeUse.set(key, use);
}
console.log('counted day', dashed(date), 'trips', activeTrips.size);

// Platforms inside Helsinki.
const platforms = new Map(), outside = {count: 0};
for (const s of await gtfs.rows('stops.txt')) {
  if (s.location_type && s.location_type.trim() !== '0') continue;
  const position = [Number(s.stop_lon), Number(s.stop_lat)];
  if (!position.every(Number.isFinite)) throw new Error(`Stop ${s.stop_id} has no coordinates`);
  if (!boundary.isInside(position)) { outside.count++; continue; }
  platforms.set(s.stop_id, {name: s.stop_name.trim(), position, lines: new Set(), departures: 0});
}

// Every stop time of the counted day: which lines pick up where, and departures in the window.
let stopTimes = 0, cols;
await gtfs.each('stop_times.txt', (line, column) => {
  cols ??= {trip: column('trip_id'), departure: column('departure_time'), stop: column('stop_id'), pickup: column('pickup_type')};
  // Most rows belong to trips of other days: skip them before parsing the whole line.
  if (cols.trip === 0 && !activeTrips.has(line.slice(0, line.indexOf(',')))) return;
  const f = parseCsvLine(line), lineNo = activeTrips.get(f[cols.trip]);
  if (lineNo === undefined) return;
  const platform = platforms.get(f[cols.stop]);
  if (!platform || f[cols.pickup] === '1') return;
  stopTimes++;
  platform.lines.add(lineNo);
  const t = seconds(f[cols.departure]);
  if (t >= WINDOW.from && t < WINDOW.to) platform.departures++;
});

const served = [...platforms.values()].filter(p => p.lines.size);
for (const p of served) p.mode = MODE_KEYS.find(m => [...p.lines].some(l => lines[l].mode === m));
const groupOf = groupStops(served);
const stops = [];
served.forEach((p, i) => {
  const g = stops[groupOf[i]] ??= {name: p.name, mode: p.mode, lines: new Set(), departures: 0};
  for (const l of p.lines) g.lines.add(l);
  g.departures += p.departures;
});

// Keep only lines that pick up somewhere in Helsinki, renumbered.
const usedLines = [...new Set(stops.flatMap(s => [...s.lines]))]
  .sort((a, b) => MODE_KEYS.indexOf(lines[a].mode) - MODE_KEYS.indexOf(lines[b].mode) || compareLines(lines[a].short, lines[b].short));
const newIndex = new Map(usedLines.map((l, i) => [l, i]));

// Shapes: the most used one per line and direction.
const wantedShapes = new Map();
for (const [key, use] of shapeUse) {
  const line = Number(key.split('|')[0]);
  if (!newIndex.has(line)) continue;
  const best = [...use].sort((a, b) => b[1] - a[1])[0][0];
  wantedShapes.set(best, line);
}
const shapePoints = new Map();
await gtfs.each('shapes.txt', (line, column) => {
  const f = line.split(','), id = f[column('shape_id')];
  if (!wantedShapes.has(id)) return;
  const list = shapePoints.get(id) ?? [];
  list.push([Number(f[column('shape_pt_sequence')]), Number(f[column('shape_pt_lon')]), Number(f[column('shape_pt_lat')])]);
  shapePoints.set(id, list);
});
const routePaths = usedLines.map(() => []);
let pathPoints = 0;
for (const [id, line] of wantedShapes) {
  const points = (shapePoints.get(id) ?? []).sort((a, b) => a[0] - b[0]).map(([, lon, lat]) => [lon, lat]);
  // Cut at the border: keep the runs of points inside Helsinki.
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      const kept = simplify(run, 3);
      routePaths[newIndex.get(line)].push(kept.flatMap(([lon, lat]) => [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]));
      pathPoints += kept.length;
    }
    run = [];
  };
  for (const point of points) { if (boundary.isInside(point)) run.push(point); else flush(); }
  flush();
}

const source = {url: GTFS_URL, license: 'Helsinki Region Transport (HSL), CC BY 4.0', feedVersion: feed.feed_version,
  feedStart: dashed(feed.feed_start_date), feedEnd: dashed(feed.feed_end_date)};
const method = `Timetable for ${dashed(date)} (the Tuesday to Thursday with most trips in the next three weeks). ` +
  'Platforms inside Helsinki where a line picks up passengers that day, grouped by name and type within 300 m. ' +
  'Departures from 7:00 to 9:00, both directions together. Route shapes: the most used shape per line and direction, ' +
  'simplified to 3 m and cut at the Helsinki border. Line numbers only. Not live data.';
await publishJson('public/transit.json', {schemaVersion: 1, source, method, date: dashed(date), window: {from: '07:00', to: '09:00', hours: 2},
  modes: MODES,
  // [line number, mode index]
  lines: usedLines.map(l => [lines[l].short, MODE_KEYS.indexOf(lines[l].mode)]),
  // [name, mode index, departures 7 to 9, line indexes]
  stops: stops.map(s => [s.name, MODE_KEYS.indexOf(s.mode), s.departures,
    [...s.lines].map(l => newIndex.get(l)).sort((a, b) => a - b)]),
  // [lon, lat, stop index]
  platforms: served.map((p, i) => [Math.round(p.position[0] * 1e6) / 1e6, Math.round(p.position[1] * 1e6) / 1e6, groupOf[i]])});
// Flat [lon, lat, lon, lat, ...] paths per line, same order as transit.json lines.
await publishJson('public/transit-routes.json', {schemaVersion: 1, date: dashed(date), paths: routePaths});

const byMode = Object.fromEntries(MODE_KEYS.map(m => [m, stops.filter(s => s.mode === m).length]));
const summary = {date: dashed(date), tripsThatDay: activeTrips.size, stopTimesCounted: stopTimes, platformsInHelsinki: platforms.size,
  platformsServed: served.length, platformsOutside: outside.count, stops: stops.length, stopsByMode: byMode, lines: usedLines.length,
  linesWithoutShape: routePaths.filter(p => !p.length).length, pathPoints, unknownRouteTypes: unknownTypes};
await datasetSection('transit', {...source, method, ...summary});
console.log(summary);
