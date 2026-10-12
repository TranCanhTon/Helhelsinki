// Connects a 3D building to its building-register records.
//
// Join keys, in order of preference:
//   1. VTJ-PRT, the national permanent building ID, when the 3D model has it
//   2. RATU, Helsinki's own building number
// A building can have several register rows (for example several addresses
// on a corner building). Several addresses are fine and all are kept.
// Conflicting building types are not guessed: the type becomes null.

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

const formatAddress = (street, number) => street ? [street.trim(), String(number ?? '').trim()].filter(Boolean).join(' ') : null;

export function joinRegister({ratu, vtjPrt}, index) {
  let rows = [], key = null;
  if (vtjPrt && index.byVtj.has(vtjPrt)) { rows = index.byVtj.get(vtjPrt); key = 'vtj_prt'; }
  else if (ratu && index.byRatu.has(ratu)) { rows = index.byRatu.get(ratu); key = 'ratu'; }
  if (!rows.length) return {registerJoin: ratu || vtjPrt ? 'no-register-match' : 'no-id-in-model', address: null, addresses: [], addressSv: null, postcode: null, use: null};

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
  return {
    registerJoin: `matched-by-${key}`,
    address: addresses[0] ?? null,
    addresses,
    addressSv: addresses[0] ? pairs.get(addresses[0]).sv : null,
    postcode: postcodes.size === 1 ? [...postcodes][0] : null,
    use: types.size === 1 ? [...types][0] : null,
  };
}
