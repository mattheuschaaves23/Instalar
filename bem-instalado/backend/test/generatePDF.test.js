const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const generatePDF = require('../utils/generatePDF');

test('rodapé do PDF não cria páginas vazias ao numerar o orçamento', async () => {
  const file = await generatePDF({
    budget: { id: 'regression-test', status: 'pending', total_amount: 200, subtotal_rolls: 200, total_rolls: 2, total_area: 9,
      installment_enabled: true, installments_count: 6, interest_free_installments: 3, installment_interest_rate: 5 },
    client: { name: 'Cliente fictício' }, user: { name: 'Profissional fictício' },
    environments: [{ name: 'Sala de teste', height: 3, width: 3, area: 9, rolls_auto: 2, total: 200 }],
  });
  try {
    const pdf = await fs.readFile(file);
    assert.match(pdf.toString('latin1'), /^%PDF/);
    const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g) || [];
    assert.equal(pages.length, 2, 'O exemplo deve ter dados e fechamento, sem páginas geradas pelo rodapé');
  } finally {
    // Delete only the unique test artifact returned by this generator.
    assert.equal(path.dirname(file), path.join(os.tmpdir(), 'instalapro-pdf'));
    await fs.unlink(file);
  }
});
