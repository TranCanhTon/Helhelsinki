import {NOISE_SCALE,NOISE_VIEW_MODES} from '../map/noise.js';
import {noiseReason} from '../data/noise.js';
import {legendGradient} from './legend.js';
import {t,getLang} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
// Band and reason in the chosen language.
const band=b=>b.hi==null?t('{lo} dB and above',{lo:b.lo}):t('{lo} to {hi} dB',{lo:b.lo,hi:b.hi});
const FI_WORDS={road:['Tieliikenne on','tieliikenne'],rail:['Junat ovat','junat'],metro:['Metro on','metro'],tram:['Raitiovaunut ovat','raitiovaunut']};
const reason=(bands,bandOf)=>getLang()==='fi'
 ?noiseReason(bands,bandOf,{words:FI_WORDS,label:band,loudest:'{who} tässä kovin melulähde ({band}).',also:'Lisäksi {list}.'})
 :noiseReason(bands,bandOf);

// Card rows: one per mode plus All. Missing stays "No band", never 0 dB.
export function noiseSection(record,noise){
 const section=el('section','noise');
 section.append(el('h3',null,t('Traffic noise · modelled')));
 if(!noise){section.append(el('p','note',t('Noise data unavailable or still loading.')));return section;}
 if(!record.noise){section.append(el('p','note',t('No noise bands for this building yet. Run npm run data:noise.')));return section;}
 section.append(el('p','noise-reason',reason(record.noise,lo=>noise.band(lo))??t('Quieter than 45 dB at and around this building, or outside the modelled area.')));
 const grid=el('dl','noise-modes');
 for(const mode of NOISE_VIEW_MODES){
  const b=noise.band(noise.bandOf(record,mode.key));
  const cell=el('div',b?'noise-mode':'noise-mode is-missing');
  cell.append(el('dt',null,t(mode.key==='all'?'Loudest source':mode.label)),el('dd',null,b?band(b):t('No band')));
  grid.append(cell);
 }
 section.append(grid);
 section.append(el('p','note',t('Modelled day-evening-night average (Lden) from the City of Helsinki {year} noise study, the loudest level at the building\'s centre or within 10 m of it. Not a measurement: the level at a given window can differ. The loudest source is not a sum of the others. No band means below 45 dB or outside the modelled area.',{year:noise.meta.studyYear})));
 return section;
}

// Noise view: the colour bar in the legend.
export function noiseLegend(container,noise){
 const bands=noise.meta.bands;
 legendGradient(container,{colors:NOISE_SCALE,start:String(bands[0].lo),end:bands.at(-1).lo+'+'});
}

// The noise sources plus Construction (Ton, 13 Oct 2026), stacked on the left of the map.
export const NOISE_SWITCH_MODES=[...NOISE_VIEW_MODES,{key:'construction',label:'Construction'}];
export function noiseSwitch(panel,current,onMode){
 const modes=el('div','noise-mode-switch');modes.setAttribute('role','group');modes.setAttribute('aria-label',t('Noise source'));
 for(const mode of NOISE_SWITCH_MODES){
  const b=el('button',null,t(mode.label));b.type='button';b.setAttribute('aria-pressed',String(current===mode.key));
  b.onclick=()=>onMode(mode.key);modes.append(b);
 }
 panel.replaceChildren(modes);
}
