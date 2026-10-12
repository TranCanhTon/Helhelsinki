// Phase 0 source check.
//
// Makes SMALL requests to every data source we plan to use and saves what
// comes back under data/raw/probe/. Nothing big is downloaded here: a couple
// of sample records per layer, the field lists, and the total counts.
//
// Run from the project folder:   npm run data:probe
// Output:  data/raw/probe/report.json   (one entry per check, ok or failed)
//          data/raw/probe/**            (raw samples, so we can inspect fields)
import {mkdir, writeFile} from 'node:fs/promises';
import {request, getText, getJson} from './lib/http.mjs';
import {gridSquare} from './lib/geo.mjs';

const OUT = new URL('../data/raw/probe/', import.meta.url);
const HELSINKI_WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
const CITYGML_WFS = 'https://kartta.hel.fi/3d/citydb-wfs/wfs';
const STATFIN = 'https://pxdata.stat.fi/PxWeb/api/v1/en/';
const POSTAL_WFS = 'https://geo.stat.fi/geoserver/postialue/wfs';
const HSL_GTFS = 'https://infopalvelut.storage.hsldev.com/gtfs/hsl.zip';
const OVERPASS = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const PERMIT_FIELDS_PDF = 'https://www.hel.fi/static/hkr/wfs/Maankayttoluvat_ja_sopimukset_ominaisuustiedot.pdf';

// City of Helsinki open WFS layers we expect to use, grouped by feature.
const HELSINKI_LAYERS = {
  boundary: ['Kaupunginosajako'],
  buildings: ['Rakennukset_alue_rekisteritiedot'],
  addresses: ['Helsinki_osoiteluettelo'],
  basemap: ['Maavesi_maa_alueet_yleistetty', 'Opaskartta_alue', 'Opaskartta_muuviiva', 'Nimisto_piste_rekisteritiedot'],
  noise: [
    'Meluselvitys_2022_Helsinki_kadut_ja_maantiet_Lden',
    'Meluselvitys_2022_Helsinki_rautatiet_Lden',
    'Meluselvitys_2022_Helsinki_metro_Lden',
    'Meluselvitys_2022_Helsinki_raitiotie_Lden',
  ],
  parking: ['Pysakointipaikat_alue', 'Pysakoinnin_maksuvyohykkeet_alue', 'Asukas_ja_yrityspysakointivyohykkeet_alue'],
  construction: [
    'Kaivuilmoitus_alue', 'Kaivuilmoitus_piste',
    'Aluevuokraus_alue', 'Aluevuokraus_piste',
    'Tilapainen_liikennejarjestely_alue', 'Tilapainen_liikennejarjestely_piste',
    'Sijoitussopimus_alue', 'Sijoitussopimus_piste',
    'Lyhyt_maanvuokraus_alue', 'Lyhyt_maanvuokraus_piste',
    'Tapahtumat_alue', 'Tapahtumat_piste',
    'Winkki_tyot_yleisilla_alueilla', 'Winkki_vuokraukset_ja_tapahtumat_yleisilla_alueilla',
  ],
};

// The pilot area for Phase 1: 400 m square around central Helsinki.
const PILOT_CENTER = [24.95, 60.17];
const PILOT_BBOX = gridSquare(PILOT_CENTER, 400);

const report = {startedAt: new Date().toISOString(), pilotBbox3879: PILOT_BBOX, checks: []};

async function save(path, content) {
  const url = new URL(path, OUT);
  await mkdir(new URL('.', url), {recursive: true});
  await writeFile(url, typeof content === 'string' || content instanceof Uint8Array ? content : JSON.stringify(content, null, 2));
}

// Runs one check, records timing and success, never stops the whole probe.
async function check(source, name, run) {
  const started = Date.now();
  process.stdout.write(`- ${source}: ${name} ... `);
  try {
    const summary = await run();
    report.checks.push({source, name, ok: true, ms: Date.now() - started, ...summary});
    console.log('ok');
  } catch (error) {
    report.checks.push({source, name, ok: false, ms: Date.now() - started, error: error.message.slice(0, 500)});
    console.log('FAILED: ' + error.message.split('\n')[0]);
  }
}

const wfsUrl = (base, params) => {
  const url = new URL(base);
  url.search = new URLSearchParams({service: 'WFS', version: '2.0.0', ...params});
  return url;
};

// ---- 1. City of Helsinki open WFS -------------------------------------
await check('helsinki-wfs', 'GetCapabilities (list of all layers)', async () => {
  const xml = await getText(wfsUrl(HELSINKI_WFS, {request: 'GetCapabilities'}));
  await save('helsinki-wfs/capabilities.xml', xml);
  const layers = [...xml.matchAll(/<FeatureType[\s\S]*?<Name>([^<]+)<\/Name>[\s\S]*?<Title>([^<]*)<\/Title>/g)].map(m => ({name: m[1], title: m[2]}));
  await save('helsinki-wfs/layer-list.json', layers);
  const formats = [...new Set([...xml.matchAll(/<ows:Value>([^<]*json[^<]*)<\/ows:Value>/gi)].map(m => m[1]))];
  return {layerCount: layers.length, jsonFormats: formats};
});

for (const [group, layers] of Object.entries(HELSINKI_LAYERS)) {
  for (const layer of layers) {
    await check('helsinki-wfs', `${group}: ${layer}`, async () => {
      const typeName = `avoindata:${layer}`;
      // Field list with types.
      const describe = await getJson(wfsUrl(HELSINKI_WFS, {request: 'DescribeFeatureType', typeNames: typeName, outputFormat: 'application/json'}));
      // Two sample records plus the total count, as longitude/latitude GeoJSON.
      const sample = await getJson(wfsUrl(HELSINKI_WFS, {request: 'GetFeature', typeNames: typeName, outputFormat: 'application/json', srsName: 'CRS:84', count: '2'}));
      await save(`helsinki-wfs/${group}/${layer}.json`, {describe, sample});
      const fields = describe.featureTypes?.[0]?.properties?.map(p => `${p.name}:${p.localType}`) ?? [];
      return {
        total: sample.totalFeatures ?? sample.numberMatched ?? null,
        geometry: sample.features?.[0]?.geometry?.type ?? null,
        fields,
      };
    });
  }
}

// ---- 2. Helsinki CityGML 3D buildings (citydb WFS) ---------------------
await check('citygml-wfs', 'GetCapabilities', async () => {
  const xml = await getText(wfsUrl(CITYGML_WFS, {request: 'GetCapabilities'}));
  await save('citygml/capabilities.xml', xml);
  const types = [...xml.matchAll(/<(?:wfs:)?Name>([^<]+)<\/(?:wfs:)?Name>/g)].map(m => m[1]);
  return {featureTypes: types.slice(0, 40)};
});
await check('citygml-wfs', 'count buildings in the 400 m pilot square', async () => {
  const xml = await getText(wfsUrl(CITYGML_WFS, {request: 'GetFeature', typeNames: 'bldg:Building', bbox: PILOT_BBOX.join(','), resultType: 'hits'}), {timeoutMs: 120000});
  await save('citygml/pilot-hits.xml', xml);
  return {numberMatched: Number(xml.match(/numberMatched="(\d+)"/)?.[1] ?? NaN)};
});
await check('citygml-wfs', '2 sample buildings from the pilot square', async () => {
  const xml = await getText(wfsUrl(CITYGML_WFS, {request: 'GetFeature', typeNames: 'bldg:Building', bbox: PILOT_BBOX.join(','), count: '2', startIndex: '0'}), {timeoutMs: 120000});
  await save('citygml/pilot-sample.gml', xml);
  if (xml.includes('ExceptionReport')) throw new Error('Server returned an exception: ' + xml.slice(0, 300));
  return {
    bytes: xml.length,
    srsNames: [...new Set([...xml.matchAll(/srsName="([^"]+)"/g)].map(m => m[1]))],
    buildings: (xml.match(/<bldg:Building\b/g) || []).length,
    lod2: /<bldg:lod2/.test(xml),
    genericAttributes: [...new Set([...xml.matchAll(/<gen:\w+Attribute name="([^"]+)"/g)].map(m => m[1]))],
  };
});

// ---- 3. Statistics Finland (prices and rents) --------------------------
for (const path of ['StatFin/ashi', 'StatFin/asvu', 'StatFin_Passiivi/asvu']) {
  await check('statfin', `table list ${path}`, async () => {
    const list = await getJson(STATFIN + path);
    await save(`statfin/${path.replace('/', '-')}.json`, list);
    const postal = list.filter(t => /postal/i.test(t.text));
    return {tables: list.length, postalCodeTables: postal.map(t => `${t.id}: ${t.text} (updated ${t.updated})`)};
  });
}

// ---- 4. Statistics Finland postal-area boundaries ----------------------
await check('postal-wfs', 'list postal boundary layers', async () => {
  const xml = await getText(wfsUrl(POSTAL_WFS, {request: 'GetCapabilities'}));
  await save('postal/capabilities.xml', xml);
  const layers = [...xml.matchAll(/<Name>(postialue:[^<]+)<\/Name>/g)].map(m => m[1]);
  report.postalLayers = layers;
  return {layers};
});
await check('postal-wfs', 'sample Helsinki postal areas (kunta 091)', async () => {
  const latest = (report.postalLayers ?? []).filter(n => /pno_\d{4}$/.test(n)).sort().at(-1) ?? 'postialue:pno_2024';
  const sample = await getJson(wfsUrl(POSTAL_WFS, {request: 'GetFeature', typeNames: latest, outputFormat: 'application/json', srsName: 'urn:ogc:def:crs:OGC:1.3:CRS84', count: '2', cql_filter: "kunta='091'"}));
  await save('postal/sample.json', sample);
  return {layer: latest, total: sample.totalFeatures ?? sample.numberMatched, fields: Object.keys(sample.features?.[0]?.properties ?? {})};
});

// ---- 5. HSL public transport timetable (GTFS) --------------------------
await check('hsl', 'GTFS zip size and date (no download)', async () => {
  const response = await request(HSL_GTFS, {method: 'HEAD'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {
    megabytes: Math.round(Number(response.headers.get('content-length')) / 1e6),
    lastModified: response.headers.get('last-modified'),
  };
});

// ---- 6. OpenStreetMap landmarks (Overpass) -----------------------------
await check('overpass', 'find Helsinki Cathedral', async () => {
  const query = '[out:json][timeout:25];nwr["name"="Helsingin tuomiokirkko"](60.16,24.94,60.18,24.96);out center tags 3;';
  const response = await request(OVERPASS, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'data=' + encodeURIComponent(query),
  });
  const data = await response.json();
  await save('overpass/sample.json', data);
  return {elements: data.elements?.length ?? 0, first: data.elements?.[0] ? `${data.elements[0].type}/${data.elements[0].id}` : null, dataTimestamp: data.osm3s?.timestamp_osm_base};
});

// ---- 7. Field description PDF for the construction permit layers -------
await check('helsinki-permits', 'download field description PDF', async () => {
  const response = await request(PERMIT_FIELDS_PDF);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await save('construction/field-description.pdf', bytes);
  return {kilobytes: Math.round(bytes.length / 1024)};
});

report.finishedAt = new Date().toISOString();
await save('report.json', report);
const failed = report.checks.filter(c => !c.ok);
console.log(`\n${report.checks.length - failed.length}/${report.checks.length} checks ok. Report: data/raw/probe/report.json`);
if (failed.length) console.log('Failed:\n' + failed.map(c => `  ${c.source}: ${c.name}`).join('\n'));
