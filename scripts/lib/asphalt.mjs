// Road texture for the ground map (Ton, 14 Oct 2026): a fine asphalt grain laid
// over the road fills. It is only a look; it carries no data.
//
// One square of grain, the same every run (fixed seed). It repeats without seams,
// and ground tiles start at multiples of 256 px, so with a size that divides 256
// the grain also lines up across tile edges.
import sharp from 'sharp';

export const GRAIN_PX = 64;

// Small fixed-seed random numbers (mulberry32).
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth noise that wraps around: random values on a coarse grid, blended between.
function smoothNoise(size, cells, next) {
  const grid = Array.from({length: cells * cells}, () => next() * 2 - 1);
  const at = (gx, gy) => grid[((gy + cells) % cells) * cells + ((gx + cells) % cells)];
  const out = new Float32Array(size * size),
    step = size / cells;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const fx = x / step,
        fy = y / step,
        x0 = Math.floor(fx),
        y0 = Math.floor(fy);
      const sx = (fx - x0) ** 2 * (3 - 2 * (fx - x0)),
        sy = (fy - y0) ** 2 * (3 - 2 * (fy - y0));
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
      const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      out[y * size + x] = top * (1 - sy) + bottom * sy;
    }
  return out;
}

// PNG of the grain: light and dark specks, see-through, so it works on every road colour.
export async function asphaltGrainPng({size = GRAIN_PX, light = 0.11, dark = 0.22} = {}) {
  const next = random(20261014);
  const patches = smoothNoise(size, 8, next); // worn patches, about 8 px across
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    let v = (next() * 2 - 1) * 0.75 + patches[i] * 0.45;
    if (next() < 0.012) v = 1.6; // a few bright stones
    v = Math.max(-1, Math.min(1.6, v));
    const shade = v >= 0 ? 255 : 0,
      alpha = v >= 0 ? v * light : -v * dark;
    pixels.set([shade, shade, shade, Math.round(Math.min(1, alpha) * 255)], i * 4);
  }
  return sharp(pixels, {raw: {width: size, height: size, channels: 4}})
    .png()
    .toBuffer();
}

// The SVG pattern to fill roads with: fill="url(#<id>)" on top of the road colour.
export async function asphaltPattern(id, options) {
  const png = (await asphaltGrainPng(options)).toString('base64');
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${GRAIN_PX}" height="${GRAIN_PX}">` +
    `<image width="${GRAIN_PX}" height="${GRAIN_PX}" xlink:href="data:image/png;base64,${png}"/></pattern>`
  );
}
