import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import type { OrderSummary } from '../../../shared/commerce-contract';
import { createApp } from '../../app';
import { FakePasswordHasher, MemoryUsersRepository } from '../users/users.fixtures';
import { UsersService } from '../users/users.service';
import { UserTokenService } from '../users/users.tokens';
import {
  FakeMercadoPagoGateway,
  MemoryCheckoutLock,
  MemoryOrdersRepository,
} from './orders.fixtures';
import { OrdersService } from './orders.service';

const order: OrderSummary = {
  id: 'order-admin-1',
  kind: 'confirmed',
  status: 'CONFIRMED',
  paymentStatus: 'ON_DELIVERY',
  paymentMethod: 'PAY_ON_DELIVERY',
  cartRevision: '1',
  currency: 'BRL',
  lines: [
    {
      itemId: 'item-1',
      productId: 'product-1',
      name: 'Bife acebolado',
      quantity: 1,
      selectedOptions: [],
      unitPriceMinor: 3290,
      lineTotalMinor: 3290,
    },
  ],
  subtotalMinor: 3290,
  deliveryFeeMinor: 0,
  paymentFeeMinor: 0,
  discountPercent: 0,
  discountMinor: 0,
  couponCode: null,
  distanceMeters: 1000,
  taxMinor: 0,
  totalMinor: 3290,
  expiresAt: '2026-10-27T15:05:00.000Z',
  mercadoPagoStatus: null,
  mercadoPagoOrderId: null,
  paymentData: null,
  createdAt: '2026-10-27T15:00:00.000Z',
  confirmedAt: '2026-10-27T15:00:00.000Z',
  cancelledAt: null,
};

async function setup() {
  const usersRepository = new MemoryUsersRepository();
  const passwords = new FakePasswordHasher();
  await usersRepository.create({
    name: 'Administrador',
    email: 'admin@loja.com.br',
    profile: 'ADMIN',
    passwordHash: await passwords.hash('SenhaAdmin123!'),
  });
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
      'admin-orders-test-secret-with-more-than-32-characters',
      'test-api',
      'test-admin',
      900,
    ),
    30,
  );
  const ordersRepository = new MemoryOrdersRepository();
  ordersRepository.orders.set(order.id, structuredClone(order));
  const ordersService = new OrdersService(
    ordersRepository,
    new MemoryCheckoutLock(),
    new FakeMercadoPagoGateway(),
    {
      currency: 'BRL',
      fallbackDeliveryPricing: { limitKm: 2, feePerKmMinor: 300 },
      mercadoPagoFeePercent: 10,
      shopLocation: null,
      quoteTtlSeconds: 300,
      lockTtlMs: 15_000,
      unpaidTimeoutMinutes: 5,
    },
  );
  return request(createApp({ usersService, ordersService }));
}

async function login(
  api: ReturnType<typeof request>,
  email: string,
  password: string,
): Promise<string> {
  const response = await api.post('/api/admin/auth/login').send({ email, password }).expect(201);
  return response.body.accessToken;
}

test('ADMIN and MANAGER can view incoming orders', async () => {
  const api = await setup();
  await api.get('/api/admin/orders').expect(401);
  for (const [email, password] of [
    ['admin@loja.com.br', 'SenhaAdmin123!'],
    ['gerente@loja.com.br', 'SenhaManager123!'],
  ] as const) {
    const accessToken = await login(api, email, password);
    const response = await api
      .get('/api/admin/orders?status=CONFIRMED')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].customer.name, 'Cliente Teste');
  }
});

test('an empty status filter returns an unfiltered order page', async () => {
  const api = await setup();
  const accessToken = await login(api, 'admin@loja.com.br', 'SenhaAdmin123!');
  const response = await api
    .get('/api/admin/orders?limit=20&status=')
    .set('authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.equal(response.body.items.length, 1);
  assert.equal(response.body.nextCursor, null);
});

test('MANAGER advances an order only through an allowed status transition', async () => {
  const api = await setup();
  const accessToken = await login(api, 'gerente@loja.com.br', 'SenhaManager123!');
  const updated = await api
    .patch(`/api/admin/orders/${order.id}/status`)
    .set('authorization', `Bearer ${accessToken}`)
    .send({ status: 'PREPARING' })
    .expect(200);
  assert.equal(updated.body.status, 'PREPARING');

  await api
    .patch(`/api/admin/orders/${order.id}/status`)
    .set('authorization', `Bearer ${accessToken}`)
    .send({ status: 'COMPLETED' })
    .expect(409)
    .expect(({ body }) => assert.equal(body.details.currentStatus, 'PREPARING'));
});
