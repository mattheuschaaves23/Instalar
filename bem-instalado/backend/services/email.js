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
    auth: {
      user: firstEnvValue('SMTP_USER'),
      pass: firstEnvValue('SMTP_PASSWORD', 'SMTP_PASS'),
    },
  });
}

async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }) {
  if (!isEmailEnabled()) {
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = firstEnvValue('SMTP_FROM') || firstEnvValue('SMTP_USER');
  const appName = firstEnvValue('APP_NAME') || 'Instalar+';
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to,
    subject: `Redefinicao de senha - ${appName}`,
    text: [
      'Recebemos uma solicitacao para redefinir sua senha.',
      '',
      `Abra este link para criar uma nova senha: ${resetUrl}`,
      '',
      `Este link expira em ${expiresInMinutes} minutos.`,
      'Se voce nao solicitou essa alteracao, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f1f1f">
        <h2 style="margin:0 0 12px">Redefinicao de senha</h2>
        <p>Recebemos uma solicitacao para redefinir sua senha.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#d89b35;color:#111;text-decoration:none;border-radius:8px;font-weight:700">
            Criar nova senha
          </a>
        </p>
        <p>Este link expira em ${expiresInMinutes} minutos.</p>
        <p>Se voce nao solicitou essa alteracao, ignore este e-mail.</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = {
  isEmailEnabled,
  sendPasswordResetEmail,
};
