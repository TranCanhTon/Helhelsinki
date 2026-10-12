import * as Cesium from 'cesium';
import {createViewer} from './map/createViewer.js';
import {Navigation} from './map/navigation.js';
import {loadBuildings} from './map/buildings.js';
import {BuildingCard} from './ui/buildingCard.js';
import './styles.css';

const $ = selector => document.querySelector(selector);

// Start view: Senate Square from the south-west, tilted.
const HOME = {lon: 24.9522, lat: 60.1693, heading: 20, pitch: -40, range: 900};

const viewer = createViewer('scene');

// A fixed sun from the south-west so walls get different shades of light.
const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat));
const lightDirection = Cesium.Matrix4.multiplyByPointAsVector(frame, new Cesium.Cartesian3(0.6, 0.5, -0.6), new Cesium.Cartesian3());
viewer.scene.light = new Cesium.DirectionalLight({direction: Cesium.Cartesian3.normalize(lightDirection, lightDirection), intensity: 2.2});

const nav = new Navigation(viewer, HOME, (state, navigation) => {
  $('#compass').style.transform = `rotate(${-state.heading}deg)`;
  $('#tool-overhead').textContent = state.pitch < -80 ? '3D' : '2D';
  const metres = navigation.metersPerPixel() * 80;
  $('#scale-label').textContent = metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres / 10) * 10} m`;
});

$('#tool-home').onclick = () => nav.goHome();
$('#tool-zoom-in').onclick = () => nav.zoom(0.75);
$('#tool-zoom-out').onclick = () => nav.zoom(1.33);
$('#tool-overhead').onclick = () => nav.toggleOverhead();
$('#tool-rotate-left').onclick = () => nav.rotate(-30);
$('#tool-rotate-right').onclick = () => nav.rotate(30);
$('#tool-north').onclick = () => nav.faceNorth();

async function start() {
  const buildings = await loadBuildings(viewer);
  const card = new BuildingCard($('#building-card'), () => { buildings.setSelected(null); card.hide(); });

  // A click (not the end of a drag) selects a building or clears the selection.
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(click => {
    if (nav.dragged) return;
    const hit = buildings.pick(click.position);
    if (!hit) { buildings.setSelected(null); card.hide(); return; }
    buildings.setSelected(hit.buildingId);
    card.show(hit.buildingId, hit.record);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { buildings.setSelected(null); card.hide(); } });

  // Wait until the visible tiles are drawn before hiding the loading screen.
  await new Promise(resolve => {
    const stop = viewer.scene.postRender.addEventListener(() => {
      if (buildings.tileset.tilesLoaded) { stop(); resolve(); }
    });
  });
  $('#loading').hidden = true;
  window.__lens = {Cesium, viewer, nav, buildings, card, ready: true};
}

start().catch(error => {
  console.error(error);
  $('#loading-text').textContent = `The 3D buildings could not load: ${error.message}`;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'retry';
  retry.textContent = 'Try again';
  retry.onclick = () => location.reload();
  $('#loading').append(retry);
  document.querySelector('.spinner')?.remove();
  window.__lens = {viewer, nav, ready: true, error: error.message};
});
