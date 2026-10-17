// Discover table IDs from official listings. Geography follows each table's map year.
import polygonClipping from 'polygon-clipping';
import {getJson} from './lib/http.mjs';
import {fetchAllFeatures} from './lib/wfs.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {cached, readJson, publishJson, writeJson, datasetSection} from './lib/prepare.mjs';
import {decodeJsonStat, quarterChange, quarterNumber, validateSchema} from '../src/data/prices.js';
const api = 'https://pxdata.stat.fi/PxWeb/api/v1/en/';
const boundary = await loadBoundary();
const metrics = {};
for (const metric of ['sale', 'rent']) {
  let chosen, folder;
  for (const candidate of metric === 'sale' ? ['StatFin/ashi'] : ['StatFin/asvu', 'StatFin_Passiivi/asvu']) {
    const list = await getJson(api + candidate);
    await writeJson('data/raw/prices/' + candidate.replace('/', '-') + '.json', list);
    const tables = list
      .filter(
        t =>
          t.type === 't' &&
          /postal code/i.test(t.text) &&
          (metric === 'sale'
            ? /old dwellings/i.test(t.text) && /quarter/i.test(t.text)
            : /non-subsidised/i.test(t.text) && /Q[1-4]/.test(t.text)),
      )
      .sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''));
    if (tables.length) {
      chosen = tables[0];
      folder = candidate;
      break;
    }
  }
  if (!chosen) throw new Error('No matching ' + metric + ' table found in official listings');
  const url = api + folder + '/' + chosen.id;
  const metadata = await getJson(url);
  await writeJson('data/raw/prices/' + metric + '-metadata.json', metadata);
  const vars = metadata.variables;
  const time = vars.find(v => v.time),
    postal = vars.find(v => /postal code/i.test(v.text));
  const type = vars.find(v => /building type|number of rooms/i.test(v.text));
  const info = vars.find(v => /information/i.test(v.text));
  if (!time || !postal || !type || !info || vars.length !== 4) throw new Error('Unexpected dimensions: ' + url);
  const pick = (v, pattern) => {
    const found = v.valueTexts.map((s, i) => (pattern.test(s) ? v.values[i] : null)).filter(Boolean);
    if (found.length !== 1) throw new Error('Ambiguous category ' + v.text);
    return found[0];
  };
  const kind = pick(type, metric === 'sale' ? /^Blocks of flats, two-room flat$/i : /^Two-room flat$/i);
  const measure = pick(info, metric === 'sale' ? /^Price per square met/i : /^Rents per square met/i);
  const periods = time.values
    .filter(v => quarterNumber(v) !== null)
    .sort((a, b) => quarterNumber(a) - quarterNumber(b))
    .slice(-2);
  if (periods.length !== 2) throw new Error('Need two quarters');
  const year = Number(postal.map?.match(/20\d{2}/)?.[0]);
  if (!year) throw new Error('Postal boundary vintage not declared: ' + postal.map);
  const polygons = await cached('data/raw/prices/postal-' + year + '.json', () =>
    fetchAllFeatures({
      base: 'https://geo.stat.fi/geoserver/postialue/wfs',
      typeName: 'postialue:pno_' + year,
      sortBy: 'posti_alue',
      extra: {CQL_FILTER: "kunta='091'"},
    }),
  );
  const available = new Set(polygons.features.map(f => String(f.properties.posti_alue)));
  const codes = postal.values.filter((code, i) => available.has(code) && /\(Helsinki\s*\)/i.test(postal.valueTexts[i]));
  if (!codes.length) throw new Error('No Helsinki postal codes');
  const selection = new Map([
    [time.code, periods],
    [postal.code, codes],
    [type.code, [kind]],
    [info.code, [measure]],
  ]);
  const body = {
    query: vars.map(v => ({code: v.code, selection: {filter: 'item', values: selection.get(v.code)}})),
    response: {format: 'json-stat2'},
  };
  const raw = await getJson(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  await writeJson('data/raw/prices/' + metric + '-response.json', raw);
  const decoded = decodeJsonStat(raw);
  const values = new Map();
  for (const row of decoded) {
    const code = row.keys[postal.code],
      period = row.keys[time.code];
    if (!values.has(code)) values.set(code, {});
    values.get(code)[period] = row.value;
  }
  const areas = [];
  for (const f of polygons.features) {
    const postcode = String(f.properties.posti_alue);
    // Keep every Helsinki postal polygon; codes absent from the table remain null.
    const clipped = polygonClipping.intersection(
      boundary.geometry.coordinates,
      f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates,
    );
    if (!clipped.length) continue;
    const observations = periods.map(q => values.get(postcode)?.[q] ?? null);
    areas.push({
      postcode,
      name: f.properties.nimi,
      values: observations,
      changePercent: quarterChange(...observations, periods),
      geometry: {type: 'MultiPolygon', coordinates: clipped},
    });
  }
  metrics[metric] = {
    title: metadata.title,
    table: chosen.id,
    source: url,
    updated: chosen.updated,
    archived: folder.includes('Passiivi'),
    boundaryYear: year,
    boundarySource: 'https://geo.stat.fi/geoserver/postialue/wfs',
    periods,
    periodLabels: periods.map(q => time.valueTexts[time.values.indexOf(q)]),
    units: metric === 'sale' ? 'EUR/m²' : 'EUR/m²/month',
    category: metric === 'sale' ? 'Old two-room flats in blocks of flats' : 'Non-subsidised two-room flats',
    areas,
  };
  console.log(metric, chosen.id, 'boundaries', year, 'periods', periods, 'areas', areas.length);
}
const data = {
  schemaVersion: 1,
  retrievedAt: new Date().toISOString(),
  license: 'Statistics Finland, CC BY 4.0',
  note: 'Postal-area averages, not building valuations. Shapes clipped to Helsinki; source area values unchanged.',
  metrics,
};
validateSchema(data, await readJson('schemas/price-by-area.schema.json'));
await publishJson('public/price-by-area.json', data);
await datasetSection('prices', {
  ...data,
  metrics: Object.fromEntries(Object.entries(metrics).map(([key, m]) => [key, {...m, areas: m.areas.length}])),
});
