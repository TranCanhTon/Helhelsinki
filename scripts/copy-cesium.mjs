// CesiumJS is the 3D globe library. Besides its JavaScript, it needs some
// static files at runtime: web workers (background threads that decode 3D
// data), images, and widget CSS. This script copies them from node_modules
// into public/cesium/ so Vite serves them at /cesium/ in dev and in the build.
//
// It runs automatically before `npm run dev` and `npm run build`
// (see "predev" and "prebuild" in package.json). public/cesium/ is ignored
// by git because it can always be recreated from node_modules.
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';

const source = new URL('../node_modules/cesium/Build/Cesium/', import.meta.url);
const target = new URL('../public/cesium/', import.meta.url);
const version = JSON.parse(await readFile(new URL('../node_modules/cesium/package.json', import.meta.url), 'utf8')).version;
const stamp = new URL('VERSION', target);

// Skip the copy when the same Cesium version is already there.
if (existsSync(stamp) && (await readFile(stamp, 'utf8')) === version) {
  console.log(`Cesium ${version} assets already in public/cesium`);
} else {
  await mkdir(target, {recursive: true});
  for (const folder of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
    await cp(new URL(folder, source), new URL(folder, target), {recursive: true});
  }
  await writeFile(stamp, version);
  console.log(`Copied Cesium ${version} assets to public/cesium`);
}
