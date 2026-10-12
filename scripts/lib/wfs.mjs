// Downloads a whole WFS layer page by page, with safety checks.
//
// A WFS server never sends a big layer in one response. You ask for
// `count` records starting at `startIndex`, then the next page, and so on.
// Things that can go wrong, and what we check:
//  - the server says it has N records but stops early     -> "truncated" error
//  - the same page comes back twice                        -> "duplicate" error
//  - the total changes while we are downloading            -> "changed" error
// Sorting by a unique field (`sortBy`) keeps the page order stable.
import {getJson} from './http.mjs';

export const HELSINKI_WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';

export async function fetchAllFeatures({
  base = HELSINKI_WFS,
  typeName,
  srsName = 'CRS:84',      // CRS:84 = longitude/latitude, in that order
  bbox,                    // optional [minE, minN, maxE, maxN] in EPSG:3879
  pageSize = 2000,
  sortBy = 'id',
  extra = {},
  log = console.log,
}) {
  const features = [];
  const seen = new Set();
  const requests = [];
  let total;

  for (let startIndex = 0; ; ) {
    const url = new URL(base);
    url.search = new URLSearchParams({
      service: 'WFS', version: '2.0.0', request: 'GetFeature',
      typeNames: typeName, outputFormat: 'application/json', srsName,
      count: String(pageSize), startIndex: String(startIndex), sortBy,
      ...(bbox ? {bbox: `${bbox.join(',')},EPSG:3879`} : {}),
      ...extra,
    });
    const page = await getJson(url);
    requests.push(url.href);

    if (page.type !== 'FeatureCollection' || !Array.isArray(page.features)) {
      throw new Error(`${typeName}: response is not a GeoJSON FeatureCollection`);
    }
    const pageTotal = Number(page.totalFeatures ?? page.numberMatched);
    if (!Number.isFinite(pageTotal)) throw new Error(`${typeName}: server did not say how many records exist`);
    if (total !== undefined && pageTotal !== total) throw new Error(`${typeName}: total changed from ${total} to ${pageTotal} during download`);
    total = pageTotal;

    for (const feature of page.features) {
      const key = feature.id ?? JSON.stringify(feature.properties);
      if (seen.has(key)) throw new Error(`${typeName}: duplicate record ${key}; paging is not stable`);
      seen.add(key);
      features.push(feature);
    }
    log(`  ${typeName}: ${features.length} / ${total}`);

    if (features.length >= total) break;
    if (!page.features.length) throw new Error(`${typeName}: server stopped at ${features.length} of ${total} (truncated)`);
    startIndex += page.features.length;
  }

  if (features.length !== total) throw new Error(`${typeName}: got ${features.length}, expected ${total}`);
  return {features, total, requests, retrievedAt: new Date().toISOString()};
}
