import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { MemoryCustomersRepository } from './customers.fixtures';
import { CustomersService } from './customers.service';
import { CustomerTokenService } from './customers.tokens';

const testSecret = 'customers-test-secret-with-more-than-32-characters';

function setup() {
  const repository = new MemoryCustomersRepository();
  const tokens = new CustomerTokenService(testSecret, 'test-api', 'test-pwa', 900);
  const customersService = new CustomersService(repository, tokens, 30);
  return { repository, api: request(createApp({ customersService })) };
}

test('login normalizes identity, sets an HttpOnly refresh cookie, and authorizes /me', async () => {
  const { repository, api } = setup();
  const login = await api
    .post('/api/auth/login')
    .send({ name: 'João da Silva', phone: '(11) 9 8765-4321' })
    .expect(201)
    .expect('set-cookie', /delivery_refresh=.*HttpOnly.*SameSite=Strict/);

  assert.equal(login.body.customer.name, 'João da Silva');
  assert.equal(login.body.customer.phone, '(11) 9 8765-4321');
  assert.equal(typeof login.body.accessToken, 'string');
  assert.equal('refreshToken' in login.body, false);
  assert.equal((await repository.findByPhone('+5511987654321'))?.loginName, 'joaodasilva');

  await api
    .get('/api/me')
    .set('authorization', `Bearer ${login.body.accessToken}`)
    .expect(200, login.body.customer);
  await api.get('/api/me').expect(401, { error: 'Bearer access token required' });
});

test('profile updates normalize login fields and reject invalid names', async () => {
  const { api } = setup();
  const login = await api
    .post('/api/auth/login')
    .send({ name: 'Maria Souza', phone: '(21) 9 1234-5678' })
    .expect(201);

  await api
    .patch('/api/me')
    .set('authorization', `Bearer ${login.body.accessToken}`)
    .send({ name: 'Maria de Souza', email: 'MARIA@EXAMPLE.COM' })
    .expect(200)
    .expect(({ body }) => {
      assert.equal(body.name, 'Maria de Souza');
      assert.equal(body.email, 'maria@example.com');
    });

  await api
    .patch('/api/me')
    .set('authorization', `Bearer ${login.body.accessToken}`)
    .send({ name: 'maria@souza' })
    .expect(400, { error: 'Name must contain only letters and spaces' });
});

test('refresh tokens rotate once and replay revokes the replacement family', async () => {
  const { api } = setup();
  const login = await api
    .post('/api/auth/login')
    .send({ name: 'Ana Lima', phone: '(31) 9 2222-3333' })
    .expect(201);
  const firstCookie = login.headers['set-cookie'][0].split(';')[0];

  const refreshed = await api.post('/api/auth/refresh').set('cookie', firstCookie).expect(200);
  const secondCookie = refreshed.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(secondCookie, firstCookie);
  assert.notEqual(refreshed.body.accessToken, login.body.accessToken);

  await api
    .post('/api/auth/refresh')
    .set('cookie', firstCookie)
    .expect(401, { error: 'Refresh token reuse detected' });
  await api
    .post('/api/auth/refresh')
    .set('cookie', secondCookie)
    .expect(401, { error: 'Refresh token reuse detected' });
});

test('a phone already assigned to a different normalized name cannot log in', async () => {
  const { api } = setup();
  await api
    .post('/api/auth/login')
    .send({ name: 'Carlos Melo', phone: '(41) 9 4444-5555' })
    .expect(201);
  await api
    .post('/api/auth/login')
    .send({ name: 'Outra Pessoa', phone: '(41) 9 4444-5555' })
    .expect(401, { error: 'Invalid name or phone' });
});
