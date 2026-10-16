import * as Cesium from 'cesium';
import {createViewer} from './map/createViewer.js';
import {Navigation} from './map/navigation.js';
import {loadBuildings} from './map/buildings.js';
import {loadBasemap} from './map/basemap.js';
import {loadLabels} from './map/context.js';
import {loadPrices,priceValue,PRICE_COLORS} from './map/prices.js';
import {loadNoise} from './map/noise.js';
import {noiseLegend,noiseSwitch} from './ui/noiseCard.js';
import {screenFinder} from './map/screenPick.js';
import {loadParking} from './map/parking.js';
import {loadTransit} from './map/transit.js';
import {parkingLegend} from './ui/parkingCard.js';
import {loadConstruction} from './map/construction.js';
import {constructionLegend} from './ui/constructionCard.js';
import {createSunShadows} from './map/sun.js';
import {createSunPanel} from './ui/sunPanel.js';
import {loadStationTrains} from './map/stationTrains.js';
import {createSelectionGlow} from './map/selectionGlow.js';
import {createViewFade} from './map/viewFade.js';
import {createWalkRings} from './map/walkRings.js';
import {legendGradient} from './ui/legend.js';
import {BuildingCard} from './ui/buildingCard.js';
import {indexListings} from './data/listings.js';
import {adsLegend} from './ui/adsPanel.js';
import {nearestPlaces} from './data/places.js';
import {loadJson,dataUrl} from './data/load.js';
import {AddressSearch} from './ui/search.js';
import {createLanding} from './ui/landing.js';
import {t,num,locale,setLang,translatePage} from './ui/i18n.js';
import {readState,writeState} from './data/urlState.js';
import '@fontsource/syne/800.css';
import '@fontsource/khand/600.css';
import '@fontsource/instrument-serif/400.css';
import './styles.css';
const $=selector=>document.querySelector(selector);
const HOME={lon:24.9480,lat:60.1835,heading:20,pitch:-40,range:1400};
const initial=readState(location.search,HOME),state={...initial};
setLang(state.lang);translatePage();
const viewer=createViewer('scene');
const frame=Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(HOME.lon,HOME.lat));
const lightDirection=Cesium.Matrix4.multiplyByPointAsVector(frame,new Cesium.Cartesian3(0.6,0.5,-0.6),new Cesium.Cartesian3());
viewer.scene.light=new Cesium.DirectionalLight({direction:Cesium.Cartesian3.normalize(lightDirection,lightDirection),intensity:2.2});
let urlTimer,canWrite=false;
const save=()=>{if(!canWrite)return;clearTimeout(urlTimer);urlTimer=setTimeout(()=>writeState(state,nav.state),250);};
const nav=new Navigation(viewer,HOME,(camera,navigation)=>{
 $('#compass').style.transform='rotate('+(-camera.heading)+'deg)';
 $('#sun-dial').style.setProperty('--heading',camera.heading.toFixed(1));
 // The button shows the view it switches to: a cube from straight above, a flat grid when tilted.
 $('#tool-overhead').dataset.next=camera.pitch<-80?'3d':'2d';
 // Haze at the far edge of a tilted view; none from straight above, where there is no horizon.
 $('.haze').style.opacity=Math.min(1,Math.max(0,(camera.pitch+85)/45)).toFixed(2);
 const metres=navigation.metersPerPixel()*80;
 $('#scale-label').textContent=metres>=1000?num(metres/1000,{minimumFractionDigits:1,maximumFractionDigits:1})+' km':Math.round(metres/10)*10+' m';
 save();
});
Object.assign(nav.state,initial.camera);nav.apply();
for(const [id,action] of Object.entries({'home':()=>nav.goHome(),'zoom-in':()=>nav.zoom(0.75),'zoom-out':()=>nav.zoom(1.33),'overhead':()=>nav.toggleOverhead(),'north':()=>nav.faceNorth()}))$('#tool-'+id).onclick=action;
function unavailable(label,error,retry){
 console.warn(label,error);
 const row=document.createElement('div');row.className='data-error';row.textContent=t('{label} unavailable. ',{label:t(label)});
 const b=document.createElement('button');b.textContent=t('Retry');b.onclick=()=>{row.remove();retry();};row.append(b);$('#data-status').append(row);
}
let basemap,prices,noise,parking,construction,transit,places,listings,buildings,sun,sunPanel,card,search,marker,currentAddress=null;
const glow=createSelectionGlow(viewer),fade=createViewFade(viewer),rings=createWalkRings(viewer);
async function ground(){
 try{basemap=await loadBasemap(viewer);}
 catch(e){unavailable('Ground map',e,ground);}
}
async function priceLayer(){
 try{
  prices=await loadPrices(viewer);prices.setLabels(canWrite);useAds();setMetric(state.metric);
  card?.refresh();
 }catch(e){$('#price-legend').textContent=t('Postal-area prices unavailable.');unavailable('Prices',e,priceLayer);}
}
// Current Oikotie ads (npm run data:listings). Checked again every 10 minutes,
// so ads collected by the background job show up without a reload.
async function adsLayer(){
 try{
  const response=await fetch(dataUrl('/listings.json'),{cache:'no-cache'});
  if(!response.ok||!(response.headers.get('content-type')??'').includes('json'))return;
  const data=await response.json();
  if(listings?.updatedAt===data.updatedAt)return;
  listings=indexListings(data);useAds();
  if(prices||state.metric==='ads')setMetric(state.metric);
  card?.refresh();
 }catch(e){console.warn('Rental ads unavailable',e);}
}
function useAds(){
 if(!prices||!listings)return;
 const ads=listings;
 // The note is worked out when shown, so it follows the language switch.
 const note=()=>t('{n} Oikotie ads, {time}',{n:num(ads.ads.length),time:new Date(ads.updatedAt).toLocaleString(locale(),{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})});
 prices.setRentFromAds(postcode=>ads.stats.get(postcode)?.groups['2'].rent??null,note);
}
async function noiseLayer(){
 try{noise=await loadNoise();noise.setMode(state.noiseMode);if(state.metric==='noise')setMetric('noise');card?.refresh();}
 catch(e){unavailable('Noise',e,noiseLayer);}
}
async function parkingLayer(){
 try{parking=await loadParking(viewer);if(state.metric==='parking')setMetric('parking');card?.refresh();}
 catch(e){unavailable('Parking',e,parkingLayer);}
}
// Construction work (data:construction): areas under Noise > Construction, list on the card.
async function constructionLayer(){
 try{construction=await loadConstruction(viewer);if(state.metric==='noise')setMetric('noise');card?.refresh();}
 catch(e){unavailable('Construction',e,constructionLayer);}
}
// Shops and services near the chosen building (data:places), on the card only.
async function placesLayer(){
 try{
  const data=await loadJson('/places.json');
  if(data.schemaVersion!==1)throw new Error('places.json is out of date. Run npm run data:places');
  places={data,nearest:nearestPlaces(data.places)};card?.refresh();
 }catch(e){unavailable('Shops and services',e,placesLayer);}
}
async function transitLayer(){
 try{
  // Homes: the stop pins only show near residential buildings.
  const homes=buildings.manifest.filter(r=>/apartment|detached house|row house|residential/i.test(r.classEn??r.useEn??'')).map(r=>r.position);
  transit=await loadTransit(viewer,nav,homes);card?.refresh();
 }catch(e){unavailable('Public transport',e,transitLayer);}
}
// Construction sits in the noise switch but is not a noise source: buildings stay plain.
function setNoiseMode(mode){
 if(mode==='construction')state.noiseMode=mode;else{noise?.setMode(mode);state.noiseMode=noise?.mode??'all';}
 setMetric('noise');
}
// Ads view (Ton, 16 Oct 2026): every building with a current ad in one bright amber,
// the rest darker than in the other coloured views and the photos covered more, so the
// ad buildings stand out from far away. No filters (Ton removed them the same day).
const AD_COLOR='#ffc247';
function paintAds(){
 if(state.metric!=='ads'||!buildings)return;
 if(!listings){buildings.setColoring(null);return;}
 const ads=listings.byBuilding;
 buildings.setColoring(id=>ads.has(id)?AD_COLOR:null,'#ffffff',{mix:0.85,rest:'#2b312e'});
}
function setMetric(metric){
 state.metric=metric;viewer.canvas.style.cursor='';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===metric)));
 prices?.setMetric(metric);
 const legend=$('#price-legend');legend.hidden=metric==='overview'||metric==='sun';$('#noise-switch').hidden=metric!=='noise';
 parking?.setVisible(metric==='parking');construction?.setVisible(metric==='noise'&&state.noiseMode==='construction');
 // Sun: shadows and the sun's light only while this tab is open.
 const sunny=metric==='sun'&&!!sun;sun?.setOn(sunny);$('#sun-panel').hidden=!sunny;$('#sun-dial').hidden=!sunny;
 if(metric==='ads'){
  paintAds();adsLegend(legend,listings,AD_COLOR);
  $('#area-info').hidden=true;save();return;
 }
 if(metric==='sun'){
  buildings?.setColoring(null);sunPanel?.show();
  $('#area-info').hidden=true;save();return;
 }
 if(metric==='parking'){
  buildings?.setColoring(null);
  if(parking)parkingLegend(legend,parking);else legend.textContent=t('Parking data is still loading or unavailable.');
  $('#area-info').hidden=true;save();return;
 }
 if(metric==='noise'){
  const work=state.noiseMode==='construction';
  // Selected building: white, since copper and red are on the noise scale.
  buildings?.setColoring(noise&&!work?id=>noise.colorOf(buildings.records.get(id)):null,'#ffffff');
  noiseSwitch($('#noise-switch'),state.noiseMode,mode=>{if(mode!==state.noiseMode)fade(()=>setNoiseMode(mode));});
  legend.replaceChildren();
  if(work){if(construction)constructionLegend(legend,construction);else legend.textContent=t('Construction data is still loading or unavailable.');}
  else if(noise)noiseLegend(legend,noise);else legend.textContent=t('Noise data is still loading or unavailable.');
  $('#area-info').hidden=true;save();return;
 }
 // Price view colours the postal areas on the ground; the buildings keep their photos (Ton, 14 Oct 2026).
 buildings?.setColoring(null);
 if(prices&&metric!=='overview'){
  const [lo,hi]=prices.range(metric),fmt=v=>num(Math.round(v));
  legendGradient(legend,{colors:PRICE_COLORS,title:t('Sale price · €/m²'),start:fmt(lo),end:fmt(hi)});
 }
 $('#area-info').hidden=true;save();
}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{if(b.dataset.view!==state.metric)fade(()=>setMetric(b.dataset.view));};
// English / Finnish switch in the tool bar (Ton, 14 Oct 2026). The button shows the language you switch to.
function paintLang(){
 const b=$('#tool-lang');b.textContent=state.lang==='fi'?'EN':'FI';b.title=state.lang==='fi'?'In English':'Suomeksi';b.setAttribute('aria-label',b.title);
}
$('#tool-lang').onclick=()=>{
 state.lang=state.lang==='fi'?'en':'fi';setLang(state.lang);translatePage();paintLang();
 search?.translate();neighbourhoodList();prices?.refresh();setMetric(state.metric);card?.refresh();nav.apply();
};
paintLang();
function clearSelection(){
 state.building=null;currentAddress=null;buildings?.setSelected(null);card?.hide();glow.show(null);rings.show(null);
 if(marker)viewer.entities.remove(marker);marker=null;viewer.scene.requestRender();save();
}
// The full record comes with its tile's detail file; the card opens when it is in.
// Camera distance at which the scale bar (80 px) shows `metres`.
// Heading equal to `target` that is the short way round from where the camera faces now.
const nearestHeading=target=>{const h=nav.state.heading;return h+(((target-h)%360)+540)%360-180;};
const rangeForScale=metres=>metres/80*viewer.canvas.clientHeight/(2*Math.tan((viewer.camera.frustum.fovy??Math.PI/3)/2));
// fly: true flies close (search), 'ease' moves to a clicked building: always the same
// zoom (scale bar 35 m) and the base angle turned 6 degrees, so picking one building
// after another does not keep zooming in or turning (Ton, 16 Oct 2026). false keeps
// the camera (link, retry).
async function selectBuilding(id,fly=true){
 const record=buildings.records.get(id);if(!record)return;
 clearSelection();state.building=id;buildings.setSelected(id);glow.show(record.position);rings.show(record.position);
 if(fly==='ease')nav.flyTo(record.position,rangeForScale(35),{heading:HOME.heading+6,pitch:HOME.pitch},1200);
 else if(fly)nav.flyTo(record.position,420);
 save();
 try{
  const full=await buildings.detail(id);
  if(!full)throw new Error('Building '+id+' is missing from its detail file. Run npm run data:split');
  if(state.building===id)card.show(id,full);
 }catch(e){if(state.building===id)unavailable('Building details',e,()=>selectBuilding(id,false));}
}
// Closing the card (×, Escape or a click on empty map): zoom out to a 60 m scale bar
// and turn back to the base angle, staying over the same place (Ton, 16 Oct 2026).
function closeCard(){
 const open=!!state.building;
 clearSelection();
 if(open)nav.flyTo([nav.state.lon,nav.state.lat],rangeForScale(60),{heading:HOME.heading,pitch:HOME.pitch},1100);
}
function selectAddress(row){
 clearSelection();currentAddress=row;
 if(row.buildingIds.length===1){selectBuilding(row.buildingIds[0]);return;}
 nav.flyTo(row.position,500);
 if(row.buildingIds.length>1){
  card.showChoices(row,row.buildingIds.map(id=>buildings.records.get(id)).filter(Boolean),id=>selectBuilding(id));return;
 }
 marker=viewer.entities.add({position:Cesium.Cartesian3.fromDegrees(...row.position),point:{pixelSize:12,color:Cesium.Color.fromCssColorString('#c2622f'),outlineColor:Cesium.Color.WHITE,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
 rings.show(row.position);card.showAddress(row);viewer.scene.requestRender();
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
// "Scroll to zoom · Shift + drag to rotate" fades after the first zoom or drag on the
// map, and stays gone on later visits (only a convenience, so storage may fail).
function hintOnce(){
 const hint=$('.hint'),key='daroad.hintDone';
 const done=()=>{hint.classList.add('is-done');try{localStorage.setItem(key,'1');}catch{}};
 try{if(localStorage.getItem(key)){hint.classList.add('is-done');return;}}catch{}
 viewer.canvas.addEventListener('wheel',done,{once:true,passive:true});
 viewer.canvas.addEventListener('pointermove',e=>{if(e.buttons)done();},{passive:true});
}
hintOnce();
// The URL only follows the camera after the landing, not its slow turn.
const landing=createLanding(nav,()=>{canWrite=true;prices?.setLabels(true);save();});
async function start(){
 buildings=await loadBuildings(viewer);
 sun=createSunShadows(viewer,buildings.tileset);sunPanel=createSunPanel($('#sun-panel'),$('#sun-dial'),sun);
 if(state.metric==='sun')setMetric('sun');
 card=new BuildingCard($('#building-card'),closeCard,()=>prices,()=>listings,()=>noise,()=>parking,()=>transit,()=>construction,()=>places);
 search=new AddressSearch($('#search'),selectAddress);
 const handler=new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
 handler.setInputAction(click=>{
  if(nav.dragged)return;
  $('#hover-tip').hidden=true;
  const spot=layerPick(click.position);
  if(spot){showInfo(spot.text);if(spot.zoomTo)nav.flyTo(spot.zoomTo,Math.max(150,nav.state.range/3));return;}
  const hit=buildings.pick(click.position);
  if(hit){selectBuilding(hit.buildingId,'ease');return;}
  const area=prices?.pick(click.position);if(area){areaInfo(area);return;}
  closeCard();
 },Cesium.ScreenSpaceEventType.LEFT_CLICK);
 let hoverTime=0;
 // Hover preview (Ton, 15 Oct 2026): address and type of the building under the
 // mouse, in a fixed box at the top middle (Ton, 16 Oct 2026: not following the mouse). Found by screen distance to each addressed
 // building's point 12 m up (about mid height), not by scene.pick, which is slow.
 const addressed=buildings.manifest.filter(r=>r.address),findBuilding=screenFinder(viewer,addressed.map(r=>r.position),12);
 const tip=$('#hover-tip');
 const hoverTip=position=>{
  const r=position?addressed[findBuilding(position,26)]:null;
  if(!r){tip.hidden=true;return null;}
  const line=document.createElement('span');line.textContent=r.classEn??r.useEn?t(r.classEn??r.useEn):'';
  const name=document.createElement('strong');name.textContent=r.address;
  tip.replaceChildren(name,line);tip.hidden=false;return r;
 };
 viewer.canvas.addEventListener('pointermove',e=>{if(e.buttons)tip.hidden=true;});
 viewer.canvas.addEventListener('pointerleave',()=>{tip.hidden=true;});
 handler.setInputAction(move=>{
  if(performance.now()-hoverTime<100)return;hoverTime=performance.now();
  const spot=layerPick(move.endPosition);
  const building=spot||nav.dragged?hoverTip(null):hoverTip(move.endPosition);
  viewer.canvas.style.cursor=spot||building?'pointer':'';
  if(spot){showInfo(spot.text);return;}
  if(building){$('#area-info').hidden=true;return;}
  if(state.metric==='overview'||state.metric==='parking'){$('#area-info').hidden=true;return;}
  areaInfo(prices?.pick(move.endPosition));
 },Cesium.ScreenSpaceEventType.MOUSE_MOVE);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.id!=='address-query')closeCard();});
 // Shortcuts (Ton, 16 Oct 2026): / search, F back to the picked building, Alt+R the
 // base angle and distance over the same place (Home still goes to the city centre).
 // F and R by key position, so they work on a Finnish keyboard too; / by the character
 // (Shift+7 there). Not while typing.
 document.addEventListener('keydown',e=>{
  if(e.target.closest?.('input,textarea,select,[contenteditable]')||e.ctrlKey||e.metaKey||!$('#landing').hidden)return;
  if(e.key==='/'&&!e.altKey){e.preventDefault();$('#address-query')?.focus();return;}
  if(e.code==='KeyF'&&!e.altKey&&!e.shiftKey&&state.building){
   const record=buildings.records.get(state.building);
   if(record){e.preventDefault();nav.flyTo(record.position,rangeForScale(35),{heading:HOME.heading+6,pitch:HOME.pitch},1000);}
   return;
  }
  if(e.code==='KeyR'&&e.altKey&&!e.shiftKey){e.preventDefault();nav.flyTo([nav.state.lon,nav.state.lat],HOME.range,{heading:nearestHeading(HOME.heading),pitch:HOME.pitch},900);}
 });
 if(state.building && buildings.records.has(state.building))selectBuilding(state.building,false);else state.building=null;
 landing.ready();
 window.__lens={Cesium,viewer,nav,buildings,card,search,selectAddress,selectBuilding,setMetric,get prices(){return prices;},get listings(){return listings;},get noise(){return noise;},get parking(){return parking;},get construction(){return construction;},get places(){return places;},get transit(){return transit;},ready:true};
 ground();
 loadLabels(viewer,nav).catch(e=>unavailable('Place labels',e,()=>loadLabels(viewer,nav)));
 priceLayer();
 noiseLayer();
 parkingLayer();
 constructionLayer();
 placesLayer();
 // Parked trains at the Central Station: preview only (?trains=1) until Ton says yes.
 if(new URLSearchParams(location.search).get('trains')==='1')loadStationTrains(viewer).catch(e=>console.warn('Parked trains unavailable',e));
 transitLayer();
 adsLayer();setInterval(adsLayer,10*60*1000);
 neighbourhoodList();
}
// Districts by building count; redrawn when the language (number format) changes.
function neighbourhoodList(){
 if(!buildings)return;
 const counts=new Map();
 for(const r of buildings.manifest){const d=r.district;if(d){const entry=counts.get(d.id)??{...d,count:0};entry.count++;counts.set(d.id,entry);}}
 const content=$('#neighbourhood-list');content.replaceChildren();
 for(const d of [...counts.values()].sort((a,b)=>b.count-a.count)){
  const b=document.createElement('button');b.textContent=d.nameFi.toLocaleLowerCase('fi')+' · '+num(d.count);
  b.onclick=()=>{const rows=buildings.manifest.filter(r=>r.district?.id===d.id);nav.flyTo([rows.reduce((s,r)=>s+r.position[0],0)/rows.length,rows.reduce((s,r)=>s+r.position[1],0)/rows.length],1800);};content.append(b);
 }
}
start().catch(error=>{
 console.error(error);landing.failed(error.message);
 window.__lens={viewer,nav,ready:true,error:error.message};
});

