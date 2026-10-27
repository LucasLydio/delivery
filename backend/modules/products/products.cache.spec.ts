import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRedisCatalogCache } from '../../infra/redis/catalog-cache';

test('Redis connection failure leaves catalog reads available through PostgreSQL', async () => {
  const cache = createRedisCatalogCache('redis://127.0.0.1:1');
  assert.equal(await cache.get('test-key'), null);
  await assert.doesNotReject(cache.set('test-key', 'value', 300));
});
