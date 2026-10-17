// Phase 1, step 3: the official building register for the same area.
//
// The 3D model gives shapes; the register gives facts about each building.
// We only take what the map needs: address (Finnish + Swedish), postcode,
// the building type label and the completion date (c_valmpvm), which
// becomes the year built. Energy and similar fields are left out on purpose.
//
// Source: City of Helsinki WFS `avoindata:Rakennukset_alue_rekisteritiedot`.
// The join key is RATU (Helsinki's own building number), with the national
// building ID VTJ-PRT as a second key.
//
// Also downloads which buildings are protected in the city's detailed plans
// (avoindata:Asemakaavoissa_suojellut_rakennukset_alue).
//
// Run:  npm run data:register -- --area=pilot
import {mkdir, writeFile} from 'node:fs/promises';
import {fetchAllFeatures} from './lib/wfs.mjs';
import {areaBbox, areaFromArgs} from './config.mjs';

const area = areaFromArgs();
// 150 m margin: a register footprint can sit across the edge of the 3D area.
const [x0, y0, x1, y1] = areaBbox(area);
const bbox = [x0 - 150, y0 - 150, x1 + 150, y1 + 150];

const dir = new URL('../data/raw/register/', import.meta.url);
await mkdir(dir, {recursive: true});

console.log(`Downloading building register for "${area}"...`);
const download = await fetchAllFeatures({
  typeName: 'avoindata:Rakennukset_alue_rekisteritiedot',
  srsName: 'CRS:84',
  bbox,
  sortBy: 'id',
  // Only the fields we use, which keeps the download small.
  extra: {
    propertyName: [
      'id',
      'ratu',
      'vtj_prt',
      'c_vtj_prt',
      'tyyppi',
      'c_kayttark',
      'c_rakennusluokka',
      'tila',
      'katunimi_suomi',
      'katunimi_ruotsi',
      'osoitenumero',
      'postinumero',
      'c_valmpvm',
      // building facts for the card
      'i_kerrlkm',
      'i_huoneistojen_lkm',
      'i_asuinhuoneistojen_lkm',
      'i_toimitilojen_lkm',
      'i_kerrosala',
      'c_lammtapa',
      'c_poltaine',
      'c_rakeaine',
      'c_julkisivu',
      'c_hissi',
      'geom',
    ].join(','),
  },
});

await writeFile(new URL(`${area}.json`, dir), JSON.stringify({area, bbox3879: bbox, ...download}));
const withRatu = download.features.filter(f => f.properties.ratu != null).length;
console.log(`${download.features.length} register records (${withRatu} with a RATU).`);

// Buildings protected in the city's detailed plans (asemakaava).
// Fields we use: s_merk (the plan marking, e.g. "sr-2"), kaava (plan number),
// voimaantulo_pvm (date the plan came into force), kaavaselitys* (the rule text).
console.log('Downloading plan protection for the same area...');
const protectedDownload = await fetchAllFeatures({
  typeName: 'avoindata:Asemakaavoissa_suojellut_rakennukset_alue',
  srsName: 'CRS:84',
  bbox,
  sortBy: 'id',
});
await writeFile(new URL(`${area}-protected.json`, dir), JSON.stringify({area, bbox3879: bbox, ...protectedDownload}));
console.log(
  `${protectedDownload.features.length} protected building areas. Next: npm run data:city-tiles -- --area=${area}`,
);
