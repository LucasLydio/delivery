import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { MemoryCustomersRepository } from '../customers/customers.fixtures';
import { CustomersService } from '../customers/customers.service';
import { CustomerTokenService } from '../customers/customers.tokens';
import {
  FakeMercadoPagoGateway,
  MemoryCheckoutLock,
  MemoryOrdersRepository,
} from './orders.fixtures';
import { OrdersService } from './orders.service';

function setup() {
  const customersService = new CustomersService(
    new MemoryCustomersRepository(),
    new CustomerTokenService(
      'orders-test-secret-with-more-than-32-characters',
      'test-api',
      'test-pwa',
      900,
    ),
    30,
  );
  const repository = new MemoryOrdersRepository();
  const lock = new MemoryCheckoutLock();
  const gateway = new FakeMercadoPagoGateway();
  const ordersService = new OrdersService(
    repository,
    lock,
    gateway,
    {
      currency: 'BRL',
      fallbackDeliveryPricing: { limitKm: 2, feePerKmMinor: 300 },
      mercadoPagoFeePercent: 10,
      shopLocation: { latitude: -23.5505, longitude: -46.6333 },
      quoteTtlSeconds: 300,
      lockTtlMs: 15_000,
      unpaidTimeoutMinutes: 5,
    },
    () => new Date('2026-10-12T15:00:00.000Z'),
  );
  return {
    api: request(createApp({ customersService, ordersService })),
    repository,
    lock,
    gateway,
  };
}

async function token(api: ReturnType<typeof request>): Promise<string> {
  return (
    await api
      .post('/api/auth/login')
      .send({ name: 'João Silva', phone: '(11) 9 8765-4321' })
      .expect(201)
  ).body.accessToken;
}

test('pay on delivery confirms the order and paginates the order history', async () => {
  const { api, repository } = setup();
  const access = await token(api);
  const result = await api
    .post('/api/checkout')
    .set('authorization', `Bearer ${access}`)
    .set('x-idempotency-key', 'checkout-offline-1')
    .send({
      cartRevision: '1',
      addressId: 'address-1',
      payment: { method: 'PAY_ON_DELIVERY' },
    })
    .expect(201);
  assert.equal(result.body.status, 'CONFIRMED');
  assert.equal(result.body.paymentStatus, 'ON_DELIVERY');
  assert.equal(result.body.totalMinor, 2800);
  await api
    .get(`/api/orders/${result.body.id}`)
    .set('authorization', `Bearer ${access}`)
    .expect(200);

  repository.orders.set('order-older', {
    ...structuredClone(result.body),
    id: 'order-older',
    createdAt: '2026-10-11T15:00:00.000Z',
  });
  const firstPage = await api
    .get('/api/orders?limit=1')
    .set('authorization', `Bearer ${access}`)
    .expect(200);
  assert.deepEqual(
    firstPage.body.items.map((order: { id: string }) => order.id),
    [result.body.id],
  );
  assert.equal(typeof firstPage.body.nextCursor, 'string');
  const secondPage = await api
    .get(`/api/orders?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`)
    .set('authorization', `Bearer ${access}`)
    .expect(200);
  assert.deepEqual(
    secondPage.body.items.map((order: { id: string }) => order.id),
    ['order-older'],
  );
  assert.equal(secondPage.body.nextCursor, null);
  await api.get('/api/orders?limit=51').set('authorization', `Bearer ${access}`).expect(400);
  await api
    .get('/api/orders?cursor=invalid')
    .set('authorization', `Bearer ${access}`)
    .expect(400, { error: 'Invalid order cursor' });
});

test('card checkout is idempotent and calls Mercado Pago once', async () => {
  const { api, gateway } = setup();
  const access = await token(api);
  const body = {
    cartRevision: '1',
    addressId: 'address-1',
    couponCode: 'dez',
    payment: {
      method: 'MERCADO_PAGO_CARD',
      paymentMethodId: 'visa',
      paymentType: 'credit_card',
      token: 'one-time-card-token',
      installments: 1,
      payer: { email: 'cliente@example.com' },
    },
  };
  const first = await api
    .post('/api/checkout')
    .set('authorization', `Bearer ${access}`)
    .set('x-idempotency-key', 'checkout-card-1')
    .send(body)
    .expect(201);
  assert.equal(first.body.status, 'CONFIRMED');
  assert.equal(first.body.paymentStatus, 'PAID');
  assert.equal(first.body.totalMinor, 2801);
  await api
    .post('/api/checkout')
    .set('authorization', `Bearer ${access}`)
    .set('x-idempotency-key', 'checkout-card-1')
    .send(body)
    .expect(200)
    .expect('x-idempotent-replay', 'true');
  assert.equal(gateway.calls.length, 1);
  assert.equal(gateway.calls[0].payment.method, 'MERCADO_PAGO_CARD');
});

test('pending Pix returns 409 on retry and a busy cart returns 429', async () => {
  const pending = setup();
  pending.gateway.result = {
    providerOrderId: 'mp-pix-1',
    status: 'action_required',
    outcome: 'pending',
    paymentData: { qrCode: '000201' },
  };
  const access = await token(pending.api);
  const body = {
    cartRevision: '1',
    addressId: 'address-1',
    payment: { method: 'MERCADO_PAGO_PIX', payer: { email: 'pix@example.com' } },
  };
  const first = await pending.api
    .post('/api/checkout')
    .set('authorization', `Bearer ${access}`)
    .set('x-idempotency-key', 'checkout-pix-1')
    .send(body)
    .expect(201);
  assert.equal(first.body.status, 'PAYMENT_PENDING');
  assert.equal(first.body.paymentData.qrCode, '000201');
  await pending.api
    .post('/api/checkout')
    .set('authorization', `Bearer ${access}`)
    .set('x-idempotency-key', 'checkout-pix-1')
    .send(body)
    .expect(409);

  const busy = setup();
  busy.lock.locked = true;
  const busyAccess = await token(busy.api);
  await busy.api
    .post('/api/checkout')
    .set('authorization', `Bearer ${busyAccess}`)
    .set('x-idempotency-key', 'checkout-busy-1')
    .send(body)
    .expect(429)
    .expect(({ body: responseBody }) => assert.equal(responseBody.details.retryAfterSeconds, 15));
});
