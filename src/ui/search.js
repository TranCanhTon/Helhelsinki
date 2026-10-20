import {addressFilter, findAddresses, liveRows, parseQuery} from '../data/addresses.js';
import {loadJson} from '../data/load.js';
import {t} from './i18n.js';

// Two ways to search:
//   live (default)   each search asks the city's address layer directly from the
//                    browser. The city allows this (it answers with
//                    Access-Control-Allow-Origin: *).
//   ?search=local    the old way: download /addresses.json once, search in memory.
const CITY_WFS = 'https://kartta.hel.fi/ws/geoserver/avoindata/wfs';
export function addressUrl(filter, count = 50) {
  const url = new URL(CITY_WFS);
  url.search = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'avoindata:Helsinki_osoiteluettelo',
    outputFormat: 'application/json',
    srsName: 'CRS:84', // longitude, latitude
    count: String(count),
    CQL_FILTER: filter,
  });
  return url.href;
}

export class AddressSearch {
  // link: adds buildingIds to live rows (the city's answer has no building ids).
  constructor(container, onSelect, link = rows => rows.map(r => ({...r, buildingIds: []}))) {
    this.el = container;
    this.onSelect = onSelect;
    this.link = link;
    this.live = new URLSearchParams(location.search).get('search') !== 'local';
    this.rows = null;
    this.request = null;
    this.active = -1;
    this.results = [];
    container.innerHTML =
      '<input id="address-query" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="address-results"><div id="address-results" role="listbox" hidden></div><p class="search-status" role="status"></p>';
    this.input = container.querySelector('input');
    this.list = container.querySelector('[role=listbox]');
    this.status = container.querySelector('[role=status]');
    this.translate();
    this.input.addEventListener('focus', () => {
      if (!this.live) this.load();
    });
    this.input.addEventListener('input', () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.run(), this.live ? 250 : 200);
    });
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        clearTimeout(this.timer);
        this.close();
        return;
      }
      if (['ArrowDown', 'ArrowUp'].includes(e.key) && this.results.length) {
        e.preventDefault();
        this.active = (this.active + (e.key === 'ArrowDown' ? 1 : -1) + this.results.length) % this.results.length;
        this.paintActive();
      } else if (e.key === 'Enter' && this.active >= 0) {
        e.preventDefault();
        this.choose(this.results[this.active]);
      }
    });
    document.addEventListener('pointerdown', e => {
      if (!container.contains(e.target)) this.close();
    });
  }
  // Placeholder and label in the chosen language; open results are redrawn.
  translate() {
    this.input.placeholder = t('Street and number');
    this.input.setAttribute('aria-label', t('Helsinki address'));
    if ((this.live || this.rows) && this.input.value.trim()) this.run();
  }
  async load() {
    if (this.rows || this.loading) return;
    this.loading = true;
    this.status.textContent = t('Loading official addresses…');
    try {
      this.rows = await loadJson('/addresses.json');
      this.status.textContent = '';
      if (document.activeElement === this.input) this.run();
    } catch {
      this.failed(() => this.load());
    } finally {
      this.loading = false;
    }
  }
  // "Addresses unavailable. Retry"
  failed(retry) {
    this.status.replaceChildren(document.createTextNode(t('Addresses unavailable. ')));
    const b = document.createElement('button');
    b.textContent = t('Retry');
    b.onclick = retry;
    this.status.append(b);
  }
  run() {
    if (this.live) {
      this.runLive();
      return;
    }
    if (!this.rows) {
      this.load();
      return;
    }
    this.paint(findAddresses(this.rows, this.input.value));
  }
  async runLive() {
    // A newer search replaces an older one still on its way. Without this, the
    // answer for "Ma" could arrive after the one for "Manner" and overwrite it.
    this.request?.abort();
    this.request = null;
    const parsed = parseQuery(this.input.value),
      filter = addressFilter(parsed);
    if (!filter) {
      this.paint([], '');
      return;
    }
    const request = (this.request = new AbortController());
    this.status.textContent = t('Searching…');
    try {
      const answer = await fetch(addressUrl(filter), {signal: request.signal});
      if (!answer.ok) throw new Error('City address search answered ' + answer.status);
      const {features} = await answer.json();
      this.paint(this.link(liveRows(features, parsed)));
    } catch (e) {
      if (e.name !== 'AbortError') this.failed(() => this.run()); // a cancelled search is not an error
    } finally {
      if (this.request === request) this.request = null;
    }
  }
  // Draws the dropdown. Both search ways end here.
  paint(results, note = this.input.value.trim() && !results.length ? t('No Helsinki addresses found.') : '') {
    this.results = results;
    this.active = -1;
    this.list.replaceChildren();
    this.status.textContent = note;
    this.results.forEach((r, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'address-option-' + i;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
      const title = document.createElement('strong');
      title.textContent = r.address;
      const sub = document.createElement('span');
      sub.textContent = [
        r.addressSv,
        r.postcode,
        r.buildingIds.length > 1
          ? t('Choose from {n} buildings', {n: r.buildingIds.length})
          : r.buildingIds.length
            ? t('3D building')
            : t('No linked 3D building'),
      ]
        .filter(Boolean)
        .join(' · ');
      b.append(title, sub);
      b.onclick = () => this.choose(r);
      this.list.append(b);
    });
    this.list.hidden = !this.results.length;
    this.input.setAttribute('aria-expanded', String(!this.list.hidden));
    this.input.removeAttribute('aria-activedescendant');
  }
  paintActive() {
    [...this.list.children].forEach((b, i) => b.setAttribute('aria-selected', String(i === this.active)));
    this.input.setAttribute('aria-activedescendant', 'address-option-' + this.active);
  }
  choose(row) {
    this.input.value = row.address;
    this.close();
    this.onSelect(row);
  }
  close() {
    // A search still on its way would open the list again when it lands.
    if (this.request) {
      this.request.abort();
      this.request = null;
      this.status.textContent = '';
    }
    this.list.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.active = -1;
    this.results = [];
  }
}
