const { readFileSync } = require('node:fs');
const pool = require('../config/database');
const { BillingError, approveVerifiedTrial, getManagedTrialConfig } = require('../services/managedAsaasTrial');

async function main() {
  const config = getManagedTrialConfig(process.env);
  const [userId, customerId, approval] = process.argv.slice(2);
  if (!config || process.env.ASAAS_MANAGED_TRIAL_ISOLATED_DB !== 'true' || approval !== '--identidade-ficticia-conferida') {
    throw new BillingError(400, 'Use somente a configuração de homologação, com banco isolado e identidade fictícia previamente conferida.');
  }
  if (process.stdin.isTTY) throw new BillingError(400, 'Forneça o CPF fictício somente pela entrada protegida, sem terminal interativo ou argumentos.');
  const cpf = readFileSync(0, 'utf8').trim();
  await approveVerifiedTrial(pool, config, Number(userId), customerId, cpf);
  process.stdout.write('Identidade de teste confirmada para um único checkout.\n');
}

main().catch((error) => {
  process.stderr.write((error instanceof BillingError ? error.message : 'A aprovação não foi concluída.') + '\n');
  process.exitCode = 1;
}).finally(() => pool.end());
