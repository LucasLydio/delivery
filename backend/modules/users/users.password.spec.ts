import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ScryptPasswordHasher } from './users.password';

test('passwords are salted and verified without storing plaintext', async () => {
  const hasher = new ScryptPasswordHasher();
  const first = await hasher.hash('UmaSenhaSegura123!');
  const second = await hasher.hash('UmaSenhaSegura123!');
  assert.notEqual(first, second);
  assert.equal(first.includes('UmaSenhaSegura123!'), false);
  assert.equal(await hasher.verify('UmaSenhaSegura123!', first), true);
  assert.equal(await hasher.verify('senha-errada', first), false);
  assert.equal(await hasher.verify('qualquer', 'hash-invalido'), false);
});
