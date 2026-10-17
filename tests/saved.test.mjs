import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaved} from '../src/data/saved.js';

const memory = () => {
  const m = new Map();
  return {getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v)};
};

test('saved buildings survive a reload of the store, newest first', async () => {
  const storage = memory(),
    saved = createSaved(storage);
  assert.equal(saved.toggle('B1', {address: 'Testikatu 1', place: 'Kallio · 00500', position: [24.9, 60.2]}), true);
  await new Promise(r => setTimeout(r, 5));
  saved.toggle('B2', {address: 'Testikatu 2', position: [24.9, 60.2]});
  const again = createSaved(storage);
  assert.deepEqual(
    again.list().map(r => r.id),
    ['B2', 'B1'],
  );
  assert.equal(again.get('B1').place, 'Kallio · 00500');
  assert.equal(again.size, 2);
  assert.equal(again.toggle('B1', {}), false);
  assert.equal(again.has('B1'), false);
});

test('a store without working storage starts empty and does not throw', () => {
  const broken = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const saved = createSaved(broken);
  assert.deepEqual(saved.list(), []);
  assert.equal(saved.toggle('B1', {address: 'Testikatu 1', position: [24.9, 60.2]}), true);
});
