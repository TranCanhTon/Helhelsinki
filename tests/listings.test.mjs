import test from 'node:test';
import assert from 'node:assert/strict';
import {median, areaStats, indexListings, groupOf} from '../src/data/listings.js';

// Synthetic ads (made up for the test, not real listings).
const ad = (id, postcode, rooms, rent, sizeM2, buildingIds = []) => ({id, postcode, rooms, rent, sizeM2, buildingIds});

test('median handles odd, even and empty lists', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test('area rent needs at least 3 ads of that size; others stay unknown', () => {
  const stats = areaStats([
    ad('a', '00530', 2, 1000, 50), ad('b', '00530', 2, 1100, 50), ad('c', '00530', 2, 1300, 52),
    ad('d', '00530', 1, 800, 30), ad('e', '00530', 4, 2000, 90),
  ]);
  const s = stats.get('00530');
  assert.equal(s.count, 5);
  assert.equal(s.groups['2'].rent, 1100);
  assert.equal(s.groups['2'].perM2, 22);
  assert.equal(s.groups['1'].rent, null);
  assert.equal(s.groups['3+'].count, 1);
});

test('ads are indexed by every building they matched', () => {
  const data = indexListings({updatedAt: 'x', ads: [ad('a', '00530', 2, 1000, 50, ['B1', 'B2']), ad('b', '00530', 3, 1500, 70, ['B1'])]});
  assert.equal(data.byBuilding.get('B1').length, 2);
  assert.equal(data.byBuilding.get('B2').length, 1);
  assert.equal(groupOf(5), '3+');
  assert.equal(groupOf(null), null);
});
