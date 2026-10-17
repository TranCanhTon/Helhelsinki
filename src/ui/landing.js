import {t, num} from './i18n.js';

// Landing screen. It covers the map while the buildings load, with the city
// centre further out and turning slowly behind it. A click anywhere (or Enter or
// Space) dives in (Ton, 14 Oct 2026: click, not scroll): the camera turns the short
// way back to the home view
// (Ton, 14 Oct 2026: always home, not the view saved in the link)
// and zooms in while the big name slides onto the small one in the top left
// corner, then the panels fade in. Only the backdrop fades, never the name, so
// the name stays solid all the way. The name is sized in em, so one scale fits it.
const ORBIT_DEG_PER_MS = 0.0018; // about one turn every three minutes
const MOVE_MS = 1100,
  FLY_MS = 1900;

export function createLanding(nav, onDone) {
  const app = document.querySelector('#app'),
    screen = document.querySelector('#landing');
  const cue = screen.querySelector('#landing-cue'),
    status = screen.querySelector('#landing-status');
  const big = screen.querySelector('.landing-brand'),
    small = document.querySelector('.brand .brand-lockup');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.webdriver;
  const target = {...nav.home};
  let orbit = null,
    ready = false;
  if (!still) {
    Object.assign(nav.state, {
      lon: target.lon,
      lat: target.lat,
      heading: target.heading,
      range: Math.min(target.range * 2.2, 6000),
      pitch: -32,
    });
    nav.apply();
    let last = performance.now();
    const turn = now => {
      nav.state.heading += (now - last) * ORBIT_DEG_PER_MS;
      last = now;
      nav.apply();
      orbit = requestAnimationFrame(turn);
    };
    orbit = requestAnimationFrame(turn);
  }
  const stopOrbit = () => {
    if (orbit) cancelAnimationFrame(orbit);
    orbit = null;
  };
  const say = text => {
    status.dataset.i18n = text;
    status.textContent = t(text);
  };
  const finish = () => {
    stopOrbit();
    app.classList.remove('is-landing', 'is-leaving');
    screen.hidden = true;
    onDone();
  };
  const enter = () => {
    if (!ready || app.classList.contains('is-leaving')) return;
    if (still) {
      Object.assign(nav.state, target);
      nav.apply();
      finish();
      return;
    }
    stopOrbit();
    // Turn the short way round to the home heading.
    const h = nav.state.heading,
      heading = h + ((((target.heading - h) % 360) + 540) % 360) - 180;
    nav.flyTo([target.lon, target.lat], target.range, {heading, pitch: target.pitch}, FLY_MS);
    const from = big.getBoundingClientRect(),
      to = small.getBoundingClientRect();
    app.classList.add('is-leaving');
    big
      .animate(
        [
          {transform: 'none'},
          {transform: `translate(${to.left - from.left}px,${to.top - from.top}px) scale(${to.width / from.width})`},
        ],
        {duration: MOVE_MS, easing: 'cubic-bezier(.65,0,.3,1)', fill: 'forwards'},
      )
      .finished.then(finish);
  };
  screen.addEventListener('click', enter);
  document.addEventListener('keydown', e => {
    if (!screen.hidden && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      enter();
    }
  });
  // Real progress while loading (Ton, 16 Oct 2026): the bytes of the big start files
  // (buildings list, ground grid) as they arrive. The bar fills only when every file
  // gave its size and kept to it; otherwise just the megabytes so far.
  const parts = new Map(),
    bar = screen.querySelector('.landing-bar i');
  const mb = b => num(b / 1048576, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const paint = () => {
    if (ready) return;
    const list = [...parts.values()],
      loaded = list.reduce((s, p) => s + p.loaded, 0);
    const sized = list.every(p => p.total && p.loaded <= p.total),
      total = list.reduce((s, p) => s + (p.total ?? 0), 0);
    delete status.dataset.i18n;
    status.textContent =
      t('loading the map') + ' · ' + (sized ? t('{a} of {b} MB', {a: mb(loaded), b: mb(total)}) : mb(loaded) + ' MB');
    bar.parentElement.hidden = !sized;
    if (sized) bar.style.width = ((100 * loaded) / total).toFixed(1) + '%';
  };
  return {
    // name -> onBytes(loaded, total) for one download.
    progress(name) {
      return (loaded, total) => {
        parts.set(name, {loaded, total});
        paint();
      };
    },
    ready() {
      ready = true;
      screen.classList.add('is-ready');
      bar.parentElement.hidden = true;
      say('click anywhere to dive in');
      // Browser checks run without anyone to click.
      if (navigator.webdriver) finish();
    },
    failed(message) {
      stopOrbit();
      screen.classList.add('is-failed');
      delete status.dataset.i18n;
      status.textContent = t('The map could not load: {message}. Click to try again.', {message});
      cue.onclick = () => location.reload();
    },
  };
}
