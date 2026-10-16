// The panel that opens when you click a building.
//
// Order (Ton, 16 Oct 2026): address header with a copy button, four answers (rent by
// flat size, noise, nearest stop, parking), rental ads in this building, the building
// facts, public transport, shops and services nearby, street parking, plan protection,
// and construction within 50 m last. No explaining notes. Missing values say
// "Not recorded", never zero.
import {adsSection} from './pricesCard.js';
import {ROOM_GROUPS} from '../data/listings.js';
import {isApartmentBuilding, NOISE_MODES} from '../data/noise.js';
import {parkingSection, priceText, spacesText} from './parkingCard.js';
import {priceValue} from '../map/prices.js';
import {transitSection} from './transitCard.js';
import {constructionSection} from './constructionCard.js';
import {placesSection, servicesSection} from './placesCard.js';
import {t, num, getLang} from './i18n.js';

const el = (tag, className, textValue) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textValue !== undefined && textValue !== null) node.textContent = textValue;
  return node;
};

const titleCase = s => s ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase()) : s;
const number = n => n === null || n === undefined ? null : num(n);
// Register words (building type...) are stored in English; shown in the chosen language.
const word = s => s == null ? s : t(s);

// Noise sources in words, for the key strip.
const NOISE_SOURCE = {road: 'road traffic', rail: 'trains', metro: 'metro', tram: 'trams'};

function factsSection(record) {
  const f = record.facts ?? {};
  const rows = [
    ['Year built', record.yearBuilt],
    ['Floors', f.floors],
    ['Height', record.heightM ? `${num(record.heightM)} m` : null],
    ['Flats', number(f.flats)],
    ['Floor area', f.floorAreaM2 ? `${number(f.floorAreaM2)} m²` : null],
    ['Elevator', f.elevator ? t('Yes') : null],
  ];
  const grid = el('dl', 'facts');
  for (const [label, value] of rows) {
    const cell = el('div', value === null || value === undefined ? 'fact is-missing' : 'fact');
    cell.append(el('dt', null, t(label)), el('dd', null, value ?? t('Not recorded')));
    grid.append(cell);
  }
  return grid;
}

function protectionSection(protection) {
  const box = el('section', 'protection');
  box.append(el('h3', null, t('Protected in the city plan')));
  const meta = [protection.marking && t('Marking {m}', {m: protection.marking}), protection.plan && t('plan {p}', {p: protection.plan}),
    protection.inForce && t('in force since {y}', {y: protection.inForce.slice(0, 4)})].filter(Boolean).join(' · ');
  if (meta) box.append(el('p', 'protection-meta', meta));
  if (protection.ruleFi) {
    // Only state in English what the Finnish text says word for word.
    if (/ei saa purkaa/i.test(protection.ruleFi)) box.append(el('p', 'protection-summary', t('The plan says it may not be demolished.')));
    const details = el('details', 'protection-details');
    details.append(el('summary', null, t('Full rule text (Finnish)')));
    const rule = el('p', 'protection-rule', protection.ruleFi);
    rule.lang = 'fi';
    details.append(rule);
    box.append(details);
  }
  return box;
}

// Four answers at the top of the card (Ton, 15 Oct 2026): rent, noise, the nearest
// stop and parking, each a big value with a short line under it. Missing says "No data".
const euroText = v => getLang() === 'fi' ? num(Math.round(v)) + ' €' : '€' + num(Math.round(v));
function keyStrip(record, {prices, listings, noise, transit, parking}) {
  const keys = [];
  // Rent: median asking rent of current 2-room ads in the postal area, else the official per m².
  const area = prices?.areaAt('rent', record.position), stats = area && listings?.stats.get(area.postcode);
  // Rent by flat size from the ads: 2 rooms big, the other sizes in the line under it
  // (Ton, 16 Oct 2026: replaces the separate Average rent section).
  const sizes = ROOM_GROUPS.map(g => ({label: t(g.label), rent: stats?.groups[g.key]?.rent})).filter(g => g.rent != null);
  const main = sizes.find(g => g.label === t('2 rooms')) ?? sizes[0];
  if (main) keys.push(['Rent', euroText(main.rent), [main.label + ' · ' + t('per month'), sizes.filter(g => g !== main).map(g => g.label + ' ' + euroText(g.rent)).join(' · ')]]);
  else if (area?.values[1] != null) keys.push(['Rent', priceValue(area.values[1], prices.data.metrics.rent.units), t('Average for the postal area')]);
  else keys.push(['Rent', null, prices ? null : t('Loading…')]);
  // Noise: apartment buildings only, as in the Noise view.
  if (isApartmentBuilding(record) && noise) {
    const band = noise.band(noise.bandOf(record, 'all'));
    const [loudest] = NOISE_MODES.map(m => m.key).filter(k => record.noise?.[k] != null).sort((a, b) => record.noise[b] - record.noise[a]);
    keys.push(['Noise', band ? (band.hi == null ? band.lo + '+ dB' : band.lo + '–' + band.hi + ' dB') : t('Under 45 dB'), loudest ? t(NOISE_SOURCE[loudest]) : null]);
  } else keys.push(['Noise', null, isApartmentBuilding(record) ? t('Loading…') : t('Modelled for homes only')]);
  // Nearest stop: distance big, name and lines under it.
  const stop = transit?.nearest(record.position)[0];
  if (stop) keys.push(['Nearest stop', num(stop.distanceM) + ' m', [stop.stop.name, [...new Set(stop.stop.lines.map(l => l.short))].slice(0, 3).join(' ')].filter(Boolean).join(' · ')]);
  else keys.push(['Nearest stop', null, transit ? t('None within 1.5 km') : t('Loading…')]);
  // Parking: the paid zone's price, else free street parking nearby.
  const near = parking?.near(record.position);
  if (near?.paidZone) keys.push(['Parking', priceText(near.paidZone.price) ?? t('Paid zone'), [t('Paid zone {n}', {n: near.paidZone.number}), near.residentZone && t('resident zone {code}', {code: near.residentZone.code})].filter(Boolean).join(' · ')]);
  else if (near?.groups.free.areas) keys.push(['Parking', t('Free'), spacesText(near.groups.free)]);
  else keys.push(['Parking', null, parking ? t('None mapped') : t('Loading…')]);

  const grid = el('dl', 'keys');
  for (const [label, value, sub] of keys) {
    const cell = el('div', value == null ? 'key is-missing' : 'key');
    const dd = el('dd');
    dd.append(el('span', 'key-value', value ?? t('No data')));
    for (const line of [sub].flat().filter(Boolean)) dd.append(el('span', 'key-sub', line));
    cell.append(el('dt', null, t(label)), dd);
    grid.append(cell);
  }
  return grid;
}

// Small copy button next to the title; a tick shows for a moment once copied.
const COPY = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/></svg>';
const TICK = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';
function copyButton(address) {
  const b = el('button', 'copy-address');
  b.type = 'button';
  b.innerHTML = COPY;
  b.title = t('Copy address');
  b.setAttribute('aria-label', b.title);
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(address + ', Helsinki'); } catch { return; }
    b.innerHTML = TICK; b.title = t('Address copied'); b.setAttribute('aria-label', b.title);
    setTimeout(() => { b.innerHTML = COPY; b.title = t('Copy address'); b.setAttribute('aria-label', b.title); }, 1600);
  };
  return b;
}

function titleRow(text, address) {
  const row = el('div', 'card-title');
  row.append(el('h2', null, text));
  if (address) row.append(copyButton(address));
  return row;
}

// One line at the end naming the data sources, which their licences ask for.
const credit = () => el('p', 'card-credit', t('Data: City of Helsinki, HSL, Statistics Finland, Oikotie, © OpenStreetMap contributors'));

export class BuildingCard {
  constructor(container, onClose, getPrices = () => null, getListings = () => null, getNoise = () => null, getParking = () => null, getTransit = () => null, getConstruction = () => null, getPlaces = () => null, getServices = () => null) {
    this.el = container;
    this.onClose = onClose;
    this.getPrices = getPrices;
    this.getListings = getListings;
    this.getNoise = getNoise;
    this.getParking = getParking;
    this.getTransit = getTransit;
    this.getConstruction = getConstruction;
    this.getPlaces = getPlaces;
    this.getServices = getServices;
  }

  // Redraw the open card after prices or ads change, keeping the scroll position.
  refresh() {
    if (this.el.hidden || !this.current) return;
    const top = this.el.scrollTop;
    this.show(...this.current);
    this.el.scrollTop = top;
  }

  // The four answers at the top, for a building and for a bare address.
  keys(row) {
    return keyStrip(row, {prices: this.getPrices(), listings: this.getListings(), noise: this.getNoise(), transit: this.getTransit(), parking: this.getParking()});
  }

  // Sections about the surroundings (Ton, 16 Oct 2026): public transport, nearby
  // places, schools and health, and street parking first; construction goes last, after plan protection.
  surroundings(row) {
    return [
      transitSection(row.position, this.getTransit()),
      placesSection(row.position, this.getPlaces()),
      servicesSection(row.position, this.getServices()),
      parkingSection(row.position, this.getParking()),
    ];
  }
  construction(row) { return constructionSection(row.position, this.getConstruction()); }

  show(buildingId, record) {
    this.current = [buildingId, record];
    const card = this.el;
    card.replaceChildren();

    const header = el('header', 'card-header');
    const heading = el('div', 'card-heading');
    // Place in small capitals above the address, the address big below it.
    const place = [titleCase(record?.district?.nameFi), titleCase(record?.subdistrict?.nameFi), record?.postcode].filter(Boolean);
    const unique = place.filter((p, i) => place.indexOf(p) === i);
    if (unique.length) heading.append(el('p', 'card-place', unique.join(' · ')));
    heading.append(titleRow(record?.address ?? t('Building without a registered address'), record?.address));
    const close = el('button', 'card-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close building details'));
    close.onclick = () => this.onClose();
    header.append(heading, close);
    card.append(header);

    if (!record) {
      card.append(el('p', 'note', t('No record for this 3D shape.')));
      card.hidden = false;
      return;
    }

    const tags = el('div', 'tags');
    const type = record.classEn ?? record.useEn ?? record.classFi ?? record.use;
    if (type) tags.append(el('span', 'tag', t(type)));
    if (record.protection) tags.append(el('span', 'tag tag-protected', t('Protected')));
    if (tags.children.length) card.append(tags);

    if (record.addresses?.length > 1) card.append(el('p', 'card-sub', t('Also {list}', {list: record.addresses.slice(1).join(', ')})));

    // The four answers first, then rental ads in this building, then the facts.
    if (record.address) card.append(this.keys(record));
    const ads = adsSection(record, this.getListings());
    if (ads) card.append(ads);
    if (record.address) card.append(factsSection(record));
    else card.append(el('p', 'note', t('No register data.')));

    card.append(...this.surroundings(record));
    if (record.protection) card.append(protectionSection(record.protection));
    card.append(this.construction(record), credit());
    card.hidden = false;
    card.scrollTop = 0;
  }

  showAddress(row) {
    this.current = null;
    this.el.replaceChildren();
    const header=el('header','card-header');
    const close=el('button','card-close','×');close.type='button';close.setAttribute('aria-label',t('Close address details'));close.onclick=this.onClose;
    header.append(titleRow(row.address,row.address),close);this.el.append(header);
    this.el.append(el('p','note',t('No linked 3D building')),el('p','card-sub',[row.addressSv,row.postcode].filter(Boolean).join(' · ')));
    this.el.append(this.keys(row),...this.surroundings(row),this.construction(row),credit());
    this.el.hidden=false;this.el.scrollTop=0;
  }
  showChoices(row,records,onSelect) {
    this.showAddress(row);
    this.el.querySelector('.note').textContent=t('Several buildings share this exact register address. Choose a building:');
    const list=el('div','building-choices');
    for(const record of records){
      const button=el('button',null,[record.address,word(record.classEn??record.useEn),record.sourceIds.ratu?'RATU '+record.sourceIds.ratu:record.buildingId].filter(Boolean).join(' · '));
      button.onclick=()=>onSelect(record.buildingId);list.append(button);
    }
    this.el.querySelector('.card-header').after(list);
  }
  hide() { this.el.hidden = true; }
}
