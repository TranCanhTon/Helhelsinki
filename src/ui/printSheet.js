import {t, locale} from './i18n.js';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!=null)n.textContent=text;return n;};

// Viewing sheet (Ton, 16 Oct 2026): one printed page per building to take to the viewing.
// The map as it is on screen now, then the open card's contents and a few empty lines
// to write on. Only for printing: on screen it never shows.
// picture: a data URL of the map, or null when it could not be read.
export function printSheet(card,{picture}){
 document.querySelector('#print-sheet')?.remove();
 const sheet=el('div','print-sheet building-card');sheet.id='print-sheet';
 const top=el('header','print-top');
 top.append(el('span','print-brand','daroad'),el('span','print-date',t('Printed {date}',{date:new Date().toLocaleDateString(locale(),{day:'numeric',month:'long',year:'numeric'})})));
 sheet.append(top);
 const body=card.cloneNode(true);
 body.removeAttribute('id');
 // No buttons on paper; closed parts open.
 body.querySelectorAll('button,.copy-address').forEach(n=>n.remove());
 body.querySelectorAll('details').forEach(d=>{d.open=true;});
 const header=body.querySelector('.card-header');
 if(header)sheet.append(...header.childNodes);
 header?.remove();
 if(picture){const img=el('img','print-map');img.src=picture;img.alt='';sheet.append(img);}
 sheet.append(...body.childNodes);
 const write=el('section','print-write');write.append(el('h3',null,t('At the viewing')));
 for(let i=0;i<6;i++)write.append(el('div','print-line'));
 sheet.append(write);
 document.querySelector('#app').append(sheet);
 const done=()=>{sheet.remove();removeEventListener('afterprint',done);};
 addEventListener('afterprint',done);
 // Let the picture load before the print dialog takes its copy of the page.
 const img=sheet.querySelector('.print-map');
 if(img&&!img.complete)img.onload=img.onerror=()=>print();else print();
}
