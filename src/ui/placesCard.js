import {PLACE_KINDS, NEAR_M, SERVICE_KINDS, SERVICE_NEAR_M} from '../data/places.js';
import {t, num} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};

// Straight-line distance: metres to the nearest 10, from 1 km in km with one decimal.
const distance=m=>m>=1000?num(m/1000,{minimumFractionDigits:1,maximumFractionDigits:1})+' km':num(Math.max(10,Math.round(m/10)*10))+' m';

// Card section (Ton, 14 Oct 2026): the nearest grocery store, pharmacy, gym and so on,
// each with its name and straight-line distance. Not drawn on the map.
export function placesSection(point,places){return section('Nearby',PLACE_KINDS,NEAR_M,point,places);}
// Day care, primary schools and health stations (Ton, 16 Oct 2026), the same rows.
export function servicesSection(point,services){return section('Schools and health',SERVICE_KINDS,SERVICE_NEAR_M,point,services);}
function section(title,kinds,radiusM,point,places){
 const section=el('section','places');
 section.append(el('h3',null,t(title)));
 if(!places){section.append(el('p','note',t('Loading…')));return section;}
 const near=places.nearest(point),list=el('dl','place-list');
 for(const {key,label} of kinds){
  const p=near[key],row=el('div',p?'place-row':'place-row is-missing');
  row.append(el('dt',null,t(label)));
  if(p)row.append(el('dd','place-name',p.name??t('Unnamed')),el('dd','place-distance',distance(p.distanceM)));
  else row.append(el('dd','place-name',t('None within {d} km',{d:num(radiusM/1000)})));
  list.append(row);
 }
 section.append(list);
 return section;
}
