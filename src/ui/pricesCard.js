import {priceValue} from '../map/prices.js';
import {ROOM_GROUPS,MIN_ADS,groupOf,perM2} from '../data/listings.js';
import {t,num,locale,getLang} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
// "€765" in English, "765 €" in Finnish.
const euro=s=>getLang()==='fi'?s+' €':'€'+s;
const euros=v=>euro(num(Math.round(v)));
const when=iso=>new Date(iso).toLocaleDateString(locale(),{day:'numeric',month:'short'});

// Rent per month in the area right now, from current ads. The official
// Statistics Finland figure is per m² only, so it is a footnote here.
function rentBlock(area,m,listings){
 const row=el('div','price-row');
 row.append(el('strong',null,t('Rent per month · current ads')));
 const s=area&&listings?.stats.get(area.postcode);
 if(!listings)row.append(el('p','note',t('Current ads are not loaded yet. Run npm run data:listings.')));
 else if(!s)row.append(el('p','note',area?t('No current Oikotie ads in {area}.',{area:area.postcode+' '+area.name}):t('No current Oikotie ads in this area.')));
 else{
  const grid=el('dl','rent-groups');
  for(const g of ROOM_GROUPS){
   const v=s.groups[g.key];
   grid.append(el('dt',null,t(g.label)),el('dd',null,v.rent!=null?t('{v} / month',{v:euros(v.rent)}):v.count?t('Too few ads ({n})',{n:v.count}):t('No ads')));
  }
  row.append(grid,el('p','note',t('Median asking rent in {n} current Oikotie ads in {area} (at least {min} ads per size). Updated {time}.',{n:s.count,area:area.postcode+' '+area.name,min:MIN_ADS,time:new Date(listings.updatedAt).toLocaleString(locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})})));
 }
 if(area?.values[1]!=null)row.append(el('p','note',t('Official average: {v} (Statistics Finland, {period}, two-room flats).',{v:priceValue(area.values[1],m.units),period:m.periodLabels[1]+(m.archived?', '+t('archived'):'')})));
 return row;
}

export function pricesSection(record,prices,listings){
 const section=el('section','postal-prices');
 section.append(el('h3',null,t('Prices in this postal area')));
 if(!prices){section.append(el('p','note',t('Price data unavailable or still loading.')));return section;}
 for(const metric of ['sale','rent']){
  const m=prices.data.metrics[metric],a=prices.areaAt(metric,record.position);
  if(metric==='rent'){section.append(rentBlock(a,m,listings));continue;}
  const row=el('div','price-row');
  row.append(el('strong',null,t('Sale · {v}',{v:priceValue(a?.values[1],m.units)})));
  row.append(el('p','note',[m.periodLabels[1],a?a.postcode+' '+a.name:t('No matching postal area'),a?.changePercent!=null?t('{p}% vs previous quarter',{p:(a.changePercent>=0?'+':'')+num(a.changePercent,{minimumFractionDigits:1,maximumFractionDigits:1})}):null].filter(Boolean).join(' · ')));
  row.append(el('p','note',t('{category} · Statistics Finland',{category:t(m.category)})));
  section.append(row);
 }
 section.append(el('p','note',t('Area figures, not a valuation of this building.')));
 return section;
}

// Ads in this exact building, each compared with similar ads in the same postal area.
export function adsSection(record,listings){
 const ads=listings?.byBuilding.get(record.buildingId);
 if(!ads?.length)return null;
 const box=el('section','building-ads');
 box.append(el('h3',null,ads.length===1?t('1 rental ad in this building now'):t('{n} rental ads in this building now',{n:ads.length})));
 for(const ad of ads){
  const a=el('a','building-ad');a.href=ad.url;a.target='_blank';a.rel='noopener noreferrer';
  a.append(el('strong',null,t('{v} / month',{v:euros(ad.rent)})+(ad.sizeM2?' · '+num(ad.sizeM2)+' m²':'')));
  const typical=listings.stats.get(ad.postcode)?.groups[groupOf(ad.rooms)];
  const own=perM2(ad);
  const compare=own!=null&&typical?.perM2!=null?Math.round((own/typical.perM2-1)*100):null;
  a.append(el('span',null,[ad.layout,ad.street,own!=null?euro(num(own,{minimumFractionDigits:1,maximumFractionDigits:1}))+'/m²':null].filter(Boolean).join(' · ')));
  if(compare!=null)a.append(el('span',compare>0?'ad-compare is-above':'ad-compare is-below',
   compare===0?t('Same as similar ads nearby per m²'):t(compare>0?'{n}% above similar ads nearby per m²':'{n}% below similar ads nearby per m²',{n:Math.abs(compare)})));
  a.append(el('span','note',t('Ad updated {date} · open on Oikotie ↗',{date:when(ad.lastmod)})));
  box.append(a);
 }
 box.append(el('p','note',t('Asking rents from Oikotie, matched by exact street address.')));
 return box;
}
