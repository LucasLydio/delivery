import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyMercadoPagoSignature } from './orders.webhook';

test('Mercado Pago webhook signatures authenticate the order ID and request ID', () => {
  const secret = 'webhook-test-secret';
  const dataId = 'ORD01ABC';
  const requestId = 'request-123';
  const timestamp = '1742505638683';
  const digest = createHmac('sha256', secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`)
    .digest('hex');
  assert.equal(
    verifyMercadoPagoSignature(`ts=${timestamp},v1=${digest}`, requestId, dataId, secret),
    true,
  );
  assert.equal(
    verifyMercadoPagoSignature(`ts=${timestamp},v1=${digest}`, 'different', dataId, secret),
    false,
  );
});
