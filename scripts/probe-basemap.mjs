// Probe for the base map layers: what fields they have, how many records,
// which type/class values exist, and roughly how big each layer is.
//
// For every layer:
//   1. DescribeFeatureType  -> field names and types
//   2. resultType=hits      -> total number of records
//   3. all records WITHOUT shapes -> distinct values per field
//   4. 300 records WITH shapes   -> bytes per record, to estimate the full size
//
// Output: data/raw/probe/basemap/<layer>.json and summary.json
// Run:    npm run data:probe:basemap
import {mkdir, writeFile} from 'node:fs/promises';
import {getJson, getText} from './lib/http.mjs';
import {fetchAllFeatures, HELSINKI_WFS} from './lib/wfs.mjs';

const LAYERS = [
  'Opaskartta_alue',
  'Opaskartta_muuviiva',
  'Maavesi_maa_alueet_yleistetty',
  'YLRE_Katualue_alue',
  'YLRE_Katu_ja_viherosat_kaikki_alue',
  'YLRE_Katu_ja_viherosat_ajorata_alue',
  'Puurekisteri_piste',
  'YLRE_Viheralue_alue',
];
// --only=Layer1,Layer2 probes just those layers.
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
// Fields with at most this many distinct values are listed in full.
const MAX_LISTED = 40;
const SAMPLE = 300;

const dir = new URL('../data/raw/probe/basemap/', import.meta.url);
await mkdir(dir, {recursive: true});

const query = params => {
  const url = new URL(HELSINKI_WFS);
  url.search = new URLSearchParams({service: 'WFS', version: '2.0.0', ...params});
  return url;
};

const summary = [];
for (const name of LAYERS.filter(l => !only || only.includes(l))) {
  const typeName = `avoindata:${name}`;
  console.log(`\n${name}`);

  const described = await getJson(query({request: 'DescribeFeatureType', typeNames: typeName, outputFormat: 'application/json'}));
  const fields = described.featureTypes[0].properties.map(p => ({name: p.name, type: p.localType}));
  const geometryField = fields.find(f => /Point|Line|Polygon|Geometry|Surface|Curve/i.test(f.type));
  const plainFields = fields.filter(f => f !== geometryField).map(f => f.name);
  // Paging needs a stable sort on a unique field; not every layer calls it "id".
  const sortBy = plainFields.includes('id') ? 'id' : plainFields.find(f => /id$/.test(f)) ?? plainFields[0];

  const hits = await getText(query({request: 'GetFeature', typeNames: typeName, resultType: 'hits'}));
  const total = Number(hits.match(/numberMatched="(\d+)"/)?.[1]);

  // All records, no shapes: small and enough to count values.
  const {features} = await fetchAllFeatures({
    typeName, pageSize: 10000, sortBy, log: () => {},
    extra: {propertyName: plainFields.join(',')},
  });
  const values = {};
  for (const field of plainFields) {
    const counts = new Map();
    for (const f of features) {
      const v = f.properties[field] ?? null;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    values[field] = {
      distinct: counts.size,
      empty: counts.get(null) ?? 0,
      ...(counts.size <= MAX_LISTED || /tyyppi|luokka|laji|kayttotark|tila|voimassaolo/i.test(field) ? {counts: Object.fromEntries(sorted)} : {examples: sorted.slice(0, 5).map(([v]) => v)}),
    };
  }

  // A sample with shapes, to estimate megabytes for the whole layer.
  const sampleText = await getText(query({
    request: 'GetFeature', typeNames: typeName, outputFormat: 'application/json', srsName: 'CRS:84',
    count: String(SAMPLE), sortBy,
  }));
  const sample = JSON.parse(sampleText);
  const bytesPerRecord = sampleText.length / Math.max(1, sample.features.length);
  const shapeTypes = [...new Set(sample.features.map(f => f.geometry?.type).filter(Boolean))].join('/');

  const result = {
    layer: typeName, total, geometry: shapeTypes || geometryField?.type || null,
    fields, values,
    estimatedMB: Math.round(bytesPerRecord * total / 1e5) / 10,
    retrievedAt: new Date().toISOString(),
  };
  await writeFile(new URL(`${name}.json`, dir), JSON.stringify(result, null, 2));
  summary.push({layer: name, total, geometry: result.geometry, estimatedMB: result.estimatedMB, fields: plainFields.length});

  console.log(`  ${total} records, geometry ${result.geometry}, about ${result.estimatedMB} MB as GeoJSON`);
  for (const [field, v] of Object.entries(values)) {
    if (v.counts) console.log(`  ${field} (${v.distinct}): ${Object.entries(v.counts).map(([k, n]) => `${k}=${n}`).join(', ')}`);
    else console.log(`  ${field}: ${v.distinct} distinct, e.g. ${v.examples.map(e => JSON.stringify(e)).join(', ')}`);
  }
}
if (!only) await writeFile(new URL('summary.json', dir), JSON.stringify(summary, null, 2));
console.log('\nSaved to data/raw/probe/basemap/');
