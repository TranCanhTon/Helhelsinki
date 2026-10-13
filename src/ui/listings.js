// Links from a building to current listings on the big Finnish housing sites.
//
// We have no verified address-to-listing mapping. These buttons open area
// searches and the card labels them accordingly.
//
//   Oikotie   by postcode   asunnot.oikotie.fi/vuokra-asunnot?locations=["00530"]
//   Vuokraovi by district   vuokraovi.com/vuokra-asunnot/helsinki/kallio
//   Etuovi    by district   etuovi.com/myytavat-asunnot/helsinki/kallio
//   Lumo      by district   lumo.fi/vuokra-asunnot/helsinki/kallio
//   SATO      by area       sato.fi/fi/vuokra-asunnot/helsinki/kallio, only for areas
//             where SATO has homes; elsewhere its Helsinki page (otherwise SATO
//             would show all of Finland)

// "Käpylä" -> "kapyla" (Vuokraovi, Etuovi and Lumo drop the dots).
const plain = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
// "Itä-Pasila" -> "itä-pasila" (SATO keeps them).
const sato = name => name.toLowerCase().replace(/\s+/g, '-');

// Areas with a SATO page, checked 12 Oct 2026 for the Central major district.
const SATO_AREAS = new Set(['kallio', 'sörnäinen', 'vallila', 'kalasatama', 'itä-pasila', 'arabianranta']);

const titleCase = s => s ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase()) : s;

export function listingLinks(record) {
  const postcode = record?.postcode;
  const district = titleCase(record?.district?.nameFi);
  const subdistrict = titleCase(record?.subdistrict?.nameFi);
  const links = [];

  if (postcode) {
    const q = encodeURIComponent(JSON.stringify([postcode]));
    links.push({site: 'Oikotie', kind: 'Rentals', area: postcode, url: `https://asunnot.oikotie.fi/vuokra-asunnot?locations=${q}&cardType=101`});
    links.push({site: 'Oikotie', kind: 'For sale', area: postcode, url: `https://asunnot.oikotie.fi/myytavat-asunnot?locations=${q}&cardType=100`});
  }
  {
    links.push({site: 'Vuokraovi', kind: 'Rentals', area: district ?? 'Helsinki', url: `https://www.vuokraovi.com/vuokra-asunnot/helsinki${district ? '/' + plain(district) : ''}`});
    links.push({site: 'Etuovi', kind: 'For sale', area: district ?? 'Helsinki', url: `https://www.etuovi.com/myytavat-asunnot/helsinki${district ? '/' + plain(district) : ''}`});
    links.push({site: 'Lumo', kind: 'Rentals', area: district ?? 'Helsinki', url: `https://lumo.fi/vuokra-asunnot/helsinki${district ? '/' + plain(district) : ''}`});
  }
  const satoArea = [subdistrict, district].find(a => a && SATO_AREAS.has(sato(a)));
  links.push({
    site: 'SATO', kind: 'Rentals', area: satoArea ?? 'Helsinki',
    url: satoArea ? `https://www.sato.fi/fi/vuokra-asunnot/helsinki/${encodeURIComponent(sato(satoArea))}` : 'https://www.sato.fi/fi/vuokra-asunnot/helsinki',
  });
  return links;
}
