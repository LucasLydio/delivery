import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../../app';
import { FakePasswordHasher, MemoryUsersRepository } from './users.fixtures';
import { UsersService } from './users.service';
import { UserTokenService } from './users.tokens';

const secret = 'admin-users-test-secret-with-more-than-32-characters';

async function setup() {
  const repository = new MemoryUsersRepository();
  const passwords = new FakePasswordHasher();
  const admin = await repository.create({
    name: 'Administrador',
    email: 'admin@loja.com.br',
    profile: 'ADMIN',
    passwordHash: await passwords.hash('Senha123!'),
  });
  const usersService = new UsersService(
    repository,
    passwords,
    new UserTokenService(secret, 'test-api', 'test-admin', 900),
    30,
  );
  return { repository, admin, api: request(createApp({ usersService })) };
}

async function login(api: { post(url: string): request.Test }) {
  return api
    .post('/api/admin/auth/login')
    .send({ email: 'ADMIN@LOJA.COM.BR', password: 'Senha123!' })
    .expect(201)
    .expect(
      'set-cookie',
      /delivery_admin_refresh=.*Path=\/api\/admin\/auth.*HttpOnly.*SameSite=Strict/,
    );
}

test('admin login normalizes email, hides credentials and authorizes /me', async () => {
  const { api, admin } = await setup();
  const response = await login(api);
  assert.equal(response.body.user.id, admin.id);
  assert.equal(response.body.user.email, 'admin@loja.com.br');
  assert.equal('password' in response.body.user, false);
  assert.equal('passwordHash' in response.body.user, false);
  assert.equal('refreshToken' in response.body, false);
  await api
    .get('/api/admin/me')
    .set('authorization', `Bearer ${response.body.accessToken}`)
    .expect(200);
});

test('ADMIN creates and lists users while MANAGER cannot access user management', async () => {
  const { api } = await setup();
  const adminLogin = await login(api);
  const created = await api
    .post('/api/admin/users')
    .set('authorization', `Bearer ${adminLogin.body.accessToken}`)
    .send({
      name: 'Gerente da Loja',
      email: 'GERENTE@LOJA.COM',
      profile: 'MANAGER',
      password: 'OutraSenha123!',
    })
    .expect(201);
  assert.equal(created.body.email, 'gerente@loja.com');

  await api
    .get('/api/admin/users?search=gerente&profile=MANAGER')
    .set('authorization', `Bearer ${adminLogin.body.accessToken}`)
    .expect(200)
    .expect(({ body }) => {
      assert.equal(body.pagination.total, 1);
      assert.equal(body.users[0].id, created.body.id);
    });

  const managerLogin = await api
    .post('/api/admin/auth/login')
    .send({ email: 'gerente@loja.com', password: 'OutraSenha123!' })
    .expect(201);
  await api
    .get('/api/admin/users')
    .set('authorization', `Bearer ${managerLogin.body.accessToken}`)
    .expect(403, { error: 'Seu perfil não tem permissão para esta ação' });
});

test('refresh tokens rotate and a replay revokes their session family', async () => {
  const { api } = await setup();
  const first = await login(api);
  const firstCookie = first.headers['set-cookie'][0].split(';')[0];
  const refreshed = await api
    .post('/api/admin/auth/refresh')
    .set('cookie', firstCookie)
    .expect(200);
  const secondCookie = refreshed.headers['set-cookie'][0].split(';')[0];
  assert.notEqual(secondCookie, firstCookie);
  await api
    .post('/api/admin/auth/refresh')
    .set('cookie', firstCookie)
    .expect(401, { error: 'Reutilização de refresh token detectada' });
  await api
    .post('/api/admin/auth/refresh')
    .set('cookie', secondCookie)
    .expect(401, { error: 'Reutilização de refresh token detectada' });
});

test('the last administrator cannot be demoted or removed', async () => {
  const { api, admin } = await setup();
  const session = await login(api);
  const authorization = `Bearer ${session.body.accessToken}`;
  await api
    .patch(`/api/admin/users/${admin.id}`)
    .set('authorization', authorization)
    .send({ profile: 'MANAGER' })
    .expect(409, { error: 'É necessário manter ao menos um administrador' });
  await api
    .delete(`/api/admin/users/${admin.id}`)
    .set('authorization', authorization)
    .expect(409, { error: 'Você não pode excluir o próprio usuário' });
});
