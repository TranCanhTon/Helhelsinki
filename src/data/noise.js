// Noise bands per building, from the city's 2022 noise study (Lden).
//
// Each source polygon is one modelled band, e.g. 55 to 60 dB. A building gets
// the loudest band at its centre or within 10 m of it. Polygons can overlap; the
// highest band wins. "All" is the highest band of any mode, never a sum of decibels.
// No polygon at the point means no band: null, never 0 dB.
import Flatbush from 'flatbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

export const NOISE_MODES = [
  {key: 'road', label: 'Road', layer: 'Meluselvitys_2022_Helsinki_kadut_ja_maantiet_Lden'},
  {key: 'rail', label: 'Rail', layer: 'Meluselvitys_2022_Helsinki_rautatiet_Lden'},
  {key: 'metro', label: 'Metro', layer: 'Meluselvitys_2022_Helsinki_metro_Lden'},
  {key: 'tram', label: 'Tram', layer: 'Meluselvitys_2022_Helsinki_raitiotie_Lden'},
];

// Why a source record cannot be used, or null if it is fine.
export function bandProblem(feature) {
  const {db_lo: lo, db_hi: hi} = feature.properties ?? {};
  const type = feature.geometry?.type;
  if (type !== 'Polygon' && type !== 'MultiPolygon') return 'no polygon geometry';
  if (typeof lo !== 'number' || !Number.isFinite(lo)) return 'db_lo missing';
  if (hi !== null && hi !== undefined && !(typeof hi === 'number' && hi > lo)) return 'db_hi not above db_lo';
  return null;
}

const bounds = geometry => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) for (const [x, y] of polygon[0]) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
};

// features -> point lookup: bandAt([lon, lat]) -> highest db_lo containing the point, or null.
// Box search first, then the exact test, which respects holes.
export function bandIndex(features) {
  if (!features.length) return () => null;
  const index = new Flatbush(features.length);
  for (const f of features) index.add(...bounds(f.geometry));
  index.finish();
  return ([x, y]) => {
    let best = null;
    for (const i of index.search(x, y, x, y)) {
      const f = features[i], lo = f.properties.db_lo;
      if ((best === null || lo > best) && booleanPointInPolygon([x, y], f)) best = lo;
    }
    return best;
  };
}

// {road, rail, ...} -> the same plus all: the highest band of any mode, or null if none.
export function withAll(bands) {
  const values = NOISE_MODES.map(m => bands[m.key]).filter(v => v !== null && v !== undefined);
  return {...bands, all: values.length ? Math.max(...values) : null};
}

// The building's centre and eight points WALL_M around it. The noise map has gaps,
// so one centre point can miss the level the walls get. Ton chose this (13 Oct 2026).
export const WALL_M = 10;
export function wallPoints([lon, lat], metres = WALL_M) {
  const dLon = metres / (111320 * Math.cos(lat * Math.PI / 180)), dLat = metres / 110540;
  return [[lon, lat], ...Array.from({length: 8}, (_, k) => [lon + Math.cos(k * Math.PI / 4) * dLon, lat + Math.sin(k * Math.PI / 4) * dLat])];
}
// Loudest band of a lookup over the wall points, or null.
export function loudestNear(bandAt, position, metres = WALL_M) {
  let best = null;
  for (const p of wallPoints(position, metres)) { const v = bandAt(p); if (v !== null && (best === null || v > best)) best = v; }
  return best;
}

// Noise colours and the card's noise section are for apartment buildings only (Ton, 13 Oct 2026).
export const isApartmentBuilding = record => /^(apartment building|small apartment building|residential building)$/i.test(record?.classEn ?? '');

// Why a building is noisy, in words, from its bands per source:
// "Road traffic is the loudest source here (65 to 70 dB). Trams add 55 to 60 dB." or null.
const SOURCE_WORDS = {road: ['Road traffic is', 'road traffic'], rail: ['Trains are', 'trains'], metro: ['The metro is', 'the metro'], tram: ['Trams are', 'trams']};
export function noiseReason(noise, bandOf) {
  const heard = NOISE_MODES.map(m => [m.key, noise?.[m.key]]).filter(([, v]) => v !== null && v !== undefined).sort((a, b) => b[1] - a[1]);
  if (!heard.length) return null;
  const [[key, lo], ...rest] = heard;
  const text = [`${SOURCE_WORDS[key][0]} the loudest source here (${bandLabel(bandOf(lo))}).`];
  if (rest.length) text.push('Also ' + rest.map(([k, v]) => `${SOURCE_WORDS[k][1]} (${bandLabel(bandOf(v))})`).join(', ') + '.');
  return text.join(' ');
}

// Band definitions seen in the data: [{lo, hi}] sorted, hi null when open-ended.
export function bandList(features) {
  const seen = new Map();
  for (const f of features) seen.set(f.properties.db_lo, f.properties.db_hi ?? null);
  return [...seen].map(([lo, hi]) => ({lo, hi})).sort((a, b) => a.lo - b.lo);
}

export const bandLabel = band => band.hi == null ? `${band.lo} dB and above` : `${band.lo} to ${band.hi} dB`;
