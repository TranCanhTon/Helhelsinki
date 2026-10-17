// Phase 1, step 2: download real 3D buildings (CityGML) for an area.
//
// Source: the City of Helsinki city information model WFS (citydb).
// It sends CityGML 2.0: XML describing each building as polygons (walls,
// roofs, ground) with 3D coordinates in EPSG:3879 metres + N2000 heights.
//
// Large requests time out on this server, so we ask for 8 buildings per page
// and save every page to data/raw/buildings/<area>/wfs-<startIndex>.gml.
// Pages already on disk are not downloaded again, so a failed run can resume.
//
// If the service is down you can instead put a CityGML file you downloaded
// yourself (for example from the export tool at https://kartta.hel.fi/3d/)
// into data/raw/buildings/<area>/ . The converter reads every .gml file there.
//
// Run:  npm run data:buildings -- --area=pilot
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {getText} from './lib/http.mjs';
import {areaBbox, areaFromArgs, CITYGML_WFS} from './config.mjs';

const area = areaFromArgs();
const bbox = areaBbox(area);
const dir = new URL(`../data/raw/buildings/${area}/`, import.meta.url);
await mkdir(dir, {recursive: true});
const exists = path =>
  access(path).then(
    () => true,
    () => false,
  );
const PAGE = Number(process.env.CITYGML_PAGE || 8);

console.log(`Area "${area}", EPSG:3879 bbox ${bbox.join(', ')}`);
const ids = new Set();
const requests = [];
let matched;

for (let startIndex = 0; ; ) {
  const cache = new URL(`wfs-${String(startIndex).padStart(6, '0')}.gml`, dir);
  let xml;
  if (await exists(cache)) {
    xml = await readFile(cache, 'utf8');
  } else {
    const url = new URL(CITYGML_WFS);
    url.search = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: 'bldg:Building',
      bbox: bbox.join(','),
      count: String(PAGE),
      startIndex: String(startIndex),
    });
    try {
      xml = await getText(url, {timeoutMs: 180000, retries: 5});
    } catch (error) {
      console.error(`\nThe 3D building service did not answer (${error.message.split('\n')[0]}).`);
      console.error('Already downloaded pages are kept. Run this again later, or put a CityGML');
      console.error(`file you downloaded yourself into data/raw/buildings/${area}/ and run npm run data:convert.`);
      process.exit(1);
    }
    if (xml.includes('ExceptionReport')) throw new Error('Server returned an error document:\n' + xml.slice(0, 500));
    requests.push(url.href);
  }

  // WFS 2.0 tells us the total ("numberMatched") and this page's size ("numberReturned").
  const returned = Number(xml.match(/numberReturned="(\d+)"/)?.[1]);
  matched = Number(xml.match(/numberMatched="(\d+)"/)?.[1]);
  if (!Number.isFinite(returned) || !Number.isFinite(matched))
    throw new Error('Page is missing numberMatched/numberReturned');

  const pageIds = [...xml.matchAll(/<bldg:Building\b[^>]*\bgml:id="([^"]+)"/g)].map(m => m[1]);
  let fresh = 0;
  for (const id of pageIds)
    if (!ids.has(id)) {
      ids.add(id);
      fresh++;
    }
  if (!(await exists(cache))) await writeFile(cache, xml);
  console.log(`  page @${startIndex}: ${returned} returned, ${fresh} new, ${ids.size}/${matched} so far`);

  if (!returned) {
    if (startIndex < matched) throw new Error(`Server stopped at ${startIndex} of ${matched} buildings (truncated)`);
    break;
  }
  startIndex += returned;
  if (startIndex >= matched) break;
}

await writeFile(
  new URL('provenance.json', dir),
  JSON.stringify(
    {
      source: CITYGML_WFS,
      layer: 'bldg:Building',
      area,
      bbox3879: bbox,
      numberMatched: matched,
      uniqueBuildings: ids.size,
      pageSize: PAGE,
      retrievedAt: new Date().toISOString(),
      newRequests: requests,
      license: 'City of Helsinki, CC BY 4.0',
    },
    null,
    2,
  ),
);
console.log(
  `\nDone: ${ids.size} unique buildings (server reported ${matched}). Next: npm run data:register -- --area=${area}`,
);
