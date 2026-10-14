import {t} from './i18n.js';

// Landing screen. It covers the map while the buildings load, with the city
// further out and turning slowly behind it. Scrolling (or a click, Enter or the
// down arrow) dives in: the camera turns the short way back to the saved view
// and zooms in while the big name slides onto the small one in the top left
// corner, then the panels fade in. Only the backdrop fades, never the name, so
// the name stays solid all the way. The name is sized in em, so one scale fits it.
const ORBIT_DEG_PER_MS = 0.0018;   // about one turn every three minutes
const MOVE_MS = 1100, FLY_MS = 1900;

export function createLanding(nav, onDone){
 const app=document.querySelector('#app'),screen=document.querySelector('#landing');
 const cue=screen.querySelector('#landing-cue'),status=screen.querySelector('#landing-status');
 const big=screen.querySelector('.landing-brand'),small=document.querySelector('.brand .brand-lockup');
 const still=matchMedia('(prefers-reduced-motion: reduce)').matches||navigator.webdriver;
 const target={...nav.state};
 let orbit=null,ready=false;
 if(!still){
  Object.assign(nav.state,{range:Math.min(target.range*2.2,6000),pitch:-32});nav.apply();
  let last=performance.now();
  const turn=now=>{nav.state.heading+=(now-last)*ORBIT_DEG_PER_MS;last=now;nav.apply();orbit=requestAnimationFrame(turn);};
  orbit=requestAnimationFrame(turn);
 }
 const stopOrbit=()=>{if(orbit)cancelAnimationFrame(orbit);orbit=null;};
 const say=text=>{status.dataset.i18n=text;status.textContent=t(text);};
 const finish=()=>{stopOrbit();app.classList.remove('is-landing','is-leaving');screen.hidden=true;onDone();};
 const enter=()=>{
  if(!ready||app.classList.contains('is-leaving'))return;
  if(still){finish();return;}
  stopOrbit();
  // Turn the short way round to the saved heading.
  const h=nav.state.heading,heading=h+(((target.heading-h)%360)+540)%360-180;
  nav.flyTo([target.lon,target.lat],target.range,{heading,pitch:target.pitch},FLY_MS);
  const from=big.getBoundingClientRect(),to=small.getBoundingClientRect();
  app.classList.add('is-leaving');
  big.animate([{transform:'none'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width})`}],
   {duration:MOVE_MS,easing:'cubic-bezier(.65,0,.3,1)',fill:'forwards'}).finished.then(finish);
 };
 screen.addEventListener('wheel',e=>{e.preventDefault();if(e.deltaY>0)enter();},{passive:false});
 screen.addEventListener('click',enter);
 document.addEventListener('keydown',e=>{if(!screen.hidden&&['Enter',' ','ArrowDown','PageDown'].includes(e.key)){e.preventDefault();enter();}});
 return {
  ready(){
   ready=true;screen.classList.add('is-ready');say('scroll to dive in');
   // Browser checks run without anyone to scroll.
   if(navigator.webdriver)finish();
  },
  failed(message){
   stopOrbit();screen.classList.add('is-failed');
   delete status.dataset.i18n;status.textContent=t('The map could not load: {message}. Click to try again.',{message});
   cue.onclick=()=>location.reload();
  },
 };
}
