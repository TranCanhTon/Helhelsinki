import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAddressIndex,findAddresses,exactAddress} from '../src/data/addresses.js';
import {decodeJsonStat,quarterChange,validateSchema} from '../src/data/prices.js';
import {readState} from '../src/data/urlState.js';
const feature=(street,sv,n,city='Helsinki',position=[24.95,60.18])=>({geometry:{type:'Point',coordinates:position},properties:{id:street+n,katunimi:street,gatan:sv,osoitenumero_teksti:n,kaupunki:city,postinumero:'00100'}});
const manifest=[{buildingId:'a',registerJoin:'matched-by-ratu',addresses:['Mäkelänkatu 16a']},{buildingId:'b',registerJoin:'matched-by-ratu',addresses:['Mäkelänkatu 16a']},{buildingId:'unverified',registerJoin:'no-register-match',addresses:['Other 2']}];
test('official search preserves aliases, suffixes and postcodes; excludes Espoo and outside points',()=>{
 const rows=buildAddressIndex([feature('Mäkelänkatu','Backasgatan','16a'),feature('Other','Annan','2'),feature('Espoo','Esbo','1','Espoo'),feature('Outside','Ute','3','Helsinki',[25.5,60.5])],manifest,p=>p[0]<25);
 assert.equal(rows.length,2);assert.equal(findAddresses(rows,'makelankatu')[0].postcode,'00100');
 assert.equal(findAddresses(rows,'BACKASGATAN 16a')[0].address,'Mäkelänkatu 16a');
 assert.deepEqual(findAddresses(rows,'makelankatu')[0].buildingIds,['a','b']);
 assert.deepEqual(findAddresses(rows,'other')[0].buildingIds,[]);
 assert.deepEqual(findAddresses(rows,'Espoo'),[]);assert.deepEqual(findAddresses(rows,'qwertyzz'),[]);
 assert.notEqual(exactAddress('Mäkelänkatu 16a'),exactAddress('Makelankatu 16a'));
});
test('JSON-stat respects dimension/category order, sparse values and suppression',()=>{
 const data={class:'dataset',id:['postal','quarter'],size:[2,2],dimension:{postal:{category:{index:{'00200':1,'00100':0}}},quarter:{category:{index:['2025Q4','2026Q1']}}},value:{0:100,2:200,3:300},status:{3:'c'}};
 const rows=decodeJsonStat(data);
 assert.deepEqual(rows.map(r=>r.value),[100,null,200,null]);
 assert.deepEqual(rows[2].keys,{quarter:'2025Q4',postal:'00200'});
 assert.equal(rows[0].keys.postal,'00100');
});
test('quarter change only uses valid adjacent quarters across year boundaries',()=>{
 assert.ok(Math.abs(quarterChange(100,110,['2025Q4','2026Q1'])-10)<1e-9);
 for(const [a,b,q] of [[null,100,['2025Q4','2026Q1']],[0,100,['2025Q4','2026Q1']],[100,110,['2025Q3','2026Q1']],[100,110,['bad','bad']]])assert.equal(quarterChange(a,b,q),null);
});
test('unknown URL values and invalid camera fall back safely',()=>{
 const home={lon:24.95,lat:60.18,heading:0,pitch:-40,range:1000};
 assert.deepEqual(readState('?view=wrong&camera=0,0,0,0,0',home).camera,home);
 assert.equal(readState('?view=wrong',home).metric,'overview');
});
test('schema rejects numeric postcode and nonfinite prices',()=>{
 assert.throws(()=>validateSchema(100,{type:'string',pattern:'^\\d{5}$'}));
 assert.throws(()=>validateSchema(NaN,{anyOf:[{type:'number'},{type:'null'}]}));
});

