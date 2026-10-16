import {loadJson} from '../data/load.js';
import {t, locale} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};

const CITY='City of Helsinki · CC BY 4.0';
// Every dataset the map shows (Ton, 16 Oct 2026): what it is, who made it with the
// licence, and when we took it, read from dataset.json when the panel opens.
// date(d) returns an ISO date or text; null shows "Date not recorded".
const SOURCES=[
 {name:'3D buildings',what:'Textured LOD2 city model',by:CITY,date:d=>d.sources?.buildings?.retrievedAt},
 {name:'Building facts',what:'Building register: year, floors, flats, area, elevator',by:CITY,date:d=>d.sources?.register?.retrievedAt},
 {name:'Plan protection',what:'Buildings protected in city plans',by:CITY,date:d=>d.sources?.planProtection?.retrievedAt},
 {name:'Addresses',what:'Official address points, Finnish and Swedish',by:CITY,date:d=>d.addresses?.retrievedAt},
 {name:'Ground map and place names',what:'Land, water, green areas, streets, names',by:CITY,date:d=>d.basemap?.sources?.[0]?.retrievedAt??d.labels?.retrievedAt},
 {name:'Sale and rent prices',what:'Postal-area averages',by:'Statistics Finland · CC BY 4.0',date:d=>d.prices?.retrievedAt,
  extra:d=>[d.prices?.metrics?.sale?.periodLabels?.[1]&&t('Sale {p}',{p:d.prices.metrics.sale.periodLabels[1]}),d.prices?.metrics?.rent?.periodLabels?.[1]&&t('Rent {p}',{p:d.prices.metrics.rent.periodLabels[1]})].filter(Boolean).join(' · ')},
 {name:'Rental ads',what:'Rent, size, rooms and address of current ads',by:'Oikotie',date:(d,ads)=>ads?.updatedAt??d.listings?.updatedAt},
 {name:'Noise',what:'Modelled noise bands',by:CITY,date:d=>d.noise?.studyYear?String(d.noise.studyYear):null,extra:d=>d.noise?.study?t(d.noise.study):null},
 {name:'Street parking',what:'Free, paid and resident permit areas',by:CITY,date:d=>d.parking?.retrievedAt},
 {name:'Construction',what:'Digging notices and street area rentals',by:CITY,date:d=>d.construction?.preparedFor},
 {name:'Public transport',what:'Stops, lines and timetables (not live)',by:'HSL · CC BY 4.0',date:d=>d.transit?.feedVersion?.slice(0,10),extra:d=>d.transit?.date?t('Departures counted for {date}',{date:day(d.transit.date)}):null},
 {name:'Shops and services',what:'Grocery stores, pharmacies, gyms, Alko, restaurants, cafés',by:'© OpenStreetMap contributors · ODbL',date:d=>d.places?.retrievedAt},
 {name:'Schools and health',what:'Day care, primary schools, health stations',by:'City of Helsinki service map · CC BY 4.0',date:d=>d.services?.retrievedAt},
];
const day=iso=>/^\d{4}$/.test(iso)?iso:new Date(iso).toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'});

// panel: the empty <aside>; getAds(): the loaded ads, whose time is newer than dataset.json's.
export function createSourcesPanel(panel,getAds){
 let data=null;
 const close=()=>{panel.hidden=true;};
 const paint=()=>{
  panel.replaceChildren();
  const head=el('header','sources-head');head.append(el('h2',null,t('Sources')));
  const x=el('button','card-close','×');x.type='button';x.setAttribute('aria-label',t('Close sources'));x.onclick=close;head.append(x);
  panel.append(head);
  if(!data){panel.append(el('p','note',t('Loading…')));return;}
  const list=el('dl','sources-list');
  for(const s of SOURCES){
   const row=el('div','source-row'),when=s.date(data,getAds());
   row.append(el('dt',null,t(s.name)));
   const dd=el('dd');
   dd.append(el('span','source-what',t(s.what)),el('span','source-by',t(s.by)));
   const extra=s.extra?.(data);if(extra)dd.append(el('span','source-extra',extra));
   row.append(dd,el('dd',when?'source-date':'source-date is-missing',when?day(when):t('Date not recorded')));
   list.append(row);
  }
  panel.append(list,el('p','note',t('Dates are when the data was taken from its source. Prices are postal-area averages, never a valuation of one building.')));
 };
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopImmediatePropagation();close();}},true);
 return {
  async open(){
   panel.hidden=false;paint();
   if(!data)try{data=await loadJson('/dataset.json');}catch{data={};}
   paint();
  },
  close,
  toggle(){if(panel.hidden)this.open();else close();},
  refresh(){if(!panel.hidden)paint();},
 };
}
