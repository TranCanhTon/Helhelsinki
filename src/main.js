import * as Cesium from 'cesium';
import {createViewer} from './map/createViewer.js';
import {Navigation} from './map/navigation.js';
import {loadBuildings} from './map/buildings.js';
import {priceValue} from './map/prices.js';
import {screenFinder} from './map/screenPick.js';
import {createSunShadows} from './map/sun.js';
import {createSunPanel} from './ui/sunPanel.js';
import {createSelectionGlow} from './map/selectionGlow.js';
import {createViewFade} from './map/viewFade.js';
import {createWalkRings} from './map/walkRings.js';
import {BuildingCard} from './ui/buildingCard.js';
import {createSaved} from './data/saved.js';
import {savedPanel as createSavedPanel} from './ui/savedCard.js';
import {printSheet} from './ui/printSheet.js';
import {createSourcesPanel} from './ui/sourcesPanel.js';
import {AddressSearch} from './ui/search.js';
import {addressLinker} from './data/addresses.js';
import {createLanding} from './ui/landing.js';
import {t, num, locale, setLang, translatePage} from './ui/i18n.js';
import {readState, writeState} from './data/urlState.js';
import {VIEWS} from './views/index.js';
import {loadDataLayers} from './layers.js';
import '@fontsource/syne/800.css';
import '@fontsource/khand/600.css';
import './styles.css';
const $ = selector => document.querySelector(selector);
const HOME = {lon: 24.948, lat: 60.1835, heading: 20, pitch: -40, range: 1400};
const initial = readState(location.search, HOME),
  state = {...initial};
setLang(state.lang);
translatePage();
const viewer = createViewer('scene');
const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat));
const lightDirection = Cesium.Matrix4.multiplyByPointAsVector(
  frame,
  new Cesium.Cartesian3(0.6, 0.5, -0.6),
  new Cesium.Cartesian3(),
);
viewer.scene.light = new Cesium.DirectionalLight({
  direction: Cesium.Cartesian3.normalize(lightDirection, lightDirection),
  intensity: 2.2,
});
let urlTimer,
  canWrite = false;
const save = () => {
  if (!canWrite) return;
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => writeState(state, nav.state), 250);
};
const nav = new Navigation(viewer, HOME, (camera, navigation) => {
  $('#compass').style.transform = 'rotate(' + -camera.heading + 'deg)';
  $('#sun-dial').style.setProperty('--heading', camera.heading.toFixed(1));
  // The button shows the view it switches to: a cube from straight above, a flat grid when tilted.
  $('#tool-overhead').dataset.next = camera.pitch < -80 ? '3d' : '2d';
  // Haze at the far edge of a tilted view; none from straight above, where there is no horizon.
  $('.haze').style.opacity = Math.min(1, Math.max(0, (camera.pitch + 85) / 45)).toFixed(2);
  const metres = navigation.metersPerPixel() * 80;
  $('#scale-label').textContent =
    metres >= 1000
      ? num(metres / 1000, {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' km'
      : Math.round(metres / 10) * 10 + ' m';
  save();
});
Object.assign(nav.state, initial.camera);
nav.apply();
// Sources panel (Ton, 16 Oct 2026): every dataset with its licence and date; the
// tool bar button and "All sources" at the end of the card open it.
const sources = createSourcesPanel($('#sources-panel'), () => layers.listings);
$('#building-card').addEventListener('click', e => {
  if (e.target.closest('.credit-link')) sources.open();
});
for (const [id, action] of Object.entries({
  home: () => nav.goHome(),
  'zoom-in': () => nav.zoom(0.75),
  'zoom-out': () => nav.zoom(1.33),
  overhead: () => nav.toggleOverhead(),
  north: () => nav.faceNorth(),
  sources: () => sources.toggle(),
}))
  $('#tool-' + id).onclick = action;
function unavailable(label, error, retry) {
  console.warn(label, error);
  const row = document.createElement('div');
  row.className = 'data-error';
  row.textContent = t('{label} unavailable. ', {label: t(label)});
  const b = document.createElement('button');
  b.textContent = t('Retry');
  b.onclick = () => {
    row.remove();
    retry();
  };
  row.append(b);
  $('#data-status').append(row);
}
// The data layers, each null until it loads. One object, shared with the card and the
// views, so they always read the current layers.
const layers = {
  buildings: null,
  prices: null,
  listings: null,
  noise: null,
  parking: null,
  construction: null,
  transit: null,
  places: null,
  services: null,
  sun: null,
  sunPanel: null,
};
let savedPanel,
  card,
  search,
  marker,
  currentAddress = null;
const glow = createSelectionGlow(viewer),
  fade = createViewFade(viewer),
  rings = createWalkRings(viewer);
// A data layer has loaded (layers.js): finish setting it up, then redraw the open view if
// it uses that layer, and the card.
function layerLoaded(name) {
  if (name === 'prices') {
    layers.prices.setLabels(canWrite);
    useAds();
  }
  if (name === 'listings') {
    useAds();
    $('[data-view=ads]').hidden = false;
  }
  if (name === 'noise') layers.noise.setMode(state.noiseMode);
  if (VIEWS[state.metric].uses.includes(name)) setMetric(state.metric);
  card?.refresh();
}
// No ads (the public site has none): the Ads tab stays hidden, and a link that opened
// it falls back to Overview.
function noAds() {
  if (!layers.listings && state.metric === 'ads') setMetric('overview');
}
// Rent in the Price view and on the card: the median of current ads when there are any.
function useAds() {
  const {prices, listings: ads} = layers;
  if (!prices || !ads) return;
  // The note is worked out when shown, so it follows the language switch.
  const note = () =>
    t('{n} Oikotie ads, {time}', {
      n: num(ads.ads.length),
      time: new Date(ads.updatedAt).toLocaleString(locale(), {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  prices.setRentFromAds(postcode => ads.stats.get(postcode)?.groups['2'].rent ?? null, note);
}
// Open a view (tab). Each view lives in src/views/ with show() and hide(); this only
// switches between them. Called again for the open view when a layer it uses loads.
const legend = $('#price-legend');
let shownView = null;
const viewContext = {state, layers, legend, $, fade: change => fade(change), setView: metric => setMetric(metric)};
function setMetric(metric) {
  if (!VIEWS[metric]) metric = 'overview';
  const view = VIEWS[metric];
  if (shownView && shownView !== view) shownView.hide?.(viewContext);
  state.metric = metric;
  shownView = view;
  viewer.canvas.style.cursor = '';
  document
    .querySelectorAll('[data-view]')
    .forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === metric)));
  legend.hidden = true;
  legend.replaceChildren();
  legend.classList.remove('is-gradient', 'is-keys');
  view.show(viewContext);
  $('#area-info').hidden = true;
  save();
}
for (const b of document.querySelectorAll('[data-view]'))
  b.onclick = () => {
    if (b.dataset.view !== state.metric) fade(() => setMetric(b.dataset.view));
  };
// English / Finnish switch in the tool bar (Ton, 14 Oct 2026). The button shows the language you switch to.
function paintLang() {
  const b = $('#tool-lang');
  b.textContent = state.lang === 'fi' ? 'EN' : 'FI';
  b.title = state.lang === 'fi' ? 'In English' : 'Suomeksi';
  b.setAttribute('aria-label', b.title);
}
$('#tool-lang').onclick = () => {
  state.lang = state.lang === 'fi' ? 'en' : 'fi';
  setLang(state.lang);
  translatePage();
  paintLang();
  search?.translate();
  neighbourhoodList();
  sources.refresh();
  savedPanel?.paint();
  layers.prices?.refresh();
  setMetric(state.metric);
  card?.refresh();
  nav.apply();
};
paintLang();
function clearSelection() {
  state.building = null;
  currentAddress = null;
  layers.buildings?.setSelected(null);
  card?.hide();
  glow.show(null);
  rings.show(null);
  if (marker) viewer.entities.remove(marker);
  marker = null;
  viewer.scene.requestRender();
  save();
}
// The full record comes with its tile's detail file; the card opens when it is in.
// Camera distance at which the scale bar (80 px) shows `metres`.
// Heading equal to `target` that is the short way round from where the camera faces now.
const nearestHeading = target => {
  const h = nav.state.heading;
  return h + ((((target - h) % 360) + 540) % 360) - 180;
};
const rangeForScale = metres =>
  ((metres / 80) * viewer.canvas.clientHeight) / (2 * Math.tan((viewer.camera.frustum.fovy ?? Math.PI / 3) / 2));
// fly: true flies close (search), 'ease' moves to a clicked building: always the same
// zoom (scale bar 35 m) and the base angle turned 6 degrees, so picking one building
// after another does not keep zooming in or turning (Ton, 16 Oct 2026). false keeps
// the camera (link, retry).
async function selectBuilding(id, fly = true) {
  const {buildings} = layers;
  const record = buildings.records.get(id);
  if (!record) return;
  clearSelection();
  state.building = id;
  buildings.setSelected(id);
  glow.show(record.position);
  rings.show(record.position);
  if (fly === 'ease')
    nav.flyTo(record.position, rangeForScale(35), {heading: HOME.heading + 6, pitch: HOME.pitch}, 1200);
  else if (fly) nav.flyTo(record.position, 420);
  save();
  try {
    const full = await buildings.detail(id);
    if (!full) throw new Error('Building ' + id + ' is missing from its detail file. Run npm run data:split');
    if (state.building === id) card.show(id, full);
  } catch (e) {
    if (state.building === id) unavailable('Building details', e, () => selectBuilding(id, false));
  }
}
// Closing the card (×, Escape or a click on empty map): zoom out to a 60 m scale bar
// and turn back to the base angle, staying over the same place (Ton, 16 Oct 2026).
function closeCard() {
  const open = !!state.building;
  clearSelection();
  if (open)
    nav.flyTo([nav.state.lon, nav.state.lat], rangeForScale(60), {heading: HOME.heading, pitch: HOME.pitch}, 1100);
}
function selectAddress(row) {
  clearSelection();
  currentAddress = row;
  if (row.buildingIds.length === 1) {
    selectBuilding(row.buildingIds[0]);
    return;
  }
  nav.flyTo(row.position, 500);
  if (row.buildingIds.length > 1) {
    card.showChoices(row, row.buildingIds.map(id => layers.buildings.records.get(id)).filter(Boolean), id =>
      selectBuilding(id),
    );
    return;
  }
  marker = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(...row.position),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString('#c2622f'),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 3,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  rings.show(row.position);
  card.showAddress(row);
  viewer.scene.requestRender();
}
function areaInfo(hit) {
  const node = $('#area-info');
  node.hidden = !hit;
  if (!hit) return;
  const d = layers.prices.describe(hit.metric),
    a = hit.area;
  node.textContent = a.postcode + ' ' + a.name + ' · ' + priceValue(hit.value, d.units) + ' · ' + d.title;
}
// Stop pin under the pointer (pins show in every view when zoomed in).
const layerPick = position => layers.transit?.pick(position) ?? null;
function showInfo(text) {
  const node = $('#area-info');
  node.hidden = !text;
  if (text) node.textContent = text;
}
// "Scroll to zoom · Shift + drag to rotate" fades after the first zoom or drag on the
// map, and stays gone on later visits (only a convenience, so storage may fail).
function hintOnce() {
  const hint = $('.hint'),
    key = 'daroad.hintDone';
  const done = () => {
    hint.classList.add('is-done');
    try {
      localStorage.setItem(key, '1');
    } catch {}
  };
  try {
    if (localStorage.getItem(key)) {
      hint.classList.add('is-done');
      return;
    }
  } catch {}
  viewer.canvas.addEventListener('wheel', done, {once: true, passive: true});
  viewer.canvas.addEventListener(
    'pointermove',
    e => {
      if (e.buttons) done();
    },
    {passive: true},
  );
}
hintOnce();
// The URL only follows the camera after the landing, not its slow turn.
const landing = createLanding(nav, () => {
  canWrite = true;
  layers.prices?.setLabels(true);
  save();
});
async function start() {
  const buildings = (layers.buildings = await loadBuildings(viewer, landing.progress));
  layers.sun = createSunShadows(viewer, buildings.tileset);
  layers.sunPanel = createSunPanel($('#sun-panel'), $('#sun-dial'), layers.sun);
  setMetric(state.metric);
  card = new BuildingCard($('#building-card'), closeCard, layers);
  search = new AddressSearch($('#search'), selectAddress, addressLinker(buildings.manifest));
  // Saved buildings (browser only): the star on the card, the list from the tool bar.
  const saved = createSaved(
    (() => {
      try {
        return localStorage;
      } catch {
        return null;
      }
    })(),
  );
  card.saved = saved;
  // Viewing sheet: the map as it is now (drawn once more so its picture can be read), then the card.
  card.onPrint = () => {
    let picture = null;
    try {
      viewer.scene.requestRender();
      viewer.scene.render();
      picture = viewer.scene.canvas.toDataURL('image/jpeg', 0.86);
    } catch (e) {
      console.warn('Map picture unavailable', e);
    }
    printSheet(card.el, {picture});
  };
  // Removed from the list while its card is open: redraw the card so its star follows.
  saved.onChange(() => {
    if (card.current && !card.el.hidden && saved.has(card.current[0]) !== card.savedShown) card.refresh();
  });
  savedPanel = createSavedPanel($('#saved-panel'), $('#tool-saved'), saved, id => {
    if (buildings.records.has(id)) {
      selectBuilding(id, 'ease');
      return;
    }
    const item = saved.get(id);
    if (item?.position) nav.flyTo(item.position, rangeForScale(60));
  });
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(click => {
    if (nav.dragged) return;
    $('#hover-tip').hidden = true;
    const spot = layerPick(click.position);
    if (spot) {
      showInfo(spot.text);
      if (spot.zoomTo) nav.flyTo(spot.zoomTo, Math.max(150, nav.state.range / 3));
      return;
    }
    const hit = buildings.pick(click.position);
    if (hit) {
      selectBuilding(hit.buildingId, 'ease');
      return;
    }
    const area = layers.prices?.pick(click.position);
    if (area) {
      areaInfo(area);
      return;
    }
    closeCard();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  let hoverTime = 0;
  // Hover preview (Ton, 15 Oct 2026): address and type of the building under the
  // mouse, in a fixed box at the top middle (Ton, 16 Oct 2026: not following the mouse). Found by screen distance to each addressed
  // building's point 12 m up (about mid height), not by scene.pick, which is slow.
  const addressed = buildings.manifest.filter(r => r.address),
    findBuilding = screenFinder(
      viewer,
      addressed.map(r => r.position),
      12,
    );
  const tip = $('#hover-tip');
  const hoverTip = position => {
    const r = position ? addressed[findBuilding(position, 26)] : null;
    if (!r) {
      tip.hidden = true;
      return null;
    }
    const line = document.createElement('span');
    line.textContent = (r.classEn ?? r.useEn) ? t(r.classEn ?? r.useEn) : '';
    const name = document.createElement('strong');
    name.textContent = r.address;
    tip.replaceChildren(name, line);
    tip.hidden = false;
    return r;
  };
  viewer.canvas.addEventListener('pointermove', e => {
    if (e.buttons) tip.hidden = true;
  });
  viewer.canvas.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });
  handler.setInputAction(move => {
    if (performance.now() - hoverTime < 100) return;
    hoverTime = performance.now();
    const spot = layerPick(move.endPosition);
    const building = spot || nav.dragged ? hoverTip(null) : hoverTip(move.endPosition);
    viewer.canvas.style.cursor = spot || building ? 'pointer' : '';
    if (spot) {
      showInfo(spot.text);
      return;
    }
    if (building) {
      $('#area-info').hidden = true;
      return;
    }
    // Postal areas answer only in the Price view, the only one that draws them.
    areaInfo(layers.prices?.pick(move.endPosition));
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && e.target.id !== 'address-query') closeCard();
  });
  // Shortcuts (Ton, 16 Oct 2026): / search, F back to the picked building, Alt+R the
  // base angle and distance over the same place (Home still goes to the city centre).
  // F and R by key position, so they work on a Finnish keyboard too; / by the character
  // (Shift+7 there). Not while typing.
  document.addEventListener('keydown', e => {
    if (
      e.target.closest?.('input,textarea,select,[contenteditable]') ||
      e.ctrlKey ||
      e.metaKey ||
      !$('#landing').hidden
    )
      return;
    if (e.key === '/' && !e.altKey) {
      e.preventDefault();
      $('#address-query')?.focus();
      return;
    }
    if (e.code === 'KeyF' && !e.altKey && !e.shiftKey && state.building) {
      const record = buildings.records.get(state.building);
      if (record) {
        e.preventDefault();
        nav.flyTo(record.position, rangeForScale(35), {heading: HOME.heading + 6, pitch: HOME.pitch}, 1000);
      }
      return;
    }
    if (e.code === 'KeyR' && e.altKey && !e.shiftKey) {
      e.preventDefault();
      nav.flyTo(
        [nav.state.lon, nav.state.lat],
        HOME.range,
        {heading: nearestHeading(HOME.heading), pitch: HOME.pitch},
        900,
      );
    }
  });
  if (state.building && buildings.records.has(state.building)) selectBuilding(state.building, false);
  else state.building = null;
  landing.ready();
  window.__lens = {
    Cesium,
    viewer,
    nav,
    buildings,
    card,
    search,
    selectAddress,
    selectBuilding,
    setMetric,
    layers,
    get prices() {
      return layers.prices;
    },
    get listings() {
      return layers.listings;
    },
    get noise() {
      return layers.noise;
    },
    get parking() {
      return layers.parking;
    },
    get construction() {
      return layers.construction;
    },
    get places() {
      return layers.places;
    },
    get transit() {
      return layers.transit;
    },
    ready: true,
  };
  loadDataLayers({viewer, nav, layers, unavailable, onLoaded: layerLoaded, onNoAds: noAds});
  neighbourhoodList();
}
// Districts by building count; redrawn when the language (number format) changes.
function neighbourhoodList() {
  const {buildings} = layers;
  if (!buildings) return;
  const counts = new Map();
  for (const r of buildings.manifest) {
    const d = r.district;
    if (d) {
      const entry = counts.get(d.id) ?? {...d, count: 0};
      entry.count++;
      counts.set(d.id, entry);
    }
  }
  const content = $('#neighbourhood-list');
  content.replaceChildren();
  for (const d of [...counts.values()].sort((a, b) => b.count - a.count)) {
    const b = document.createElement('button');
    b.textContent = d.nameFi.toLocaleLowerCase('fi') + ' · ' + num(d.count);
    b.onclick = () => {
      const rows = buildings.manifest.filter(r => r.district?.id === d.id);
      nav.flyTo(
        [
          rows.reduce((s, r) => s + r.position[0], 0) / rows.length,
          rows.reduce((s, r) => s + r.position[1], 0) / rows.length,
        ],
        1800,
      );
    };
    content.append(b);
  }
}
start().catch(error => {
  console.error(error);
  landing.failed(error.message);
  window.__lens = {viewer, nav, ready: true, error: error.message};
});
