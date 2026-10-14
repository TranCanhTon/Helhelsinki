// Modelled road, rail, metro and tram noise (2022 Lden study) per building.
//
// 1. Downloads the four Lden layers from the city WFS (all pages, checked).
// 2. Checks every band record; a broken record stops the script.
// 3. Per building and mode: the loudest band at its centre or within 10 m (src/data/noise.js).
// 4. Writes the bands into buildings-manifest.json (and the map's building index) and the method into layers.json.
// Run again after data:city-tiles, which rewrites the manifest.
import {fetchAllFeatures} from './lib/wfs.mjs';
import {cached, readJson, publishJson, datasetSection, ROOT} from './lib/prepare.mjs';
import {writeBuildingFiles} from './lib/split-buildings.mjs';
import {NOISE_MODES, bandProblem, bandIndex, withAll, bandList, loudestNear, WALL_M} from '../src/data/noise.js';

const modes = [];
const lookups = {};
for (const mode of NOISE_MODES) {
  const raw = await cached('data/raw/noise/' + mode.key + '.json', () =>
    fetchAllFeatures({typeName: 'avoindata:' + mode.layer, pageSize: 5000, sortBy: 'id'}));
  const problems = raw.features.map(f => [f.id, bandProblem(f)]).filter(([, p]) => p);
  if (problems.length) throw new Error(`${mode.layer}: ${problems.length} unusable records, e.g. ${problems.slice(0, 5).map(p => p.join(': ')).join('; ')}`);
  lookups[mode.key] = bandIndex(raw.features);
  const bands = bandList(raw.features);
  modes.push({key: mode.key, label: mode.label, layer: 'avoindata:' + mode.layer, records: raw.total,
    retrievedAt: raw.retrievedAt, updated: raw.features[0]?.properties.paivitetty_tietopalveluun ?? null, bands});
  console.log(mode.key, raw.total, 'records, bands', bands.map(b => b.lo + '-' + (b.hi ?? '')).join(' '));
}

const manifest = await readJson('public/buildings-manifest.json');
const counts = Object.fromEntries([...NOISE_MODES.map(m => m.key), 'all'].map(k => [k, 0]));
for (const record of manifest) {
  record.noise = withAll(Object.fromEntries(NOISE_MODES.map(m => [m.key, loudestNear(lookups[m.key], record.position)])));
  for (const [key, value] of Object.entries(record.noise)) if (value !== null) counts[key]++;
}
await publishJson('public/buildings-manifest.json', manifest);
await writeBuildingFiles(ROOT, manifest);

// One band list for the legend: every band any mode uses.
const allBands = new Map();
for (const m of modes) for (const b of m.bands) allBands.set(b.lo, b.hi);
const layers = {schemaVersion: 1,
  noise: {study: 'Helsinki noise survey 2022', studyYear: 2022, metric: 'Lden',
    metricText: 'Modelled day-evening-night average noise level (Lden), with evening and night weighted up. Not a measurement.',
    source: 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs', license: 'City of Helsinki, CC BY 4.0',
    method: 'Loudest band at the building centre (manifest position) or at eight points '+WALL_M+' m around it, tested against each band polygon, holes respected. Overlapping bands: the highest wins. All = highest band of any mode, not a sum. No band at any point = null (below the lowest mapped band or not covered), never 0 dB.',
    bands: [...allBands].map(([lo, hi]) => ({lo, hi})).sort((a, b) => a.lo - b.lo),
    modes}};
await publishJson('public/layers.json', layers);
await datasetSection('noise', {...layers.noise, buildings: manifest.length, buildingsWithBand: counts});
console.log('buildings', manifest.length, 'with a band', counts);
