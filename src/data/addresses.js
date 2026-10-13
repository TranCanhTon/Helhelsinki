// Search ignores accents; exact register joins preserve them.
export const searchText = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fi').replace(/\s+/g, ' ').trim();
export const exactAddress = value => String(value ?? '').normalize('NFC').toLocaleLowerCase('fi').replace(/\s+/g, ' ').trim().replace(/(\d)\s+([a-zåäö])$/u, '$1$2');
export function buildAddressIndex(features, manifest, inside) {
  const links = new Map();
  for (const r of manifest) {
    if (!r.registerJoin?.startsWith('matched-by-')) continue;
    for (const address of r.addresses ?? []) {
      const key = exactAddress(address);
      if (!links.has(key)) links.set(key, new Set());
      links.get(key).add(r.buildingId);
    }
  }
  const rows = new Map();
  for (const f of features) {
    const p = f.properties, position = f.geometry?.coordinates;
    if (f.geometry?.type !== 'Point' || !inside(position) || p.kaupunki !== 'Helsinki') continue;
    const number = String(p.osoitenumero_teksti ?? [p.osoitenumero, p.osoitekirjain].filter(v => v != null).join('')).trim();
    if (!p.katunimi || !number) continue;
    const address = p.katunimi.trim() + ' ' + number;
    const addressSv = p.gatan ? p.gatan.trim() + ' ' + number : null;
    const postcode = p.postinumero == null ? null : String(p.postinumero);
    const key = exactAddress(address) + '|' + postcode;
    if (rows.has(key)) continue;
    rows.set(key, {id: String(p.id), address, addressSv, postcode, position,
      buildingIds: [...(links.get(exactAddress(address)) ?? [])]});
  }
  return [...rows.values()].sort((a,b) => a.address.localeCompare(b.address, 'fi', {numeric:true}));
}
export function findAddresses(rows, query, limit = 8) {
  const words = searchText(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  return rows.filter(r => words.every(w => searchText(r.address + ' ' + (r.addressSv ?? '') + ' ' + (r.postcode ?? '')).includes(w))).slice(0,limit);
}

