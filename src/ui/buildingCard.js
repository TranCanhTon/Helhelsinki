// The panel that opens when you click a building.
//
// Sections: address header, key facts, prices, noise, street parking, public
// transport, plan protection, listing links and "Sources & IDs". Missing values
// say "Not recorded", never zero.
import {listingLinks} from './listings.js';
import {pricesSection, adsSection} from './pricesCard.js';
import {noiseSection} from './noiseCard.js';
import {isApartmentBuilding} from '../data/noise.js';
import {parkingSection} from './parkingCard.js';
import {transitSection} from './transitCard.js';
import {t, num} from './i18n.js';

const el = (tag, className, textValue) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textValue !== undefined && textValue !== null) node.textContent = textValue;
  return node;
};

const titleCase = s => s ? s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase()) : s;
const number = n => n === null || n === undefined ? null : num(n);
// Register words (heating, frame, building type...) are stored in English; shown in the chosen language.
const word = s => s == null ? s : t(s);

function factsSection(record) {
  const f = record.facts ?? {};
  const rows = [
    ['Year built', record.yearBuilt],
    ['Floors', f.floors],
    ['Height', record.heightM ? `${num(record.heightM)} m` : null],
    ['Flats', number(f.flats)],
    ['Business premises', f.businessPremises === 0 ? t('None') : number(f.businessPremises)],
    ['Floor area', f.floorAreaM2 ? `${number(f.floorAreaM2)} m²` : null],
    ['Heating', word(f.heating)],
    ['Heating fuel', word(f.fuel)],
    ['Frame', word(f.frame)],
    ['Facade', word(f.facade)],
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

function listingsSection(record) {
  const box = el('section', 'listings');
  box.append(el('h3', null, t('Homes around here')));
  box.append(el('p', 'note', t('Opens area searches. These links do not confirm a listing in this exact building. Copy the address to narrow the search.')));
  const list = el('div', 'listing-buttons');
  for (const link of listingLinks(record)) {
    const a = el('a', 'listing');
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.append(el('span', 'listing-site', link.site), el('span', 'listing-what', `${t(link.kind)} · ${link.area}`));
    list.append(a);
  }
  const copy=el('button','copy-address',t('Copy address'));copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(record.address + ', Helsinki');copy.textContent=t('Address copied');}catch{copy.textContent=t('Copy: {a}',{a:record.address});}};
  box.append(list,copy);
  return box;
}

function sourcesSection(record) {
  const details = el('details', 'sources');
  details.append(el('summary', null, t('Sources & IDs')));
  const ids = el('dl');
  const add = (label, value) => ids.append(el('dt', null, t(label)), el('dd', null, value ?? t('None')));
  add('Model ID (gml:id)', record.sourceIds.gmlId);
  add('RATU', record.sourceIds.ratu);
  add('VTJ-PRT', record.sourceIds.vtjPrt);
  add('Register link', record.registerJoin);
  add('Year built from', record.yearSource);
  add('Plan protection matched by', record.protection?.matchedBy);
  add('Geometry', record.geometrySource);
  add('Tile / feature', `${record.tileContentUri} #${record.tileFeatureId}`);
  details.append(ids, el('p', 'note', t('City of Helsinki 3D model, building register and detailed plans, CC BY 4.0. Height is the city model\'s measured height.')));
  return details;
}

export class BuildingCard {
  constructor(container, onClose, getPrices = () => null, getListings = () => null, getNoise = () => null, getParking = () => null, getTransit = () => null) {
    this.el = container;
    this.onClose = onClose;
    this.getPrices = getPrices;
    this.getListings = getListings;
    this.getNoise = getNoise;
    this.getParking = getParking;
    this.getTransit = getTransit;
  }

  // Redraw the open card after prices or ads change, keeping the scroll position.
  refresh() {
    if (this.el.hidden || !this.current) return;
    const top = this.el.scrollTop;
    this.show(...this.current);
    this.el.scrollTop = top;
  }

  show(buildingId, record) {
    this.current = [buildingId, record];
    const card = this.el;
    card.replaceChildren();

    const header = el('header', 'card-header');
    const heading = el('div', 'card-heading');
    heading.append(el('h2', null, record?.address ?? t('Building without a registered address')));
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
      card.append(el('p', 'note', t('This 3D shape ({id}) has no record in the building list.', {id: buildingId})));
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

    if (record.address) card.append(factsSection(record));
    else card.append(el('p', 'note', t('This shape has no building ID in the city model, so there is no register data. Most such shapes are sheds, garages and yard buildings.')));

    const ads = adsSection(record, this.getListings());
    if (ads) card.append(ads);
    card.append(pricesSection(record, this.getPrices(), this.getListings()));
    if (isApartmentBuilding(record)) card.append(noiseSection(record, this.getNoise()));
    card.append(parkingSection(record.position, this.getParking()));
    card.append(transitSection(record.position, this.getTransit()));
    if (record.protection) card.append(protectionSection(record.protection));
    if (record.address) card.append(listingsSection(record));
    const later=el('details','sources');later.append(el('summary',null,'More about the surroundings'));
    later.append(el('p','note','Construction data will be added in a later phase.'));
    card.append(later,sourcesSection(record));
    const priceData=this.getPrices()?.data;
    if(priceData){
      const sources=card.querySelector('.sources:last-child');
      for(const [metric,m] of Object.entries(priceData.metrics)){
        const link=el('a',null,t('{metric} statistics · {table} · {year} postal boundaries',{metric:t(metric),table:m.table,year:m.boundaryYear}));
        link.href=m.source;link.target='_blank';link.rel='noopener noreferrer';
        const p=el('p','note');p.append(link);sources.append(p);
      }
    }
    card.hidden = false;
    card.scrollTop = 0;
  }

  showAddress(row) {
    this.current = null;
    this.el.replaceChildren();
    const header=el('header','card-header');
    const close=el('button','card-close','×');close.type='button';close.setAttribute('aria-label',t('Close address details'));close.onclick=this.onClose;
    header.append(el('h2',null,row.address),close);this.el.append(header);
    this.el.append(el('p','note',t('No linked 3D building')),el('p','card-sub',[row.addressSv,row.postcode].filter(Boolean).join(' · ')));
    this.el.append(pricesSection(row,this.getPrices(),this.getListings()));
    this.el.append(parkingSection(row.position,this.getParking()),transitSection(row.position,this.getTransit()));
    if(row.address)this.el.append(listingsSection(row));
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
