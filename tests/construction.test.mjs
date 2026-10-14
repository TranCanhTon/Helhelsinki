import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, mainPurpose, workStatus, distanceToAreas, nearbyIndex, shortAddress, RULES, LEVEL_KEYS} from '../src/data/construction.js';

const label = text => { const c = classify(text); return c.rule === null ? c.level : `${c.level}: ${RULES[c.rule][1]}`; };

test('change notes added later are cut off the purpose', () => {
  assert.equal(mainPurpose('Telekaapelin asentaminen.\nMUUTOS 26.02.2026: aloitus siirtyy.\nLISÄYS 24.4.2026: louhinta'), 'Telekaapelin asentaminen.');
  assert.equal(label('Telekaapelin asentaminen.\nLISÄYS 24.4.2026: louhintaa'), 'medium: Telecom and fibre cables');
});

test('real purposes from the data get the levels Ton approved', () => {
  assert.equal(label('Työstä vastaava varaa tilaa uudisrakennuksen työmaa-alueelle.'), 'heavy: New building or demolition');
  assert.equal(label('Siirretään uomaa, louhitaan sekä rakennetaan uusi vesihuolto.'), 'heavy: Rock blasting, piling, foundations');
  assert.equal(label('Työstä vastaava varaa tilaa kaivutyölle; vesihuoltoverkoston saneeraus.'), 'heavy: Water and sewer network renewal');
  assert.equal(label('Kaukolämpötyö'), 'heavy: District heating or cooling pipes');
  assert.equal(label('Tietoliikenne.'), 'medium: Telecom and fibre cables');
  assert.equal(label('Kiinteistöremontti: julkisivujen ja vesikaton saneeraus.'), 'medium: Building renovation (facade, roof, balcony)');
  assert.equal(label('Työstä vastaava varaa tilaa työmaasähkölle'), 'light: Temporary power line or poles');
  assert.equal(label('Työmaa-alue.'), 'medium: Building site area, site road, site traffic');
  assert.equal(label('Ulkovalaistuksen saneeraus'), 'light: Street lights or traffic lights');
  assert.equal(label('Muutto.'), 'light: Moving van');
});

test('surveys stay light even when they name a pipe', () => {
  assert.equal(label('DN1000 vesijohdon vuototutkimus'), 'light: Ground surveys and inspections');
  assert.equal(label('Maaperätutkimukset'), 'light: Ground surveys and inspections');
});

test('no matching words stays unknown', () => {
  assert.deepEqual(classify('DJ-pöydän asentaminen.'), {level: 'unknown', rule: null});
  assert.deepEqual(classify(''), {level: 'unknown', rule: null});
  for (const [level] of RULES) assert.ok(LEVEL_KEYS.includes(level));
});

test('status comes from the dates, not the status field', () => {
  assert.equal(workStatus({start: '2026-01-01', end: '2026-10-12'}, '2026-10-13'), 'over');
  assert.equal(workStatus({start: '2026-01-01', end: '2026-10-13'}, '2026-10-13'), 'running');
  assert.equal(workStatus({start: '2026-11-02', end: '2026-11-30'}, '2026-10-13'), 'upcoming');
});

// A 20 m x 20 m square whose west edge is 100 m east of the point [25, 60].
const kx = 111320 * Math.cos(60 * Math.PI / 180), ky = 110540;
const square = (east, size = 20) => [[[[25 + east / kx, 60], [25 + (east + size) / kx, 60], [25 + (east + size) / kx, 60 + size / ky], [25 + east / kx, 60 + size / ky], [25 + east / kx, 60]]]];

test('distance is to the nearest edge, 0 inside', () => {
  assert.ok(Math.abs(distanceToAreas([25, 60], square(100)) - 100) < 0.5);
  assert.equal(distanceToAreas([25 + 110 / kx, 60 + 10 / ky], square(100)), 0);
});

test('nearby keeps works within the radius that are not over, nearest first', () => {
  const work = (east, end, start = '2026-01-01') => ({polygons: square(east), start, end});
  const near = nearbyIndex([work(150, '2027-01-01'), work(50, '2027-01-01'), work(10, '2026-10-01'), work(250, '2027-01-01'), work(120, '2027-01-01', '2026-11-01')]);
  const found = near([25, 60], '2026-10-13');
  assert.deepEqual(found.map(f => Math.round(f.distanceM)), [50, 120, 150]);
  assert.deepEqual(found.map(f => f.status), ['running', 'upcoming', 'running']);
  assert.deepEqual(nearbyIndex([])([25, 60], '2026-10-13'), []);
});

test('long street lists are cut at a comma', () => {
  assert.equal(shortAddress('Hämeentie 3'), 'Hämeentie 3');
  const long = 'Castreninkatu 1, 10, 13, 16, 22-24, Wallininkatu 7-11, Wallininkuja 6, 3-4, 1, Toinen Linja 19-31';
  const short = shortAddress(long);
  assert.ok(short.length <= 70 && short.endsWith(' and more') && long.startsWith(short.replace(' and more', '')), short);
});
