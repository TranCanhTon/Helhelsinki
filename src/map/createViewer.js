import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Helsinki centre, roughly the Senate Square. [longitude, latitude]
export const HELSINKI_CENTER = [24.9525, 60.1695];

// Creates the Cesium 3D globe with every online default turned off.
// By default Cesium would load satellite imagery and world terrain from
// Cesium ion (a paid cloud service needing a token). We don't want any of
// that: the map must only show our own prepared Helsinki files.
export function createViewer(containerId) {
  Cesium.Ion.defaultAccessToken = '';

  const viewer = new Cesium.Viewer(containerId, {
    baseLayer: false,            // no satellite imagery
    baseLayerPicker: false,
    geocoder: false,             // no online place search
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    scene3DOnly: true,
    skyBox: false,
    skyAtmosphere: false,
  });

  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#0e1a2b');
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#16263a');
  scene.globe.showGroundAtmosphere = false;
  scene.fog.enabled = false;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;

  // Draw at most 1.5x device pixels, so high-DPI phones don't render 3x.
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);

  return viewer;
}
