import * as Cesium from 'cesium';
import Flatbush from 'flatbush';
import {loadJson} from '../data/load.js';
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
function viewBox(viewer) {
 const r=viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
 return r?[r.west,r.south,r.east,r.north].map(Cesium.Math.toDegrees):null;
}
export async function loadLabels(viewer,nav) {
 const rows=await loadJson('/labels.json');
 const index=new Flatbush(rows.length);rows.forEach(r=>index.add(r.position[0],r.position[1],r.position[0],r.position[1]));index.finish();
 const host=document.createElement('div');host.className='place-labels';host.setAttribute('aria-hidden','true');document.querySelector('#app').append(host);
 const pool=[];const measure=document.createElement('canvas').getContext('2d');measure.font='600 12px Segoe UI';
 let last='',lastTime=0,timer;
 // The map only redraws on request, so panels opening or closing must ask for
 // a redraw to move labels out from under them.
 const redraw=()=>viewer.scene.requestRender();
 document.querySelector('.neighbourhoods').addEventListener('toggle',redraw);
 new MutationObserver(redraw).observe(document.querySelector('#building-card'),{attributes:true,attributeFilter:['hidden']});
 new MutationObserver(redraw).observe(document.querySelector('#price-legend'),{attributes:true,attributeFilter:['hidden']});
 viewer.scene.postRender.addEventListener(()=>{
  const key=JSON.stringify(nav.state)+viewer.canvas.clientWidth+viewer.canvas.clientHeight+document.querySelector('#building-card').hidden+document.querySelector('.neighbourhoods').open+document.querySelector('#price-legend').hidden;
  if(key===last)return;
  // Ran less than 100 ms ago: come back once the camera settles.
  const wait=100-(performance.now()-lastTime);
  if(wait>0){clearTimeout(timer);timer=setTimeout(redraw,wait);return;}
  last=key;lastTime=performance.now();
  const box=viewBox(viewer);if(!box)return;
  // Names only when zoomed right in: the scale bar (80 px) shows 40 m or less.
  const candidates=Math.round(nav.metersPerPixel()*80/10)*10<=40?index.search(...box).map(i=>rows[i]):[];
  candidates.sort((a,b)=>Number(/katu|polku/i.test(a.kind??''))-Number(/katu|polku/i.test(b.kind??''))||a.name.localeCompare(b.name));
  const blocked=[...document.querySelectorAll('.panel:not([hidden]),.map-caption,.hint')].filter(e=>e.offsetWidth).map(e=>{const r=e.getBoundingClientRect();return[r.left,r.top,r.right,r.bottom];});
  const accepted=[];let count=0;
  for(const r of candidates) {
   const p=Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene,Cesium.Cartesian3.fromDegrees(...r.position,1));
   if(!p||p.x<0||p.y<0||p.x>viewer.canvas.clientWidth||p.y>viewer.canvas.clientHeight)continue;
   const width=Math.max(40,measure.measureText(r.name).width+4),rect=[p.x-width/2-6,p.y-13,p.x+width/2+6,p.y+13];
   if([...blocked,...accepted].some(b=>intersects(rect,b)))continue;
   accepted.push(rect);
   if(!pool[count]){pool[count]=document.createElement('span');host.append(pool[count]);}
   const label=pool[count++];label.textContent=r.name;label.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px) translate(-50%,-50%)';label.hidden=false;
   if(count>=90)break;
  }
  for(let i=count;i<pool.length;i++)pool[i].hidden=true;
 });
}
// Only 3 in 10 trees are drawn (Ton, 13 Oct 2026: too many, too slow). The choice
// comes from each tree's position, so the same trees show every time.
export const keepTree=([lon,lat])=>((Math.imul(Math.round(lon*1e6),73856093)^Math.imul(Math.round(lat*1e6),19349663))>>>0)%10<3;
export async function loadTrees(viewer,nav) {
 const meta=await loadJson('/trees.json'),loaded=new Map(),pending=new Set();
 const treeCanvas=document.createElement('canvas');treeCanvas.width=32;treeCanvas.height=40;
 const ctx=treeCanvas.getContext('2d');
 ctx.fillStyle='#80765b';ctx.fillRect(14,25,4,13);
 ctx.fillStyle='#91ad72';ctx.beginPath();ctx.arc(16,15,12,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#b8ca92';ctx.beginPath();ctx.arc(12,12,7,0,Math.PI*2);ctx.fill();
 // One shared picture for every tree. A bare canvas makes Cesium store a copy per tree.
 const treeImage=treeCanvas.toDataURL();
 let lastTime=0,timer;
 const redraw=()=>viewer.scene.requestRender();
 viewer.scene.postRender.addEventListener(()=>{
  const wait=300-(performance.now()-lastTime);
  if(wait>0){clearTimeout(timer);timer=setTimeout(redraw,wait);return;}
  lastTime=performance.now();
  const visible=nav.state.range<1500,box=visible?viewBox(viewer):null;
  const wanted=new Set(box?meta.tiles.filter(t=>intersects(t.rectangle,box)).map(t=>t.file):[]);
  for(const [file,collection] of loaded)if(!wanted.has(file)){viewer.scene.primitives.remove(collection);loaded.delete(file);redraw();}
  for(const tile of meta.tiles){
   if(!wanted.has(tile.file)||loaded.has(tile.file)||pending.has(tile.file)||pending.size>=4)continue;
   pending.add(tile.file);
   loadJson('/'+tile.file).then(rows=>{
    if(nav.state.range>=1500 || loaded.has(tile.file))return;
    const collection=viewer.scene.primitives.add(new Cesium.BillboardCollection({scene:viewer.scene}));
    for(const [lon,lat,species,latin] of rows.filter(keepTree))collection.add({
     position:Cesium.Cartesian3.fromDegrees(lon,lat,0),image:treeImage,width:6,height:8,sizeInMeters:true,
     verticalOrigin:Cesium.VerticalOrigin.BOTTOM,
     id:{tree:true,species,latin},color:Cesium.Color.WHITE.withAlpha(0.8),
     distanceDisplayCondition:new Cesium.DistanceDisplayCondition(0,1800)
    });
    loaded.set(tile.file,collection);redraw();
   }).catch(error=>console.warn('Tree cell unavailable',tile.file,error.message)).finally(()=>pending.delete(tile.file));
  }
 });
 return {meta,loaded};
}

