import {priceValue} from '../map/prices.js';
import {ROOM_GROUPS,MIN_ADS,groupOf,perM2} from '../data/listings.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
const euros=v=>'€'+Math.round(v).toLocaleString('en-GB');
const when=iso=>new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short'});

// Rent per month in the area right now, from current ads. The official
// Statistics Finland figure is per m² only, so it is a footnote here.
function rentBlock(area,m,listings){
 const row=el('div','price-row');
 row.append(el('strong',null,'Rent per month · current ads'));
 const s=area&&listings?.stats.get(area.postcode);
 if(!listings)row.append(el('p','note','Current ads are not loaded yet. Run npm run data:listings.'));
 else if(!s)row.append(el('p','note','No current Oikotie ads in '+(area?area.postcode+' '+area.name:'this area')+'.'));
 else{
  const grid=el('dl','rent-groups');
  for(const g of ROOM_GROUPS){
   const v=s.groups[g.key];
   grid.append(el('dt',null,g.label),el('dd',null,v.rent!=null?euros(v.rent)+' / month':v.count?'Too few ads ('+v.count+')':'No ads'));
  }
  row.append(grid,el('p','note','Median asking rent in '+s.count+' current Oikotie ads in '+area.postcode+' '+area.name+' (at least '+MIN_ADS+' ads per size). Updated '+new Date(listings.updatedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'.'));
 }
 if(area?.values[1]!=null)row.append(el('p','note','Official average: '+priceValue(area.values[1],m.units)+' (Statistics Finland, '+m.periodLabels[1]+(m.archived?', archived':'')+', two-room flats).'));
 return row;
}

export function pricesSection(record,prices,listings){
 const section=el('section','postal-prices');
 section.append(el('h3',null,'Prices in this postal area'));
 if(!prices){section.append(el('p','note','Price data unavailable or still loading.'));return section;}
 for(const metric of ['sale','rent']){
  const m=prices.data.metrics[metric],a=prices.areaAt(metric,record.position);
  if(metric==='rent'){section.append(rentBlock(a,m,listings));continue;}
  const row=el('div','price-row');
  row.append(el('strong',null,'Sale · '+priceValue(a?.values[1],m.units)));
  row.append(el('p','note',[m.periodLabels[1],a?a.postcode+' '+a.name:'No matching postal area',a?.changePercent!=null?(a.changePercent>=0?'+':'')+a.changePercent.toFixed(1)+'% vs previous quarter':null].filter(Boolean).join(' · ')));
  row.append(el('p','note',m.category+' · Statistics Finland'));
  section.append(row);
 }
 section.append(el('p','note','Area figures, not a valuation of this building.'));
 return section;
}

// Ads in this exact building, each compared with similar ads in the same postal area.
export function adsSection(record,listings){
 const ads=listings?.byBuilding.get(record.buildingId);
 if(!ads?.length)return null;
 const box=el('section','building-ads');
 box.append(el('h3',null,(ads.length===1?'1 rental ad':ads.length+' rental ads')+' in this building now'));
 for(const ad of ads){
  const a=el('a','building-ad');a.href=ad.url;a.target='_blank';a.rel='noopener noreferrer';
  a.append(el('strong',null,euros(ad.rent)+' / month'+(ad.sizeM2?' · '+ad.sizeM2.toLocaleString('en-GB')+' m²':'')));
  const typical=listings.stats.get(ad.postcode)?.groups[groupOf(ad.rooms)];
  const own=perM2(ad);
  const compare=own!=null&&typical?.perM2!=null?Math.round((own/typical.perM2-1)*100):null;
  a.append(el('span',null,[ad.layout,ad.street,own!=null?'€'+own.toFixed(1)+'/m²':null].filter(Boolean).join(' · ')));
  if(compare!=null)a.append(el('span',compare>0?'ad-compare is-above':'ad-compare is-below',
   (compare===0?'Same as':Math.abs(compare)+'% '+(compare>0?'above':'below'))+' similar ads nearby per m²'));
  a.append(el('span','note','Ad updated '+when(ad.lastmod)+' · open on Oikotie ↗'));
  box.append(a);
 }
 box.append(el('p','note','Asking rents from Oikotie, matched by exact street address.'));
 return box;
}
