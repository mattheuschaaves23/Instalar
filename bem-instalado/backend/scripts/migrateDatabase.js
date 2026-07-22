const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/database');

const MIGRATIONS_PATH = path.join(__dirname, '..', 'db', 'migrations');
const MIGRATION_LOCK_ID = 19772401;

async function runMigrations() {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(180) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = fs.existsSync(MIGRATIONS_PATH)
      ? fs.readdirSync(MIGRATIONS_PATH).filter((name) => name.endsWith('.sql')).sort()
      : [];

    for (const name of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_PATH, name), 'utf8').replace(/^\uFEFF/, '');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const applied = await client.query('SELECT checksum FROM schema_migrations WHERE name = $1', [name]);

      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`A migracao ${name} foi alterada depois de aplicada.`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
        await client.query('COMMIT');
        console.log(`Migracao aplicada: ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => null);
    client.release();
  }
}

if (require.main === module) {
  const shouldSkipPreview = Boolean(process.env.VERCEL) && process.env.VERCEL_ENV !== 'production';
  const migrationTask = shouldSkipPreview
    ? Promise.resolve(console.log(`Migracoes ignoradas no ambiente Vercel ${process.env.VERCEL_ENV || 'desconhecido'}.`))
    : runMigrations();

  migrationTask
    .then(() => pool.end())
    .catch(async (error) => {
      console.error('Falha ao aplicar migracoes:', error);
      await pool.end().catch(() => null);
      process.exit(1);
    });
}

module.exports = runMigrations;
