const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isReversalStatus,
  resolvePaymentStatusTransition,
} = require('../utils/paymentState');

test('não regride pagamento recebido por uma leitura pendente atrasada', () => {
  assert.equal(resolvePaymentStatusTransition('paid', 'pending'), 'paid');
  assert.equal(resolvePaymentStatusTransition('paid', 'refunded'), 'refunded');
});

test('mantém estorno diante de leitura pendente e aceita restauração paga', () => {
  assert.equal(resolvePaymentStatusTransition('refunded', 'pending'), 'refunded');
  assert.equal(resolvePaymentStatusTransition('refunded', 'paid'), 'paid');
});

test('identifica estados que revertem a validade da assinatura', () => {
  assert.equal(isReversalStatus('refunded'), true);
  assert.equal(isReversalStatus('canceled'), true);
  assert.equal(isReversalStatus('failed'), true);
  assert.equal(isReversalStatus('pending'), false);
});
