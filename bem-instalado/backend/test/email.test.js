const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPasswordResetMessage,
  buildServiceRequestInterestMessage,
} = require('../services/email');

test('monta e-mail de recuperação com URL escapada e texto utilizável', () => {
  const resetUrl = 'https://instalapro.example/reset?token=abc&account=cliente';
  const message = buildPasswordResetMessage({
    appName: 'InstalaPro',
    resetUrl,
    expiresInMinutes: 30,
  });

  assert.match(message.subject, /Redefinição de senha/);
  assert.match(message.text, new RegExp(resetUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(message.html, /token=abc&amp;account=cliente/);
  assert.doesNotMatch(message.html, /undefined/);
});

test('monta aviso de interesse sem expor HTML informado pelo usuário', () => {
  const message = buildServiceRequestInterestMessage({
    appName: 'InstalaPro',
    clientName: '<Cliente>',
    installerName: 'Instalador & Filho',
    serviceLabel: 'Papel "premium"',
    trackingUrl: 'https://instalapro.example/cliente/pedido#pedido=3&acesso=abc',
  });

  assert.match(message.subject, /Novo instalador interessado/);
  assert.match(message.html, /&lt;Cliente&gt;/);
  assert.match(message.html, /Instalador &amp; Filho/);
  assert.match(message.html, /Papel &quot;premium&quot;/);
  assert.match(message.html, /pedido=3&amp;acesso=abc/);
  assert.doesNotMatch(message.html, /undefined/);
});
