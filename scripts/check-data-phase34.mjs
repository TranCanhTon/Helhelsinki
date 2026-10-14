import assert from 'node:assert/strict';
import {stat,readdir} from 'node:fs/promises';
import polygonClipping from 'polygon-clipping';
import {readJson,publishJson,ROOT} from './lib/prepare.mjs';
import {loadBoundary,multiPolygonAreaKm2} from './lib/boundary.mjs';
import {validateSchema} from '../src/data/prices.js';
const boundary=await loadBoundary();
const addresses=await readJson('public/addresses.json'),labels=await readJson('public/labels.json');
const prices=await readJson('public/price-by-area.json'),manifest=await readJson('public/buildings-manifest.json'),ids=new Set(manifest.map(r=>r.buildingId));
validateSchema(prices,await readJson('schemas/price-by-area.schema.json'));
for(const a of addresses){assert.ok(boundary.isInside(a.position));assert.ok(a.postcode===null || /^\d{5}$/.test(a.postcode));for(const id of a.buildingIds)assert.ok(ids.has(id));}
for(const l of labels)assert.ok(boundary.isInside(l.position));
const priceCounts={};
for(const [metric,m] of Object.entries(prices.metrics)){
 assert.equal(m.areas.length,84);
 for(const a of m.areas){
  const outside=polygonClipping.difference(a.geometry.coordinates,boundary.geometry.coordinates);
  assert.ok(multiPolygonAreaKm2({type:'MultiPolygon',coordinates:outside})<0.000001,'Postal polygon outside Helsinki: '+a.postcode);
 }
 priceCounts[metric]={areas:m.areas.length,available:m.areas.filter(a=>a.values[1]!==null).length,unavailable:m.areas.filter(a=>a.values[1]===null).length};
}
async function bytes(path){const file=new URL(path,ROOT);const s=await stat(file);if(!s.isDirectory())return s.size;let total=0;for(const name of await readdir(file))total+=await bytes(path+'/'+name);return total;}
const files={};
for(const path of ['public/addresses.json','public/labels.json','public/price-by-area.json','public/basemap'])files[path]=await bytes(path);
const report={checkedAt:new Date().toISOString(),addresses:addresses.length,labels:labels.length,priceCounts,bytes:files,
 checks:['All address and label points inside Helsinki','Every search building ID exists','Postcodes are five-character strings','Price JSON validates against checked-in schema','Postal polygons clipped to Helsinki with holes preserved']};
await publishJson('data/staging/phase34-audit.json',report);
const dataset=await readJson('public/dataset.json');dataset.phase34Validation=report;
await publishJson('public/dataset.json',dataset);
console.log(JSON.stringify(report,null,2));

