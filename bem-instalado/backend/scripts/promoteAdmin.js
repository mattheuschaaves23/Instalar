const pool = require('../config/database');

async function promoteAdmin() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Uso: npm run admin:promote -- email@dominio.com');
  }

  const { rows } = await pool.query(
    `
      UPDATE users
      SET is_admin = TRUE, updated_at = NOW()
      WHERE LOWER(email) = $1 AND deleted_at IS NULL
      RETURNING id, name, email, account_type, is_admin
    `,
    [email]
  );

  if (!rows[0]) throw new Error('Conta ativa nao encontrada para esse e-mail.');
  console.log(`Administrador promovido manualmente: ${rows[0].email}`);
}

promoteAdmin()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error.message);
    await pool.end().catch(() => null);
    process.exit(1);
  });
