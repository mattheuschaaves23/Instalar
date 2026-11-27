const { readFileSync } = require('node:fs');
const { BillingError, approveVerifiedTrial, getBillingConfig } = require('../services/managedAsaasTrial');

let pool;
async function main() {
  if (process.argv.length !== 5 || process.argv[4] !== '--titularidade-verificada' || process.stdin.isTTY) {
    throw new BillingError(400, 'Informe instalador e cliente Asaas aprovados. CPF somente pela entrada protegida.');
  }
  pool = require('../config/database');
  const config = getBillingConfig(process.env);
  if (config?.environment !== 'production' || !config.installerId || config.enrollment ||
      process.env.ASAAS_PILOT_SANDBOX_VERIFIED !== 'true') {
    throw new BillingError(400, 'Aprovação de piloto exige homologação concluída, uma conta autorizada e adesões ainda pausadas.');
  }
  const cpf = readFileSync(0, 'utf8').trim();
  await approveVerifiedTrial(pool, config, Number(process.argv[2]), process.argv[3], cpf);
  process.stdout.write('Instalador autorizado para o piloto. Nenhum checkout foi criado.\n');
}
main().catch((error) => {
  process.stderr.write((error instanceof BillingError ? error.message : 'A autorização do piloto não foi concluída.') + '\n');
  process.exitCode = 1;
}).finally(() => pool?.end());
