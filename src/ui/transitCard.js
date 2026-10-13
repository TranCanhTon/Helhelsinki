import {MODE_COLORS,SQUARE_MODES} from '../map/transit.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
const swatch=mode=>{const i=el('i',SQUARE_MODES.has(mode)?'is-square':null);i.style.background=MODE_COLORS[mode];return i;};
const dateText=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});

// Card section: the three nearest stops within 1.5 km, with lines and departures.
export function transitSection(point,transit){
 const section=el('section','transit');
 section.append(el('h3',null,'Public transport · nearest stops'));
 if(!transit){section.append(el('p','note','Public transport data unavailable or still loading.'));return section;}
 const near=transit.nearest(point),label=key=>transit.data.modes.find(m=>m.key===key).label;
 if(!near.length)section.append(el('p','note','No stops within 1.5 km.'));
 for(const {stop,distanceM} of near){
  const row=el('div','stop-row'),head=el('div','stop-head');
  const name=el('strong');name.append(swatch(stop.mode),document.createTextNode(stop.name));
  head.append(name,el('span','stop-distance',`${distanceM.toLocaleString('en-GB')} m`));
  const byMode=new Map();for(const l of stop.lines)byMode.set(l.mode,[...(byMode.get(l.mode)??[]),l.short]);
  const lines=el('p','stop-lines');
  for(const [mode,names] of byMode){const part=el('span');part.append(el('b',null,label(mode)),document.createTextNode(' '+names.join(' ')));lines.append(part);}
  row.append(head,lines,el('p','stop-departures',`${transit.perHour(stop)} from 7 to 9`));
  section.append(row);
 }
 section.append(el('p','note',`HSL timetable for ${dateText(transit.data.date)}. Departures count both directions together. Distance in a straight line: the walk is longer. Not live. HSL open data, CC BY 4.0.`));
 return section;
}

