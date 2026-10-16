// Soft change between views (Ton, 16 Oct 2026). Just before the switch, the map's
// last picture is copied onto a flat canvas over the map; the new view is drawn
// underneath and the copy fades out. One fade covers everything that changes: the
// building colours, the price areas, parking strips and construction.
const FADE_MS = 380;

export function createViewFade(viewer) {
  const layer = document.createElement('canvas');
  layer.className = 'view-fade';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  // Right after the map canvas, so the HTML place names stay on top of the copy.
  viewer.scene.canvas.insertAdjacentElement('afterend', layer);
  let timer = null;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // change(): switches the view. Runs at once; the fade is only on top.
  return change => {
    const source = viewer.scene.canvas;
    if (still() || !source.width) { change(); return; }
    try {
      // The map's own picture is only readable right after it is drawn, so draw it now.
      // The map skips drawing unless asked, hence requestRender first.
      viewer.scene.requestRender();
      viewer.scene.render();
      layer.width = source.width;
      layer.height = source.height;
      layer.getContext('2d').drawImage(source, 0, 0);
    } catch { change(); return; }
    clearTimeout(timer);
    layer.style.transition = 'none';
    layer.style.opacity = '1';
    layer.hidden = false;
    change();
    viewer.scene.requestRender();
    // Two frames: the copy must show once at full strength before it starts to fade.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      layer.style.transition = `opacity ${FADE_MS}ms ease`;
      layer.style.opacity = '0';
    }));
    // Free the copy afterwards (it is the size of the window).
    timer = setTimeout(() => { layer.hidden = true; layer.width = layer.height = 0; }, FADE_MS + 120);
  };
}
