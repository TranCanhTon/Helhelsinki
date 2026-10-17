// Rebuilds what the map loads from the current buildings, without importing again:
// the flat tile list, the short building index and the per-tile detail files
// (scripts/lib/split-buildings.mjs).
// data:city-tiles and data:noise do this themselves; run this after other changes
// to public/buildings-manifest.json.
import {readJson, publishJson, ROOT} from './lib/prepare.mjs';
import {flatTileset, contentTiles, writeBuildingFiles} from './lib/split-buildings.mjs';

const manifest = await readJson('public/buildings-manifest.json');
const tileset = flatTileset(await readJson('public/tileset/tileset.json'));
const tiles = new Set(contentTiles(tileset).map(t => t.content.uri));
const used = new Set(manifest.map(r => r.tileContentUri));
const missing = [...used].filter(u => !tiles.has(u));
if (missing.length || tiles.size !== used.size)
  throw new Error(
    `Tiles and building list do not match (${tiles.size} tiles, ${used.size} used, missing ${missing.slice(0, 5).join(', ')})`,
  );
await publishJson('public/tileset/tileset.json', tileset);
console.log(`Tile list: ${tiles.size} tiles, all loading when in view.`);
await writeBuildingFiles(ROOT, manifest);
