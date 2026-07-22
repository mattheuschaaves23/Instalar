const nodemailer = require('nodemailer');

function firstEnvValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function isEmailEnabled() {
  return Boolean(
    firstEnvValue('SMTP_HOST') &&
      firstEnvValue('SMTP_USER') &&
      firstEnvValue('SMTP_PASSWORD', 'SMTP_PASS')
  );
}

function createTransporter() {
  const port = Number(firstEnvValue('SMTP_PORT') || 587);
  return nodemailer.createTransport({
    host: firstEnvValue('SMTP_HOST'),
    port,
    secure: String(firstEnvValue('SMTP_SECURE')).toLowerCase() === 'true' || port === 465,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: {
      user: firstEnvValue('SMTP_USER'),
      pass: firstEnvValue('SMTP_PASSWORD', 'SMTP_PASS'),
    },
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }) {
  if (!isEmailEnabled()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = firstEnvValue('SMTP_FROM') || firstEnvValue('SMTP_USER');
  const appName = firstEnvValue('APP_NAME') || 'InstalaPro';
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to,
    subject: `Redefinição de senha - ${appName}`,
    text: [
      'Recebemos uma solicitação para redefinir sua senha.',
      '',
      `Abra este link para criar uma nova senha: ${resetUrl}`,
      '',
      `Este link expira em ${expiresInMinutes} minutos.`,
      'Se você não solicitou essa alteração, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f1f1f">
        <h2 style="margin:0 0 12px">Redefinição de senha</h2>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p>
          <a href="${safeResetUrl}" style="display:inline-block;padding:12px 18px;background:#d89b35;color:#111;text-decoration:none;border-radius:8px;font-weight:700">
            Criar nova senha
          </a>
        </p>
        <p>Este link expira em ${expiresInMinutes} minutos.</p>
        <p>Se você não solicitou essa alteração, ignore este e-mail.</p>
      </div>
    `,
  });

  return { sent: true };
}

async function sendServiceRequestInterestEmail({ to, clientName, installerName, serviceLabel, trackingUrl }) {
  if (!isEmailEnabled() || !to) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = firstEnvValue('SMTP_FROM') || firstEnvValue('SMTP_USER');
  const appName = firstEnvValue('APP_NAME') || 'InstalaPro';
  const transporter = createTransporter();
  const safeResetUrl = escapeHtml(resetUrl);
  const safeClientName = escapeHtml(clientName || 'cliente');
  const safeInstallerName = escapeHtml(installerName || 'Um instalador');
  const safeServiceLabel = escapeHtml(serviceLabel || 'seu pedido');
  const safeTrackingUrl = escapeHtml(trackingUrl);

  await transporter.sendMail({
    from,
    to,
    subject: `Novo instalador interessado - ${appName}`,
    text: [
      `Olá, ${clientName || 'cliente'}.`,
      '',
      `${installerName || 'Um instalador'} demonstrou interesse em ${serviceLabel || 'seu pedido'}.`,
      'Abra o acompanhamento para conferir o perfil e decidir com quem conversar.',
      '',
      trackingUrl,
      '',
      'Seu telefone só será liberado depois que você escolher o profissional.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f1f1f">
        <h2 style="margin:0 0 12px">Novo instalador interessado</h2>
        <p>Olá, ${safeClientName}.</p>
        <p><strong>${safeInstallerName}</strong> demonstrou interesse em ${safeServiceLabel}.</p>
        <p>Confira o perfil e decida com quem conversar.</p>
        <p>
          <a href="${safeTrackingUrl}" style="display:inline-block;padding:12px 18px;background:#e9b52e;color:#111;text-decoration:none;border-radius:8px;font-weight:700">
            Acompanhar meu pedido
          </a>
        </p>
        <p style="font-size:13px;color:#666">Seu telefone só será liberado depois que você escolher o profissional.</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = {
  isEmailEnabled,
  sendPasswordResetEmail,
  sendServiceRequestInterestEmail,
};
