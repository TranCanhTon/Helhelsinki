// Construction work from the city's permit system (yleisten alueiden lupajärjestelmä):
// digging notices (Kaivuilmoitus_alue) and street area rentals (Aluevuokraus_alue).
//
// Each record has a free-text purpose in Finnish. Later changes are added to the
// end of it ("MUUTOS 26.02.2026: ...", "LISÄYS ..."); we cut those off and sort the
// rest with keyword rules into heavy, medium or light work. The label is a rough
// guess from the kind of work, not a noise level. No rule matched = unknown; those are
// left out of the map and the card (Ton, 13 Oct 2026).
// The status field is not used: over a thousand say "active" after their end date.
import Flatbush from 'flatbush';

export const CONSTRUCTION_LEVELS = [
  {key: 'heavy', label: 'Heavy'},
  {key: 'medium', label: 'Medium'},
  {key: 'light', label: 'Light'},
];
export const LEVEL_KEYS = CONSTRUCTION_LEVELS.map(l => l.key);

export const PERMIT_KINDS = {
  dig: {label: 'Digging notice', layer: 'Kaivuilmoitus_alue'},
  rent: {label: 'Street area rental', layer: 'Aluevuokraus_alue'},
};

// [level, kind of work, words in the Finnish purpose]. First match wins.
// Surveys come first (their text often names pipes), then heavy, medium and light
// kinds of work, then the general digging and repair words last.
// Ton approved this table on 13 Oct 2026 (checked against 1,192 current permits).
export const RULES = [
  ['light', 'Ground surveys and inspections', /maaperätutk|pohjatutk|kairau|vuototutk|erikoistarkast|näytte/],
  ['heavy', 'New building or demolition', /uudisrak|rakennu\w* pur|purku ja uuden|uuden rakennuksen|rakennuksen rakent|toimistorakennuksen|esirakent/],
  ['heavy', 'Tram line building or track renewal', /raitiotien rakent|raitiotielinja|raitiotien ja|ratikka|raitiotiekisko|raitiotievaihte|kiskojen vaihto/],
  ['heavy', 'Street or square rebuilt', /kadun (?:perusparannu|rakentami|rakennus|saneeraus|ennallist)|kadunrakent|katujen (?:rakent|saneer|pintarakent)|katu-urak|risteysalue|aukion .*rakent|kunnallistekniik/],
  ['heavy', 'Bridge or metro structure', /siltojen|sillat|merityö|sillan (?:rakent|uusi|korja)|metrokuil|metrosil/],
  ['heavy', 'Rock blasting, piling, foundations', /louhi|räjäyt|paalut|pontt|massanvaih|injektoin|stabiloin|perustu\w* vahvist/],
  ['heavy', 'Tower crane', /torninosturi/],
  ['heavy', 'Water and sewer network renewal', /vesihuoltoverkoston|vesihuollon saneer|uusi vesihuolto|viemäriverkoston saneer/],
  ['heavy', 'District heating or cooling pipes', /kaukolämpö|kaukojäähdy/],
  ['medium', 'Building renovation (facade, roof, balcony)', /kiinteistöremont|kiinteistön saneer|julkisivu|vesikat|katto|ikkun|parveke|remont/],
  ['medium', 'Scaffolding', /teline/],
  ['medium', 'Building site area, site road, site traffic', /työmaa(?!-? ?sähkö|kop|parak)/],
  ['medium', 'Telecom and fibre cables', /telekaapel|tietoliiken|tiedonsiirto|kuitu|kaapeli/],
  ['medium', 'Electricity network', /sähköverkko|sähkö(?:n)? ?(?:kaapel|liitty)/],
  ['medium', 'Water, sewer and storm water pipes', /vesijoh|viemär|hulevesi|vesi-|vesiliit|vesihuol|tonttiliit|kiinteistöliitty|salaoj|\bhv-|\bkvv|linjasaneer/],
  ['medium', 'Tram overhead lines and stops', /raitiotie|raitiovaunu|raitiovanu|ajojoh/],
  ['medium', 'Geothermal drilling', /maalämpö|lämpökaivo|poraus|geotermi/],
  ['medium', 'Park or green area building', /puiston rakent|puisto|leikkipaik|viherrakent|kasvualust/],
  ['medium', 'Paving and kerbs', /päällyst|asfaltoin|pintarakent|pintarakenn|reunakiv|kiveys|kivetys|hidaste|töyssy/],
  ['light', 'Street lights or traffic lights', /valaistu|ulkovalo|liikennevalo|valaisin/],
  ['light', 'Tree planting', /istut|puiden/],
  ['light', 'Lifting work (mobile crane)', /nosto/],
  ['light', 'Skip, container or storage', /vaihtolav|kontti|konttit|varastoin|lava/],
  ['light', 'Moving van', /muutto/],
  ['light', 'Temporary power line or poles', /sähkölinj|työmaa ?sähkö|sähköpylv|ilmalinja|ilmajohd|tolp/],
  ['light', 'Site huts and fences', /työmaakop|parak|aita|aidan/],
  ['light', 'Filming or show vehicles', /kuvaus|näytök/],
  ['light', 'Signs, parking and temporary stops', /opast|liikennemerk|liikennejärjest|pysäk|pysäköin|parkki/],
  ['light', 'Test pits, suction truck, manhole work', /koekuop|koemont|imuauto|kaivosta käsin/],
  ['medium', 'Other digging', /kaivu/],
  ['medium', 'Other building or repair work', /rakentami|rakennetaan|korjau|korjaus|kunnost|uusimi|uusint|muutostyö|saneer|perusparan|peruskorj/],
];

// The purpose as first written: change notes cut off, spaces tidied, case kept.
export function mainPurpose(text) {
  return String(text ?? '').split(/\n\s*(?:MUUTOS|LISÄYS|LISAYS|KORJAUS|PÄIVITYS|HUOM)\b/i)[0].replace(/\s+/g, ' ').trim();
}

// purpose text -> {level, rule}: rule is the index in RULES, or null for unknown.
export function classify(text) {
  const purpose = mainPurpose(text).toLowerCase();
  const rule = RULES.findIndex(([, , words]) => words.test(purpose));
  return rule < 0 ? {level: 'unknown', rule: null} : {level: RULES[rule][0], rule};
}

// Dates are 'YYYY-MM-DD' strings. Over = the end date has passed.
export function workStatus({start, end}, today) {
  if (end && end < today) return 'over';
  if (start && start > today) return 'upcoming';
  return 'running';
}

// Today in Helsinki as 'YYYY-MM-DD'.
export const helsinkiToday = (date = new Date()) => date.toLocaleDateString('sv-SE', {timeZone: 'Europe/Helsinki'});

// Metres from a [lon, lat] point to the nearest edge of a work area, 0 inside it.
// polygons: MultiPolygon coordinates. Holes are ignored (work areas have none that matter).
export function distanceToAreas([lon, lat], polygons) {
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540;
  let best = Infinity;
  for (const [ring] of polygons) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - lon) * kx, ay = (ring[j][1] - lat) * ky;
      const bx = (ring[i][0] - lon) * kx, by = (ring[i][1] - lat) * ky;
      if ((ay > 0) !== (by > 0) && ax + (bx - ax) * -ay / (by - ay) > 0) inside = !inside;
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    if (inside) return 0;
  }
  return best;
}

const bounds = polygons => {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [ring] of polygons) for (const [x, y] of ring) {
    b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
  }
  return b;
};

// works: [{polygons, start, end, ...}] -> near(point, today) -> works whose area comes
// within `radius` metres, not over yet, nearest first: [{work, distanceM, status}].
export function nearbyIndex(works, radius = 200) {
  const index = new Flatbush(Math.max(1, works.length));
  for (const w of works) index.add(...bounds(w.polygons));
  if (!works.length) index.add(0, 0, 0, 0);
  index.finish();
  return (point, today) => {
    if (!works.length) return [];
    const dLat = radius / 110540, dLon = radius / (111320 * Math.cos(point[1] * Math.PI / 180));
    const out = [];
    for (const i of index.search(point[0] - dLon, point[1] - dLat, point[0] + dLon, point[1] + dLat)) {
      const work = works[i], status = workStatus(work, today);
      if (status === 'over') continue;
      const distanceM = distanceToAreas(point, work.polygons);
      if (distanceM <= radius) out.push({work, distanceM, status});
    }
    return out.sort((a, b) => a.distanceM - b.distanceM);
  };
}

// Some cable jobs list forty streets. Cut long addresses at a comma.
export function shortAddress(text, max = 60) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(',', max);
  return s.slice(0, cut > 20 ? cut : max).trim() + ' and more';
}
