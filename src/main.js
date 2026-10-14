import * as Cesium from 'cesium';
import {createViewer} from './map/createViewer.js';
import {Navigation} from './map/navigation.js';
import {loadBuildings} from './map/buildings.js';
import {loadBasemap} from './map/basemap.js';
import {loadLabels} from './map/context.js';
import {loadPrices,priceValue,PRICE_COLORS} from './map/prices.js';
import {loadNoise} from './map/noise.js';
import {noiseLegend} from './ui/noiseCard.js';
import {loadParking} from './map/parking.js';
import {loadTransit} from './map/transit.js';
import {parkingLegend} from './ui/parkingCard.js';
import {legendGradient} from './ui/legend.js';
import {BuildingCard} from './ui/buildingCard.js';
import {indexListings} from './data/listings.js';
import {AddressSearch} from './ui/search.js';
import {readState,writeState} from './data/urlState.js';
import './styles.css';
const $=selector=>document.querySelector(selector);
const HOME={lon:24.9480,lat:60.1835,heading:20,pitch:-40,range:1400};
const initial=readState(location.search,HOME),state={...initial};
const viewer=createViewer('scene');
const frame=Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(HOME.lon,HOME.lat));
const lightDirection=Cesium.Matrix4.multiplyByPointAsVector(frame,new Cesium.Cartesian3(0.6,0.5,-0.6),new Cesium.Cartesian3());
viewer.scene.light=new Cesium.DirectionalLight({direction:Cesium.Cartesian3.normalize(lightDirection,lightDirection),intensity:2.2});
let urlTimer,canWrite=false;
const save=()=>{if(!canWrite)return;clearTimeout(urlTimer);urlTimer=setTimeout(()=>writeState(state,nav.state),250);};
const nav=new Navigation(viewer,HOME,(camera,navigation)=>{
 $('#compass').style.transform='rotate('+(-camera.heading)+'deg)';
 $('#tool-overhead').textContent=camera.pitch<-80?'3D':'2D';
 const metres=navigation.metersPerPixel()*80;
 $('#scale-label').textContent=metres>=1000?(metres/1000).toFixed(1)+' km':Math.round(metres/10)*10+' m';
 save();
});
Object.assign(nav.state,initial.camera);nav.apply();
for(const [id,action] of Object.entries({'home':()=>nav.goHome(),'zoom-in':()=>nav.zoom(0.75),'zoom-out':()=>nav.zoom(1.33),'overhead':()=>nav.toggleOverhead(),'north':()=>nav.faceNorth()}))$('#tool-'+id).onclick=action;
function unavailable(label,error,retry){
 console.warn(label,error);
 const row=document.createElement('div');row.className='data-error';row.textContent=label+' unavailable. ';
 const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>{row.remove();retry();};row.append(b);$('#data-status').append(row);
}
let basemap,prices,noise,parking,transit,listings,buildings,card,marker,currentAddress=null;
async function ground(){
 try{basemap=await loadBasemap(viewer);basemap.setTheme(state.theme);}
 catch(e){unavailable('Ground map',e,ground);}
}
async function priceLayer(){
 try{
  prices=await loadPrices(viewer,buildings.manifest);useAds();setMetric(state.metric);
  card?.refresh();
 }catch(e){$('#price-legend').textContent='Postal-area prices unavailable.';unavailable('Prices',e,priceLayer);}
}
// Current Oikotie ads (npm run data:listings). Checked again every 10 minutes,
// so ads collected by the background job show up without a reload.
async function adsLayer(){
 try{
  const response=await fetch('/listings.json',{cache:'no-cache'});
  if(!response.ok||!(response.headers.get('content-type')??'').includes('json'))return;
  const data=await response.json();
  if(listings?.updatedAt===data.updatedAt)return;
  listings=indexListings(data);useAds();
  if(prices)setMetric(state.metric);
  card?.refresh();
 }catch(e){console.warn('Rental ads unavailable',e);}
}
function useAds(){
 if(!prices||!listings)return;
 const time=new Date(listings.updatedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
 prices.setRentFromAds(postcode=>listings.stats.get(postcode)?.groups['2'].rent??null,listings.ads.length.toLocaleString('en-GB')+' Oikotie ads, '+time);
}
async function noiseLayer(){
 try{noise=await loadNoise();noise.setMode(state.noiseMode);if(state.metric==='noise')setMetric('noise');card?.refresh();}
 catch(e){unavailable('Noise',e,noiseLayer);}
}
async function parkingLayer(){
 try{parking=await loadParking(viewer);parking.setTheme(state.theme);if(state.metric==='parking')setMetric('parking');card?.refresh();}
 catch(e){unavailable('Parking',e,parkingLayer);}
}
async function transitLayer(){
 try{
  // Homes: the stop pins only show near residential buildings.
  const homes=buildings.manifest.filter(r=>/apartment|detached house|row house|residential/i.test(r.classEn??r.useEn??'')).map(r=>r.position);
  transit=await loadTransit(viewer,nav,homes);card?.refresh();
 }catch(e){unavailable('Public transport',e,transitLayer);}
}
function setNoiseMode(mode){noise.setMode(mode);state.noiseMode=noise.mode;setMetric('noise');}
function setMetric(metric){
 state.metric=metric;viewer.canvas.style.cursor='';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===metric)));
 prices?.setMetric(metric);
 const legend=$('#price-legend');legend.hidden=metric==='overview';$('#noise-switch').hidden=metric!=='noise';
 parking?.setVisible(metric==='parking');
 if(metric==='parking'){
  buildings?.setColoring(null);
  if(parking)parkingLegend(legend,parking);else legend.textContent='Parking data is still loading or unavailable.';
  $('#area-info').hidden=true;save();return;
 }
 if(metric==='noise'){
  buildings?.setColoring(noise?id=>noise.colorOf(buildings.records.get(id)):null,'#c2622f');
  legend.replaceChildren();
  if(noise)noiseLegend(legend,$('#noise-switch'),noise,setNoiseMode);else legend.textContent='Noise data is still loading or unavailable.';
  $('#area-info').hidden=true;save();return;
 }
 buildings?.setColoring(prices&&metric!=='overview'?id=>prices.colorOf(id):null,'#c2622f');
 if(prices&&metric!=='overview'){
  const [lo,hi]=prices.range(metric),fmt=v=>Math.round(v).toLocaleString('en-GB');
  legendGradient(legend,{colors:PRICE_COLORS,start:fmt(lo),end:fmt(hi)});
 }
 $('#area-info').hidden=true;save();
}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>setMetric(b.dataset.view);
// Light/dark switch in the tool bar. The icon shows the mode you switch to.
const SUN='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
const MOON='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function paintTheme(){
 document.documentElement.dataset.theme=state.theme;
 const b=$('#tool-theme');b.innerHTML=state.theme==='day'?MOON:SUN;b.title=state.theme==='day'?'Dark mode':'Light mode';b.setAttribute('aria-label',b.title);
}
$('#tool-theme').onclick=()=>{
 state.theme=state.theme==='day'?'dusk':'day';basemap?.setTheme(state.theme);parking?.setTheme(state.theme);
 paintTheme();setMetric(state.metric);card?.refresh();
};
paintTheme();
function clearSelection(){
 state.building=null;currentAddress=null;buildings?.setSelected(null);card?.hide();
 if(marker)viewer.entities.remove(marker);marker=null;viewer.scene.requestRender();save();
}
// The full record comes with its tile's detail file; the card opens when it is in.
async function selectBuilding(id,fly=true){
 const record=buildings.records.get(id);if(!record)return;
 clearSelection();state.building=id;buildings.setSelected(id);
 if(fly)nav.flyTo(record.position,420);save();
 try{
  const full=await buildings.detail(id);
  if(!full)throw new Error('Building '+id+' is missing from its detail file. Run npm run data:split');
  if(state.building===id)card.show(id,full);
 }catch(e){if(state.building===id)unavailable('Building details',e,()=>selectBuilding(id,false));}
}
function selectAddress(row){
 clearSelection();currentAddress=row;
 if(row.buildingIds.length===1){selectBuilding(row.buildingIds[0]);return;}
 nav.flyTo(row.position,500);
 if(row.buildingIds.length>1){
  card.showChoices(row,row.buildingIds.map(id=>buildings.records.get(id)).filter(Boolean),id=>selectBuilding(id));return;
 }
 marker=viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(...row.position),point:{pixelSize:12,color:Cesium.Color.fromCssColorString('#c2622f'),outlineColor:Cesium.Color.WHITE,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
 card.showAddress(row);viewer.scene.requestRender();
}
function areaInfo(hit){
 const node=$('#area-info');node.hidden=!hit;
 if(!hit)return;
 const d=prices.describe(hit.metric),a=hit.area;
 node.textContent=a.postcode+' '+a.name+' · '+priceValue(hit.value,d.units)+' · '+d.title;
}
// Stop pin under the pointer (pins show in every view when zoomed in).
const layerPick=position=>transit?.pick(position)??null;
function showInfo(text){const node=$('#area-info');node.hidden=!text;if(text)node.textContent=text;}
async function start(){
 buildings=await loadBuildings(viewer);
 card=new BuildingCard($('#building-card'),clearSelection,()=>prices,()=>listings,()=>noise,()=>parking,()=>transit);
 const search=new AddressSearch($('#search'),selectAddress);
 const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
 handler.setInputAction(click=>{
  if(nav.dragged)return;
  const spot=layerPick(click.position);
  if(spot){showInfo(spot.text);if(spot.zoomTo)nav.flyTo(spot.zoomTo,Math.max(150,nav.state.range/3));return;}
  const hit=buildings.pick(click.position);
  if(hit){selectBuilding(hit.buildingId,false);return;}
  const area=prices?.pick(click.position);if(area){areaInfo(area);return;}
  clearSelection();
 },Cesium.ScreenSpaceEventType.LEFT_CLICK);
 let hoverTime=0;
 handler.setInputAction(move=>{
  if(performance.now()-hoverTime<100)return;hoverTime=performance.now();
  const spot=layerPick(move.endPosition);viewer.canvas.style.cursor=spot?'pointer':'';
  if(spot){showInfo(spot.text);return;}
  if(state.metric==='overview'||state.metric==='parking'){$('#area-info').hidden=true;return;}
  areaInfo(prices?.pick(move.endPosition));
 },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.id!=='address-query')clearSelection();});
 if(state.building && buildings.records.has(state.building))selectBuilding(state.building,false);else state.building=null;
 canWrite=true;save();
 $('#loading').hidden=true;
 window.__lens={Cesium,viewer,nav,buildings,card,search,selectAddress,selectBuilding,setMetric,get prices(){return prices;},get listings(){return listings;},get noise(){return noise;},get parking(){return parking;},get transit(){return transit;},ready:true};
 ground();
 loadLabels(viewer,nav).catch(e=>unavailable('Place labels',e,()=>loadLabels(viewer,nav)));
 priceLayer();
 noiseLayer();
 parkingLayer();
 transitLayer();
 adsLayer();setInterval(adsLayer,10*60*1000);
 const counts=new Map();
 for(const r of buildings.manifest){const d=r.district;if(d){const entry=counts.get(d.id)??{...d,count:0};entry.count++;counts.set(d.id,entry);}}
 const content=$('#neighbourhood-list');
 for(const d of [...counts.values()].sort((a,b)=>b.count-a.count)){
  const b=document.createElement('button');b.textContent=d.nameFi.toLocaleLowerCase('fi')+' · '+d.count.toLocaleString('en-GB');
  b.onclick=()=>{const rows=buildings.manifest.filter(r=>r.district?.id===d.id);nav.flyTo([rows.reduce((s,r)=>s+r.position[0],0)/rows.length,rows.reduce((s,r)=>s+r.position[1],0)/rows.length],1800);};content.append(b);
 }
}
start().catch(error=>{
 console.error(error);$('#loading-text').textContent='The 3D buildings could not load: '+error.message;
 const retry=document.createElement('button');retry.className='retry';retry.textContent='Try again';retry.onclick=()=>location.reload();$('#loading').append(retry);$('.spinner')?.remove();
 window.__lens={viewer,nav,ready:true,error:error.message};
});

