// Current Oikotie rental ads in Helsinki, matched to our buildings.
//
// Ton allowed collecting these (12 Oct 2026). We only use what Oikotie's
// robots.txt allows: the published sitemaps and the ad pages. Never /api.
//   1. sitemaps (sm_ad_*.xml) list every ad URL with a "last changed" time;
//      Helsinki rentals look like /vuokra-asunnot/helsinki/<id>
//   2. each new or changed ad page is read once, about one page per second.
//      The page carries schema.org data meant for search engines: rent, size,
//      rooms, address, coordinates. We keep only those facts: no photos,
//      descriptions or landlord names.
//   3. ads are matched to buildings by exact address and published to
//      public/listings.json. Ads gone from the sitemap are dropped.
//
// Run:  npm run data:listings            full pass (all sitemaps, drops removed ads)
//       npm run data:listings -- --quick  newest sitemap only (new ads), no drops
//       npm run data:listings -- --watch  quick pass every 15 min, full every 6 h
// If Oikotie answers 403/429 or shows a captcha, the script stops. Do not work around it.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {loadBoundary} from './lib/boundary.mjs';
import {readJson, publishJson, datasetSection} from './lib/prepare.mjs';
import {exactAddress} from '../src/data/addresses.js';

const SITE = 'https://asunnot.oikotie.fi';
const UA = 'HelsinkiLens/0.1 (personal research project; +https://github.com/TranCanhTon/helhelsinki)';
const PAUSE_MS = 1100;
const CACHE = new URL('../data/raw/listings/', import.meta.url);
const CACHE_FILE = new URL('ads.json', CACHE);
const quick = process.argv.includes('--quick'), watch = process.argv.includes('--watch');
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Blocked extends Error {}
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try { response = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(60000)}); }
    catch (error) { if (attempt < 2) { await sleep(5000 * (attempt + 1)); continue; } throw error; }
    if ([403, 429].includes(response.status)) throw new Blocked(`Oikotie answered HTTP ${response.status} for ${url}. Stopping; do not work around it.`);
    if ([502, 503, 504].includes(response.status) && attempt < 2) { await sleep(5000 * (attempt + 1)); continue; }
    const text = await response.text();
    if (/captcha|cf-challenge|challenge-platform/i.test(text)) throw new Blocked(`Oikotie showed a bot check for ${url}. Stopping; do not work around it.`);
    return {status: response.status, text};
  }
}

// [{id, url, lastmod}] for Helsinki rental ads in the given sitemaps.
async function sitemapAds(files) {
  const ads = [];
  for (const file of files) {
    const {status, text} = await get(file);
    if (status !== 200) throw new Error(`Sitemap ${file}: HTTP ${status}`);
    for (const [, loc, lastmod] of text.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) {
      const m = /\/vuokra-asunnot\/helsinki\/(\d+)$/.exec(loc);
      if (m) ads.push({id: m[1], url: loc, lastmod});
    }
    await sleep(PAUSE_MS);
  }
  return ads;
}

// Facts from the ad page's schema.org block, or null if the page has none.
function parseAd(html) {
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data; try { data = JSON.parse(json); } catch { continue; }
    const types = [].concat(data['@type']);
    if (!types.includes('Apartment')) continue;
    const num = v => Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null;
    return {
      rent: num(data.offers?.price),
      currency: data.offers?.priceCurrency ?? null,
      sizeM2: num(data.floorSize?.value),
      rooms: num(data.numberOfRooms),
      layout: data.name?.replace(/\s*\|\s*Oikotie$/, '') || null,       // e.g. "2h + k + kph"
      street: data.address?.streetAddress?.split(',')[0].trim() || null,
      postcode: data.address?.postalCode ? String(data.address.postalCode) : null,
      district: data.address?.addressLocality ?? null,
      position: num(data.geo?.longitude) !== null && num(data.geo?.latitude) !== null ? [num(data.geo.longitude), num(data.geo.latitude)] : null,
      condition: data.itemCondition?.name ?? null,
    };
  }
  return null;
}

// "Sturenkatu 47 B 12" -> ["sturenkatu 47b", "sturenkatu 47"]: try the house letter, then without.
function addressKeys(street) {
  const m = /^(.*?\D)\s*(\d+)\s*([a-zåäö])?\b/iu.exec(street ?? '');
  if (!m) return [];
  const base = m[1].trim() + ' ' + m[2];
  return [...new Set([m[3] ? exactAddress(base + m[3].toLowerCase()) : null, exactAddress(base)].filter(Boolean))];
}

async function run(full) {
  await mkdir(CACHE, {recursive: true});
  const cache = await readFile(CACHE_FILE, 'utf8').then(JSON.parse, () => ({ads: {}}));
  const index = (await get(SITE + '/sitemaps/index.xml')).text;
  const files = [...index.matchAll(/<loc>([^<]*\/sm_ad_\d+\.xml)<\/loc>/g)].map(m => m[1])
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)[1]) - Number(/(\d+)\.xml$/.exec(b)[1]));
  if (!files.length) throw new Error('No ad sitemaps found in the sitemap index');
  const listed = await sitemapAds(full ? files : files.slice(0, 1));
  console.log(`${listed.length} Helsinki rental ads in ${full ? files.length : 1} sitemap file(s).`);

  const todo = listed.filter(a => cache.ads[a.id]?.lastmod !== a.lastmod);
  console.log(`${todo.length} new or changed ads to read (about ${Math.ceil(todo.length * PAUSE_MS / 60000)} min).`);
  let done = 0, gone = 0;
  for (const ad of todo) {
    const {status, text} = await get(ad.url);
    if (status === 404 || status === 410) { delete cache.ads[ad.id]; gone++; }
    else if (status === 200) {
      cache.ads[ad.id] = {...ad, firstSeen: cache.ads[ad.id]?.firstSeen ?? new Date().toISOString(), facts: parseAd(text)};
    }
    if (++done % 50 === 0) { await writeFile(CACHE_FILE, JSON.stringify(cache)); console.log(`  ${done}/${todo.length}`); }
    // Publish along the way so the map shows ads long before a first full run ends.
    if (done % 200 === 0) { cache.updatedAt = new Date().toISOString(); await publish(cache); }
    await sleep(PAUSE_MS);
  }
  if (full) {
    const live = new Set(listed.map(a => a.id));
    for (const id of Object.keys(cache.ads)) if (!live.has(id)) { delete cache.ads[id]; gone++; }
  }
  cache.updatedAt = new Date().toISOString();
  if (full) cache.fullAt = cache.updatedAt;
  await writeFile(CACHE_FILE, JSON.stringify(cache));
  await publish(cache);
  console.log(`Read ${done} ad pages, dropped ${gone} removed ads.`);
}

async function publish(cache) {
  const boundary = await loadBoundary();
  const addresses = await readJson('public/addresses.json');
  const byAddress = new Map();
  for (const row of addresses) if (row.buildingIds.length) byAddress.set(exactAddress(row.address) + '|' + row.postcode, row.buildingIds);
  const rows = [];
  let outside = 0, noFacts = 0;
  for (const ad of Object.values(cache.ads)) {
    const f = ad.facts;
    if (!f || !Number.isFinite(f.rent) || f.currency !== 'EUR') { noFacts++; continue; }
    if (!f.position || !boundary.isInside(f.position)) { outside++; continue; }
    const key = addressKeys(f.street).map(k => k + '|' + f.postcode).find(k => byAddress.has(k));
    rows.push({id: ad.id, url: ad.url, rent: f.rent, sizeM2: f.sizeM2, rooms: f.rooms, layout: f.layout,
      street: f.street, postcode: f.postcode, district: f.district, position: f.position, condition: f.condition,
      buildingIds: key ? byAddress.get(key) : [], firstSeen: ad.firstSeen, lastmod: ad.lastmod});
  }
  rows.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  await publishJson('public/listings.json', {updatedAt: cache.updatedAt, fullAt: cache.fullAt ?? null, ads: rows});
  await datasetSection('listings', {
    source: 'Oikotie rental ads (asunnot.oikotie.fi): sitemaps and ad pages, schema.org data only',
    updatedAt: cache.updatedAt, lastFullPassAt: cache.fullAt ?? null, count: rows.length,
    matchedToBuilding: rows.filter(r => r.buildingIds.length).length, skippedNoPriceData: noFacts, skippedOutsideHelsinki: outside,
    kept: 'rent per month, size, rooms, layout, street address, postcode, district, coordinates, condition, link',
    notKept: 'photos, descriptions, landlord or agent names',
    limitations: ['Asking rents in current ads, not agreed rents.', 'Only ads published on Oikotie.', 'Matched to a building only on an exact street address and postcode.'],
  });
  console.log(`Published ${rows.length} ads, ${rows.filter(r => r.buildingIds.length).length} matched to a 3D building (outside Helsinki ${outside}, no price ${noFacts}).`);
}

try {
  if (process.argv.includes('--publish-only')) await publish(JSON.parse(await readFile(CACHE_FILE, 'utf8')));
  else if (!watch) await run(!quick);
  else for (;;) {
    const cache = await readFile(CACHE_FILE, 'utf8').then(JSON.parse, () => ({}));
    const full = !cache.fullAt || Date.now() - Date.parse(cache.fullAt) > 6 * 3600e3;
    await run(full);
    console.log(`Next check at ${new Date(Date.now() + 15 * 60e3).toLocaleTimeString('fi-FI')}.`);
    await sleep(15 * 60e3);
  }
} catch (error) {
  console.error(error instanceof Blocked ? error.message : error);
  process.exit(1);
}
