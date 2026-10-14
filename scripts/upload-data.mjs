// Copies the map data the browser needs to the Cloudflare R2 bucket behind the public
// site (Ton, 14 Oct 2026). Uses rclone (https://rclone.org) with a remote called "r2"
// that Ton sets up once with his own keys. Only new or changed files are sent.
//
// Left out: listings.json (Oikotie ads are never published), the grey fallback
// buildings (tileset/, 373 MB), files only the data scripts use, and everything the
// Vercel build makes or the repo holds (cesium/, models/, favicon).
//
//   npm run data:upload              bucket "daroad-data"
//   npm run data:upload -- my-bucket another bucket name
import {readdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const bucket = process.argv[2] ?? 'daroad-data';
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const SKIP = new Set(['listings.json', 'tileset', 'buildings-manifest.json', 'transit-routes.json', 'cesium', 'models', 'map', 'favicon.svg']);

const files = [];
async function walk(dir, prefix) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const rel = prefix + entry.name;
    if (!prefix && SKIP.has(entry.name)) continue;
    if (entry.name.endsWith('.tmp') || entry.name.endsWith('.part')) continue;
    if (entry.isDirectory()) await walk(dir + entry.name + '/', rel + '/');
    else files.push(rel);
  }
}
await walk(PUBLIC, '');
if (files.includes('listings.json')) throw new Error('listings.json must never be uploaded');
const list = join(tmpdir(), 'daroad-upload-list.txt');
await writeFile(list, files.join('\n') + '\n');
console.log(`${files.length} files to r2:${bucket}`);
const run = spawnSync('rclone', ['copy', PUBLIC, `r2:${bucket}`, '--files-from', list, '--transfers', '32', '--progress'], {stdio: 'inherit'});
if (run.error) throw new Error('rclone not found. Install it: winget install Rclone.Rclone');
process.exit(run.status ?? 1);
