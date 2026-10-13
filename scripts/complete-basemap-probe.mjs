import {fetchAllFeatures} from './lib/wfs.mjs';
import {readJson,writeJson,cached} from './lib/prepare.mjs';
for(const name of ['Puurekisteri_piste','YLRE_Katu_ja_viherosat_kaikki_alue']){
 const probe=await readJson('data/raw/probe/basemap/'+name+'.json');
 const fields=Object.entries(probe.values).filter(([k,v])=>/tyyppi|luokka|laji|kayttotark|tila|voimassaolo/i.test(k)&&!v.counts).map(([k])=>k);
 const raw=name==='Puurekisteri_piste'?await readJson('data/raw/context/Puurekisteri_piste.json'):
  await cached('data/raw/probe/class-values/all-parts-properties.json',()=>fetchAllFeatures({
   typeName:'avoindata:'+name,sortBy:'osan_id',pageSize:10000,extra:{propertyName:['osan_id',...fields].join(',')}
  }));
 const result={};
 for(const field of fields){
  const counts={};for(const f of raw.features){const key=String(f.properties[field]??null);counts[key]=(counts[key]??0)+1;}
  result[field]={distinct:Object.keys(counts).length,counts};
 }
 await writeJson('data/raw/probe/class-values/'+name+'-full.json',result);
}

