import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { MemoryCustomersRepository } from '../customers/customers.fixtures';
import { CustomersService } from '../customers/customers.service';
import { CustomerTokenService } from '../customers/customers.tokens';
import { MemoryCartsRepository } from './carts.fixtures';
import { CartsService } from './carts.service';

const itemId = '2f841c5a-b05b-4413-a204-70c3ae95f1b1';

function setup() {
  const customersService = new CustomersService(
    new MemoryCustomersRepository(),
    new CustomerTokenService(
      'carts-test-secret-with-more-than-32-characters',
      'test-api',
      'test-pwa',
      900,
    ),
    30,
  );
  const repository = new MemoryCartsRepository();
  const cartsService = new CartsService(
    repository,
    'BRL',
    500,
    300,
    () => new Date('2026-10-12T15:00:00.000Z'),
  );
  return { repository, api: request(createApp({ customersService, cartsService })) };
}

async function accessToken(api: ReturnType<typeof request>): Promise<string> {
  const login = await api
    .post('/api/auth/login')
    .send({ name: 'João Silva', phone: '(11) 9 8765-4321' })
    .expect(201);
  return login.body.accessToken;
}

test('cart synchronization stores selections and increments its revision', async () => {
  const { api } = setup();
  await api.get('/api/cart').expect(401, { error: 'Bearer access token required' });
  const token = await accessToken(api);
  await api
    .get('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .expect(200, { id: null, revision: null, items: [] });

  const first = await api
    .put('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .send({
      revision: null,
      items: [{ id: itemId, productId: 'product-1', quantity: 1, selectedOptionIds: ['option-1'] }],
    })
    .expect(200);
  assert.equal(first.body.revision, '1');

  const second = await api
    .put('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .send({
      revision: '1',
      items: [{ id: itemId, productId: 'product-1', quantity: 2, selectedOptionIds: ['option-1'] }],
    })
    .expect(200);
  assert.equal(second.body.revision, '2');
  assert.equal(second.body.items[0].quantity, 2);

  await api
    .put('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .send({
      revision: '1',
      items: [{ id: itemId, productId: 'product-1', quantity: 3, selectedOptionIds: [] }],
    })
    .expect(409)
    .expect(({ body }) => assert.equal(body.details.currentCart.revision, '2'));
});

test('cart rejects unknown options and quote uses current database prices', async () => {
  const { api, repository } = setup();
  const token = await accessToken(api);
  await api
    .put('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .send({
      revision: null,
      items: [{ id: itemId, productId: 'product-1', quantity: 2, selectedOptionIds: ['option-1'] }],
    })
    .expect(200);

  repository.productsRows[0].basePriceMinor = 2700;
  const quote = await api
    .post('/api/cart/quote')
    .set('authorization', `Bearer ${token}`)
    .expect(201);
  assert.equal(quote.body.subtotalMinor, 6000);
  assert.equal(quote.body.deliveryFeeMinor, 500);
  assert.equal(quote.body.taxMinor, 0);
  assert.equal(quote.body.totalMinor, 6500);
  assert.equal(quote.body.expiresAt, '2026-10-12T15:05:00.000Z');

  await api
    .put('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .send({
      revision: '1',
      items: [
        { id: itemId, productId: 'product-1', quantity: 1, selectedOptionIds: ['another-option'] },
      ],
    })
    .expect(400, {
      error: 'Cart contains invalid items',
      details: [{ itemId, message: 'Selected option does not belong to the product' }],
    });
});

test('clearing the cart is idempotent and removes the server draft', async () => {
  const { api } = setup();
  const token = await accessToken(api);
  await api
    .put('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .send({ revision: null, items: [] })
    .expect(200);
  await api.delete('/api/cart').set('authorization', `Bearer ${token}`).expect(204);
  await api.delete('/api/cart').set('authorization', `Bearer ${token}`).expect(204);
  await api
    .get('/api/cart')
    .set('authorization', `Bearer ${token}`)
    .expect(200, { id: null, revision: null, items: [] });
  await api
    .post('/api/cart/quote')
    .set('authorization', `Bearer ${token}`)
    .expect(400, { error: 'Cart is empty' });
});
