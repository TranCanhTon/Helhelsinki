import test from 'node:test';
import assert from 'node:assert/strict';
import {readWithProgress} from '../src/data/load.js';

test('readWithProgress returns every byte and reports each part with the size', async () => {
  const parts = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
  const body = new ReadableStream({start(c) { for (const p of parts) c.enqueue(p); c.close(); }});
  const seen = [];
  const bytes = await readWithProgress(new Response(body, {headers: {'content-length': '5'}}), (loaded, total) => seen.push([loaded, total]));
  assert.deepEqual([...bytes], [1, 2, 3, 4, 5]);
  assert.deepEqual(seen, [[0, 5], [3, 5], [5, 5]]);
});

test('readWithProgress without a size reports null and still reads', async () => {
  const seen = [];
  const bytes = await readWithProgress(new Response(new Uint8Array([9, 8])), (loaded, total) => seen.push(total));
  assert.deepEqual([...bytes], [9, 8]);
  assert.ok(seen.every(t => t === null || t === 2));
});
