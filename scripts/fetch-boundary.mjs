// Phase 1, step 1: the Helsinki boundary.
//
// Source: City of Helsinki WFS layer `avoindata:Kaupunginosajako` (60 districts).
// Output: public/map/helsinki-boundary.json   one merged Helsinki shape
//         public/map/district-boundaries.json  the 60 districts with names
//         data/raw/boundary/Kaupunginosajako.json  the untouched download
//         data/raw/boundary/Maavesi_osa_alueet.json  148 sub-districts (used by the importer)
//
// Run:  npm run data:boundary
import {mkdir, writeFile} from 'node:fs/promises';
import {fetchAllFeatures} from './lib/wfs.mjs';
import {unionDistricts, multiPolygonAreaKm2, makeInsideTest, BOUNDARY_FILE} from './lib/boundary.mjs';

const RAW = new URL('../data/raw/boundary/', import.meta.url);
const PUBLIC_MAP = new URL('../public/map/', import.meta.url);
await mkdir(RAW, {recursive: true});
await mkdir(PUBLIC_MAP, {recursive: true});

console.log('Downloading Helsinki districts (Kaupunginosajako)...');
const download = await fetchAllFeatures({typeName: 'avoindata:Kaupunginosajako', sortBy: 'id'});
await writeFile(new URL('Kaupunginosajako.json', RAW), JSON.stringify(download));

// Every district must belong to municipality 091 (Helsinki).
const notHelsinki = download.features.filter(f => f.properties.kunta !== '091');
if (notHelsinki.length) throw new Error(`${notHelsinki.length} districts are not municipality 091`);
if (download.features.length < 50) throw new Error(`Only ${download.features.length} districts; expected about 60`);

const geometry = unionDistricts(download.features);
const area = multiPolygonAreaKm2(geometry);
const isInside = makeInsideTest(geometry);

// Known places that must be inside or outside. If any of these is wrong,
// the boundary is broken and we stop instead of publishing it.
const controlPoints = [
  {name: 'Senate Square', point: [24.9522, 60.1693], inside: true},
  {name: 'Kamppi', point: [24.9316, 60.169], inside: true},
  {name: 'Suomenlinna (island)', point: [24.9883, 60.1454], inside: true},
  {name: 'Vuosaari', point: [25.144, 60.2096], inside: true},
  {name: 'Otaniemi, Espoo', point: [24.827, 60.1867], inside: false},
  {name: 'Tapiola, Espoo', point: [24.8053, 60.1757], inside: false},
  {name: 'Tikkurila, Vantaa', point: [25.0444, 60.2925], inside: false},
  {name: 'Helsinki Airport, Vantaa', point: [24.9633, 60.3172], inside: false},
];
const failures = controlPoints.filter(c => isInside(c.point) !== c.inside);
for (const c of controlPoints)
  console.log(
    `  ${isInside(c.point) === c.inside ? 'ok  ' : 'FAIL'} ${c.name}: ${isInside(c.point) ? 'inside' : 'outside'}`,
  );
if (failures.length) throw new Error('Boundary control points failed: ' + failures.map(f => f.name).join(', '));

const source = {
  provider: 'City of Helsinki',
  layer: 'avoindata:Kaupunginosajako',
  license: 'CC BY 4.0',
  retrievedAt: download.retrievedAt,
  requests: download.requests,
};

await writeFile(
  BOUNDARY_FILE,
  JSON.stringify({
    type: 'Feature',
    properties: {
      name: 'Helsinki',
      municipalityCode: '091',
      districts: download.features.length,
      pieces: geometry.coordinates.length,
      areaKm2: Math.round(area * 10) / 10,
      method: 'Union of the 60 official districts. Includes islands and the sea areas inside the municipal border.',
      source,
    },
    geometry,
  }),
);

await writeFile(
  new URL('district-boundaries.json', PUBLIC_MAP),
  JSON.stringify({
    type: 'FeatureCollection',
    source,
    features: download.features.map(f => ({
      type: 'Feature',
      properties: {id: f.properties.tunnus, nameFi: f.properties.nimi_fi, nameSv: f.properties.nimi_se},
      geometry: f.geometry,
    })),
  }),
);

// Sub-districts (osa-alueet), e.g. Kalasatama inside Sörnäinen. Some listing
// sites (SATO) use these names. Fields: tunnus, nimi_fi, nimi_se, tyyppi.
console.log('Downloading Helsinki sub-districts (Maavesi_osa_alueet)...');
const subdistricts = await fetchAllFeatures({typeName: 'avoindata:Maavesi_osa_alueet', sortBy: 'tietopalvelu_id'});
await writeFile(new URL('Maavesi_osa_alueet.json', RAW), JSON.stringify(subdistricts));

console.log(
  `\nHelsinki boundary: ${download.features.length} districts merged into ${geometry.coordinates.length} piece(s), ${area.toFixed(1)} km².`,
);
console.log(`Sub-districts: ${subdistricts.features.length}.`);
console.log('Wrote public/map/helsinki-boundary.json and public/map/district-boundaries.json');
