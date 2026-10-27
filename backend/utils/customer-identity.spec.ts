import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '../shared/exceptions';
import {
  formatBrazilianPhone,
  normalizeBrazilianPhone,
  normalizeCustomerName,
} from './customer-identity';

test('customer names become lowercase login keys without spaces or accents', () => {
  assert.deepEqual(normalizeCustomerName('  João   da Silva  '), {
    displayName: 'João da Silva',
    loginName: 'joaodasilva',
  });
  assert.throws(() => normalizeCustomerName('joao@silva'), BadRequestException);
});

test('Brazilian mobile numbers use one canonical database value and one display format', () => {
  assert.equal(normalizeBrazilianPhone('(11) 9 8765-4321'), '+5511987654321');
  assert.equal(normalizeBrazilianPhone('+55 (11) 9 8765-4321'), '+5511987654321');
  assert.equal(formatBrazilianPhone('+5511987654321'), '(11) 9 8765-4321');
  assert.throws(() => normalizeBrazilianPhone('(11) 8765-4321'), BadRequestException);
});
