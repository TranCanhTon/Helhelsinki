import * as Cesium from 'cesium';
import Flatbush from 'flatbush';
import {loadJson} from '../data/load.js';
import {nearestStops, perHourText, MODE_KEYS} from '../data/transit.js';
import {metresBetween} from '../data/parking.js';
import {screenFinder} from './screenPick.js';
import {stopPin, MODE_COLORS, SQUARE_MODES} from './pinIcons.js';
import {t} from '../ui/i18n.js';
export {MODE_COLORS, SQUARE_MODES};

// Stop pins on the main map (data:transit), in every view, once the scale bar reads
// 60 m or less (Ton, 14 Oct 2026). Platforms closer than MERGE_M to each other become one pin, whatever
// their direction or type; a pin shows one icon per type. Only pins within
// NEAR_HOME_M of a home are drawn. The card's nearest stops use every platform.
const MERGE_M = 80, NEAR_HOME_M = 200, SHOW_AT_M = 60;

// homes: [lon, lat] of residential buildings.
export async function loadTransit(viewer, nav, homes) {
 const data = await loadJson('/transit.json');
 if (data.schemaVersion !== 1) throw new Error('transit.json is out of date. Run npm run data:transit');
 const modes = data.modes.map(m => m.key);
 const lines = data.lines.map(([short, mode]) => ({short, mode: modes[mode]}));
 const stops = data.stops.map(([name, mode, departures, lineIds], index) =>
  ({index, name, mode: modes[mode], departures, lines: lineIds.map(i => lines[i]), lineIds}));
 const nearest = nearestStops(data.platforms);

 const homeIndex = new Flatbush(Math.max(1, homes.length));
 for (const [lon, lat] of homes) homeIndex.add(lon, lat, lon, lat);
 if (!homes.length) homeIndex.add(0, 0, 0, 0);
 homeIndex.finish();
 const nearHome = ([lon, lat], metres = NEAR_HOME_M) => homes.length > 0 && homeIndex.search(lon - 0.006, lat - 0.003, lon + 0.006, lat + 0.003)
  .some(i => metresBetween([lon, lat], homes[i]) <= metres);
 // Merge close platforms (near homes) into pins, then keep the pins near homes.
 const merged = [];
 for (const [lon, lat, group] of data.platforms) {
  if (!nearHome([lon, lat], NEAR_HOME_M + MERGE_M)) continue;
  let pin = merged.find(p => metresBetween(p.anchor, [lon, lat]) <= MERGE_M);
  if (!pin) merged.push(pin = {anchor: [lon, lat], points: [], stops: new Set()});
  pin.points.push([lon, lat]); pin.stops.add(group);
 }
 const pins = merged.map(p => {
  const position = [p.points.reduce((s, q) => s + q[0], 0) / p.points.length, p.points.reduce((s, q) => s + q[1], 0) / p.points.length];
  const group = [...p.stops].map(i => stops[i]), lineSet = new Map();
  for (const s of group) for (const id of s.lineIds) lineSet.set(id, lines[id]);
  const pinModes = MODE_KEYS.filter(m => [...lineSet.values()].some(l => l.mode === m));
  return {position, stops: group, lines: [...lineSet.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]), modes: pinModes};
 }).filter(p => p.modes.length && nearHome(p.position));
 const findPin = screenFinder(viewer, pins.map(p => p.position));

 const billboards = viewer.scene.primitives.add(new Cesium.BillboardCollection({scene: viewer.scene}));
 for (const p of pins) {
  const pin = stopPin(p.modes);
  billboards.add({position: Cesium.Cartesian3.fromDegrees(...p.position, 1), image: pin.image, width: pin.width, height: pin.height,
   disableDepthTestDistance: Number.POSITIVE_INFINITY});
 }
 const zoomedIn = () => Math.round(nav.metersPerPixel() * 80 / 10) * 10 <= SHOW_AT_M;
 billboards.show = zoomedIn();
 viewer.scene.postRender.addEventListener(() => {
  const now = zoomedIn();
  if (now !== billboards.show) { billboards.show = now; viewer.scene.requestRender(); }
 });
 viewer.scene.requestRender();

 return {data, lines, stops, pins,
  // Up to three nearest stops within 1.5 km of a point: [{stop, distanceM}].
  nearest: point => nearest(point).map(({group, distanceM}) => ({stop: stops[group], distanceM})),
  perHour: stop => perHourText(stop.departures, data.window.hours),
  // Screen position -> {text} for the pin under it, or null.
  pick(position) {
   if (!billboards.show) return null;
   const i = findPin(position, 14);
   if (i < 0) return null;
   const p = pins[i], byMode = new Map();
   for (const l of p.lines) byMode.set(l.mode, [...(byMode.get(l.mode) ?? []), l.short]);
   const list = [...byMode].map(([mode, short]) => `${t(data.modes.find(m => m.key === mode).label)} ${short.join(' ')}`).join(' · ');
   return {text: `${[...new Set(p.stops.map(s => s.name))].join(' / ')} · ${list}`};
  },
 };
}
