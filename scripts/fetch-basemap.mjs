// Phase 2: download the layers the ground map is drawn from.
//
// All City of Helsinki WFS, CC BY 4.0. Coordinates come as longitude/latitude
// (CRS:84). Only Helsinki's bounding box is requested; build-basemap.mjs then
// draws only what is inside the exact Helsinki boundary.
//
//   land       Maavesi_maa_alueet_yleistetty   land shapes; the sea is what's left
//   guide      Opaskartta_alue                  lakes, rivers, forest, fields, blocks, squares, bridges
//   lines      Opaskartta_muuviiva              railway, metro, light rail, piers
//   streets    YLRE_Katualue_alue               every street's real outline and road class
//   green      YLRE_Viheralue_alue              parks and other green areas
//   lanes      YLRE_Katu_ja_viherosat_ajorata_alue   driving surface, central area only
//
// Output: data/raw/basemap/<name>.json   (resumes: existing files are kept; --force to refetch)
// Run:    npm run data:basemap:fetch
import {mkdir, writeFile, access} from 'node:fs/promises';
import {fetchAllFeatures} from './lib/wfs.mjs';
import {loadBoundary} from './lib/boundary.mjs';
import {lonLatToGrid} from './lib/geo.mjs';
import {areaBbox} from './config.mjs';

const LAYERS = [
  {name: 'land', layer: 'Maavesi_maa_alueet_yleistetty', sortBy: 'tietopalvelu_id', scope: 'helsinki'},
  {name: 'guide', layer: 'Opaskartta_alue', sortBy: 'id', scope: 'helsinki'},
  {name: 'lines', layer: 'Opaskartta_muuviiva', sortBy: 'id', scope: 'helsinki'},
  {name: 'streets', layer: 'YLRE_Katualue_alue', sortBy: 'katualue_id', scope: 'helsinki'},
  {name: 'green', layer: 'YLRE_Viheralue_alue', sortBy: 'viheralue_id', scope: 'helsinki'},
  {name: 'lanes', layer: 'YLRE_Katu_ja_viherosat_ajorata_alue', sortBy: 'osan_id', scope: 'central'},
];

const dir = new URL('../data/raw/basemap/', import.meta.url);
await mkdir(dir, {recursive: true});
const force = process.argv.includes('--force');
const exists = path =>
  access(path).then(
    () => true,
    () => false,
  );

// Helsinki's bounding box in EPSG:3879 (the server's own grid), from the boundary.
const boundary = await loadBoundary().catch(() => {
  throw new Error('Run npm run data:boundary first.');
});
const box = [Infinity, Infinity, -Infinity, -Infinity];
for (const polygon of boundary.geometry.coordinates)
  for (const point of polygon[0]) {
    const [e, n] = lonLatToGrid(point);
    box[0] = Math.min(box[0], e);
    box[1] = Math.min(box[1], n);
    box[2] = Math.max(box[2], e);
    box[3] = Math.max(box[3], n);
  }
const scopes = {helsinki: box.map(Math.round), central: areaBbox('central')};

for (const {name, layer, sortBy, scope} of LAYERS) {
  const file = new URL(`${name}.json`, dir);
  if (!force && (await exists(file))) {
    console.log(`  have ${name} (${layer})`);
    continue;
  }
  console.log(`Downloading ${layer} for ${scope}...`);
  const download = await fetchAllFeatures({
    typeName: `avoindata:${layer}`,
    srsName: 'CRS:84',
    bbox: scopes[scope],
    sortBy,
    pageSize: 5000,
  });
  await writeFile(
    file,
    JSON.stringify({
      layer: `avoindata:${layer}`,
      scope,
      bbox3879: scopes[scope],
      license: 'City of Helsinki, CC BY 4.0',
      ...download,
    }),
  );
  console.log(`  ${name}: ${download.features.length} features`);
}
console.log('Next: npm run data:basemap:build');
