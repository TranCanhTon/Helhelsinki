import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
export const ROOT = new URL('../../', import.meta.url);
export const readJson = async path => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
export async function writeJson(path, data) {
  const file = new URL(path, ROOT);
  await mkdir(new URL('./', file), {recursive: true});
  await writeFile(file, JSON.stringify(data));
}
export async function publishJson(path, data) {
  await writeJson(path + '.tmp', data);
  await rename(new URL(path + '.tmp', ROOT), new URL(path, ROOT));
}
export async function cached(path, fetcher) {
  if (!process.argv.includes('--force')) {
    try {
      return await readJson(path);
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  const data = await fetcher();
  await writeJson(path, data);
  return data;
}
export async function datasetSection(key, data) {
  const dataset = await readJson('public/dataset.json');
  dataset[key] = data;
  await publishJson('public/dataset.json', dataset);
}
