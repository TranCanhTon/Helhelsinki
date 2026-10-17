// Current Oikotie rental ads (public/listings.json, made by npm run data:listings).
// Asking rents in live ads, not agreed rents or official statistics.
export const ROOM_GROUPS = [
  {key: '1', label: '1 room', test: r => r === 1},
  {key: '2', label: '2 rooms', test: r => r === 2},
  {key: '3+', label: '3+ rooms', test: r => r >= 3},
];
// Fewer ads than this in an area and group: no typical value shown.
export const MIN_ADS = 3;
export function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
export const perM2 = ad => (Number.isFinite(ad.sizeM2) && ad.sizeM2 > 0 ? ad.rent / ad.sizeM2 : null);
// postcode -> {group key -> {count, rent (median €/month), perM2 (median €/m²)}}
export function areaStats(ads) {
  const byPostcode = new Map();
  for (const ad of ads) {
    if (!ad.postcode) continue;
    if (!byPostcode.has(ad.postcode)) byPostcode.set(ad.postcode, []);
    byPostcode.get(ad.postcode).push(ad);
  }
  const stats = new Map();
  for (const [postcode, list] of byPostcode) {
    const groups = {};
    for (const g of ROOM_GROUPS) {
      const ads = list.filter(a => g.test(a.rooms));
      groups[g.key] = {
        count: ads.length,
        rent: ads.length >= MIN_ADS ? median(ads.map(a => a.rent)) : null,
        perM2: ads.length >= MIN_ADS ? median(ads.map(perM2)) : null,
      };
    }
    stats.set(postcode, {count: list.length, groups});
  }
  return stats;
}
export const groupOf = rooms => ROOM_GROUPS.find(g => g.test(rooms))?.key ?? null;
export function indexListings(data) {
  const byBuilding = new Map();
  for (const ad of data.ads)
    for (const id of ad.buildingIds) {
      if (!byBuilding.has(id)) byBuilding.set(id, []);
      byBuilding.get(id).push(ad);
    }
  return {...data, byBuilding, stats: areaStats(data.ads)};
}
