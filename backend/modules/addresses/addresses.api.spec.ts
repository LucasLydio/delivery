import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { MemoryCustomersRepository } from '../customers/customers.fixtures';
import { CustomersService } from '../customers/customers.service';
import { CustomerTokenService } from '../customers/customers.tokens';
import { MemoryAddressesRepository } from './addresses.fixtures';
import { AddressesService } from './addresses.service';

function setup(maximumAddresses = 10) {
  const customersService = new CustomersService(
    new MemoryCustomersRepository(),
    new CustomerTokenService(
      'addresses-test-secret-with-more-than-32-characters',
      'test-api',
      'test-pwa',
      900,
    ),
    30,
  );
  const addressesRepository = new MemoryAddressesRepository();
  const api = request(
    createApp({
      customersService,
      addressesService: new AddressesService(addressesRepository, maximumAddresses),
    }),
  );
  return { api, addressesRepository };
}

async function login(
  api: ReturnType<typeof request>,
  name: string,
  phone: string,
): Promise<string> {
  const response = await api.post('/api/auth/login').send({ name, phone }).expect(201);
  return response.body.accessToken;
}

const home = {
  label: 'Casa',
  line1: 'Rua das Flores, 100',
  city: 'São Paulo',
  region: 'sp',
  postalCode: '01310-100',
  deliveryInstructions: 'Portaria 2',
  locationPin: { latitude: -23.561684, longitude: -46.655981, accuracyMeters: 12.5 },
};

test('address routes require authentication and persist a validated location pin', async () => {
  const { api } = setup();
  await api.get('/api/me/addresses').expect(401, { error: 'Bearer access token required' });
  const token = await login(api, 'João Silva', '(11) 9 8765-4321');

  const created = await api
    .post('/api/me/addresses')
    .set('authorization', `Bearer ${token}`)
    .send(home)
    .expect(201);
  assert.equal(created.body.postalCode, '01310-100');
  assert.equal(created.body.region, 'SP');
  assert.equal(created.body.countryCode, 'BR');
  assert.equal(created.body.isDefault, true);
  assert.deepEqual(created.body.locationPin, home.locationPin);

  await api
    .post('/api/me/addresses')
    .set('authorization', `Bearer ${token}`)
    .send({ ...home, locationPin: { latitude: -91, longitude: -46 } })
    .expect(400);
});

test('address creation is bounded per customer', async () => {
  const { api } = setup(1);
  const token = await login(api, 'Limite Teste', '(11) 9 7777-8888');
  await api
    .post('/api/me/addresses')
    .set('authorization', `Bearer ${token}`)
    .send(home)
    .expect(201);
  await api
    .post('/api/me/addresses')
    .set('authorization', `Bearer ${token}`)
    .send({ ...home, label: 'Trabalho' })
    .expect(409, { error: 'Address limit reached' });
});

test('default changes, deletion promotion, and customer ownership are enforced', async () => {
  const { api } = setup();
  const firstToken = await login(api, 'Ana Lima', '(21) 9 1111-2222');
  const secondToken = await login(api, 'Bia Costa', '(31) 9 3333-4444');

  const first = await api
    .post('/api/me/addresses')
    .set('authorization', `Bearer ${firstToken}`)
    .send(home)
    .expect(201);
  const second = await api
    .post('/api/me/addresses')
    .set('authorization', `Bearer ${firstToken}`)
    .send({ ...home, label: 'Trabalho', line1: 'Avenida Paulista, 1000', isDefault: true })
    .expect(201);
  assert.equal(second.body.isDefault, true);

  const list = await api
    .get('/api/me/addresses')
    .set('authorization', `Bearer ${firstToken}`)
    .expect(200);
  assert.deepEqual(
    list.body.map((address: { id: string }) => address.id),
    [second.body.id, first.body.id],
  );
  assert.equal(list.body.filter((address: { isDefault: boolean }) => address.isDefault).length, 1);

  await api
    .patch(`/api/me/addresses/${first.body.id}`)
    .set('authorization', `Bearer ${secondToken}`)
    .send({ label: 'Inválido' })
    .expect(404, { error: 'Address not found' });

  await api
    .delete(`/api/me/addresses/${second.body.id}`)
    .set('authorization', `Bearer ${firstToken}`)
    .expect(204);
  const remaining = await api
    .get('/api/me/addresses')
    .set('authorization', `Bearer ${firstToken}`)
    .expect(200);
  assert.equal(remaining.body[0].id, first.body.id);
  assert.equal(remaining.body[0].isDefault, true);
});
