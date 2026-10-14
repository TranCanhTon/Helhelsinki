import * as Cesium from 'cesium';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import {loadJson} from '../data/load.js';
import {colorAt} from './ramp.js';
// Price view colours the ground, not the buildings (Ton, 14 Oct 2026): each postal
// area is a see-through fill with a solid outline, on a smooth scale from the lowest
// area (teal) to the highest (coral), so the buildings keep their photos. Colours
// taken from Ton's image. An area without a value is not drawn: missing stays missing.
export const PRICE_COLORS=['#59b9ae','#6fc1af','#85cab0','#9ecfad','#bad3a8','#d6d6a2','#ddc992','#e4bc82','#e3ab76','#d99670','#cf8169'];
const FILL_ALPHA=0.5;
export const priceValue=(value,units)=>value==null?'Unavailable':value.toLocaleString('en-GB',{maximumFractionDigits:units==='EUR/m²'||units==='€/month'?0:2})+' '+units;
const bboxOf=geometry=>{const b=[Infinity,Infinity,-Infinity,-Infinity];for(const poly of geometry.coordinates)for(const [x,y] of poly[0]){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}return b;};
const ring=r=>Cesium.Cartesian3.fromDegreesArray(r.slice(0,-1).flat());
export async function loadPrices(viewer) {
 const data=await loadJson('/price-by-area.json'),boxes={},ranges={};
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
 const colorFor=(metric,area)=>{
  const value=valueOf(metric,area),[lo,hi]=rangeFor(metric);
  return Number.isFinite(value)?Cesium.Color.fromCssColorString(colorAt(PRICE_COLORS,hi>lo?(value-lo)/(hi-lo):0)):null;
 };
 // The areas of one metric on the ground, or nothing.
 let current=null,drawn=null;
 const draw=()=>{
  if(drawn){viewer.scene.primitives.remove(drawn.fill);viewer.scene.primitives.remove(drawn.edges);drawn=null;}
  if(current){
   const instances=[],edges=new Cesium.PolylineCollection();
   for(const area of data.metrics[current].areas){
    const color=colorFor(current,area);if(!color)continue;
    for(const [outer,...holes] of area.geometry.coordinates){
     instances.push(new Cesium.GeometryInstance({
      geometry:new Cesium.PolygonGeometry({polygonHierarchy:new Cesium.PolygonHierarchy(ring(outer),holes.map(h=>new Cesium.PolygonHierarchy(ring(h)))),
       height:0.3,vertexFormat:Cesium.PerInstanceColorAppearance.FLAT_VERTEX_FORMAT}),
      attributes:{color:Cesium.ColorGeometryInstanceAttribute.fromColor(color.withAlpha(FILL_ALPHA))},
     }));
     for(const r of [outer,...holes])edges.add({positions:Cesium.Cartesian3.fromDegreesArrayHeights(r.flatMap(([x,y])=>[x,y,0.5])),width:1.5,material:Cesium.Material.fromType('Color',{color})});
    }
   }
   drawn={
    fill:viewer.scene.primitives.add(new Cesium.Primitive({geometryInstances:instances,appearance:new Cesium.PerInstanceColorAppearance({flat:true,translucent:true})})),
    edges:viewer.scene.primitives.add(edges),
   };
  }
  viewer.scene.requestRender();
 };
 return {data,areaAt,valueOf,
  get metric(){return current;},
  range:metric=>rangeFor(metric),
  describe(metric){
   const m=data.metrics[metric];
   if(metric==='rent'&&rentFromAds)return {title:'Rent · current ads',note:'Two-room flats · median asking rent per month · '+adsNote,units:'€/month'};
   return {title:(metric==='sale'?'Sale':'Rent')+' · '+m.periodLabels[1]+(m.archived?' · archived':''),note:m.category+' · '+m.units,units:m.units};
  },
  setRentFromAds(fn,note){rentFromAds=fn;adsNote=note;delete ranges.rent;if(current==='rent')draw();},
  // metric: 'sale' or 'rent' draws its areas; anything else clears the ground.
  setMetric(metric){const next=data.metrics[metric]?metric:null;if(next===current)return;current=next;draw();},
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
