// English labels for the building register's code fields.
//
// The register stores some facts as numbers (heating fuel 4 = electricity).
// These meanings were checked against HSY's building data, which carries the
// same codes next to Finnish text, on about 40,000 matched Helsinki buildings.
// The city and HSY number fuels differently; these tables follow the city.
// A code that is not in a table stays null (shown as "Not recorded").

export const HEATING = {
  1: 'Central water heating',
  2: 'Central air heating',
  3: 'Direct electric heating',
  4: 'Stove or oven heating',
  5: 'No fixed heating',
};

export const FUEL = {
  1: 'District heating',
  2: 'Light fuel oil',
  3: 'Heavy fuel oil',
  4: 'Electricity',
  5: 'Gas',
  6: 'Coal',
  7: 'Wood',
  9: 'Ground-source heat',
  10: 'Other',
};

export const FRAME = {1: 'Concrete', 2: 'Brick', 3: 'Steel', 4: 'Wood', 5: 'Other'};

export const FACADE = {1: 'Concrete', 2: 'Brick', 3: 'Metal sheet', 4: 'Stone', 5: 'Wood', 6: 'Glass', 7: 'Other'};

// Building use as written in the register (tyyppi). Finnish -> English.
export const USE = {
  Asuinrakennus: 'Residential building',
  'Asuin- ja liikerakennus': 'Residential and commercial building',
  Liikerakennus: 'Commercial building',
  Toimistorakennus: 'Office building',
  Talousrakennus: 'Outbuilding',
  Varastorakennus: 'Storage building',
  Vaja: 'Shed',
  Autotalli: 'Garage',
  'Muu rakennus': 'Other building',
  'Vapaa-ajan rakennus': 'Leisure building',
  Tehdas: 'Factory',
  Pienteollisuusrakennus: 'Light industry building',
  Muuntamo: 'Electrical substation',
  Opetusrakennus: 'School or college building',
  Parakki: 'Temporary building',
  'Kauppa tai kioski': 'Shop or kiosk',
  Sairaala: 'Hospital',
  Huoltorakennus: 'Maintenance building',
  Päiväkoti: 'Day care centre',
  Käymälä: 'Public toilet',
  Sauna: 'Sauna',
  Vartiorakennus: 'Guard building',
  Paikoitustalo: 'Parking garage',
  Palvelutalo: 'Service housing',
  Pukusuoja: 'Changing room building',
  Kirkko: 'Church',
  Halli: 'Hall',
  Huoltoasema: 'Petrol station',
  Pumppaamo: 'Pumping station',
  Asemarakennus: 'Station building',
  Lämpökeskus: 'Heating plant',
  Väestönsuoja: 'Civil defence shelter',
};

// Building class (national 2018 classification, as text in the city model).
export const CLASS = {
  Asuinkerrostalot: 'Apartment building',
  Pienkerrostalot: 'Small apartment building',
  Rivitalot: 'Row house',
  Paritalot: 'Semi-detached house',
  Omakotitalot: 'Detached house',
  Asuntolarakennukset: 'Dormitory',
  'Erityisryhmien asuinrakennukset': 'Housing for special groups',
  'Ympärivuotiseen käyttöön soveltuvat vapaa-ajan asuinrakennukset': 'Year-round holiday home',
  'Osavuotiseen käyttöön soveltuvat vapaa-ajan asuinrakennukset': 'Seasonal holiday home',
  Toimistorakennukset: 'Office building',
  Talousrakennukset: 'Outbuilding',
  Saunarakennukset: 'Sauna building',
  'Lasten päiväkodit': 'Day care centre',
  'Yleissivistävien oppilaitosten rakennukset': 'School',
  'Ammatillisten oppilaitosten rakennukset': 'Vocational school',
  Korkeakoulurakennukset: 'University building',
  Tutkimuslaitosrakennukset: 'Research institute',
  'Ravintolarakennukset ja vastaavat liikerakennukset': 'Restaurant building',
  'Tukku- ja vähittäiskaupan myymälähallit': 'Retail hall',
  'Kauppakeskukset ja liike- ja tavaratalot': 'Shopping centre or department store',
  'Muut myymälärakennukset': 'Shop building',
  Hotellit: 'Hotel',
  'Pysäköintitalot ja -hallit': 'Parking garage',
  Keskussairaalat: 'Central hospital',
  'Muut sairaalat': 'Hospital',
  'Terveys- ja hyvinvointikeskukset': 'Health centre',
  'Museot ja taidegalleriat': 'Museum or gallery',
  'Kirjastot ja arkistot': 'Library or archive',
  'Teatterit, musiikki- ja kongressitalot': 'Theatre or concert hall',
  Uskonnonharjoittamisrakennukset: 'Place of worship',
  Seurakuntatalot: 'Parish hall',
  'Muut urheilu- ja liikuntarakennukset': 'Sports building',
  'Urheilu- ja palloiluhallit': 'Sports hall',
  Uimahallit: 'Swimming hall',
  Jäähallit: 'Ice rink',
  'Teollisuus- ja pienteollisuustalot': 'Industrial building',
  'Muut teollisuuden tuotantorakennukset': 'Industrial production building',
  'Lämpimät varastot': 'Heated warehouse',
  'Lämmittämättömät varastot': 'Unheated warehouse',
  Paloasemat: 'Fire station',
  'Asemarakennukset ja terminaalit': 'Station or terminal',
};

const code = value => {
  const s = String(value ?? '').trim();
  return s === '' ? null : Number(s);
};

export const label = (table, value) => table[code(value)] ?? null;
