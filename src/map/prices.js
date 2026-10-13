import * as Cesium from 'cesium';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import {loadJson} from '../data/load.js';
import {colorAt} from './ramp.js';
// Price view colours the buildings by their postal area's value on a smooth scale
// from the lowest area (teal) to the highest (coral). Colours taken from Ton's image.
export const PRICE_COLORS=['#59b9ae','#6fc1af','#85cab0','#9ecfad','#bad3a8','#d6d6a2','#ddc992','#e4bc82','#e3ab76','#d99670','#cf8169'];
export const priceValue=(value,units)=>value==null?'Unavailable':value.toLocaleString('en-GB',{maximumFractionDigits:units==='EUR/m²'||units==='€/month'?0:2})+' '+units;
const bboxOf=geometry=>{const b=[Infinity,Infinity,-Infinity,-Infinity];for(const poly of geometry.coordinates)for(const [x,y] of poly[0]){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}return b;};
export async function loadPrices(viewer,manifest) {
 const data=await loadJson('/price-by-area.json'),boxes={},ranges={},colors={};
 for(const [metric,m] of Object.entries(data.metrics))boxes[metric]=m.areas.map(a=>bboxOf(a.geometry));
 const areaAt=(metric,[x,y])=>data.metrics[metric].areas.find((a,i)=>{const b=boxes[metric][i];
  return x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]&&booleanPointInPolygon([x,y],{type:'Feature',properties:{},geometry:a.geometry});})??null;
 // Rent view uses current ads (median monthly rent of two-room flats) when they are loaded;
 // otherwise the official per m² statistic.
 let rentFromAds=null,adsNote=null;
 const valueOf=(metric,area)=>metric==='rent'&&rentFromAds?rentFromAds(area.postcode):area.values[1];
 // Lowest and highest area value: the two ends of the colour scale.
 const rangeFor=metric=>ranges[metric]??=(values=>[Math.min(...values),Math.max(...values)])(
  data.metrics[metric].areas.map(a=>valueOf(metric,a)).filter(Number.isFinite));
 // buildingId -> colour or null, worked out once per metric when first shown.
 const colorsFor=metric=>colors[metric]??=new Map(manifest.map(r=>{
  const area=areaAt(metric,r.position),value=area?valueOf(metric,area):null,[lo,hi]=rangeFor(metric);
  return [r.buildingId,Number.isFinite(value)?colorAt(PRICE_COLORS,hi>lo?(value-lo)/(hi-lo):0):null];
 }));
 let current=null;
 return {data,areaAt,valueOf,
  get metric(){return current;},
  range:metric=>rangeFor(metric),
  describe(metric){
   const m=data.metrics[metric];
   if(metric==='rent'&&rentFromAds)return {title:'Rent · current ads',note:'Two-room flats · median asking rent per month · '+adsNote,units:'€/month'};
   return {title:(metric==='sale'?'Sale':'Rent')+' · '+m.periodLabels[1]+(m.archived?' · archived':''),note:m.category+' · '+m.units,units:m.units};
  },
  setRentFromAds(fn,note){rentFromAds=fn;adsNote=note;delete colors.rent;delete ranges.rent;if(current==='rent')colorsFor('rent');},
  setMetric(metric){current=data.metrics[metric]?metric:null;if(current)colorsFor(current);},
  // Colour for a building in the current price view, or null (no view, or no data).
  colorOf(buildingId){return current?colors[current].get(buildingId)??null:null;},
  // Screen point -> postal area under it, by testing the ground point against the areas.
  pick(position){
   if(!current)return null;
   const ground=viewer.camera.pickEllipsoid(position);if(!ground)return null;
   const c=Cesium.Cartographic.fromCartesian(ground);
   const area=areaAt(current,[Cesium.Math.toDegrees(c.longitude),Cesium.Math.toDegrees(c.latitude)]);
   return area?{metric:current,area,value:valueOf(current,area)}:null;
  }
 };
}
