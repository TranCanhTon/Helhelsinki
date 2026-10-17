// Loads the map's data layers in the background (Ton, 17 Oct 2026: moved out of main.js).
//
// Every layer goes into the shared `layers` object under its name and then calls
// onLoaded(name), so main.js can redraw whatever uses it. A layer that fails shows a
// "… unavailable. Retry" row (unavailable()) and can be tried again; the rest of the
// map keeps working. The buildings load first in main.js; everything here comes after.
import {loadBasemap} from './map/basemap.js';
import {loadLabels} from './map/context.js';
import {loadPrices} from './map/prices.js';
import {loadNoise} from './map/noise.js';
import {loadParking} from './map/parking.js';
import {loadConstruction} from './map/construction.js';
import {loadTransit} from './map/transit.js';
import {loadStationTrains} from './map/stationTrains.js';
import {indexListings} from './data/listings.js';
import {nearestPlaces, SERVICE_KEYS, SERVICE_NEAR_M} from './data/places.js';
import {loadJson, dataUrl} from './data/load.js';

// Homes: the stop pins only show near residential buildings.
const HOME_TYPES = /apartment|detached house|row house|residential/i;

// Ads are read again every 10 minutes, so ads collected by the background job show up
// without a reload.
const ADS_EVERY_MS = 10 * 60 * 1000;

// ctx: {viewer, nav, layers, unavailable(label, error, retry), onLoaded(name), onNoAds()}
export function loadDataLayers(ctx) {
  const {viewer, nav, layers, unavailable, onLoaded} = ctx;

  // name: where it goes in layers (null: drawn only, nothing kept); label: what the
  // error row calls it; make(): loads it.
  const load = (name, label, make) => {
    const run = async () => {
      try {
        const layer = await make();
        if (name) {
          layers[name] = layer;
          onLoaded(name);
        }
      } catch (error) {
        unavailable(label, error, run);
      }
    };
    run();
  };
  // A prepared file with a version number: refuses an old one with the command to fix it.
  const file = async (path, command) => {
    const data = await loadJson(path);
    if (data.schemaVersion !== 1) throw new Error(`${path.slice(1)} is out of date. Run npm run ${command}`);
    return data;
  };

  load(null, 'Ground map', () => loadBasemap(viewer));
  load(null, 'Place labels', () => loadLabels(viewer, nav));
  load('prices', 'Prices', () => loadPrices(viewer));
  load('noise', 'Noise', () => loadNoise());
  load('parking', 'Parking', () => loadParking(viewer));
  // Construction work: areas under Noise > Construction, a list on the card.
  load('construction', 'Construction', () => loadConstruction(viewer));
  // Shops and services, and day care, schools and health stations: on the card only.
  load('places', 'Shops and services', async () => {
    const data = await file('/places.json', 'data:places');
    return {data, nearest: nearestPlaces(data.places)};
  });
  load('services', 'Schools and health', async () => {
    const data = await file('/services.json', 'data:services');
    return {data, nearest: nearestPlaces(data.places, SERVICE_NEAR_M, SERVICE_KEYS)};
  });
  load('transit', 'Public transport', () => {
    const homes = layers.buildings.manifest
      .filter(r => HOME_TYPES.test(r.classEn ?? r.useEn ?? ''))
      .map(r => r.position);
    return loadTransit(viewer, nav, homes);
  });
  // Parked trains at the Central Station: preview only (?trains=1) until Ton says yes.
  if (new URLSearchParams(location.search).get('trains') === '1') {
    loadStationTrains(viewer).catch(e => console.warn('Parked trains unavailable', e));
  }
  loadAds(ctx);
  setInterval(() => loadAds(ctx), ADS_EVERY_MS);
}

// Current Oikotie ads (npm run data:listings). They stay on this computer: the data pack
// never publishes them, so on the public site there is no file and onNoAds() runs.
async function loadAds({layers, onLoaded, onNoAds}) {
  try {
    const response = await fetch(dataUrl('/listings.json'), {cache: 'no-cache'});
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) {
      onNoAds();
      return;
    }
    const data = await response.json();
    if (layers.listings?.updatedAt === data.updatedAt) return;
    layers.listings = indexListings(data);
    onLoaded('listings');
  } catch (error) {
    console.warn('Rental ads unavailable', error);
    onNoAds();
  }
}
