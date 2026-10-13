import test from 'node:test';
import assert from 'node:assert/strict';
import {classify, capacityOf, nearbyIndex, hoursText, limitText, zonePrice, grownHull, PARKING_TYPES, GROUP_KEYS} from '../src/data/parking.js';

test('a known use wins over the class, and no-parking records are left out', () => {
  assert.equal(classify({luokka: 3, tyyppi: 'Pysäköintikielto'}), 'exclude');
  assert.equal(classify({luokka: 6, tyyppi: 'inva'}), 'accessible');
  assert.equal(classify({luokka: 6, tyyppi: null}), 'paid-permit');
  assert.equal(classify({luokka: 0, tyyppi: null}), 'unknown');
});

test('every type sits in one of the three groups or in other', () => {
  for (const [key, t] of Object.entries(PARKING_TYPES)) assert.ok([...GROUP_KEYS, 'other'].includes(t.group), key);
  assert.equal(PARKING_TYPES['disc-permit'].group, 'free');
  assert.equal(PARKING_TYPES['paid-permit'].group, 'permit');
  assert.equal(PARKING_TYPES.loading.group, 'other');
});

test('missing or zero capacity stays null, not 0', () => {
  assert.equal(capacityOf({paikat_ala: null}), null);
  assert.equal(capacityOf({paikat_ala: 0}), null);
  assert.equal(capacityOf({paikat_ala: 'x'}), null);
  assert.equal(capacityOf({paikat_ala: 2.4}), 2.4);
});

test('nearby sums spaces per group within the radius only', () => {
  const at = (dx, type, capacity) => ({position: [25 + dx / 55600, 60], type, capacity});
  const near = nearbyIndex([at(0, 'paid', 3.4), at(50, 'paid', 2.2), at(100, 'free-short', null), at(150, 'loading', null), at(400, 'paid', 9)]);
  const out = near([25, 60]);
  assert.deepEqual(out.groups.paid, {spaces: 6, areas: 2, noEstimate: 0});
  assert.deepEqual(out.groups.free, {spaces: null, areas: 1, noEstimate: 1});
  assert.deepEqual(out.groups.permit, {spaces: null, areas: 0, noEstimate: 0});
  assert.deepEqual(out.other, {loading: 1});
  assert.equal(nearbyIndex([])([25, 60]).groups.free.spaces, null);
});

test('hours follow the Finnish sign order: weekdays, (Saturday), Sunday', () => {
  assert.equal(hoursText('9-21, (9-18)'), 'Mon to Fri 9 to 21, Sat 9 to 18');
  assert.equal(hoursText('9-21, (9-21), 9-21'), 'Mon to Fri 9 to 21, Sat 9 to 21, Sun 9 to 21');
  assert.equal(hoursText('8-20'), 'Mon to Fri 8 to 20');
  assert.equal(hoursText('7-15, Maksullinen (9-18)'), '7-15, Maksullinen (9-18)');
  assert.equal(hoursText(''), null);
});

test('time limits are tidied, odd wording kept as written', () => {
  assert.equal(limitText('4 h'), 'max 4 h');
  assert.equal(limitText('30 min, (30 мин)'), 'max 30 min');
  assert.equal(limitText('60min'), 'max 60 min');
  assert.equal(limitText('ei aikarajoitusta'), 'no time limit');
  assert.equal(limitText('4'), '4');
  assert.equal(limitText(null), null);
});

test('paid zone price comes from the city note or stays missing', () => {
  assert.equal(zonePrice('Maksuvyöhykkeen sisällä pysäköinti maksaa 4 euroa tunnilta. Huomioithan'), '€4 per hour');
  assert.equal(zonePrice('maksaa 2,5 euroa tunnilta'), '€2.5 per hour');
  assert.equal(zonePrice('Tarkista liikennemerkistä'), null);
});

test('a kerb strip grows into a closed zone outline around it', () => {
  const strip = {type: 'Polygon', coordinates: [[[25, 60], [25.0002, 60], [25.0002, 60.00002], [25, 60.00002], [25, 60]]]};
  const ring = grownHull(strip, 6);
  assert.deepEqual(ring[0], ring.at(-1));
  const lons = ring.map(p => p[0]), lats = ring.map(p => p[1]);
  assert.ok(Math.min(...lons) < 25 && Math.max(...lons) > 25.0002);
  assert.ok(Math.abs((Math.max(...lats) - 60.00002) * 110540 - 6) < 0.5);
});