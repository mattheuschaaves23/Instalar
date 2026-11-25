const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { inflateSync } = require('node:zlib');
const generatePDF = require('../utils/generatePDF');
const { normalizePdfBranding } = require('../utils/pdfBranding');
const { sample } = require('../../shared/pdfBranding.json');

async function inspectPdf(input) {
  const file = await generatePDF(input);
  try {
    const document = (await fs.readFile(file)).toString('latin1');
    assert.match(document, /^%PDF/);
    const pages = document.match(/\/Type \/Page\b/g) || [];
    const textPages = [...document.matchAll(/\/Filter \/FlateDecode[^]*?stream\n([^]*?)\nendstream/g)].flatMap(match => {
      const operators = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      if (!operators.includes('BT\n')) return [];
      return [[...operators.matchAll(/\[(.*?)\]\s*TJ/g)].map(line => [...line[1].matchAll(/<([0-9a-f]+)>/gi)]
        .map(part => Buffer.from(part[1], 'hex').toString('latin1')).join('')).join('\n')];
    });
    assert.equal(textPages.length, pages.length, 'Todas as páginas precisam ter conteúdo');
    return { document, textPages, text: textPages.join('\n') };
  } finally {
    assert.equal(path.dirname(file), path.join(os.tmpdir(), 'instalapro-pdf'));
    await fs.unlink(file);
  }
}

test('orçamento curto cabe em uma página e o rodapé não cria páginas vazias', async () => {
  const { textPages, text } = await inspectPdf({
    budget: { id: 'regression-test', status: 'pending', total_amount: 200, subtotal_rolls: 200, total_rolls: 2, total_area: 9,
      installment_enabled: true, installments_count: 6, interest_free_installments: 3, installment_interest_rate: 5 },
    client: { name: 'Cliente fictício' }, user: { name: 'Profissional fictício' },
    environments: [{ name: 'Sala de teste', height: 3, width: 3, area: 9, rolls_auto: 2, total: 200 }],
  });
  assert.equal(textPages.length, 1);
  assert.match(text, /Total do orçamento/);
  assert.match(text, /6x/);
  assert.match(text, /operadora/i);
  assert.match(text, /Assinatura do cliente/);
  assert.match(text, /1 \/ 1/);
});

test('PDF do valor fechado mostra o total sem imprimir medidas ou rolos zerados', async () => {
  const { text } = await inspectPdf({
    ...sample,
    isPro: true,
    budget: { id: 42, status: 'pending', pricing_mode: 'fixed', total_amount: 450.50, subtotal_rolls: 450.50 },
    branding: { show_measurements: true },
    environments: [],
  });
  assert.match(text, /Serviço a valor fechado/);
  assert.match(text, /450,50/);
  assert.doesNotMatch(text, /0 rolos|Nenhum ambiente discriminado|Dimensões/);
});

test('preserva configurações antigas e valida cor, modelo e texto personalizados', () => {
  const result = normalizePdfBranding({
    brand_name: '  Marca  antiga ', accent_color: '#cda349', intro_text: 'Primeiro parágrafo\r\n\nSegundo',
    template: 'inexistente', show_contact: false, show_signature: 'false', validity_days: -1,
  });
  assert.equal(result.brand_name, 'Marca antiga');
  assert.equal(result.intro_text, 'Primeiro parágrafo\n\nSegundo');
  assert.equal(result.accent_color, '#CDA349');
  assert.equal(result.template, 'studio');
  assert.equal(result.validity_days, 30);
  assert.equal(result.show_contact, false);
  assert.equal(result.show_signature, true);
  assert.equal(normalizePdfBranding({ accent_color: '#27fc00' }).accent_color, '#27FC00');
  assert.equal(normalizePdfBranding({ accent_color: '#175DAA inválida' }).accent_color, '#175DAA');
  assert.equal(normalizePdfBranding({ intro_text: 'a\n'.repeat(160) }).intro_text.split('\n').length, 8);
});

test('exemplo aplica opções ainda não salvas, sem ocultar valores e endereço', async () => {
  const { text } = await inspectPdf({
    ...sample, example: true, user: { name: 'Profissional de exemplo', email: 'privado@example.test' },
    branding: {
      template: 'classic', document_title: 'Proposta revisada', intro_text: 'Obrigado pelo contato.',
      scope_text: 'Escopo definido pelo profissional', validity_days: 7,
      show_contact: false, show_client_contact: false, show_measurements: false, show_signature: false,
    },
  });
  for (const expected of ['Exemplo ilustrativo', 'Proposta revisada', 'Obrigado pelo contato.', 'Escopo definido pelo profissional',
    '30/11/2026', 'Mariana Silva', 'São José', '1.280,00', 'Pix']) assert.ok(text.includes(expected), expected);
  for (const hidden of ['privado@example.test', '99999-0123', 'Medidas', 'Assinatura do cliente']) assert.ok(!text.includes(hidden), hidden);
});

test('PDF real respeita o acesso ao plano e mantém remoção e condições aprovadas', async () => {
  const { text } = await inspectPdf({
    ...sample, budget: { ...sample.budget, status: 'approved', approved_date: '2026-11-23', schedule_date: '2026-11-24',
      total_amount: 1380, removal_cost: 100, removal_price_per_roll: 50, removal_rolls: 2 },
    user: { name: 'Oficina PDF' },
    branding: { document_title: 'Não aplicar sem Pro', show_signature: false },
  });
  assert.ok(!text.includes('Não aplicar sem Pro'));
  for (const expected of ['Aprovado', '24/11/2026', '2 rolos', '1.380,00', 'Assinatura do cliente']) assert.ok(text.includes(expected), expected);
});

test('proposta longa pagina ambientes e mantém o fechamento e a numeração', async () => {
  const { textPages, text } = await inspectPdf({
    ...sample,
    isPro: true,
    environments: Array.from({ length: 62 }, (_, index) => ({ ...sample.environments[0], name: `Ambiente QA ${index + 1}` })),
    branding: { intro_text: 'Apresentação detalhada. '.repeat(12), closing_text: 'Fechamento do orçamento. '.repeat(11) },
  });
  assert.ok(textPages.length >= 3);
  textPages.forEach((page, index) => {
    assert.match(page, /Ambiente QA|Total do orçamento|Escopo e observações|Assinatura do cliente/);
    assert.ok(page.includes(`${index + 1} / ${textPages.length}`));
  });
  assert.match(text, /Ambientes \(continuação\)/);
  assert.match(text, /Ambiente QA 62/);
  assert.match(text, /Total do orçamento/);
});

test('inclui imagens PNG do profissional somente quando habilitadas', async () => {
  const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
  const input = { ...sample, isPro: true, user: { logo, name: 'Marca com logo' } };
  const withLogo = await inspectPdf(input);
  assert.match(withLogo.document, /\/Subtype \/Image/);
  const withoutLogo = await inspectPdf({ ...input, branding: { show_logo: false } });
  assert.doesNotMatch(withoutLogo.document, /\/Subtype \/Image/);
});

test('modelo gratuito mantém valores, sem personalização salva nem identidade Pro', async () => {
  const { text } = await inspectPdf({
    ...sample, user: { name: 'Ana', business_name: 'Companhia Pro' },
    branding: { template: 'classic', brand_name: 'Minha marca', document_subtitle: 'Meu subtítulo', show_environment_prices: false },
  });
  for (const expected of ['Orçamento de instalação', 'Gerado com InstalarPro', 'Total do orçamento', 'R$ 960,00']) assert.ok(text.includes(expected), expected);
  for (const hidden of ['Companhia Pro', 'Minha marca', 'Meu subtítulo']) assert.ok(!text.includes(hidden), hidden);
  const basic = await inspectPdf({ ...sample, isPro: true, branding: { template: 'basic', document_title: 'customizado' } });
  assert.match(basic.text, /Orçamento de instalação/);
  assert.doesNotMatch(basic.text, /customizado/);
});

test('modelos Pro têm hierarquias e renderização distintas', async () => {
  const make = template => inspectPdf({ ...sample, isPro: true, branding: { template } });
  const [studio, classic, technical] = await Promise.all(['studio', 'classic', 'compact'].map(make));
  assert.ok(studio.text.indexOf('Total do orçamento') < studio.text.indexOf('Sala de estar'));
  assert.ok(classic.text.indexOf('Total do orçamento') > classic.text.indexOf('Pagamento e condições'));
  assert.match(classic.document, /\/BaseFont \/Times-Bold/);
  assert.match(technical.document, /\/BaseFont \/Courier-Bold/);
  assert.match(technical.text, /Nº/);
});

test('personalização Pro não muda condições ou total e preserva quebra de página', async () => {
  const { text, document, textPages } = await inspectPdf({
    ...sample, isPro: true,
    environments: Array.from({ length: 47 }, (_, index) => ({ ...sample.environments[0], name: `Bloco ${index + 1}` })),
    branding: {
      template: 'compact', heading_font: 'serif', paper_tone: 'tinted', density: 'spacious',
      document_subtitle: 'Subtítulo do instalador', footer_text: 'Rodapé personalizado',
      show_status: false, show_environment_prices: false, show_pattern: false,
    },
  });
  assert.match(document, /\/BaseFont \/Times-Bold/);
  assert.match(text, /Subtítulo do instalador/);
  assert.match(text, /Bloco 47/);
  assert.match(text, /1\.280,00/);
  assert.doesNotMatch(text, /Pendente|960,00/);
  assert.ok(textPages.length >= 2);
  textPages.forEach(page => assert.match(page, /Rodapé personalizado/));
});
