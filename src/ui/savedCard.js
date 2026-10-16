import {t} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};

// Saved buildings (Ton, 16 Oct 2026): the star in the card header and the list that
// opens from the star in the tool bar. Kept in this browser only.
export const STAR='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>';

// The star on the card: saves or removes the building. place: "Kallio · 00500".
export function starButton(saved,id,record,place){
 const b=el('button','card-icon card-star');b.type='button';b.innerHTML=STAR;
 const paint=()=>{const on=saved.has(id);b.classList.toggle('is-on',on);b.title=t(on?'Remove from saved':'Save this building');b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(on));};
 b.onclick=()=>{saved.toggle(id,{address:record.address,place,position:record.position});paint();};
 paint();return b;
}

// The list beside the tool bar: place in small capitals, the address big, a × to remove.
// button: the tool bar star (its badge shows the count). onPick(id) opens the building.
export function savedPanel(panel,button,saved,onPick){
 const badge=el('span','tool-badge');button.append(badge);
 const close=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
 const paint=()=>{
  const rows=saved.list();
  badge.textContent=rows.length?String(rows.length):'';badge.hidden=!rows.length;
  button.classList.toggle('has-saved',rows.length>0);
  panel.replaceChildren();
  const head=el('header','saved-head');
  head.append(el('h2',null,t('Saved')));
  if(rows.length)head.append(el('span','saved-count',String(rows.length)));
  panel.append(head);
  if(!rows.length){panel.append(el('p','saved-empty',t('Nothing saved yet. Use the star on a building card.')));return;}
  const list=el('ul','saved-items');
  for(const row of rows){
   const item=el('li','saved-item'),open=el('button','saved-open');open.type='button';
   if(row.place)open.append(el('span','saved-place',row.place));
   open.append(el('strong',null,row.address??t('Building without a registered address')));
   open.onclick=()=>{close();onPick(row.id);};
   const remove=el('button','saved-remove','×');remove.type='button';remove.title=t('Remove from saved');remove.setAttribute('aria-label',remove.title);
   remove.onclick=()=>saved.toggle(row.id,{});
   item.append(open,remove);list.append(item);
  }
  panel.append(list);
 };
 button.setAttribute('aria-expanded','false');
 button.onclick=()=>{if(panel.hidden){paint();panel.hidden=false;button.setAttribute('aria-expanded','true');}else close();};
 // A click anywhere else, or Escape, closes the list.
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!button.contains(e.target))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopImmediatePropagation();close();}},true);
 saved.onChange(paint);paint();
 return {paint,close};
}
