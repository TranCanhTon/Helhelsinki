// Puts the published map data into public/ before a build (runs as part of npm run build).
//
// The data is not in the main branch (it is made on Ton's computer and is too big for
// it). deploy/data-snapshot.json names one snapshot commit (npm run data:pack); this
// fetches exactly that commit from GitHub and checks it, so every build has one complete,
// matching set of files. Vercel builds this way from a clean checkout.
//
// On a computer that already has its own data in public/ nothing is fetched; set
// DATA_SNAPSHOT=fetch to replace it with the snapshot anyway.
import {readFile, rm, mkdir, rename, readdir, stat, cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url)), PUBLIC = ROOT + 'public/';
const pin = JSON.parse(await readFile(ROOT + 'deploy/data-snapshot.json', 'utf8'));
const have = await stat(PUBLIC + 'buildings-index.json').then(() => true, () => false);
if (have && process.env.DATA_SNAPSHOT !== 'fetch') {
  console.log('Map data already in public/ (this computer\'s own). DATA_SNAPSHOT=fetch uses the published snapshot instead.');
  process.exit(0);
}
// Unpacked inside the project: on Vercel the temp folder is another disk, and files cannot be moved across disks.
const work = join(ROOT, '.data-fetch'), files = join(work, 'files');
const git = (...args) => execFileSync('git', args, {cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']}).trim();
await rm(work, {recursive: true, force: true});
await mkdir(files, {recursive: true});
console.log(`fetching map data ${pin.ref} (${pin.files} files, ${Math.round(pin.bytes / 1e6)} MB)`);
git('init', '-q');
git('fetch', '-q', '--depth', '1', '--no-tags', pin.repo, `+${pin.ref}:refs/snapshot`);
const got = git('rev-parse', 'refs/snapshot');
if (got !== pin.commit) throw new Error(`${pin.ref} is ${got}, but deploy/data-snapshot.json expects ${pin.commit}`);
git('-c', 'core.autocrlf=false', '--work-tree=' + files, 'checkout', '-q', 'refs/snapshot', '--', '.');
// Count before anything goes into public/.
let count = 0;
const walk = async dir => { for (const e of await readdir(dir, {withFileTypes: true})) e.isDirectory() ? await walk(join(dir, e.name)) : count++; };
await walk(files);
if (count !== pin.files) throw new Error(`snapshot has ${count} files, expected ${pin.files}`);
for (const name of await readdir(files)) {
  await rm(PUBLIC + name, {recursive: true, force: true});
  await rename(join(files, name), PUBLIC + name).catch(async () => { await cp(join(files, name), PUBLIC + name, {recursive: true}); });
}
await rm(work, {recursive: true, force: true});
console.log(`map data ${pin.ref} in public/ (${count} files)`);
