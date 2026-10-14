import {CONSTRUCTION_LEVELS, shortAddress} from '../data/construction.js';
import {legendKeys} from './legend.js';
import {t,tn,num,locale} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
const LEVEL_LABEL=Object.fromEntries(CONSTRUCTION_LEVELS.map(l=>[l.key,l.label]));
const level=key=>t(LEVEL_LABEL[key]);
const date=s=>new Date(s+'T12:00:00').toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'});

function whenText(work,status){
 const until=work.end?t('until {date}',{date:date(work.end)}):t('no end date given');
 return status==='upcoming'?t('Starts {date}, {until}',{date:date(work.start),until}):until[0].toUpperCase()+until.slice(1);
}
const distanceText=m=>m<1?t('At the building'):num(Math.max(5,Math.round(m/5)*5))+' m';
const purposeText=s=>s&&s.length>160?s.slice(0,157).trimEnd()+'…':s;

// Card section: construction work within 200 m, nearest first. Ton chose the list
// and what each row shows (13 Oct 2026).
export function constructionSection(point,construction){
 const section=el('section','construction');
 section.append(el('h3',null,t('Construction · within {r} m',{r:construction?.data.radiusM??200})));
 if(!construction){section.append(el('p','note',t('Construction data unavailable or still loading.')));return section;}
 const found=construction.near(point),colors=construction.colors(),rules=construction.data.rules;
 if(!found.length)section.append(el('p','construction-summary',t('No construction permits within {r} m.',{r:construction.data.radiusM})));
 else{
  const counts=CONSTRUCTION_LEVELS.map(l=>[l.key,found.filter(f=>f.work.level===l.key).length]).filter(([,n])=>n);
  const upcoming=found.filter(f=>f.status==='upcoming').length;
  section.append(el('p','construction-summary',tn(found.length,'{n} job','{n} jobs')+': '+counts.map(([k,n])=>t('{n} {what}',{n:num(n),what:level(k).toLocaleLowerCase(locale())})).join(', ')+(upcoming?'. '+t('{n} not started yet.',{n:num(upcoming)}):'.')));
  const list=el('ul','construction-list');
  for(const {work,distanceM,status} of found){
   const item=el('li','construction-work'),head=el('div','work-head');
   const tag=el('span','work-level'),swatch=el('i');swatch.style.background=colors[work.level];
   tag.append(swatch,document.createTextNode(level(work.level)));
   head.append(tag,el('strong','work-kind',t(rules[work.rule].label)),el('span','work-distance',distanceText(distanceM)));
   item.append(head,el('p','work-when',whenText(work,status)));
   if(work.address){const where=el('p','work-where',shortAddress(work.address).replace(/ and more$/,t(' and more')));where.title=work.address;item.append(where);}
   if(work.purpose){const fi=el('p','work-purpose',purposeText(work.purpose));fi.lang='fi';fi.title=work.purpose;item.append(fi);}
   list.append(item);
  }
  section.append(list);
 }
 section.append(el('p','note',t('From the City of Helsinki\'s digging notices and street area rentals, prepared {date}. Heavy, medium and light is a rough guess from the kind of work, not a noise level. Distance in a straight line from the middle of the building to the nearest edge of the work area. Work areas are drawn roughly, and private building sites that rent no street space are missing. City of Helsinki, CC BY 4.0.',{date:date(construction.data.source.preparedFor)})));
 return section;
}

// Noise view, Construction picked: one square per level in the map colours.
export function constructionLegend(container,construction){
 const colors=construction.colors();
 legendKeys(container,{title:t('Construction work'),items:CONSTRUCTION_LEVELS.map(l=>({color:colors[l.key],text:t(l.label),square:true}))});
}
