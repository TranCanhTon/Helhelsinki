import test from 'node:test';
import assert from 'node:assert/strict';
import {placeKind, nearestPlaces, PLACE_KEYS} from '../src/data/places.js';

test('OpenStreetMap tags sort into place kinds', () => {
  assert.equal(placeKind({shop: 'supermarket', name: 'S-market'}), 'grocery');
  assert.equal(placeKind({shop: 'convenience', brand: 'K-Market'}), 'grocery');
  assert.equal(placeKind({shop: 'convenience', brand: 'Neste'}), null);
  assert.equal(placeKind({shop: 'convenience', name: 'St1 Kallio'}), null);
  assert.equal(placeKind({amenity: 'pharmacy'}), 'pharmacy');
  assert.equal(placeKind({leisure: 'fitness_centre'}), 'gym');
  assert.equal(placeKind({shop: 'alcohol', brand: 'Alko'}), 'alko');
  assert.equal(placeKind({shop: 'alcohol', name: 'Vallilan Panimo'}), null);
  assert.equal(placeKind({amenity: 'cafe'}), 'cafe');
  assert.equal(placeKind({amenity: 'bank'}), null);
});

test('nearest place of each kind within the radius', () => {
  const rows = [
    ['grocery', 'Far', 24.9500, 60.1700],
    ['grocery', 'Near', 24.9410, 60.1700],
    ['pharmacy', null, 24.9400, 60.1720],
    ['gym', 'Too far', 24.9800, 60.1700],
  ];
  const near = nearestPlaces(rows, 1000)([24.94, 60.17]);
  assert.deepEqual(Object.keys(near), PLACE_KEYS);
  assert.equal(near.grocery.name, 'Near');
  assert.ok(near.grocery.distanceM > 50 && near.grocery.distanceM < 60);
  assert.equal(near.pharmacy.name, null);
  assert.ok(Math.abs(near.pharmacy.distanceM - 223) < 2);
  assert.equal(near.gym, null);
  assert.equal(near.cafe, null);
  assert.equal(nearestPlaces([])([24.94, 60.17]).grocery, null);
});
