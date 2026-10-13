import {loadJson} from '../data/load.js';
import {NOISE_MODES,isApartmentBuilding} from '../data/noise.js';
import {colorAt} from './ramp.js';
// Noise view colours the buildings by their modelled band (layers.json, data:noise).
// Cyan (quiet) through green, yellow, orange and red to purple (loud), colours taken
// from Ton's image. Each 5 dB band gets the colour at its place on that scale.
export const NOISE_SCALE=['#14c4d2','#1dc688','#4fc94d','#cbce2a','#f1ac1a','#f47a11','#e85415','#db321c','#ca172c','#a4117e','#7117f6'];
export const NOISE_COLORS=Array.from({length:7},(_,i)=>colorAt(NOISE_SCALE,i/6));
export const NO_BAND_COLOR='#cfcfca';
export const NOISE_VIEW_MODES=[{key:'all',label:'All'},...NOISE_MODES.map(({key,label})=>({key,label}))];
export async function loadNoise(){
 const {noise}=await loadJson('/layers.json');
 if(noise.bands.length!==NOISE_COLORS.length)throw new Error('Noise data has '+noise.bands.length+' bands but the map has '+NOISE_COLORS.length+' colours');
 const step=new Map(noise.bands.map((b,i)=>[b.lo,i]));
 let mode='all';
 return {meta:noise,
  get mode(){return mode;},
  setMode(m){mode=NOISE_VIEW_MODES.some(v=>v.key===m)?m:'all';},
  // Band (lower dB) for a building in a mode, or null: no band at its centre or within 10 m.
  bandOf(record,m=mode){return record?.noise?.[m]??null;},
  band(lo){return noise.bands[step.get(lo)]??null;},
  // Apartment buildings only; every other building stays plain (null).
  colorOf(record){if(!isApartmentBuilding(record))return null;const lo=this.bandOf(record);return lo==null?NO_BAND_COLOR:NOISE_COLORS[step.get(lo)]??NO_BAND_COLOR;}
 };
}
