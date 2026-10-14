import {PLACE_KINDS, NEAR_M} from '../data/places.js';
import {t, num} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};

// Card section (Ton, 14 Oct 2026): the nearest grocery store, pharmacy, gym and so on,
// each with its name and straight-line distance. Not drawn on the map.
export function placesSection(point,places){
 const section=el('section','places');
 section.append(el('h3',null,t('Nearby')));
 if(!places){section.append(el('p','note',t('Loading…')));return section;}
 const near=places.nearest(point),list=el('dl','place-list');
 for(const {key,label} of PLACE_KINDS){
  const p=near[key],row=el('div',p?'place-row':'place-row is-missing');
  row.append(el('dt',null,t(label)));
  if(p)row.append(el('dd','place-name',p.name??t('Unnamed')),el('dd','place-distance',num(Math.max(10,Math.round(p.distanceM/10)*10))+' m'));
  else row.append(el('dd','place-name',t('None within {d} km',{d:num(NEAR_M/1000)})));
  list.append(row);
 }
 section.append(list);
 return section;
}
