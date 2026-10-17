import {sunDay, compassPoint, TIME_ZONE} from '../data/sun.js';
import {t, locale} from './i18n.js';
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
const DIRECTIONS = [
  'Sun in the north',
  'Sun in the north-east',
  'Sun in the east',
  'Sun in the south-east',
  'Sun in the south',
  'Sun in the south-west',
  'Sun in the west',
  'Sun in the north-west',
];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Sun tab (Ton, 14 Oct 2026): month picker, a slider from sunrise to sunset, the time
// and the sun's height. The day is the 21st of the chosen month, this year, in
// Helsinki time. The dial on the left turns with the map and shows N, E, S, W and the sun.
export function createSunPanel(panel, dial, shadows) {
  const now = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {timeZone: TIME_ZONE, year: 'numeric', month: 'numeric'})
      .formatToParts(new Date())
      .map(p => [p.type, +p.value]),
  );
  const year = now.year;
  let month = now.month - 1,
    day = sunDay(year, month),
    minutes = null;
  const ends = () => [Math.ceil((day.sunrise - day.midnight) / 60000), Math.floor((day.sunset - day.midnight) / 60000)];
  // Minutes after Helsinki midnight -> "14:20" (Finnish "14.20"). The 21st never has a clock change.
  const clock = m =>
    new Intl.DateTimeFormat(locale(), {timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit'}).format(
      day.midnight + m * 60000,
    );
  const pickMonth = next => {
    month = next;
    day = sunDay(year, month);
    const [lo, hi] = ends();
    // First open: midday. After that the clock time stays, kept inside the new day.
    minutes = minutes == null ? Math.round((day.noon - day.midnight) / 60000) : clamp(minutes, lo, hi);
  };
  pickMonth(month);

  let slider, time, height, where, rise, set;
  const update = () => {
    const sun = shadows.setTime(day.midnight + minutes * 60000);
    time.textContent = clock(minutes);
    slider.setAttribute('aria-valuetext', clock(minutes));
    // Between sunrise and sunset the sun's top edge is above the horizon: shown as 0° at the ends.
    height.textContent = t('Sun height {deg}°', {deg: Math.max(0, Math.round(sun.elevation))});
    where.textContent = t(DIRECTIONS[compassPoint(sun.azimuth)]);
    dial.style.setProperty('--sun', sun.azimuth.toFixed(1));
  };
  const build = () => {
    const months = el('select', 'sun-month');
    months.setAttribute('aria-label', t('Month'));
    const name = new Intl.DateTimeFormat(locale(), {timeZone: 'UTC', day: 'numeric', month: 'long'});
    for (let m = 0; m < 12; m++) {
      const o = el('option', null, name.format(Date.UTC(year, m, 21)));
      o.value = String(m);
      o.selected = m === month;
      months.append(o);
    }
    months.onchange = () => {
      pickMonth(+months.value);
      paintEnds();
      update();
    };
    const end = (label, cls) => {
      const box = el('span', 'sun-end ' + cls);
      box.append(el('small', null, t(label)), el('b'));
      return box;
    };
    rise = end('Sunrise', 'is-rise');
    set = end('Sunset', 'is-set');
    slider = el('input', 'sun-slider');
    slider.type = 'range';
    slider.step = '1';
    slider.setAttribute('aria-label', t('Time of day'));
    slider.oninput = () => {
      minutes = +slider.value;
      update();
    };
    // Top row: month, time, sun height and direction. Bottom row: sunrise, slider, sunset.
    const head = el('div', 'sun-head');
    time = el('strong', 'sun-time');
    const lines = el('span', 'sun-lines');
    height = el('span');
    where = el('span');
    lines.append(height, where);
    head.append(months, time, lines);
    panel.replaceChildren(head, rise, slider, set);
    dial.replaceChildren();
    const ring = el('div', 'dial-ring');
    for (const [letter, angle] of [
      ['N', 0],
      ['E', 90],
      ['S', 180],
      ['W', 270],
    ]) {
      const s = el('span', 'dial-letter' + (letter === 'N' ? ' is-north' : ''), t(letter));
      s.style.setProperty('--a', angle);
      ring.append(s);
    }
    ring.append(el('span', 'dial-ray'));
    dial.append(ring);
    paintEnds();
  };
  const paintEnds = () => {
    const [lo, hi] = ends();
    slider.min = String(lo);
    slider.max = String(hi);
    slider.value = String(minutes);
    rise.querySelector('b').textContent = clock(lo);
    set.querySelector('b').textContent = clock(hi);
  };
  return {
    // Builds the controls in the current language and moves the light to the chosen time.
    show() {
      build();
      update();
    },
  };
}
