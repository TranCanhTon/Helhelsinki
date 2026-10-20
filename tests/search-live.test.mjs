// Live address search: query parsing, the city filter, cleaning the city's
// answer and linking rows to buildings. A fake city answer, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {addressFilter, addressLinker, addressRow, liveRows, parseQuery} from '../src/data/addresses.js';

const point = (street, number, letter = null, city = 'Helsinki', postcode = '00100') => ({
  type: 'Feature',
  geometry: {type: 'Point', coordinates: [24.95, 60.18]},
  properties: {
    id: street + number + (letter ?? ''),
    katunimi: street,
    gatan: street + 'gatan',
    osoitenumero: number,
    osoitekirjain: letter,
    osoitenumero_teksti: number == null ? null : number + (letter ?? ''),
    kaupunki: city,
    postinumero: postcode,
  },
});

test('parseQuery splits street, number, letter and postcode', () => {
  assert.deepEqual(parseQuery('Mannerheimintie 12 B'), {
    street: 'Mannerheimintie',
    number: 12,
    letter: 'b',
    postcode: null,
  });
  assert.deepEqual(parseQuery('mäkelänkatu 16a'), {street: 'mäkelänkatu', number: 16, letter: 'a', postcode: null});
  assert.deepEqual(parseQuery('kallio 00530'), {street: 'kallio', number: null, letter: null, postcode: '00530'});
  assert.deepEqual(parseQuery(''), {street: null, number: null, letter: null, postcode: null});
  assert.deepEqual(parseQuery('   '), {street: null, number: null, letter: null, postcode: null});
});

test('typed quotes cannot break out of the filter text', () => {
  const filter = addressFilter(parseQuery("x' OR 1=1 --"));
  // The only quotes left are the ones that open and close our own text values.
  assert.ok(!filter.includes("x'"));
  assert.ok(!filter.includes("''"));
  assert.match(filter, /ILIKE 'x _r%'/);
  // Even if a quote got through, it would be doubled and stay inside the text.
  const sneaky = addressFilter({street: "o'brien", number: null, letter: null, postcode: null});
  assert.match(sneaky, /LIKE 'o''brien%'/);
  assert.equal(addressFilter(parseQuery('m')), null);
  assert.equal(addressFilter(parseQuery('12')), null);
  assert.equal(parseQuery('a'.repeat(200)).street.length, 60);
});

test('addressFilter joins street, number and postcode, Helsinki only', () => {
  assert.equal(
    addressFilter(parseQuery('Mäkelänkatu 16 00510')),
    "kaupunki = 'Helsinki' AND (" +
      "(katunimi ILIKE 'm_k_l_nk_tu%' AND strReplace(strReplace(strReplace(strToLowerCase(katunimi),'[äåá]','a',true),'ö','o',true),'é','e',true) LIKE 'makelankatu%')" +
      ' OR ' +
      "(gatan ILIKE 'm_k_l_nk_tu%' AND strReplace(strReplace(strReplace(strToLowerCase(gatan),'[äåá]','a',true),'ö','o',true),'é','e',true) LIKE 'makelankatu%')" +
      ") AND osoitenumero = 16 AND postinumero = '00510'",
  );
  assert.equal(addressFilter(parseQuery('00530')), "kaupunki = 'Helsinki' AND postinumero = '00530'");
});

test('liveRows keeps Helsinki only, the right letter, at most 10, numbers sorted as numbers', () => {
  const features = [
    point('Katu', 10),
    point('Katu', 2),
    point('Katu', 2), // same address twice
    point('Katu', 3, 'a'),
    point('Katu', 3, 'b'),
    point('Katu', 4, null, 'Espoo'),
    point('Katu', null), // street without a house number
  ];
  assert.deepEqual(
    liveRows(features, parseQuery('katu')).map(r => r.address),
    ['Katu 2', 'Katu 3a', 'Katu 3b', 'Katu 10'],
  );
  assert.deepEqual(
    liveRows(features, parseQuery('katu 3 b')).map(r => r.address),
    ['Katu 3b'],
  );
  const many = Array.from({length: 30}, (_, i) => point('Katu', i + 1));
  assert.equal(liveRows(many, parseQuery('katu')).length, 10);
  assert.equal(addressRow(point('Katu', 1, null, 'Vantaa')), null);
  assert.deepEqual(addressRow(point('Katu', 1)), {
    id: 'Katu1',
    address: 'Katu 1',
    addressSv: 'Katugatan 1',
    postcode: '00100',
    position: [24.95, 60.18],
  });
});

test('addressLinker matches "16 A" and "16a" to the same building', () => {
  const link = addressLinker([
    {buildingId: 'b1', address: 'Mäkelänkatu 16 A'},
    {buildingId: 'b2', address: null},
  ]);
  const [row] = link([{address: 'Mäkelänkatu 16a'}]);
  assert.deepEqual(row.buildingIds, ['b1']);
  assert.deepEqual(link([{address: 'Mäkelänkatu 17'}])[0].buildingIds, []);
  // The full manifest: only register matches count, like data:context.
  const strict = addressLinker([
    {buildingId: 'b1', registerJoin: 'matched-by-ratu', addresses: ['Katu 1']},
    {buildingId: 'b2', registerJoin: 'no-register-match', addresses: ['Katu 1']},
  ]);
  assert.deepEqual(strict([{address: 'Katu 1'}])[0].buildingIds, ['b1']);
});
