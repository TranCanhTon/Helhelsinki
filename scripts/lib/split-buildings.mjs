// What the map loads for the grey buildings:
//
// 1. flatTileset(tileset): every building tile directly under the root, so Cesium loads
//    each tile in view, also when zoomed out. (A tree that loaded only tiles within
//    2.5 km was removed by Ton, 13 Oct 2026; this turns such a tree back into a list.)
// 2. writeBuildingFiles(manifest): the short index the map loads at start plus one
//    file of full records per tile, loaded when a card opens (src/data/buildingIndex.js).
import {writeFile, mkdir, rm, rename} from 'node:fs/promises';
import {encodeIndex, detailFile} from '../../src/data/buildingIndex.js';

export function flatTileset(tileset) {
  const children = contentTiles(tileset).map(t => ({boundingVolume: t.boundingVolume, geometricError: 0, content: t.content}));
  const {content, ...root} = tileset.root;
  return {...tileset, geometricError: 2000, root: {...root, geometricError: 500, refine: 'ADD', children}};
}

// The content tiles of a tileset, flat or tree (for checks).
export function contentTiles(tileset) {
  const out = [];
  const walk = node => { if (node.content) out.push(node); for (const c of node.children ?? []) walk(c); };
  walk(tileset.root);
  return out;
}

// On Windows a running dev server can hold a folder for a moment (EPERM/EBUSY): try again.
async function retry(step) {
  for (let attempt = 1; ; attempt++) {
    try { return await step(); } catch (error) {
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES'].includes(error.code)) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function writeBuildingFiles(root, manifest) {
  const byTile = new Map();
  for (const r of manifest) {
    if (!r.tileContentUri) throw new Error(`${r.buildingId} has no tile`);
    if (!byTile.has(r.tileContentUri)) byTile.set(r.tileContentUri, []);
    byTile.get(r.tileContentUri).push(r);
  }
  // Write into a new folder, then swap, so the map never sees half a set.
  const dir = new URL('public/buildings/', root), next = new URL('public/buildings.next/', root);
  await retry(() => rm(next, {recursive: true, force: true}));
  await mkdir(next, {recursive: true});
  for (const [uri, records] of byTile) await writeFile(new URL(detailFile(uri), next), JSON.stringify(records));
  await retry(() => rm(dir, {recursive: true, force: true}));
  await retry(() => rename(next, dir));
  const index = JSON.stringify(encodeIndex(manifest));
  await writeFile(new URL('public/buildings-index.json.tmp', root), index);
  await retry(() => rename(new URL('public/buildings-index.json.tmp', root), new URL('public/buildings-index.json', root)));
  console.log(`Building index: ${manifest.length} buildings, ${(index.length / 1024 / 1024).toFixed(2)} MB; ${byTile.size} detail files.`);
}
