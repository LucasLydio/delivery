import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { createProductStorage } from '../../config/storage';
import { MemoryCategoriesRepository, MemoryCategoryCache } from '../categories/categories.fixtures';
import { CategoriesService } from '../categories/categories.service';
import { FakePasswordHasher, MemoryUsersRepository } from '../users/users.fixtures';
import { UsersService } from '../users/users.service';
import { UserTokenService } from '../users/users.tokens';
import { MemoryCache, MemoryProductsRepository } from './products.fixtures';
import { ProductsService } from './products.service';

async function setup() {
  const usersRepository = new MemoryUsersRepository();
  const passwords = new FakePasswordHasher();
  await usersRepository.create({
    name: 'Gerente',
    email: 'gerente@loja.com.br',
    profile: 'MANAGER',
    passwordHash: await passwords.hash('SenhaManager123!'),
  });
  const usersService = new UsersService(
    usersRepository,
    passwords,
    new UserTokenService(
      'catalog-admin-secret-with-more-than-32-characters',
      'test-api',
      'test-admin',
      900,
    ),
    30,
  );
  const categoriesRepository = new MemoryCategoriesRepository();
  const productsRepository = new MemoryProductsRepository();
  const categoriesService = new CategoriesService(
    categoriesRepository,
    new MemoryCategoryCache(),
    'test',
  );
  const productsService = new ProductsService(
    productsRepository,
    new MemoryCache(),
    'BRL',
    createProductStorage({
      STORAGE_PROVIDER: 'local',
      PRODUCT_IMAGE_BASE_URL: '/images/products/',
      LOCAL_PRODUCT_IMAGE_DIRECTORY: 'public/images/products',
    }),
    'test',
  );
  const api = request(createApp({ usersService, categoriesService, productsService }));
  const login = await api
    .post('/api/admin/auth/login')
    .send({ email: 'gerente@loja.com.br', password: 'SenhaManager123!' })
    .expect(201);
  return {
    api,
    authorization: `Bearer ${login.body.accessToken}`,
    categoriesRepository,
    productsRepository,
  };
}

test('MANAGER creates, edits, and disables categories', async () => {
  const { api, authorization, categoriesRepository } = await setup();
  const created = await api
    .post('/api/admin/categories')
    .set('authorization', authorization)
    .send({ name: 'Sobremesas', sortOrder: 30 })
    .expect(201);
  assert.equal(created.body.slug, 'sobremesas');
  assert.equal(created.body.available, true);

  const updated = await api
    .patch(`/api/admin/categories/${created.body.id}`)
    .set('authorization', authorization)
    .send({ name: 'Doces', available: false })
    .expect(200);
  assert.equal(updated.body.name, 'Doces');
  assert.equal(updated.body.available, false);
  assert.equal(categoriesRepository.revision, 3);

  const listed = await api
    .get('/api/admin/categories')
    .set('authorization', authorization)
    .expect(200);
  assert.equal(
    listed.body.categories.some((category: { id: string }) => category.id === created.body.id),
    true,
  );
});

test('MANAGER creates and edits products, groups, and availability options', async () => {
  const { api, authorization, productsRepository } = await setup();
  const created = await api
    .post('/api/admin/products')
    .set('authorization', authorization)
    .send({
      name: 'Prato executivo',
      description: 'Arroz, feijão e proteína',
      categoryId: 'category-1',
      basePriceMinor: 2990,
      sortOrder: 20,
    })
    .expect(201);
  assert.equal(created.body.slug, 'prato-executivo');

  const withGroup = await api
    .post(`/api/admin/products/${created.body.id}/option-groups`)
    .set('authorization', authorization)
    .send({ name: 'Proteína', minSelections: 1, maxSelections: 1, sortOrder: 10 })
    .expect(201);
  const groupId = withGroup.body.optionGroups[0].id;

  const withOption = await api
    .post(`/api/admin/products/option-groups/${groupId}/options`)
    .set('authorization', authorization)
    .send({ name: 'Frango grelhado', priceDeltaMinor: 0, sortOrder: 10 })
    .expect(201);
  const optionId = withOption.body.optionGroups[0].options[0].id;

  const optionDisabled = await api
    .patch(`/api/admin/products/options/${optionId}`)
    .set('authorization', authorization)
    .send({ available: false })
    .expect(200);
  assert.equal(optionDisabled.body.optionGroups[0].options[0].available, false);

  const productDisabled = await api
    .patch(`/api/admin/products/${created.body.id}`)
    .set('authorization', authorization)
    .send({ available: false, basePriceMinor: 3190 })
    .expect(200);
  assert.equal(productDisabled.body.available, false);
  assert.equal(productDisabled.body.basePriceMinor, 3190);
  assert.equal(productsRepository.revision, 6);
});
