// Writes our own 3D tiles + manifest from prepared buildings, checks them,
// and only then copies them into public/. Used by both building sources:
// the CityGML converter and the city-tiles importer.
//
// Give either `items` (all at once) or `cells` (an async list of [cell, items], one
// 500 m cell at a time, so the whole city never has to be in memory).
// Each item: {
//   record: manifest fields (buildingId, position, ...),
//   cell:   tile key such as "50994-13345" (500 m grid cell; only needed with `items`),
//   meshes: [{positions: [[e,n,u]...], normals: [[e,n,u]...], indices: [...]}]  local metres
// }
import {readFile, writeFile, mkdir, rm, cp} from 'node:fs/promises';
import {encodeB3dm} from './b3dm.mjs';
import {FRAME, ORIGIN, toGltfAxes, boxFromMinMax, validateTileset} from './tiles.mjs';
import {writeBuildingFiles} from './split-buildings.mjs';

function groupByCell(items) {
  const cells = new Map();
  for (const item of items) {
    if (!cells.has(item.cell)) cells.set(item.cell, []);
    cells.get(item.cell).push(item);
  }
  return [...cells].sort(([a], [b]) => a.localeCompare(b));
}

export async function publishBuildings({root, items, cells, boundary, dataset}) {
  const staging = new URL('data/staging/', root);
  const stagingTiles = new URL('tileset/', staging);
  await rm(staging, {recursive: true, force: true});
  await mkdir(stagingTiles, {recursive: true});

  const manifest = [],
    children = [],
    problems = [];
  const allMin = [Infinity, Infinity, Infinity],
    allMax = [-Infinity, -Infinity, -Infinity];
  let triangles = 0,
    tileBytes = 0,
    empty = 0;
  for await (const [cell, cellItems] of cells ?? groupByCell(items)) {
    const positions = [],
      normals = [],
      batchIds = [],
      indices = [];
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    const tileContentUri = `${cell}.b3dm`;
    const tileRecords = [];
    for (const {record, meshes} of cellItems.sort((a, b) => a.record.buildingId.localeCompare(b.record.buildingId))) {
      const featureId = tileRecords.length;
      let added = 0;
      for (const mesh of meshes) {
        if (!mesh.indices.length) continue;
        const base = positions.length / 3;
        mesh.positions.forEach((p, i) => {
          positions.push(...toGltfAxes(p));
          normals.push(...toGltfAxes(mesh.normals[i]));
          batchIds.push(featureId);
          for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[k]);
            max[k] = Math.max(max[k], p[k]);
          }
        });
        for (const i of mesh.indices) indices.push(base + i);
        added += mesh.indices.length / 3;
      }
      if (!added) {
        empty++;
        continue;
      }
      triangles += added;
      tileRecords.push({...record, tileContentUri, tileFeatureId: featureId});
    }
    if (!tileRecords.length) continue;
    const tile = encodeB3dm(
      {
        positions: Float32Array.from(positions),
        normals: Float32Array.from(normals),
        batchIds: Uint32Array.from(batchIds),
        indices: Uint32Array.from(indices),
      },
      {buildingId: tileRecords.map(r => r.buildingId)},
    );
    const url = new URL(tileContentUri, stagingTiles);
    await writeFile(url, tile);
    tileBytes += tile.length;
    for (let k = 0; k < 3; k++) {
      allMin[k] = Math.min(allMin[k], min[k]);
      allMax[k] = Math.max(allMax[k], max[k]);
    }
    const child = {boundingVolume: {box: boxFromMinMax(min, max)}, geometricError: 0, content: {uri: tileContentUri}};
    // Check the tile as written to disk now, so no tile has to stay in memory.
    const written = await readFile(url);
    problems.push(
      ...validateTileset({
        tileset: {root: {children: [child]}},
        manifest: tileRecords,
        readTile: () => written,
        isInside: boundary.isInside,
      }),
    );
    children.push(child);
    manifest.push(...tileRecords);
    console.log(`  tile ${tileContentUri}: ${tileRecords.length} buildings, ${(tile.length / 1024).toFixed(0)} KB`);
  }
  if (!manifest.length) throw new Error('No buildings with geometry to publish');
  // Across tiles: every building exactly once.
  const ids = new Set();
  for (const r of manifest) {
    if (ids.has(r.buildingId)) problems.push(`duplicate buildingId ${r.buildingId}`);
    ids.add(r.buildingId);
  }
  if (problems.length)
    throw new Error('Validation failed; public/ was NOT changed:\n' + problems.slice(0, 30).join('\n'));

  const tileset = {
    asset: {version: '1.0', gltfUpAxis: 'Y', copyright: 'City of Helsinki, CC BY 4.0'},
    geometricError: 2000,
    root: {
      transform: FRAME.matrix,
      boundingVolume: {box: boxFromMinMax(allMin, allMax, 5)},
      geometricError: 500,
      refine: 'ADD',
      children,
    },
  };
  await writeFile(new URL('tileset.json', stagingTiles), JSON.stringify(tileset));

  // Keep sections other scripts own (addresses, labels, trees, prices, basemap).
  const previous = await readFile(new URL('public/dataset.json', root), 'utf8').then(JSON.parse, () => ({}));
  const fullDataset = {
    ...previous,
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ...dataset,
    counts: {
      buildings: manifest.length,
      tiles: children.length,
      triangles,
      lod2: manifest.filter(r => r.lod === 2).length,
      lod1: manifest.filter(r => r.lod === 1).length,
      withAddress: manifest.filter(r => r.address).length,
      ...dataset.counts,
      buildingsWithoutTriangles: empty,
    },
    tileBytes,
    origin: ORIGIN,
  };
  await writeFile(new URL('buildings-manifest.json', staging), JSON.stringify(manifest));
  await writeFile(new URL('dataset.json', staging), JSON.stringify(fullDataset, null, 2));

  const publicDir = new URL('public/', root);
  await rm(new URL('tileset/', publicDir), {recursive: true, force: true});
  await cp(stagingTiles, new URL('tileset/', publicDir), {recursive: true});
  await cp(new URL('buildings-manifest.json', staging), new URL('buildings-manifest.json', publicDir));
  await cp(new URL('dataset.json', staging), new URL('dataset.json', publicDir));
  await writeBuildingFiles(root, manifest);

  console.log(
    `\nPublished ${manifest.length} buildings in ${children.length} tile(s), ${triangles} triangles, ${(tileBytes / 1024 / 1024).toFixed(2)} MB.`,
  );
  console.log(`With an address: ${fullDataset.counts.withAddress}/${manifest.length}.`);
  return {manifest, tileset, dataset: fullDataset};
}
