// Publishes the prepared map data as one snapshot for the public site (14 Oct 2026).
//
// The data is made on Ton's computer and is git-ignored (640 MB, raw downloads and the
// Oikotie ads among it). The site needs only the files the browser loads. This script:
//   1. copies exactly those files into data/snapshot/ (dataset.json without the ads section),
//   2. checks they belong to one preparation run: every building ID is in the index, in
//      its grey tile and in its detail file, and nowhere else; search addresses point at
//      known buildings,
//   3. stores the folder as one git commit (not on any branch, so normal clones skip it)
//      and pushes it to GitHub as refs/daroad-data/<time>,
//   4. writes deploy/data-snapshot.json with that commit. Commit this file: the build
//      (scripts/fetch-data.mjs) fetches exactly that commit, so a deployment can never
//      mix files from two runs.
//
//   npm run data:pack              check, store, push
//   npm run data:pack -- --dry     check and copy only
import {readFile, writeFile, readdir, stat, rm, mkdir, cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeIndex, detailFile} from '../src/data/buildingIndex.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = ROOT + 'public/',
  OUT = ROOT + 'data/snapshot/';
// What the browser loads. Everything else in public/ stays on this computer.
export const PUBLISHED = [
  'tileset',
  'buildings',
  'basemap',
  'buildings-index.json',
  'addresses.json',
  'ground-grid.json',
  'ground-grid.bin',
  'labels.json',
  'layers.json',
  'price-by-area.json',
  'parking.json',
  'parking-zones.json',
  'transit.json',
  'construction.json',
  'places.json',
  'services.json',
  'dataset.json',
];
const NEVER = ['listings.json'];
const dry = process.argv.includes('--dry');
const git = (args, opts = {}) => (execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', ...opts}) ?? '').trim();

// 1. Copy.
await rm(OUT, {recursive: true, force: true});
await mkdir(OUT, {recursive: true});
for (const name of PUBLISHED) {
  try {
    await stat(PUBLIC + name);
  } catch {
    throw new Error(`public/${name} is missing. Prepare the data first (README, Data commands).`);
  }
  if (name === 'dataset.json') {
    const dataset = JSON.parse(await readFile(PUBLIC + name, 'utf8'));
    delete dataset.listings; // how the Oikotie ads were collected: not for the public site
    await writeFile(OUT + name, JSON.stringify(dataset));
  } else await cp(PUBLIC + name, OUT + name, {recursive: true});
}

// 2. One run: the same building IDs in the index, the grey tiles and the detail files.
const index = decodeIndex(JSON.parse(await readFile(OUT + 'buildings-index.json', 'utf8')));
const byTile = new Map();
for (const r of index)
  (byTile.get(r.tileContentUri) ?? byTile.set(r.tileContentUri, new Set()).get(r.tileContentUri)).add(r.buildingId);
const tileset = JSON.parse(await readFile(OUT + 'tileset/tileset.json', 'utf8'));
const tileFiles = (await readdir(OUT + 'tileset')).filter(f => f.endsWith('.b3dm'));
const problems = [];
let tileIds = 0;
for (const file of tileFiles) {
  const b = await readFile(OUT + 'tileset/' + file);
  const ftj = b.readUInt32LE(12),
    ftb = b.readUInt32LE(16),
    btj = b.readUInt32LE(20);
  const ids = JSON.parse(b.toString('utf8', 28 + ftj + ftb, 28 + ftj + ftb + btj)).buildingId ?? [];
  tileIds += ids.length;
  const want = byTile.get(file) ?? new Set();
  const details = new Set(
    JSON.parse(await readFile(OUT + 'buildings/' + detailFile(file), 'utf8')).map(r => r.buildingId),
  );
  for (const id of ids)
    if (!want.has(id) || !details.has(id)) problems.push(`${id} in ${file} but not in the index or detail file`);
  if (ids.length !== want.size || details.size !== want.size)
    problems.push(`${file}: tile ${ids.length}, index ${want.size}, details ${details.size} buildings`);
}
if (tileFiles.length !== byTile.size)
  problems.push(`${tileFiles.length} grey tiles but the index names ${byTile.size}`);
if (!JSON.stringify(tileset).includes(tileFiles[0])) problems.push('tileset.json does not list the tile files');
const known = new Set(index.map(r => r.buildingId));
for (const a of JSON.parse(await readFile(OUT + 'addresses.json', 'utf8')))
  for (const id of a.buildingIds ?? [])
    if (!known.has(id)) problems.push(`address ${a.address ?? ''} points at unknown ${id}`);
for (const name of NEVER)
  try {
    await stat(OUT + name);
    problems.push(`${name} must never be published`);
  } catch {}
if (problems.length) throw new Error(`Data from different runs or incomplete:\n${problems.slice(0, 20).join('\n')}`);

// Size and count.
let files = 0,
  bytes = 0;
const walk = async dir => {
  for (const e of await readdir(dir, {withFileTypes: true})) {
    if (e.isDirectory()) await walk(dir + e.name + '/');
    else {
      files++;
      bytes += (await stat(dir + e.name)).size;
    }
  }
};
await walk(OUT);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
const summary = {
  createdAt: new Date().toISOString(),
  files,
  bytes,
  buildings: index.length,
  tiles: tileFiles.length,
  tileBuildings: tileIds,
};
console.log('snapshot ok:', JSON.stringify(summary));
if (dry) process.exit(0);

// 3. One commit, outside any branch. A separate index file keeps the normal staging area untouched.
const previous = JSON.parse(await readFile(ROOT + 'deploy/data-snapshot.json', 'utf8').catch(() => '{}'));
const env = {...process.env, GIT_INDEX_FILE: ROOT + 'data/.snapshot-index'};
await rm(ROOT + 'data/.snapshot-index', {force: true});
// Files are stored byte for byte: no line-ending changes on Windows.
git(['-c', 'core.autocrlf=false', '--work-tree=' + OUT, 'add', '--all', '--force', '.'], {env});
const tree = git(['write-tree'], {env});
const parents = previous.commit ? ['-p', previous.commit] : [];
let commit;
try {
  commit = git([
    'commit-tree',
    tree,
    ...parents,
    '-m',
    `data: map data snapshot ${stamp}\n\n${JSON.stringify(summary)}`,
  ]);
} catch {
  commit = git(['commit-tree', tree, '-m', `data: map data snapshot ${stamp}\n\n${JSON.stringify(summary)}`]);
}
const ref = `refs/daroad-data/${stamp}`;
git(['push', 'origin', `${commit}:${ref}`], {stdio: 'inherit'});
await rm(ROOT + 'data/.snapshot-index', {force: true});

// 4. Pin it.
await mkdir(ROOT + 'deploy', {recursive: true});
await writeFile(
  ROOT + 'deploy/data-snapshot.json',
  JSON.stringify({repo: 'https://github.com/TranCanhTon/Helhelsinki.git', ref, commit, ...summary}, null, 2) + '\n',
);
console.log(`pushed ${ref} (${commit}). Commit deploy/data-snapshot.json to use it.`);
