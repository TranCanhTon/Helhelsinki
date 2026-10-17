import * as Cesium from 'cesium';

// A soft copper glow on the ground under the selected building (Ton, 15 Oct 2026).
// One flat disc with a round fade image; it fades in over half a second and then
// stays still, so the map goes back to drawing only when something changes.
// The map uploads the image a few frames after the disc appears; until then it shows
// plain white. So frames keep coming for SETTLE_MS, a little longer than the fade.
const RADIUS_M = 32,
  FADE_MS = 500,
  SETTLE_MS = 1200;

// The fade image, made once: copper in the middle, gone at the edge. A canvas, not a
// data URL, so it is ready at once (a URL loads later and the map shows plain white
// until something redraws). Only one glow exists at a time.
function glowImage() {
  const size = 128,
    canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'),
    g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(194, 98, 47, 0.95)');
  g.addColorStop(0.4, 'rgba(194, 98, 47, 0.55)');
  g.addColorStop(1, 'rgba(194, 98, 47, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createSelectionGlow(viewer) {
  const image = glowImage(),
    tint = new Cesium.Color(1, 1, 1, 0);
  let entity = null,
    started = 0,
    timer = null;
  const fade = () => {
    const ms = performance.now() - started;
    tint.alpha = Math.min(1, ms / FADE_MS);
    viewer.scene.requestRender();
    timer = ms < SETTLE_MS ? setTimeout(fade, 16) : null;
  };
  return {
    // [lon, lat] or null to remove.
    show(position) {
      clearTimeout(timer);
      if (entity) viewer.entities.remove(entity);
      entity = null;
      if (!position) {
        viewer.scene.requestRender();
        return;
      }
      tint.alpha = 0;
      entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(position[0], position[1]),
        ellipse: {
          semiMajorAxis: RADIUS_M,
          semiMinorAxis: RADIUS_M,
          height: 0.35,
          material: new Cesium.ImageMaterialProperty({
            image,
            transparent: true,
            color: new Cesium.CallbackProperty(() => tint, false),
          }),
        },
      });
      started = performance.now();
      fade();
    },
  };
}
