// Official addresses, current names and street/park trees. Geometry is CRS:84.
import {fetchAllFeatures} from './lib/wfs.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, readJson, publishJson, datasetSection} from './lib/prepare.mjs';
import {buildAddressIndex} from '../src/data/addresses.js';
const boundary = await loadBoundary();
const source = async (name, extra = {}) => cached('data/raw/context/' + name + '.json', () =>
  fetchAllFeatures({typeName:'avoindata:' + name, pageSize:5000, extra}));
const addresses = await source('Helsinki_osoiteluettelo');
const rows = buildAddressIndex(addresses.features, await readJson('public/buildings-manifest.json'), boundary.isInside);
await publishJson('public/addresses.json', rows);
await datasetSection('addresses', {source:'avoindata:Helsinki_osoiteluettelo', license:'City of Helsinki, CC BY 4.0',
  retrievedAt:addresses.retrievedAt, sourceCount:addresses.total, count:rows.length,
  matched:rows.filter(r=>r.buildingIds.length).length, ambiguous:rows.filter(r=>r.buildingIds.length>1).length,
  matching:'Exact normalized Finnish register address only. Multiple buildings require an explicit choice. No proximity guessing.'});
const names = await source('Nimisto_piste_rekisteritiedot', {CQL_FILTER:'olotila=1'});
const labels = names.features.filter(f=>f.geometry?.type==='Point' && Number(f.properties.olotila)===1 && boundary.isInside(f.geometry.coordinates))
  .map(f=>({id:String(f.properties.id), position:f.geometry.coordinates, name:f.properties.nimi_suomi, nameSv:f.properties.nimi_ruotsi,
    kind:f.properties.laji_selite, class:Number(f.properties.laji)})).filter(f=>f.name);
await publishJson('public/labels.json', labels);
await datasetSection('labels',{source:'avoindata:Nimisto_piste_rekisteritiedot',license:'City of Helsinki, CC BY 4.0',retrievedAt:names.retrievedAt,count:labels.length,filter:'olotila = 1; point inside Helsinki'});
const trees = await source('Puurekisteri_piste');
const cells = new Map();
for (const f of trees.features) {
  if (f.geometry?.type!=='Point' || !boundary.isInside(f.geometry.coordinates) || !['Katu','Puisto'].includes(f.properties.paatyyppi)) continue;
  const [lon,lat] = f.geometry.coordinates;
  const key = Math.floor(lon*100) + '_' + Math.floor(lat*100);
  if(!cells.has(key)) cells.set(key,[]);
  cells.get(key).push([lon,lat,f.properties.suomenknimi, [f.properties.suku,f.properties.laji].filter(Boolean).join(' ')]);
}
const generation = trees.retrievedAt.replace(/[^0-9]/g,'');
const tiles = [];
for (const [key, records] of cells) {
  const [x,y] = key.split('_').map(Number);
  const file = 'trees/' + generation + '/' + key + '.json';
  await publishJson('public/' + file,records);
  tiles.push({file,rectangle:[x/100,y/100,(x+1)/100,(y+1)/100],count:records.length});
}
const meta = {source:'avoindata:Puurekisteri_piste',license:'City of Helsinki, CC BY 4.0',retrievedAt:trees.retrievedAt,
 count:tiles.reduce((s,t)=>s+t.count,0), tiles,
 representation:'Only position and species are real register data. Shape and height are illustrative. Street and park trees only; this is not a forest inventory.'};
await publishJson('public/trees.json',meta);
await datasetSection('trees',{...meta,tiles:tiles.length});
console.log(JSON.stringify({addresses:rows.length,labels:labels.length,trees:meta.count,treeCells:tiles.length}));

