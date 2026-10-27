import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { MemoryCategoriesRepository, MemoryCategoryCache } from './categories.fixtures';
import { CategoriesService } from './categories.service';

function setup() {
  const repository = new MemoryCategoriesRepository();
  const cache = new MemoryCategoryCache();
  const categoriesService = new CategoriesService(
    repository,
    cache,
    'categories-test',
    () => new Date('2026-10-12T15:00:00Z'),
  );
  return { repository, cache, api: request(createApp({ categoriesService })) };
}

test('GET /api/categories returns ordered category metadata and supports ETags', async () => {
  const { repository, api } = setup();
  const response = await api.get('/api/categories').expect(200).expect('etag', '"categories-1"');
  assert.equal(
    response.headers['cache-control'],
    'public, max-age=300, stale-while-revalidate=3600',
  );
  assert.equal(
    response.headers['netlify-cdn-cache-control'],
    'public, durable, s-maxage=300, stale-while-revalidate=86400',
  );
  assert.equal(response.body.version, '1');
  assert.equal(response.body.fetchedAt, '2026-10-12T15:00:00.000Z');
  assert.deepEqual(
    response.body.categories.map((category: { slug: string }) => category.slug),
    ['pratos', 'bebidas'],
  );
  assert.equal(response.body.categories[0].availableProductCount, 2);
  await api.get('/api/categories').set('if-none-match', '"categories-1"').expect(304).expect('');
  assert.equal(repository.listCalls, 1);
});

test('GET /api/categories/:id caches details and reports invalid or missing IDs', async () => {
  const { repository, api } = setup();
  await api
    .get('/api/categories/category-1')
    .expect(200)
    .expect(({ body }) => {
      assert.equal(body.name, 'Pratos');
      assert.equal(body.availableProductCount, 2);
    });
  await api
    .get('/api/categories/category-1')
    .set('if-none-match', '"category-category-1-1"')
    .expect(304);
  assert.equal(repository.detailCalls, 1);
  await api.get('/api/categories/invalid%20id').expect(400, { error: 'Invalid category ID' });
  await api.get('/api/categories/missing').expect(404, { error: 'Category not found' });
});
