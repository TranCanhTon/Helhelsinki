import {PARKING_GROUPS, PARKING_TYPES} from '../data/parking.js';
import {legendKeys} from './legend.js';
import {t, tn, num} from './i18n.js';
const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};
const areas = n => tn(n, '{n} area', '{n} areas'),
  spaces = n => tn(n, '{n} space', '{n} spaces');
// "€3 per hour" from the zone data -> "3 €/tunti" in Finnish.
export const priceText = p => {
  const m = /^€([\d.]+) per hour$/.exec(p ?? '');
  return m ? t('€{p} per hour', {p: num(Number(m[1]))}) : p;
};

// "about 44 spaces", "3 areas, no estimate", "None mapped". Missing stays missing, never 0.
export function spacesText(g) {
  if (!g.areas) return null;
  if (g.spaces === null) return t('{areas}, no estimate', {areas: areas(g.areas)});
  return (
    t('about {spaces}', {spaces: spaces(g.spaces)}) +
    (g.noEstimate ? t(' and {areas} without estimate', {areas: areas(g.noEstimate)}) : '')
  );
}

// Card section: street parking within 200 m of a point, by Ton's three groups.
export function parkingSection(point, parking) {
  const section = el('section', 'parking');
  section.append(el('h3', null, t('Street parking · within 200 m')));
  if (!parking) {
    section.append(el('p', 'note', t('Parking data unavailable or still loading.')));
    return section;
  }
  const near = parking.near(point),
    colors = parking.colors();
  const grid = el('dl', 'parking-groups');
  for (const g of PARKING_GROUPS) {
    const text = spacesText(near.groups[g.key]),
      cell = el('div', text ? 'parking-group' : 'parking-group is-missing');
    const label = el('dt'),
      swatch = el('i');
    swatch.style.background = colors[g.key];
    label.append(swatch, document.createTextNode(t(g.label)));
    cell.append(label, el('dd', null, text ?? t('None mapped')));
    grid.append(cell);
  }
  section.append(grid);
  const zones = el('p', 'parking-zones');
  const paid = near.paidZone,
    resident = near.residentZone;
  zones.append(
    el(
      'span',
      null,
      paid
        ? t('Paid zone {n}', {n: paid.number}) + (paid.price ? ' · ' + priceText(paid.price) : '')
        : t('Not in a paid zone'),
    ),
    el(
      'span',
      null,
      resident
        ? t('Resident zone {code} · {name}', {code: resident.code, name: resident.name})
        : t('Not in a resident parking zone'),
    ),
  );
  section.append(zones);
  const other = Object.entries(near.other).map(([type, n]) =>
    t('{what} {n}', {n: num(n), what: t(PARKING_TYPES[type].short)}),
  );
  if (other.length) section.append(el('p', 'note', t('Other places mapped: {list}.', {list: other.join(', ')})));
  return section;
}

// Parking view legend: the three zone colours.
export function parkingLegend(container, parking) {
  const colors = parking.colors();
  legendKeys(container, {items: PARKING_GROUPS.map(g => ({color: colors[g.key], text: t(g.label)}))});
}
