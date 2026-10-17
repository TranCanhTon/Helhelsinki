import {loadJson} from '../data/load.js';
import {NOISE_MODES, isApartmentBuilding} from '../data/noise.js';
import {colorAt} from './ramp.js';
// Noise view colours the buildings by their modelled band (layers.json, data:noise).
// One scale in the map's own colours (Ton, 15 Oct 2026, was a rainbow): quiet is calm
// verdigris, then sand, copper and red to deep crimson for loud. Warmer = louder.
// Each 5 dB band gets the colour at its place on that scale.
export const NOISE_SCALE = ['#2f7d70', '#6a9a7a', '#b0b27c', '#dbb26a', '#e58c4a', '#dc5f3a', '#c43a3c', '#9c2150'];
export const NOISE_COLORS = Array.from({length: 7}, (_, i) => colorAt(NOISE_SCALE, i / 6));
// Missing is the quietest thing on the map: an apartment building without a band is
// mid grey, other buildings darker grey (buildings.js), never bright.
export const NO_BAND_COLOR = '#6b726e';
export const NOISE_VIEW_MODES = [{key: 'all', label: 'All'}, ...NOISE_MODES.map(({key, label}) => ({key, label}))];
export async function loadNoise() {
  const {noise} = await loadJson('/layers.json');
  if (noise.bands.length !== NOISE_COLORS.length)
    throw new Error(
      'Noise data has ' + noise.bands.length + ' bands but the map has ' + NOISE_COLORS.length + ' colours',
    );
  const step = new Map(noise.bands.map((b, i) => [b.lo, i]));
  let mode = 'all';
  return {
    meta: noise,
    get mode() {
      return mode;
    },
    setMode(m) {
      mode = NOISE_VIEW_MODES.some(v => v.key === m) ? m : 'all';
    },
    // Band (lower dB) for a building in a mode, or null: no band at its centre or within 10 m.
    bandOf(record, m = mode) {
      return record?.noise?.[m] ?? null;
    },
    band(lo) {
      return noise.bands[step.get(lo)] ?? null;
    },
    // Apartment buildings only; every other building stays plain (null).
    colorOf(record) {
      if (!isApartmentBuilding(record)) return null;
      const lo = this.bandOf(record);
      return lo == null ? NO_BAND_COLOR : (NOISE_COLORS[step.get(lo)] ?? NO_BAND_COLOR);
    },
  };
}
