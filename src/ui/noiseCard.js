import {NOISE_SCALE,NOISE_VIEW_MODES} from '../map/noise.js';
import {bandLabel,noiseReason} from '../data/noise.js';
import {legendGradient} from './legend.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};
const NO_BAND='No band';

// Card rows: one per mode plus All. Missing stays "No band", never 0 dB.
export function noiseSection(record,noise){
 const section=el('section','noise');
 section.append(el('h3',null,'Traffic noise · modelled'));
 if(!noise){section.append(el('p','note','Noise data unavailable or still loading.'));return section;}
 if(!record.noise){section.append(el('p','note','No noise bands for this building yet. Run npm run data:noise.'));return section;}
 section.append(el('p','noise-reason',noiseReason(record.noise,lo=>noise.band(lo))??'Quieter than 45 dB at and around this building, or outside the modelled area.'));
 const grid=el('dl','noise-modes');
 for(const mode of NOISE_VIEW_MODES){
  const band=noise.band(noise.bandOf(record,mode.key));
  const cell=el('div',band?'noise-mode':'noise-mode is-missing');
  cell.append(el('dt',null,mode.key==='all'?'Loudest source':mode.label),el('dd',null,band?bandLabel(band):NO_BAND));
  grid.append(cell);
 }
 section.append(grid);
 section.append(el('p','note','Modelled day-evening-night average (Lden) from the City of Helsinki '+noise.meta.studyYear+' noise study, the loudest level at the building\'s centre or within 10 m of it. Not a measurement: the level at a given window can differ. The loudest source is not a sum of the others. No band means below 45 dB or outside the modelled area.'));
 return section;
}

// Noise view: the colour bar in the legend, the source switch in its own panel.
export function noiseLegend(container,switchPanel,noise,onMode){
 const bands=noise.meta.bands;
 legendGradient(container,{colors:NOISE_SCALE,start:String(bands[0].lo),end:bands.at(-1).lo+'+'});
 const modes=el('div','noise-mode-switch');modes.setAttribute('role','group');modes.setAttribute('aria-label','Noise source');
 for(const mode of NOISE_VIEW_MODES){
  const b=el('button',null,mode.label);b.type='button';b.setAttribute('aria-pressed',String(noise.mode===mode.key));
  b.onclick=()=>onMode(mode.key);modes.append(b);
 }
 switchPanel.replaceChildren(modes);
}
