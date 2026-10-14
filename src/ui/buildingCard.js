// The panel that opens when you click a building.
//
// Kept short (Ton, 14 Oct 2026): address header with a copy button, the rental ads in
// this building (when there are any), the key facts with noise, average rent,
// construction within 50 m, street parking, public transport and plan protection.
// No explaining notes. Missing values say "Not recorded", never zero.
import {rentSection, adsSection} from './pricesCard.js';
import {bandText} from './noiseCard.js';
import {isApartmentBuilding, NOISE_MODES} from '../data/noise.js';
import {parkingSection} from './parkingCard.js';
import {transitSection} from './transitCard.js';
import {constructionSection} from './constructionCard.js';
import {t, num} from './i18n.js';

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

// "65 to 70 dB, road traffic": the loudest modelled band at the building and its source.
const NOISE_SOURCE = {road: 'road traffic', rail: 'trains', metro: 'metro', tram: 'trams'};
function noiseText(record, noise) {
  if (!noise || !record.noise) return null;
  const all = noise.band(noise.bandOf(record, 'all'));
  if (!all) return t('Under 45 dB');
  const [loudest] = NOISE_MODES.map(m => m.key).filter(k => record.noise[k] != null).sort((a, b) => record.noise[b] - record.noise[a]);
  return bandText(all) + (loudest ? ', ' + t(NOISE_SOURCE[loudest]) : '');
}

function factsSection(record, noise) {
  const f = record.facts ?? {};
  const rows = [
    ['Year built', record.yearBuilt],
    ['Floors', f.floors],
    ['Height', record.heightM ? `${num(record.heightM)} m` : null],
    ['Flats', number(f.flats)],
    ['Floor area', f.floorAreaM2 ? `${number(f.floorAreaM2)} m²` : null],
    ['Elevator', f.elevator ? t('Yes') : null],
  ];
  // Noise for apartment buildings only, as in the Noise view.
  if (isApartmentBuilding(record)) rows.push(['Noise', noiseText(record, noise)]);
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
const credit = () => el('p', 'card-credit', t('Data: City of Helsinki, HSL, Statistics Finland, Oikotie'));

export class BuildingCard {
  constructor(container, onClose, getPrices = () => null, getListings = () => null, getNoise = () => null, getParking = () => null, getTransit = () => null, getConstruction = () => null) {
    this.el = container;
    this.onClose = onClose;
    this.getPrices = getPrices;
    this.getListings = getListings;
    this.getNoise = getNoise;
    this.getParking = getParking;
    this.getTransit = getTransit;
    this.getConstruction = getConstruction;
  }

  // Redraw the open card after prices or ads change, keeping the scroll position.
  refresh() {
    if (this.el.hidden || !this.current) return;
    const top = this.el.scrollTop;
    this.show(...this.current);
    this.el.scrollTop = top;
  }

  // Sections about the surroundings, the same for a building and a bare address.
  surroundings(row) {
    return [
      rentSection(row, this.getPrices(), this.getListings()),
      constructionSection(row.position, this.getConstruction()),
      parkingSection(row.position, this.getParking()),
      transitSection(row.position, this.getTransit()),
    ];
  }

  show(buildingId, record) {
    this.current = [buildingId, record];
    const card = this.el;
    card.replaceChildren();

    const header = el('header', 'card-header');
    const heading = el('div', 'card-heading');
    heading.append(titleRow(record?.address ?? t('Building without a registered address'), record?.address));
    const place = [titleCase(record?.subdistrict?.nameFi), titleCase(record?.district?.nameFi), record?.postcode].filter(Boolean);
    const unique = place.filter((p, i) => place.indexOf(p) === i);
    if (unique.length) heading.append(el('p', 'card-place', unique.join(' · ')));
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
    if (record.addressSv) {
      const sv = el('p', 'card-sub', t('På svenska: {a}', {a: record.addressSv}));
      sv.lang = 'sv';
      card.append(sv);
    }

    // Current rental ads in this building first, then the facts.
    const ads = adsSection(record, this.getListings());
    if (ads) card.append(ads);
    if (record.address) card.append(factsSection(record, this.getNoise()));
    else card.append(el('p', 'note', t('No register data.')));

    card.append(...this.surroundings(record));
    if (record.protection) card.append(protectionSection(record.protection));
    card.append(credit());
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
    this.el.append(...this.surroundings(row),credit());
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
