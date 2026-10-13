// Connects a 3D building to its building-register records.
//
// Join keys, in order of preference:
//   1. VTJ-PRT, the national permanent building ID, when the 3D model has it
//   2. RATU, Helsinki's own building number
// A building can have several register rows (for example several addresses
// on a corner building). Several addresses are fine and all are kept.
// Conflicting building types or years are not guessed: they become null.
//
// Year built comes from c_valmpvm (completion date). The register writes
// 1000-01-01 when the date is unknown, so years before 1700 count as missing.

const normalizeRatu = value => {
  const s = String(value ?? '').trim();
  return /^\d+(\.0+)?$/.test(s) && Number(s) > 0 ? String(Number(s)) : null;
};

export function buildRegisterIndex(features) {
  const byRatu = new Map(), byVtj = new Map();
  const add = (map, key, record) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(record); };
  for (const {properties: p} of features) {
    add(byRatu, normalizeRatu(p.ratu), p);
    add(byVtj, p.vtj_prt?.trim(), p);
    if (p.c_vtj_prt?.trim() !== p.vtj_prt?.trim()) add(byVtj, p.c_vtj_prt?.trim(), p);
  }
  return {byRatu, byVtj};
}

import {HEATING, FUEL, FRAME, FACADE, USE, label} from './register-codes.mjs';

const count = value => {
  const n = Number(String(value ?? '').trim());
  return String(value ?? '').trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

// One value all rows agree on, or null when they disagree or have none.
const agree = (rows, read) => {
  const values = new Set(rows.map(read).filter(v => v !== null && v !== undefined));
  return values.size === 1 ? [...values][0] : null;
};

// The extra facts shown on the building card. All may be null.
function registerFacts(rows) {
  return {
    floors: agree(rows, r => count(r.i_kerrlkm) || null),
    flats: agree(rows, r => count(r.i_asuinhuoneistojen_lkm) ?? count(r.i_huoneistojen_lkm)),
    businessPremises: agree(rows, r => count(r.i_toimitilojen_lkm)),
    floorAreaM2: agree(rows, r => count(r.i_kerrosala) || null),
    heating: agree(rows, r => label(HEATING, r.c_lammtapa)),
    fuel: agree(rows, r => label(FUEL, r.c_poltaine)),
    frame: agree(rows, r => label(FRAME, r.c_rakeaine)),
    facade: agree(rows, r => label(FACADE, r.c_julkisivu)),
    // The register only marks buildings that have one ("x"); no mark means unknown, not "no".
    elevator: rows.some(r => String(r.c_hissi ?? '').trim().toLowerCase() === 'x') ? true : null,
  };
}

export const EMPTY_FACTS = registerFacts([]);

export function yearFromDate(value) {
  const year = Number(String(value ?? '').slice(0, 4));
  return Number.isInteger(year) && year >= 1700 && year <= new Date().getFullYear() ? year : null;
}

const formatAddress = (street, number) => street ? [street.trim(), String(number ?? '').trim()].filter(Boolean).join(' ') : null;

export function joinRegister({ratu, vtjPrt}, index) {
  let rows = [], key = null;
  if (vtjPrt && index.byVtj.has(vtjPrt)) { rows = index.byVtj.get(vtjPrt); key = 'vtj_prt'; }
  else if (ratu && index.byRatu.has(ratu)) { rows = index.byRatu.get(ratu); key = 'ratu'; }
  if (!rows.length) return {registerJoin: ratu || vtjPrt ? 'no-register-match' : 'no-id-in-model', address: null, addresses: [], addressSv: null, postcode: null, use: null, useEn: null, yearBuilt: null, facts: EMPTY_FACTS};

  // Prefer records the register marks as current.
  const current = rows.filter(r => r.tila === 'voimassa');
  if (current.length) rows = current;

  const pairs = new Map();
  for (const r of rows) {
    const fi = formatAddress(r.katunimi_suomi, r.osoitenumero);
    if (fi && !pairs.has(fi)) pairs.set(fi, {sv: formatAddress(r.katunimi_ruotsi, r.osoitenumero), postcode: r.postinumero ?? null});
  }
  const addresses = [...pairs.keys()].sort((a, b) => a.localeCompare(b, 'fi', {numeric: true}));
  const postcodes = new Set([...pairs.values()].map(v => v.postcode).filter(Boolean));
  const types = new Set(rows.map(r => r.tyyppi).filter(Boolean));
  const years = new Set(rows.map(r => yearFromDate(r.c_valmpvm)).filter(Boolean));
  return {
    registerJoin: `matched-by-${key}`,
    address: addresses[0] ?? null,
    addresses,
    addressSv: addresses[0] ? pairs.get(addresses[0]).sv : null,
    postcode: postcodes.size === 1 ? [...postcodes][0] : null,
    use: types.size === 1 ? [...types][0] : null,
    useEn: types.size === 1 ? USE[[...types][0]] ?? null : null,
    yearBuilt: years.size === 1 ? [...years][0] : null,
    facts: registerFacts(rows),
  };
}
