import {findAddresses} from '../data/addresses.js';
import {loadJson} from '../data/load.js';
export class AddressSearch {
  constructor(container,onSelect) {
    this.el=container; this.onSelect=onSelect; this.rows=null; this.active=-1; this.results=[];
    container.innerHTML='<input id="address-query" type="search" aria-label="Helsinki address" autocomplete="off" placeholder="Street and number · katu / gata" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="address-results"><div id="address-results" role="listbox" hidden></div><p class="search-status" role="status"></p>';
    this.input=container.querySelector('input');this.list=container.querySelector('[role=listbox]');this.status=container.querySelector('[role=status]');
    this.input.addEventListener('focus',()=>this.load());
    this.input.addEventListener('input',()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),200);});
    this.input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.stopPropagation();clearTimeout(this.timer);this.close();return;}
      if(['ArrowDown','ArrowUp'].includes(e.key)&&this.results.length){
        e.preventDefault();this.active=(this.active+(e.key==='ArrowDown'?1:-1)+this.results.length)%this.results.length;
        this.paintActive();
      } else if(e.key==='Enter' && this.active>=0){e.preventDefault();this.choose(this.results[this.active]);}
    });
    document.addEventListener('pointerdown',e=>{if(!container.contains(e.target))this.close();});
  }
  async load() {
    if(this.rows || this.loading)return;
    this.loading=true;this.status.textContent='Loading official addresses…';
    try{this.rows=await loadJson('/addresses.json');this.status.textContent='';if(document.activeElement===this.input)this.run();}
    catch{this.status.replaceChildren(document.createTextNode('Addresses unavailable. '));const b=document.createElement('button');b.textContent='Retry';b.onclick=()=>this.load();this.status.append(b);}
    finally{this.loading=false;}
  }
  run() {
    if(!this.rows){this.load();return;}
    this.results=findAddresses(this.rows,this.input.value);this.active=-1;this.list.replaceChildren();
    this.status.textContent=this.input.value.trim()&&!this.results.length?'No Helsinki addresses found.':'';
    this.results.forEach((r,i)=>{
      const b=document.createElement('button');b.type='button';b.id='address-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.tabIndex=-1;
      const title=document.createElement('strong');title.textContent=r.address;
      const sub=document.createElement('span');sub.textContent=[r.addressSv,r.postcode,r.buildingIds.length>1?'Choose from '+r.buildingIds.length+' buildings':r.buildingIds.length?'3D building':'No linked 3D building'].filter(Boolean).join(' · ');
      b.append(title,sub);b.onclick=()=>this.choose(r);this.list.append(b);
    });
    this.list.hidden=!this.results.length;this.input.setAttribute('aria-expanded',String(!this.list.hidden));this.input.removeAttribute('aria-activedescendant');
  }
  paintActive(){[...this.list.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===this.active)));this.input.setAttribute('aria-activedescendant','address-option-'+this.active);}
  choose(row){this.input.value=row.address;this.close();this.onSelect(row);}
  close(){this.list.hidden=true;this.input.setAttribute('aria-expanded','false');this.input.removeAttribute('aria-activedescendant');this.active=-1;this.results=[];}
}

