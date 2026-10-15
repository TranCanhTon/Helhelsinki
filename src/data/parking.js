// Street parking from the city's parking map (Pysakointipaikat_alue).
//
// Each record is a mapped parking area on a street. `luokka` is its rule class
// with the city's own description in `luokka_nimi`; records without a class
// carry a use in `tyyppi` (no parking, taxi, loading...). `paikat_ala` is the
// city's estimate of how many cars fit, worked out from the area. It is not a
// count of free spaces. Codes we do not know stay "unknown".
import Flatbush from 'flatbush';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

// The three groups the map and the card show. Ton chose these (13 Oct 2026).
export const PARKING_GROUPS = [
  {key: 'free', label: 'Free'},
  {key: 'paid', label: 'Paid'},
  {key: 'permit', label: 'Paid, free with resident permit'},
];
export const GROUP_KEYS = PARKING_GROUPS.map(g => g.key);

// group: one of the three groups, or 'other' (not general car parking, left out
// of the space estimate). short: words for "3 loading places" on the card.
export const PARKING_TYPES = {
  'free-short': {label: 'Free, time limited', group: 'free'},
  'free-long': {label: 'Free, no time limit', group: 'free'},
  'paid': {label: 'Paid', group: 'paid'},
  'paid-permit': {label: 'Paid, free with resident or business permit', group: 'permit'},
  'disc-permit': {label: 'Free with parking disc, or with permit', group: 'free'},
  'conditional': {label: 'Free outside no-parking hours', group: 'free'},
  'car-sharing': {label: 'Car sharing (Z permit)', group: 'other', short: 'car sharing'},
  'loading': {label: 'Loading', group: 'other', short: 'loading bay'},
  'accessible': {label: 'Accessible (disabled permit)', group: 'other', short: 'disabled permit'},
  'reserved': {label: 'Reserved (taxi, police, diplomats, officials)', group: 'other', short: 'taxi or official'},
  'ev': {label: 'Electric cars', group: 'other', short: 'electric car'},
  'other-vehicle': {label: 'Motorcycles, coaches or trucks', group: 'other', short: 'motorcycle, coach or truck'},
  'unknown': {label: 'Unknown type', group: 'other', short: 'unknown type'},
};
export const TYPE_KEYS = Object.keys(PARKING_TYPES);

// luokka -> type, from the luokka_nimi texts in the data (checked 12 Oct 2026).
const CLASS_TYPES = {
  1: 'free-short',    // Ilmainen lyhytaikainen pysäköinti
  2: 'free-long',     // Ilmainen pitkäaikainen pysäköinti
  3: 'paid',          // Kertamaksu enintään 1 tunti
  4: 'paid',          // Kertamaksu enintään 2 tuntia
  5: 'paid',          // Kertamaksu enintään 4 tuntia
  6: 'paid-permit',   // Maksullinen ilman asukas-/yritystunnusta
  7: 'paid-permit',   // Kertamaksu enintään 1 h ilman asukas-/yritystunnusta
  8: 'disc-permit',   // Ilman asukas-/yritystunnusta ilmainen lyhytaikainen pysäköinti. Käytä pysäköintikiekkoa.
  9: 'conditional',   // Pysäköinti sallittu pysäköintikieltoajan ulkopuolella
  10: 'paid',         // Maksullinen vyöhykehinta
  11: 'car-sharing',  // Z-tunnus nouto/palautus
};
// tyyppi texts. 'exclude' = not parking for cars at all, left out of everything.
const USE_TYPES = {
  'pysäköintikielto': 'exclude', 'pysäyttämiskielto': 'exclude',
  'sähköpotkulauta': 'exclude', 'polkupyörä': 'exclude', 'parklet': 'exclude',
  'kuormauspaikka': 'loading',
  'inva': 'accessible',
  'taxi': 'reserved', 'taksi': 'reserved', 'taxi, lataus': 'reserved', 'cd': 'reserved', 'virka-auto': 'reserved',
  'poliisi': 'reserved', 'kaupunginkanslia': 'reserved', 'valtioneuvosto': 'reserved', 'kirjastoauto': 'reserved',
  'sähköauto': 'ev',
  'moottoripyörä': 'other-vehicle', 'matkailuliikenne': 'other-vehicle', 'kuorma-auto': 'other-vehicle',
};

// properties -> type key, or 'exclude'. A known use text wins over the class,
// so a "no parking" record is never counted as parking.
export function classify(properties) {
  const use = USE_TYPES[String(properties.tyyppi ?? '').trim().toLowerCase()];
  if (use) return use;
  return CLASS_TYPES[properties.luokka] ?? 'unknown';
}

// Estimated cars, or null when the source has no usable estimate (missing, zero or invalid).
export const capacityOf = properties => {
  const v = Number(properties.paikat_ala);
  return properties.paikat_ala != null && Number.isFinite(v) && v > 0 ? v : null;
};

// Centre of the record's bounding box, [lon, lat].
export function centreOf(geometry) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) for (const [x, y] of polygon[0]) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
}

// A parking area grown by `metres` on every side, as one closed [lon, lat] ring:
// the convex outline of its corners, each corner widened into a small circle. Used
// to turn thin kerb strips into zones that merge along a street.
export function grownHull(geometry, metres) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const corners = polygons.flatMap(p => p[0]);
  const lat0 = corners[0][1], kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const points = [];
  for (const [lon, lat] of corners) for (let k = 0; k < 12; k++) {
    points.push([lon * kx + Math.cos(k * Math.PI / 6) * metres, lat * ky + Math.sin(k * Math.PI / 6) * metres]);
  }
  // Convex hull (monotone chain).
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = list => {
    const out = [];
    for (const p of list) { while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); }
    out.pop();
    return out;
  };
  const hull = [...half(points), ...half([...points].reverse())];
  const ring = hull.map(([x, y]) => [x / kx, y / ky]);
  return [...ring, ring[0]];
}

// Straight-line metres between two [lon, lat] points (fine at city scale).
export function metresBetween([x1, y1], [x2, y2]) {
  const k = Math.PI / 180, lat = (y1 + y2) / 2 * k;
  const dx = (x2 - x1) * k * Math.cos(lat) * 6371008, dy = (y2 - y1) * k * 6371008;
  return Math.hypot(dx, dy);
}

// segments: [{position, type, capacity}] -> near(point) summary for that point:
// per group the estimated spaces (null when no area has an estimate), the number
// of mapped areas and how many of them have no estimate; other places by type.
export function nearbyIndex(segments, radius = 200) {
  const index = new Flatbush(Math.max(1, segments.length));
  for (const s of segments) index.add(s.position[0], s.position[1], s.position[0], s.position[1]);
  if (!segments.length) index.add(0, 0, 0, 0);
  index.finish();
  return point => {
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(point[1] * Math.PI / 180));
    const groups = Object.fromEntries(GROUP_KEYS.map(k => [k, {spaces: null, areas: 0, noEstimate: 0}]));
    const out = {radiusM: radius, groups, other: {}};
    if (!segments.length) return out;
    for (const i of index.search(point[0] - dLon, point[1] - dLat, point[0] + dLon, point[1] + dLat)) {
      const s = segments[i];
      if (metresBetween(point, s.position) > radius) continue;
      const group = groups[PARKING_TYPES[s.type].group];
      if (!group) { out.other[s.type] = (out.other[s.type] ?? 0) + 1; continue; }
      group.areas++;
      if (s.capacity === null) group.noEstimate++;
      else group.spaces = (group.spaces ?? 0) + s.capacity;
    }
    for (const g of Object.values(groups)) if (g.spaces !== null) g.spaces = Math.round(g.spaces);
    return out;
  };
}

// The hours field as written on Finnish signs: "9-21, (9-18), 10-16" means
// weekdays 9 to 21, Saturdays 9 to 18 (in brackets), Sundays 10 to 16 (red on
// the sign). Other wording is returned as written.
export function hoursText(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const m = text.match(/^(\d{1,2})\s*-\s*(\d{1,2})(?:\s*,?\s*\((\d{1,2})\s*-\s*(\d{1,2})\))?(?:\s*,\s*(\d{1,2})\s*-\s*(\d{1,2}))?$/);
  if (!m) return text;
  const parts = [`Mon to Fri ${m[1]} to ${m[2]}`];
  if (m[3]) parts.push(`Sat ${m[3]} to ${m[4]}`);
  if (m[5]) parts.push(`Sun ${m[5]} to ${m[6]}`);
  return parts.join(', ');
}

// The time limit field: "4 h", "60 min", "30 min, (30 мин)". A number without a
// unit or other wording is returned as written.
export function limitText(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/^ei aikara/i.test(text)) return 'no time limit';
  const m = text.match(/^(\d+)\s*(h|min)\b/i);
  return m ? `max ${m[1]} ${m[2].toLowerCase()}` : text;
}

// Paid zone note from the city ("... maksaa 4 euroa tunnilta ...") -> "€4 per hour", or null.
export function zonePrice(note) {
  const m = String(note ?? '').match(/(\d+(?:[,.]\d+)?)\s*euroa?\s+tunnilta/i);
  return m ? `€${m[1].replace(',', '.')} per hour` : null;
}

// zones: GeoJSON features -> zoneAt(point) -> the first zone containing it (holes respected), or null.
export function zoneLookup(features, describe) {
  return point => {
    for (const f of features) if (booleanPointInPolygon(point, f)) return describe(f.properties);
    return null;
  };
}
