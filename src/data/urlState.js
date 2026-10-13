export function readState(search,home) {
 const params=new URLSearchParams(search),camera={...home};
 const raw=params.get('camera')?.split(',').map(Number);
 if(raw?.length===5 && raw.every(Number.isFinite)) {
  const [lon,lat,heading,pitch,range]=raw;
  if(lon>=24.78&&lon<=25.27&&lat>=60.05&&lat<=60.3&&range>=120&&range<=15000&&pitch>=-89&&pitch<=-15)
   Object.assign(camera,{lon,lat,heading,pitch,range});
 }
 return {camera,building:params.get('building'),theme:params.get('theme')==='day'?'day':'dusk',
 metric:['sale','noise','parking'].includes(params.get('view'))?params.get('view'):'overview',
 noiseMode:['road','rail','metro','tram'].includes(params.get('noise'))?params.get('noise'):'all'};
}
export function writeState(state,camera) {
 const url=new URL(location.href),p=url.searchParams;
 for(const [k,v] of Object.entries({building:state.building,theme:state.theme,view:state.metric,noise:state.metric==='noise'&&state.noiseMode!=='all'?state.noiseMode:null}))v?p.set(k,v):p.delete(k);
 p.set('camera',[camera.lon.toFixed(6),camera.lat.toFixed(6),camera.heading.toFixed(1),camera.pitch.toFixed(1),camera.range.toFixed(1)].join(','));
 history.replaceState(null,'',url);
}

