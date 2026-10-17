import {NOISE_SCALE, NOISE_VIEW_MODES, NO_BAND_COLOR} from '../map/noise.js';
import {legendGradient} from './legend.js';
import {t} from './i18n.js';
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
// A noise band in the chosen language: "65 to 70 dB", "75 dB and above". The building
// card shows it in its facts table (Ton, 14 Oct 2026: no noise section of its own).
export const bandText = b =>
  b.hi == null ? t('{lo} dB and above', {lo: b.lo}) : t('{lo} to {hi} dB', {lo: b.lo, hi: b.hi});

// Noise view: the colour bar in the legend.
export function noiseLegend(container, noise) {
  const bands = noise.meta.bands;
  legendGradient(container, {
    colors: NOISE_SCALE,
    title: t('Noise · dB'),
    start: String(bands[0].lo),
    end: bands.at(-1).lo + '+',
    missing: {color: NO_BAND_COLOR, text: t('No data')},
  });
}

// The noise sources plus Construction (Ton, 13 Oct 2026), stacked on the left of the map.
export const NOISE_SWITCH_MODES = [...NOISE_VIEW_MODES, {key: 'construction', label: 'Construction'}];
export function noiseSwitch(panel, current, onMode) {
  const modes = el('div', 'noise-mode-switch');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', t('Noise source'));
  for (const mode of NOISE_SWITCH_MODES) {
    const b = el('button', null, t(mode.label));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(current === mode.key));
    b.onclick = () => onMode(mode.key);
    modes.append(b);
  }
  panel.replaceChildren(modes);
}
