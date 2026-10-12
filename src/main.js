import * as Cesium from 'cesium';
import {createViewer, HELSINKI_CENTER} from './map/createViewer.js';
import './styles.css';

const viewer = createViewer('scene');

// Look at central Helsinki from about 4 km away, tilted 50 degrees down.
viewer.camera.lookAt(
  Cesium.Cartesian3.fromDegrees(HELSINKI_CENTER[0], HELSINKI_CENTER[1], 0),
  new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-50), 4000),
);
viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

// Exposed for browser tests and debugging in the console.
window.__lens = {viewer, ready: true};
