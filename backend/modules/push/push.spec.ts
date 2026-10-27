import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { MemoryCustomersRepository } from '../customers/customers.fixtures';
import { CustomersService } from '../customers/customers.service';
import { CustomerTokenService } from '../customers/customers.tokens';
import type { PushRepository, StoredPushSubscription } from './push.repository';
import type { PushDeletion, PushRegistration } from './push.schema';
import { PushService } from './push.service';

class MemoryPushRepository implements PushRepository {
  registration?: { customerId: string; input: PushRegistration; maximum: number };
  deletion?: { customerId: string; input: PushDeletion };
  async upsert(customerId: string, input: PushRegistration, maximum: number) {
    this.registration = { customerId, input, maximum };
  }
  async delete(customerId: string, input: PushDeletion) {
    this.deletion = { customerId, input };
    return true;
  }
  async listForOrder(): Promise<StoredPushSubscription[]> {
    return [];
  }
  async deleteByEndpoint(): Promise<void> {}
}

const registration = {
  installId: 'f62f7544-749a-4bd8-b205-5fe4b28d11c0',
  subscription: {
    endpoint: 'https://push.example.test/subscription',
    keys: { p256dh: 'public_key', auth: 'auth_key' },
  },
};

function setup() {
  const repository = new MemoryPushRepository();
  const customersService = new CustomersService(
    new MemoryCustomersRepository(),
    new CustomerTokenService(
      'push-test-secret-with-more-than-32-characters',
      'test-api',
      'test-pwa',
      900,
    ),
    30,
  );
  return {
    repository,
    api: request(createApp({ pushService: new PushService(repository), customersService })),
  };
}

async function login(
  api: ReturnType<typeof request>,
): Promise<{ token: string; customerId: string }> {
  const response = await api
    .post('/api/auth/login')
    .send({ name: 'Cliente Teste', phone: '(11) 9 8765-4321' })
    .expect(201);
  return { token: response.body.accessToken, customerId: response.body.customer.id };
}

test('push subscriptions are registered and removed for the authenticated customer', async () => {
  const { repository, api } = setup();
  const { token, customerId } = await login(api);
  await api
    .post('/api/push/subscriptions')
    .set('authorization', `Bearer ${token}`)
    .send(registration)
    .expect(201, { registered: true });
  assert.deepEqual(repository.registration, { customerId, input: registration, maximum: 5 });
  const deletion = {
    installId: registration.installId,
    endpoint: registration.subscription.endpoint,
  };
  await api
    .delete('/api/push/subscriptions')
    .set('authorization', `Bearer ${token}`)
    .send(deletion)
    .expect(200, { removed: true });
  assert.deepEqual(repository.deletion, { customerId, input: deletion });
});

test('push routes require authentication and validate request bodies', async () => {
  const { api } = setup();
  await api
    .post('/api/push/subscriptions')
    .send(registration)
    .expect(401, { error: 'Bearer access token required' });
  await api
    .post('/api/push/subscriptions')
    .set('content-type', 'text/plain')
    .send('payload')
    .expect(415);
  await api
    .post('/api/push/subscriptions')
    .set('content-type', 'application/json')
    .send('{')
    .expect(400, { error: 'Request body must be valid JSON' });
  await api.post('/api/push/subscriptions').send({ installId: 'invalid' }).expect(400);
});
