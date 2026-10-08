const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

async function check() {
  const entry = require('../../../../api/index.js');
  assert.equal(typeof entry, 'function');
  const clients = require('../../controllers/clientController');
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; } };
  await clients.createClient({ body: { name: 'Fictício', phone: '48999999999', document_id: '00000000000' } }, res);
  assert.equal(res.statusCode, 400);
  const generatePDF = require('../../utils/generatePDF');
  const file = await generatePDF({
    budget: { id: 'startup-test', total_amount: 200 },
    client: { name: 'Cliente fictício' }, user: { name: 'QA local' }, environments: [],
  });
  assert.equal(path.dirname(file), path.join(os.tmpdir(), 'instalapro-pdf'));
  try { assert.match((await fs.readFile(file)).toString('latin1'), /^%PDF/); }
  finally { await fs.unlink(file); }
  console.log('serverless-startup-ok');
}
check().catch(error => { console.error(error); process.exitCode = 1; });
