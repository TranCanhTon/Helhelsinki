import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.argv[2]||'http://localhost:5173/';
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const out='screenshots/phase34';await mkdir(out,{recursive:true});
const errors=[],external=[];let bytes=0;
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith(new URL(url).origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 page.on('response',r=>{bytes+=Number(r.headers()['content-length']??0);if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 const began=Date.now();await page.goto(url);
 await page.waitForFunction(()=>window.__lens?.ready && __lens.prices,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>__lens.error),undefined);
 const loadMs=Date.now()-began;
 await page.locator('#address-query').focus();
 await page.waitForFunction(()=>__lens.search.rows?.length>0);
 const sample=await page.evaluate(()=>({
  modelled:__lens.search.rows.find(r=>r.buildingIds.length===1&&r.addressSv),
  unmodelled:__lens.search.rows.find(r=>!r.buildingIds.length&&r.address.startsWith('Aleksanterinkatu')),
  ambiguous:__lens.search.rows.find(r=>r.buildingIds.length>1)
 }));
 const input=page.locator('#address-query');
 await input.fill(sample.modelled.addressSv);
 await page.waitForTimeout(350);
 assert.ok((await page.locator('#address-results').textContent()).includes(sample.modelled.address));
 await input.press('ArrowDown');await input.press('Enter');
 await page.waitForFunction(id=>__lens.buildings.selected===id,sample.modelled.buildingIds[0]);
 await page.waitForFunction(()=>__lens.nav.flight===null && __lens.viewer.scene.globe.tilesLoaded && __lens.buildings.tileset.tilesLoaded,null,{timeout:120000});
 assert.ok((await page.locator('#building-card').textContent()).includes('Postal-area average'));
 assert.ok((await page.locator('#building-card').textContent()).includes('Oikotie'));
 const selected=await page.evaluate(()=>__lens.buildings.selected);
 await page.screenshot({path:out+'/building-day.png'});
 await page.waitForTimeout(300);const shared=page.url();
 await page.reload();
 await page.waitForFunction(()=>window.__lens?.ready && __lens.prices,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>__lens.buildings.selected),selected);
 assert.ok(shared.includes('camera='));
 await page.locator('.card-close').click();
 await page.evaluate(row=>__lens.selectAddress(row),sample.unmodelled);
 assert.ok((await page.locator('#building-card').textContent()).includes('No linked 3D building'));
 await page.locator('.card-close').click();
 if(sample.ambiguous){await page.evaluate(row=>__lens.selectAddress(row),sample.ambiguous);assert.ok(await page.locator('.building-choices button').count()>1);await page.locator('.card-close').click();}
 await input.fill('qwertyzzzz');await page.waitForFunction(()=>document.querySelector('.search-status').textContent.includes('No Helsinki'),null,{timeout:30000});
 await input.fill('Otakaari 1');await page.waitForTimeout(350);assert.ok((await page.locator('.search-status').textContent()).includes('No Helsinki'));
 await input.fill('');await input.press('Escape');
 await page.locator('[data-view=noise]').click();await page.waitForTimeout(1500);assert.match(await page.locator('#price-legend').textContent(),/75\+/);
 await page.screenshot({path:out+'/noise-dusk.png'});
 await page.locator('[data-view=sale]').click();assert.match(await page.locator('#price-legend').textContent(),/\d,\d{3}/);
 await page.screenshot({path:out+'/sale.png'});
 const frames=await page.evaluate(()=>new Promise(resolve=>{const times=[];let prev=performance.now();function tick(now){times.push(now-prev);prev=now;if(times.length<60)requestAnimationFrame(tick);else resolve(1000/(times.reduce((a,b)=>a+b,0)/times.length));}requestAnimationFrame(tick);}));
 const report={viewport:'1440x900',loadMs,downloadedContentLengthBytes:bytes,fps:frames,renderer:'Chrome headless SwiftShader; not representative of hardware GPU performance',errors,external};
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(report);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}catch(error){console.log({errors,external});throw error;}finally{await browser.close();}


