import {PARKING_GROUPS, PARKING_TYPES} from '../data/parking.js';
import {legendKeys} from './legend.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
const count=n=>n.toLocaleString('en-GB');
const plural=(n,word)=>`${count(n)} ${word}${n===1?'':'s'}`;

// "about 44 spaces", "3 areas, no estimate", "None mapped". Missing stays missing, never 0.
function spacesText(g){
 if(!g.areas)return null;
 if(g.spaces===null)return `${plural(g.areas,'area')}, no estimate`;
 return `about ${plural(g.spaces,'space')}`+(g.noEstimate?` and ${plural(g.noEstimate,'area')} without estimate`:'');
}

// Card section: street parking within 200 m of a point, by Ton's three groups.
export function parkingSection(point,parking){
 const section=el('section','parking');
 section.append(el('h3',null,'Street parking · within 200 m'));
 if(!parking){section.append(el('p','note','Parking data unavailable or still loading.'));return section;}
 const near=parking.near(point),colors=parking.colors();
 const grid=el('dl','parking-groups');
 for(const g of PARKING_GROUPS){
  const text=spacesText(near.groups[g.key]),cell=el('div',text?'parking-group':'parking-group is-missing');
  const label=el('dt'),swatch=el('i');swatch.style.background=colors[g.key];label.append(swatch,document.createTextNode(g.label));
  cell.append(label,el('dd',null,text??'None mapped'));grid.append(cell);
 }
 section.append(grid);
 const zones=el('p','parking-zones');
 const paid=near.paidZone,resident=near.residentZone;
 zones.append(el('span',null,paid?`Paid zone ${paid.number}${paid.price?' · '+paid.price:''}`:'Not in a paid zone'),
  el('span',null,resident?`Resident zone ${resident.code} · ${resident.name}`:'Not in a resident parking zone'));
 section.append(zones);
 const other=Object.entries(near.other).map(([type,n])=>`${count(n)} ${PARKING_TYPES[type].short}`);
 if(other.length)section.append(el('p','note',`Other places mapped: ${other.join(', ')}.`));
 section.append(el('p','note','The city\'s estimate from its street parking map ('+parking.data.source.updated+'), counted in a straight line from the building. Not free spaces right now. Yard and garage parking are not included. Zone borders are approximate. Hours and rules vary: check the signs. City of Helsinki, CC BY 4.0.'));
 return section;
}

// Parking view legend: the three zone colours.
export function parkingLegend(container,parking){
 const colors=parking.colors();
 legendKeys(container,{items:PARKING_GROUPS.map(g=>({color:colors[g.key],text:g.label}))});
}
