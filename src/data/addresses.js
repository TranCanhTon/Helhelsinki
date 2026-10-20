// Search ignores accents; exact register joins preserve them.
export const searchText = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fi')
    .replace(/\s+/g, ' ')
    .trim();
export const exactAddress = value =>
  String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('fi')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d)\s+([a-zåäö])$/u, '$1$2');
// One city address point -> one search row, or null when it is not a Helsinki
// street address with a house number. data:context and live search both use it.
export function addressRow(feature) {
  const p = feature?.properties ?? {},
    position = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== 'Point' || p.kaupunki !== 'Helsinki') return null;
  const number = String(
    p.osoitenumero_teksti ?? [p.osoitenumero, p.osoitekirjain].filter(v => v != null).join(''),
  ).trim();
  if (!p.katunimi || !number) return null;
  const address = p.katunimi.trim() + ' ' + number;
  return {
    id: String(p.id),
    address,
    addressSv: p.gatan ? p.gatan.trim() + ' ' + number : null,
    postcode: p.postinumero == null ? null : String(p.postinumero),
    position,
  };
}
// address -> building ids. Works with the full manifest (several addresses per
// building, only register matches count) and with the browser's short index
// (one address per building, no match info).
function addressLinks(manifest) {
  const links = new Map();
  for (const r of manifest) {
    if (r.registerJoin && !r.registerJoin.startsWith('matched-by-')) continue;
    for (const address of r.addresses ?? (r.address ? [r.address] : [])) {
      const key = exactAddress(address);
      if (!links.has(key)) links.set(key, new Set());
      links.get(key).add(r.buildingId);
    }
  }
  return links;
}
const rowKey = r => exactAddress(r.address) + '|' + r.postcode;
const byAddress = (a, b) => a.address.localeCompare(b.address, 'fi', {numeric: true});
export function buildAddressIndex(features, manifest, inside) {
  const links = addressLinks(manifest);
  const rows = new Map();
  for (const f of features) {
    const row = addressRow(f);
    if (!row || !inside(row.position) || rows.has(rowKey(row))) continue;
    rows.set(rowKey(row), {...row, buildingIds: [...(links.get(exactAddress(row.address)) ?? [])]});
  }
  return [...rows.values()].sort(byAddress);
}
export function findAddresses(rows, query, limit = 8) {
  const words = searchText(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return rows
    .filter(r =>
      words.every(w => searchText(r.address + ' ' + (r.addressSv ?? '') + ' ' + (r.postcode ?? '')).includes(w)),
    )
    .slice(0, limit);
}

// ---- Live search: the browser asks the city's address layer directly ----
// The city server (GeoServer) reads a CQL filter, a small "where" rule.
// It ignores upper and lower case (ILIKE) but not accents, so "makelankatu"
// would not find "Mäkelänkatu". The filter therefore has two parts per name:
//   katunimi ILIKE 'm_k_l_nk_tu%'       fast, in the database; _ is any one letter
//   AND <name without accents> LIKE 'makelankatu%'   exact, only on the rows left

// Text the user typed -> {street, number, letter, postcode}.
// 'Mannerheimintie 12 B' -> {street: 'Mannerheimintie', number: 12, letter: 'b', postcode: null}
export function parseQuery(text) {
  const words = String(text ?? '')
    .normalize('NFC')
    .slice(0, 60)
    .replace(/[^\p{L}0-9 -]/gu, ' ') // only letters, digits, spaces and -
    .split(/\s+/)
    .filter(Boolean);
  const street = [];
  let number = null,
    letter = null,
    postcode = null;
  for (const w of words) {
    const house = w.match(/^(\d{1,4})(\p{L})?$/u);
    if (/^\d{5}$/.test(w)) postcode = w;
    else if (house && number === null) {
      number = Number(house[1]);
      letter = house[2]?.toLocaleLowerCase('fi') ?? null;
    } else if (number !== null && letter === null && /^\p{L}$/u.test(w)) letter = w.toLocaleLowerCase('fi');
    else if (number === null) street.push(w);
  }
  return {street: street.join(' ') || null, number, letter, postcode};
}
// A text value inside the filter. Quotes are doubled so a quote typed by the
// user stays text and cannot end the value early (parseQuery already removed them).
const cqlText = value => "'" + String(value).replaceAll("'", "''") + "'";
// The city's names with accents removed, done on the server.
const plainName = field =>
  `strReplace(strReplace(strReplace(strToLowerCase(${field}),'[äåá]','a',true),'ö','o',true),'é','e',true)`;
// The CQL filter for one parsed query, or null when there is too little to search for.
export function addressFilter(parsed) {
  const street = searchText(parsed?.street);
  const letters = street.replace(/[^\p{L}]/gu, '').length;
  if (letters < 2 && !parsed?.postcode) return null;
  const parts = ["kaupunki = 'Helsinki'"];
  if (letters) {
    const loose = street.replace(/[aoe]/g, '_') + '%',
      exact = street + '%';
    const name = field => `(${field} ILIKE ${cqlText(loose)} AND ${plainName(field)} LIKE ${cqlText(exact)})`;
    parts.push(`(${name('katunimi')} OR ${name('gatan')})`);
  }
  if (Number.isInteger(parsed.number)) parts.push('osoitenumero = ' + parsed.number);
  if (parsed.postcode) parts.push('postinumero = ' + cqlText(parsed.postcode));
  return parts.join(' AND ');
}
// City answer -> at most `limit` clean rows: Helsinki only, right house letter,
// no duplicates, sorted with numbers as numbers ("Katu 2" before "Katu 10").
export function liveRows(features, parsed, limit = 10) {
  const rows = new Map();
  for (const f of features ?? []) {
    const row = addressRow(f);
    if (!row || rows.has(rowKey(row))) continue;
    if (parsed?.letter && row.address.toLocaleLowerCase('fi').match(/\d(\p{L})$/u)?.[1] !== parsed.letter) continue;
    rows.set(rowKey(row), row);
  }
  return [...rows.values()].sort(byAddress).slice(0, limit);
}
// Building list -> a function that adds buildingIds to search rows.
export function addressLinker(manifest) {
  const links = addressLinks(manifest);
  return rows => rows.map(r => ({...r, buildingIds: [...(links.get(exactAddress(r.address)) ?? [])]}));
}
