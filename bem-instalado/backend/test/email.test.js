const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPasswordResetMessage,
  buildPasswordRevokedNoticeMessage,
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
    installerRegion: 'Palhoça & região',
    serviceLabel: 'Papel "premium"',
    trackingUrl: 'https://instalapro.example/cliente/pedido#pedido=3&acesso=abc',
    profileUrl: 'https://instalapro.example/installers/7?pedido=3#pedido=3&acesso=abc',
  });

  assert.match(message.subject, /Novo instalador interessado/);
  assert.match(message.html, /&lt;Cliente&gt;/);
  assert.match(message.html, /Instalador &amp; Filho/);
  assert.match(message.html, /Papel &quot;premium&quot;/);
  assert.match(message.html, /pedido=3&amp;acesso=abc/);
  assert.match(message.html, /installers\/7\?pedido=3#pedido=3&amp;acesso=abc/);
  assert.match(message.html, /Palhoça &amp; região/);
  assert.match(message.text, /Escolher este instalador/);
  assert.doesNotMatch(message.html, /undefined/);
});

test('monta aviso de senha desativada pelo Google com link de nova senha escapado', () => {
  const recoveryUrl = 'https://instalapro.example/instalador/recuperar-senha?origem=aviso&x=1';
  const message = buildPasswordRevokedNoticeMessage({ appName: 'InstalaPro', provider: 'google', recoveryUrl });

  assert.match(message.subject, /senha antiga foi desativada/);
  assert.match(message.text, /Google/);
  assert.ok(message.text.includes(recoveryUrl));
  assert.match(message.html, /origem=aviso&amp;x=1/);
  assert.doesNotMatch(message.html, /undefined/);
});
