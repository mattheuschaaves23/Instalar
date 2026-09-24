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
  const nodemailer = require('nodemailer');
  const port = Number(firstEnvValue('SMTP_PORT', 'PORTA_SMTP') || 587);
  return nodemailer.createTransport({
    host: firstEnvValue('SMTP_HOST'),
    port,
    secure: String(firstEnvValue('SMTP_SECURE', 'SMTP_SEGURO')).toLowerCase() === 'true' || port === 465,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    auth: {
      user: firstEnvValue('SMTP_USER'),
      pass: firstEnvValue('SMTP_PASSWORD', 'SMTP_PASS'),
    },
  });
}

async function sendEmailMessage({ to, subject, text, html }) {
  if (!isEmailEnabled()) {
    const error = new Error('smtp_not_configured');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const recipient = String(to || '').trim();
  if (!recipient) {
    const error = new Error('email_recipient_required');
    error.code = 'EMAIL_RECIPIENT_REQUIRED';
    throw error;
  }

  const from = firstEnvValue('SMTP_FROM') || firstEnvValue('SMTP_USER');
  await createTransporter().sendMail({ from, to: recipient, subject, text, html });
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
  const appName = firstEnvValue('APP_NAME') || 'InstalaPro';
  const message = buildPasswordResetMessage({ appName, resetUrl, expiresInMinutes });
  return queueTransactionalEmail({ to, message, category: 'password_reset' });
}

async function sendServiceRequestInterestEmail({ to, clientName, installerName, serviceLabel, trackingUrl }) {
  const appName = firstEnvValue('APP_NAME') || 'InstalaPro';
  const message = buildServiceRequestInterestMessage({
    appName,
    clientName,
    installerName,
    serviceLabel,
    trackingUrl,
  });

  return queueTransactionalEmail({ to, message, category: 'service_interest' });
}

async function sendEmailVerificationEmail({ to, verificationUrl, expiresInMinutes }) {
  const appName = firstEnvValue('APP_NAME') || 'InstalaPro';
  return queueTransactionalEmail({
    to,
    message: buildEmailVerificationMessage({ appName, verificationUrl, expiresInMinutes }),
    category: 'email_verification',
  });
}

async function sendMarketplaceEmail({ to, subject, title, body, actionLabel, actionUrl }) {
  if (!isEmailEnabled() || !to) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = firstEnvValue('SMTP_FROM') || firstEnvValue('SMTP_USER');
  const transporter = {
    sendMail: (message) => queueTransactionalEmail({ to, message, category: 'marketplace' }),
  };
  const safeTitle = escapeHtml(title || subject || 'Atualização da InstalaPro');
  const safeBody = escapeHtml(body || '').replace(/\n/g, '<br />');
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : '';
  const safeActionLabel = escapeHtml(actionLabel || 'Abrir InstalaPro');

  const delivery = await transporter.sendMail({
    from,
    to,
    subject,
    text: [title, body, actionUrl].filter(Boolean).join('\n\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f1f1f">
        <h2 style="margin:0 0 12px">${safeTitle}</h2>
        <p>${safeBody}</p>
        ${safeActionUrl ? `<p><a href="${safeActionUrl}" style="display:inline-block;padding:12px 18px;background:#d89b35;color:#111;text-decoration:none;border-radius:8px;font-weight:700">${safeActionLabel}</a></p>` : ''}
      </div>
    `,
  });

  return delivery;
}

async function queueTransactionalEmail({ to, message, category }) {
  if (!isEmailEnabled() || !to) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  // Loaded lazily: outboundDelivery uses sendEmailMessage to perform the
  // actual SMTP call, while this public helper creates the durable record.
  const { queueEmailDelivery } = require('./outboundDelivery');
  return queueEmailDelivery({ to, message, category });
}

function buildPasswordResetMessage({ appName = 'InstalaPro', resetUrl, expiresInMinutes }) {
  const safeResetUrl = escapeHtml(resetUrl);

  return {
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
  };
}

function buildEmailVerificationMessage({ appName = 'InstalaPro', verificationUrl, expiresInMinutes }) {
  const safeVerificationUrl = escapeHtml(verificationUrl);

  return {
    subject: `Confirme seu e-mail - ${appName}`,
    text: [
      'Confirme seu e-mail para ativar os recursos da sua conta.',
      '',
      `Abra este link: ${verificationUrl}`,
      '',
      `Este link expira em ${expiresInMinutes} minutos.`,
      'Se você não criou uma conta, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f1f1f">
        <h2 style="margin:0 0 12px">Confirme seu e-mail</h2>
        <p>Confirme seu e-mail para ativar os recursos da sua conta na ${escapeHtml(appName)}.</p>
        <p><a href="${safeVerificationUrl}" style="display:inline-block;padding:12px 18px;background:#d89b35;color:#111;text-decoration:none;border-radius:8px;font-weight:700">Confirmar e-mail</a></p>
        <p>Este link expira em ${expiresInMinutes} minutos.</p>
      </div>
    `,
  };
}

function buildServiceRequestInterestMessage({
  appName = 'InstalaPro',
  clientName,
  installerName,
  serviceLabel,
  trackingUrl,
}) {
  const safeClientName = escapeHtml(clientName || 'cliente');
  const safeInstallerName = escapeHtml(installerName || 'Um instalador');
  const safeServiceLabel = escapeHtml(serviceLabel || 'seu pedido');
  const safeTrackingUrl = escapeHtml(trackingUrl);

  return {
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
  };
}

module.exports = {
  buildPasswordResetMessage,
  buildEmailVerificationMessage,
  buildServiceRequestInterestMessage,
  isEmailEnabled,
  sendEmailMessage,
  sendEmailVerificationEmail,
  sendMarketplaceEmail,
  sendPasswordResetEmail,
  sendServiceRequestInterestEmail,
};
