import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
const dir=new URL('../data/raw/probe/basemap/',import.meta.url);
let report='# Helsinki basemap source probe\n\nSaved official WFS probes from 12 October 2026. Size estimates use samples, not full downloads.\n\n';
report+='Recommendation: use YLRE_Katualue_alue citywide for road hierarchy and actual street outlines, plus YLRE_Katu_ja_viherosat_ajorata_alue in the central detail area for carriageways. Avoid the roughly 497 MB all-parts layer. Use guide areas and lines for water, forest, squares, bridges, rail, light rail and piers. Exclude planned, unbuilt and underground features.\n\n';
for(const file of (await readdir(dir)).filter(f=>f.endsWith('.json')&&f!=='summary.json')){
 const p=JSON.parse(await readFile(new URL(file,dir),'utf8'));
 const extra=JSON.parse(await readFile(new URL(file.replace('.json','-full.json'),new URL('../data/raw/probe/class-values/',import.meta.url)),'utf8').catch(()=> '{}'));
 Object.assign(p.values,extra);
 report+='## '+p.layer+'\n\n'+p.total.toLocaleString('en-GB')+' records; estimated '+p.estimatedMB+' MB; '+p.geometry+'.\n\nFields:\n\n';
 report+=p.fields.map(f=>'- '+f.name+' ('+f.type+')').join('\n')+'\n\nType and class values (value: count):\n\n';
 for(const [field,values] of Object.entries(p.values).filter(([k])=>/tyyppi|luokka|laji|kayttotark|tila|voimassaolo/i.test(k)))
  report+='- **'+field+'**: '+(values.counts?Object.entries(values.counts).map(([k,v])=>k+': '+v).join('; '):values.distinct+' distinct; examples '+JSON.stringify(values.examples))+'\n';
 report+='\n';
}
await mkdir(new URL('../docs/',import.meta.url),{recursive:true});
await writeFile(new URL('../docs/basemap-probe.md',import.meta.url),report);

