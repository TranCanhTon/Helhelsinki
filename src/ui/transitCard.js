import {MODE_COLORS,SQUARE_MODES} from '../map/transit.js';
import {t,num,locale} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
const swatch=mode=>{const i=el('i',SQUARE_MODES.has(mode)?'is-square':null);i.style.background=MODE_COLORS[mode];return i;};
const dateText=date=>new Date(date+'T12:00:00Z').toLocaleDateString(locale(),{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
// "12 per hour" from the timetable -> the chosen language.
const perHourText=s=>{const m=/^(\d+) per hour$/.exec(s??'');return m?t('{n} per hour',{n:m[1]}):t(s);};

// Card section: the three nearest stops within 1.5 km, with lines and departures.
export function transitSection(point,transit){
 const section=el('section','transit');
 section.append(el('h3',null,t('Public transport · nearest stops')));
 if(!transit){section.append(el('p','note',t('Public transport data unavailable or still loading.')));return section;}
 const near=transit.nearest(point),label=key=>t(transit.data.modes.find(m=>m.key===key).label);
 if(!near.length)section.append(el('p','note',t('No stops within 1.5 km.')));
 for(const {stop,distanceM} of near){
  const row=el('div','stop-row'),head=el('div','stop-head');
  const name=el('strong');name.append(swatch(stop.mode),document.createTextNode(stop.name));
  head.append(name,el('span','stop-distance',`${num(distanceM)} m`));
  const byMode=new Map();for(const l of stop.lines)byMode.set(l.mode,[...(byMode.get(l.mode)??[]),l.short]);
  const lines=el('p','stop-lines');
  for(const [mode,names] of byMode){const part=el('span');part.append(el('b',null,label(mode)),document.createTextNode(' '+names.join(' ')));lines.append(part);}
  row.append(head,lines,el('p','stop-departures',t('{x} from 7 to 9',{x:perHourText(transit.perHour(stop))})));
  section.append(row);
 }
 section.append(el('p','note',t('HSL timetable for {date}. Departures count both directions together. Distance in a straight line: the walk is longer. Not live. HSL open data, CC BY 4.0.',{date:dateText(transit.data.date)})));
 return section;
}

