// Phase 1, step 3: the official building register for the same area.
//
// The 3D model gives shapes; the register gives facts about each building.
// We only take what the map needs now: address (Finnish + Swedish), postcode
// and the building type label. Construction year, energy etc. are left out on purpose.
//
// Source: City of Helsinki WFS `avoindata:Rakennukset_alue_rekisteritiedot`.
// The join key is RATU (Helsinki's own building number), with the national
// building ID VTJ-PRT as a second key.
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
  extra: {propertyName: 'id,ratu,vtj_prt,c_vtj_prt,tyyppi,c_kayttark,tila,katunimi_suomi,katunimi_ruotsi,osoitenumero,postinumero,i_kerrlkm,geom'},
});

await writeFile(new URL(`${area}.json`, dir), JSON.stringify({area, bbox3879: bbox, ...download}));
const withRatu = download.features.filter(f => f.properties.ratu != null).length;
console.log(`${download.features.length} register records (${withRatu} with a RATU). Next: npm run data:convert -- --area=${area}`);
