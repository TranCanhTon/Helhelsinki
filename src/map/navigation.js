import * as Cesium from 'cesium';

// Map-style camera controls.
//
// Cesium's built-in controls are made for spinning a whole globe. For a city
// map we want: drag = move the map, scroll = zoom, Shift+drag or right drag =
// rotate and tilt. So we switch Cesium's own input off and keep our own
// camera "state": the point we look at (lon, lat), the compass direction
// (heading), the tilt (pitch) and the distance from that point (range).
// Every change updates the state and calls apply(), which places the camera.

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// The camera may not leave this Helsinki rectangle [west, south, east, north].
export const CAMERA_BOUNDS = [24.78, 60.05, 25.27, 60.3];
const RANGE = {min: 120, max: 15000};
const PITCH = {min: -89, max: -15};

export class Navigation {
  constructor(viewer, home, onChange = () => {}) {
    this.viewer = viewer;
    this.canvas = viewer.scene.canvas;
    this.home = {...home};
    this.state = {...home};
    this.onChange = onChange;
    this.pointers = new Map();
    this.dragged = false;
    this.flight = null;

    viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute(
      'aria-label',
      'Helsinki 3D map. Drag to move, scroll to zoom, Shift and drag to rotate. Arrow keys move, plus and minus zoom.',
    );
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointerdown', e => this.pointerDown(e));
    this.canvas.addEventListener('pointermove', e => this.pointerMove(e));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      this.canvas.addEventListener(type, e => this.pointers.delete(e.pointerId));
    this.canvas.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        this.zoom(Math.exp(clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0012, -0.3, 0.3)));
      },
      {passive: false},
    );
    this.canvas.addEventListener('keydown', e => this.key(e));
    this.apply();
  }

  // Metres covered by one screen pixel at the look-at point (for panning and the scale bar).
  metersPerPixel() {
    const fovy = this.viewer.camera.frustum.fovy ?? Math.PI / 3;
    return (2 * this.state.range * Math.tan(fovy / 2)) / this.canvas.clientHeight;
  }

  apply() {
    const s = this.state;
    s.lon = clamp(s.lon, CAMERA_BOUNDS[0], CAMERA_BOUNDS[2]);
    s.lat = clamp(s.lat, CAMERA_BOUNDS[1], CAMERA_BOUNDS[3]);
    s.range = clamp(s.range, RANGE.min, RANGE.max);
    s.pitch = clamp(s.pitch, PITCH.min, PITCH.max);
    const target = Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0);
    this.viewer.camera.lookAt(
      target,
      new Cesium.HeadingPitchRange(Cesium.Math.toRadians(s.heading), Cesium.Math.toRadians(s.pitch), s.range),
    );
    // lookAt locks the camera to the target; release it so picking works normally.
    this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    this.viewer.scene.requestRender();
    this.onChange(s, this);
  }

  pan(dx, dy) {
    const s = this.state,
      m = this.metersPerPixel();
    const h = Cesium.Math.toRadians(s.heading);
    // A screen drag is stretched on tilted views; divide by the tilt so the map follows the finger.
    const forward = dy / Math.max(0.3, Math.sin(-Cesium.Math.toRadians(s.pitch)));
    const east = (-dx * Math.cos(h) + forward * Math.sin(h)) * m;
    const north = (dx * Math.sin(h) + forward * Math.cos(h)) * m;
    s.lon += east / (111320 * Math.cos(Cesium.Math.toRadians(s.lat)));
    s.lat += north / 111320;
    this.apply();
  }

  zoom(factor) {
    this.cancelFlight();
    this.state.range *= factor;
    this.apply();
  }
  rotate(degrees) {
    this.cancelFlight();
    this.state.heading += degrees;
    this.apply();
  }
  faceNorth() {
    this.cancelFlight();
    this.state.heading = 0;
    this.apply();
  }
  toggleOverhead() {
    this.cancelFlight();
    this.state.pitch = this.state.pitch < -80 ? this.home.pitch : -89;
    this.apply();
  }
  goHome() {
    this.flyTo([this.home.lon, this.home.lat], this.home.range, {heading: this.home.heading, pitch: this.home.pitch});
  }

  // Smooth move to a point. Respects "reduce motion" settings by jumping instead.
  flyTo([lon, lat], range = this.state.range, extra = {}, ms = 900) {
    this.cancelFlight();
    const start = {...this.state},
      end = {...start, lon, lat, range, ...extra};
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
    const began = performance.now();
    const step = now => {
      const t = duration ? Math.min(1, (now - began) / duration) : 1;
      const e = t * t * (3 - 2 * t);
      for (const k of ['lon', 'lat', 'range', 'heading', 'pitch']) this.state[k] = start[k] + (end[k] - start[k]) * e;
      this.apply();
      this.flight = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.flight = requestAnimationFrame(step);
  }
  cancelFlight() {
    if (this.flight) cancelAnimationFrame(this.flight);
    this.flight = null;
  }

  pointerDown(e) {
    this.cancelFlight();
    this.dragged = false;
    this.canvas.focus({preventScroll: true, focusVisible: false});
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  }

  pointerMove(e) {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    const next = {x: e.clientX, y: e.clientY},
      dx = next.x - previous.x,
      dy = next.y - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) this.dragged = true;
    if (this.pointers.size === 2) {
      // Two fingers: pinch to zoom and move together to pan.
      const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (after > 5) this.state.range *= before / after;
      this.pan(dx / 2, dy / 2);
    } else if (e.shiftKey || e.buttons === 2) {
      this.state.heading -= dx * 0.3;
      this.state.pitch += dy * 0.2;
      this.apply();
    } else {
      this.pan(dx, dy);
    }
    this.pointers.set(e.pointerId, next);
  }

  key(e) {
    const moves = {ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80]};
    if (moves[e.key]) {
      e.preventDefault();
      this.pan(...moves[e.key]);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      this.zoom(0.8);
    } else if (e.key === '-') {
      e.preventDefault();
      this.zoom(1.25);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.goHome();
    }
  }
}
