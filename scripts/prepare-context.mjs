// Official addresses and current place names. Geometry is CRS:84.
import {fetchAllFeatures} from './lib/wfs.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, readJson, publishJson, datasetSection} from './lib/prepare.mjs';
import {buildAddressIndex} from '../src/data/addresses.js';
const boundary = await loadBoundary();
const source = async (name, extra = {}) =>
  cached('data/raw/context/' + name + '.json', () =>
    fetchAllFeatures({typeName: 'avoindata:' + name, pageSize: 5000, extra}),
  );
const addresses = await source('Helsinki_osoiteluettelo');
const rows = buildAddressIndex(addresses.features, await readJson('public/buildings-manifest.json'), boundary.isInside);
await publishJson('public/addresses.json', rows);
await datasetSection('addresses', {
  source: 'avoindata:Helsinki_osoiteluettelo',
  license: 'City of Helsinki, CC BY 4.0',
  retrievedAt: addresses.retrievedAt,
  sourceCount: addresses.total,
  count: rows.length,
  matched: rows.filter(r => r.buildingIds.length).length,
  ambiguous: rows.filter(r => r.buildingIds.length > 1).length,
  matching:
    'Exact normalized Finnish register address only. Multiple buildings require an explicit choice. No proximity guessing.',
});
const names = await source('Nimisto_piste_rekisteritiedot', {CQL_FILTER: 'olotila=1'});
const labels = names.features
  .filter(
    f =>
      f.geometry?.type === 'Point' && Number(f.properties.olotila) === 1 && boundary.isInside(f.geometry.coordinates),
  )
  .map(f => ({
    id: String(f.properties.id),
    position: f.geometry.coordinates,
    name: f.properties.nimi_suomi,
    nameSv: f.properties.nimi_ruotsi,
    kind: f.properties.laji_selite,
    class: Number(f.properties.laji),
  }))
  .filter(f => f.name);
await publishJson('public/labels.json', labels);
await datasetSection('labels', {
  source: 'avoindata:Nimisto_piste_rekisteritiedot',
  license: 'City of Helsinki, CC BY 4.0',
  retrievedAt: names.retrievedAt,
  count: labels.length,
  filter: 'olotila = 1; point inside Helsinki',
});
console.log(JSON.stringify({addresses: rows.length, labels: labels.length}));
