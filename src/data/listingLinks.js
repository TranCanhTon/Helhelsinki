// "Find listings" links on the building card (Ton, 20 Oct 2026): Oikotie searches for
// the building's street and number, for sale and for rent. Links only: the site
// fetches nothing from Oikotie. Etuovi and Vuokraovi are left out: their searches are
// saved on their server as a number (?haku=M...), so no link can be built from an
// address, and their readable /helsinki/<word> pages match the word in ad texts,
// not the street (checked 20 Oct 2026).
//
// Oikotie's format, checked on Fleminginkatu 20 the same day: the free-text search
// (keywords[]) narrowed to the city of Helsinki (locations [[64,6,"Helsinki"]]).
// cardType 100 = flats for sale, 101 = flats for rent. The keyword search matches the
// street, so the page lists the street's ads with the building's own among them.
const OIKOTIE = {
  sale: ['https://asunnot.oikotie.fi/myytavat-asunnot', 100],
  rent: ['https://asunnot.oikotie.fi/vuokra-asunnot', 101],
};
const HELSINKI = '[[64,6,"Helsinki"]]';

// 'Fleminginkatu 20' -> 'Fleminginkatu 20'; 'Kyläkirkontie 6-10' -> 'Kyläkirkontie 6';
// 'Mäkelänkatu 16a' stays. A name without a house number ('Leppäluoto') -> null.
export function streetAndNumber(address) {
  const m = String(address ?? '')
    .trim()
    .match(/^(\p{L}[\p{L} .'-]*?)\s+(\d+\p{L}?)(?:\s*-\s*\d+\p{L}?)?(?:\s+\p{L})?$/u);
  return m ? m[1] + ' ' + m[2] : null;
}

// address -> [{kind: 'sale' | 'rent', url}], or [] when there is no street and number.
export function listingLinks(address) {
  const query = streetAndNumber(address);
  if (!query) return [];
  return Object.entries(OIKOTIE).map(([kind, [base, cardType]]) => ({
    kind,
    url: `${base}?locations=${encodeURIComponent(HELSINKI)}&cardType=${cardType}&keywords%5B%5D=${encodeURIComponent(query)}`,
  }));
}
