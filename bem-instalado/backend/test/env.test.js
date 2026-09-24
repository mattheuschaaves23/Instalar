const assert = require('node:assert/strict');
const test = require('node:test');

const DATABASE_ALIASES = [
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'URL_PRISMA_POSTGRES',
  'BANCO DE DADOS POSTGRES',
  'BANCO_DE_DADOS_POSTGRES',
  'POSTGRES_URL_NO_SSL',
];

function preserveEnvironment(keys) {
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  return () => {
    for (const key of keys) {
      if (previous.get(key) === undefined) delete process.env[key];
      else process.env[key] = previous.get(key);
    }
  };
}

test('aceita aliases traduzidos e gerados pelo Neon para o banco', () => {
  const restore = preserveEnvironment(['DATABASE_URL', ...DATABASE_ALIASES]);

  try {
    for (const key of ['DATABASE_URL', ...DATABASE_ALIASES]) delete process.env[key];
    process.env['BANCO DE DADOS POSTGRES'] = 'postgresql://postgres.example/neon';

    const { applyEnvironmentAliases } = require('../config/env');
    applyEnvironmentAliases();

    assert.equal(process.env.DATABASE_URL, 'postgresql://postgres.example/neon');
  } finally {
    restore();
  }
});
