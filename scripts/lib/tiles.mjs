// Shared pieces for building 3D tiles: the project origin, coordinate
// conversion for vertices, and a validator that re-reads written tiles.
import {gridToLonLat} from './geo.mjs';
import {geodeticToEcef, enuFrame} from './frame.mjs';
import {decodeB3dm} from './b3dm.mjs';

// One fixed origin for the whole project (central Helsinki, sea level).
// Every tile's vertices are metres east/north/up from here.
export const ORIGIN = [24.95, 60.17, 0];
export const FRAME = enuFrame(...ORIGIN);

// Heights: the model uses N2000 (height above mean sea level in Finland).
// Our globe has no terrain; its surface is treated as sea level, so N2000
// metres are used directly as height above that surface. This is an
// approximation (see dataset.json limitations), not a surveyed GPS height.
export function gridPointToLocal([east, north, height]) {
  const [lon, lat] = gridToLonLat([east, north]);
  return FRAME.toLocal(geodeticToEcef(lon, lat, height));
}

export const N2000_LIMITATION =
  'Heights are N2000 (above sea level) shown above a flat sea-level globe; there is no terrain model, so buildings on higher ground can appear to float slightly.';
export const LIMITATIONS = [
  'Partial coverage: only the areas listed in coverage are modelled.',
  N2000_LIMITATION,
  'Neutral colours; facade textures are not included.',
];

// glTF models are "Y up"; 3D Tiles rotates them to "Z up" when loading.
// So local [east, north, up] is stored as [east, up, -north].
export const toGltfAxes = ([e, n, u]) => [e, u, -n];
export const fromGltfAxes = ([x, y, z]) => [x, -z, y];

// 3D Tiles bounding box: centre + three half-axis vectors, in local metres (Z up).
export function boxFromMinMax(min, max, margin = 0.5) {
  const c = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
  const h = [0, 1, 2].map(i => (max[i] - min[i]) / 2 + margin);
  return [...c, h[0], 0, 0, 0, h[1], 0, 0, 0, h[2]];
}

// Re-reads every tile and checks it against the manifest. Returns a list of
// problems (empty list = all good).
export function validateTileset({tileset, manifest, readTile, isInside}) {
  const problems = [];
  const byTile = new Map();
  for (const record of manifest) {
    if (!byTile.has(record.tileContentUri)) byTile.set(record.tileContentUri, []);
    byTile.get(record.tileContentUri).push(record);
  }
  const ids = new Set();
  for (const record of manifest) {
    if (ids.has(record.buildingId)) problems.push(`duplicate buildingId ${record.buildingId}`);
    ids.add(record.buildingId);
    if (!record.position?.every(Number.isFinite)) problems.push(`${record.buildingId}: position is not finite`);
    else if (isInside && !isInside(record.position))
      problems.push(`${record.buildingId}: position is outside Helsinki`);
  }
  const children = tileset.root.children ?? [];
  if (children.length !== byTile.size)
    problems.push(`tileset lists ${children.length} tiles, manifest uses ${byTile.size}`);
  for (const child of children) {
    const uri = child.content.uri;
    const records = (byTile.get(uri) ?? []).sort((a, b) => a.tileFeatureId - b.tileFeatureId);
    let tile;
    try {
      tile = decodeB3dm(readTile(uri));
    } catch (error) {
      problems.push(`${uri}: ${error.message}`);
      continue;
    }
    if (tile.featureTable.BATCH_LENGTH !== records.length)
      problems.push(`${uri}: BATCH_LENGTH ${tile.featureTable.BATCH_LENGTH}, manifest has ${records.length}`);
    records.forEach((record, i) => {
      if (record.tileFeatureId !== i) problems.push(`${uri}: feature IDs are not 0..n-1`);
      if (tile.batchTable.buildingId[i] !== record.buildingId)
        problems.push(`${uri}: feature ${i} is ${tile.batchTable.buildingId[i]}, manifest says ${record.buildingId}`);
    });
    const vertexCount = tile.positions.length / 3;
    const usedBatch = new Set();
    for (const id of tile.batchIds) {
      if (id >= records.length) {
        problems.push(`${uri}: _BATCHID ${id} out of range`);
        break;
      }
      usedBatch.add(id);
    }
    if (usedBatch.size !== records.length)
      problems.push(`${uri}: ${records.length - usedBatch.size} buildings have no triangles`);
    for (const i of tile.indices)
      if (i >= vertexCount) {
        problems.push(`${uri}: index out of range`);
        break;
      }
    const [cx, cy, cz, hx, , , , hy, , , , hz] = child.boundingVolume.box;
    for (let i = 0; i < tile.positions.length; i += 3) {
      const p = [tile.positions[i], tile.positions[i + 1], tile.positions[i + 2]];
      if (!p.every(Number.isFinite)) {
        problems.push(`${uri}: non-finite vertex`);
        break;
      }
      const [e, n, u] = fromGltfAxes(p);
      if (Math.abs(e - cx) > hx + 1e-3 || Math.abs(n - cy) > hy + 1e-3 || Math.abs(u - cz) > hz + 1e-3) {
        problems.push(`${uri}: vertex outside its bounding box`);
        break;
      }
    }
  }
  return problems;
}
