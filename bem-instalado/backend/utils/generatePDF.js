const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');
const { decodeAssetKey, isObjectStorageConfigured } = require('../services/objectStorage');
const { defaultScope } = require('../../shared/pdfBranding.json');
const { normalizePdfBranding, normalizeText } = require('./pdfBranding');

const INK = '#10243C';
const MUTED = '#45586D';
const RULE = '#D8E1EA';
const PAPER = '#FFFFFF';
const M = 42;
const LIMIT_IMAGE = 4 * 1024 * 1024;
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimalFormatter = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = value => currencyFormatter.format(number(value));
const decimal = value => decimalFormatter.format(number(value));
const clean = (value, limit = 260) => normalizeText(String(value ?? ''), limit);
const methods = { pix: 'Pix', boleto: 'Boleto', debit_card: 'Cartão de débito', credit_card: 'Cartão à vista', cash: 'Dinheiro', bank_transfer: 'Transferência' };

function formatDate(value) {
  if (!value) return '';
  // Dates chosen in the calendar have no time; do not shift the day for UTC midnight.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(date);
}

function validUntil(value, days) {
  const issue = formatDate(value || new Date()) || formatDate(new Date());
  const [day, month, year] = issue.split('/').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return formatDate(date);
}

function accentInk(hex) {
  // Keep bright custom swatches for decoration, but darken them for readable text on paper.
  const rgb = hex.slice(1).match(/../g).map(part => parseInt(part, 16));
  function luminance(channels) {
    return channels.map(value => {
      const srgb = value / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }
  while (luminance(rgb) > 0.14) rgb.forEach((value, index) => { rgb[index] = Math.floor(value * 0.87); });
  return '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');
}

async function brandImage(value, userId, kind) {
  if (typeof value !== 'string') return null;
  const data = /^data:image\/(?:png|jpeg);base64,([\w+/=]+)$/i.exec(value);
  if (data && data[1].length <= Math.ceil(LIMIT_IMAGE / 3) * 4) {
    return Buffer.from(data[1], 'base64');
  }
  const suffix = /^\/api\/public\/assets\/([\w-]+)$/.exec(value);
  if (!suffix || !userId || !isObjectStorageConfigured()) return null;
  const pathname = decodeAssetKey(suffix[1]);
  if (!pathname.startsWith(`uploads/${userId}/${kind}/`)) return null;
  try {
    const { get } = require('@vercel/blob');
    const asset = await get(pathname, { access: 'private', abortSignal: AbortSignal.timeout(3500) });
    if (!asset?.stream) return null;
    const type = asset.blob?.contentType || asset.headers?.get?.('content-type');
    if (!['image/png', 'image/jpeg'].includes(type)) {
      await asset.stream.cancel();
      return null;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of asset.stream) {
      size += chunk.byteLength;
      if (size > LIMIT_IMAGE) return null;
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

function upfrontTerms(value) {
  let terms = value;
  if (typeof value === 'string') {
    try { terms = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(terms)) return [];
  return terms.slice(0, 12).flatMap(term => {
    const key = clean(term?.method).toLowerCase();
    const percent = number(term?.discount_percent);
    if (!Object.hasOwn(methods, key) || percent < 0 || percent > 100) return [];
    return [percent > 0 ? `${methods[key]} (${percent.toLocaleString('pt-BR')}% de desconto)` : methods[key]];
  });
}

function render(doc, { budget, client, environments, user, isPro, branding, logo, photo, installment, example }) {
  const width = doc.page.width - 2 * M;
  const right = M + width;
  const compact = branding.template === 'compact';
  const classic = branding.template === 'classic';
  const accent = branding.accent_color;
  const accentText = accentInk(accent);
  const brand = branding.brand_name || clean(user.business_name, 80) || (isPro ? clean(user.name, 80) : '') || 'InstalarPro';
  const issue = formatDate(budget.created_at || new Date());
  const valid = validUntil(budget.created_at, branding.validity_days);
  const id = clean(budget.id, 45);
  const identifier = `Orçamento #${id}`;
  const rawStatus = clean(budget.status, 24).toLowerCase();
  const status = ({ approved: 'Aprovado', rejected: 'Rejeitado', pending: 'Pendente', completed: 'Concluído', canceled: 'Cancelado' })[rawStatus] || 'Pendente';
  const total = money(budget.total_amount);
  const pad = compact ? 12 : 16;
  let y = 0;

  const style = (size, color = INK, bold = false) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
  const measure = (value, w, size, bold = false) => style(size, INK, bold).heightOfString(value, { width: w, lineGap: 2 });
  function write(value, x, top, w, { size = 10, color = INK, bold = false, align = 'left' } = {}) {
    style(size, color, bold).text(value, x, top, { width: w, align, lineGap: 2 });
  }
  function fixed(value, x, top, w, { size = 9, color = MUTED, bold = false, align = 'left' } = {}) {
    style(size, color, bold);
    let output = value;
    if (doc.widthOfString(output) > w) {
      while (output.length && doc.widthOfString(output + '...') > w) output = output.slice(0, -1);
      output += '...';
    }
    doc.text(output, align === 'right' ? x + w - doc.widthOfString(output) : x, top, { width: 0, lineBreak: false });
  }
  const rule = (top, from = M, to = right) => doc.moveTo(from, top).lineTo(to, top).lineWidth(0.7).stroke(RULE);
  const image = (data, x, top, w, h) => {
    if (!data) return false;
    try {
      doc.image(data, x, top, { fit: [w, h], align: 'center', valign: 'center' });
      return true;
    } catch {
      return false;
    }
  };

  function header(continued = false) {
    if (continued) {
      fixed(brand, M, 32, width / 2, { size: 12, bold: true, color: INK });
      fixed(`${identifier} / Continuação`, M + width / 2, 34, width / 2, { align: 'right' });
      rule(56);
      y = 73;
      return;
    }
    const top = compact ? 30 : 40;
    const darkText = classic ? PAPER : INK;
    const secondary = classic ? '#DFEAF5' : MUTED;
    const mediaBlock = photo ? 56 : 0;
    const rightWidth = 119;
    const brandX = M + (logo ? 61 : 0);
    const maxLeft = width - rightWidth - mediaBlock - 17;
    const titleSize = compact ? 19 : 24;
    const titleHeight = measure(branding.document_title, maxLeft, titleSize, true);
    const headerBottom = top + 21 + titleHeight + pad;
    if (classic) doc.rect(0, 0, doc.page.width, headerBottom + 6).fill(INK);
    if (!compact) doc.rect(classic ? 0 : M, classic ? 0 : 22, classic ? doc.page.width : width, classic ? 6 : 4).fill(accent);
    const left = image(logo, M, top - 8, 48, 27) ? brandX : M;
    fixed(brand, left, top, maxLeft - (left - M), { size: 11, color: classic ? PAPER : accentText, bold: true });
    write(branding.document_title, M, top + 19, maxLeft, { size: titleSize, color: darkText, bold: true });
    const metaX = right - mediaBlock - rightWidth;
    fixed(identifier, metaX, top, rightWidth, { size: 11, color: darkText, bold: true, align: 'right' });
    fixed(`Emissão: ${issue || '-'}`, metaX, top + 17, rightWidth, { color: secondary, align: 'right' });
    fixed(example ? 'Exemplo ilustrativo' : status, metaX, top + 32, rightWidth, { color: secondary, align: 'right' });
    image(photo, right - 44, top - 4, 44, 44);
    if (!classic) rule(headerBottom);
    y = headerBottom + (compact ? 15 : 20);
  }

  function room(height) {
    if (y + height <= doc.page.height - 62) return false;
    doc.addPage();
    header(true);
    return true;
  }
  function heading(title) {
    write(title, M, y, width, { size: 13, bold: true });
    y += 19;
  }
  function paragraph(title, content) {
    if (!content) return;
    const height = measure(content, width - 15, 10);
    room(height + 32);
    write(title, M + 12, y, width - 15, { size: 10, color: accentText, bold: true });
    doc.rect(M, y, 2, height + 18).fill(accent);
    write(content, M + 12, y + 15, width - 15);
    y += height + 17 + pad;
  }

  header();
  paragraph('Apresentação', branding.intro_text);

  const address = [
    [clean(client.street, 130), clean(client.house_number, 30), clean(client.complement, 80)].filter(Boolean).join(', '),
    [clean(client.neighborhood, 80), [clean(client.city, 60), clean(client.state, 8)].filter(Boolean).join(' - ')].filter(Boolean).join(', '),
    clean(client.zip_code, 14) && `CEP ${clean(client.zip_code, 14)}`,
  ].filter(Boolean).join(' / ') || clean(client.address, 300);
  const half = (width - 20) / 2;
  const contact = (person, enabled) => enabled ? [clean(person.phone, 40), clean(person.email, 125)].filter(Boolean) : [];
  const parties = [
    { label: 'Preparado por', name: clean(user.name, 100) || brand, lines: contact(user, branding.show_contact) },
    { label: 'Cliente e local', name: clean(client.name, 120) || 'Cliente', lines: [...contact(client, branding.show_client_contact), address].filter(Boolean) },
  ];
  const partyHeight = Math.max(...parties.map(({ name, lines }) =>
    measure(name, half, 11, true) + lines.reduce((sum, line) => sum + measure(line, half, 9) + 2, 0)));
  room(partyHeight + 29);
  parties.forEach(({ label, name, lines }, index) => {
    const x = M + index * (half + 20);
    write(label, x, y, half, { size: 9, color: MUTED });
    write(name, x, y + 14, half, { size: 11, bold: true });
    let lineY = y + 16 + measure(name, half, 11, true);
    for (const line of lines) {
      write(line, x, lineY, half, { size: 9, color: MUTED });
      lineY += measure(line, half, 9) + 2;
    }
  });
  y += partyHeight + 17 + pad;

  const detail = branding.show_measurements;
  const tableWidths = detail ? [width - 324, 96, 68, 49, 111] : [width - 120, 120];
  function tableHeader(continued = false) {
    heading(continued ? 'Ambientes (continuação)' : 'Ambientes');
    doc.rect(M, y, width, 24).fill('#EDF3FA');
    let x = M;
    (detail ? ['Ambiente', 'Medidas', 'Área', 'Rolos', 'Valor'] : ['Ambiente', 'Valor']).forEach((label, i) => {
      fixed(label, x + 8, y + 7, tableWidths[i] - 16, { bold: true, color: MUTED, align: i === 0 ? 'left' : 'right' });
      x += tableWidths[i];
    });
    y += 24;
  }
  const roomName = environment => clean(environment.name, 180) || 'Ambiente';
  const rowSize = name => Math.max(compact ? 22 : 26, measure(name, tableWidths[0] - 16, 10) + 10);
  room(43 + (environments.length ? rowSize(roomName(environments[0])) : 27));
  tableHeader();
  if (!environments.length) {
    write('Nenhum ambiente discriminado.', M + 8, y + 7, width - 16, { color: MUTED });
    y += 27;
    rule(y);
  }
  environments.forEach(environment => {
    const rolls = number(environment.rolls_manual) > 0 ? number(environment.rolls_manual) : number(environment.rolls_auto);
    const name = roomName(environment);
    const values = [name, ...(detail ? [
      `${decimal(environment.width)} x ${decimal(environment.height)} m`,
      `${decimal(environment.area)} m²`,
      String(rolls),
    ] : []), money(number(environment.total) - number(environment.removal_total))];
    const rowHeight = rowSize(name);
    if (room(rowHeight)) tableHeader(true);
    let x = M;
    values.forEach((value, i) => {
      if (!i) write(value, x + 8, y + 6, tableWidths[i] - 16);
      else fixed(value, x + 8, y + 7, tableWidths[i] - 16, { color: INK, align: 'right' });
      x += tableWidths[i];
    });
    y += rowHeight;
    rule(y);
  });
  y += pad;

  const terms = upfrontTerms(budget.payment_terms);
  const payment = [
    terms.length ? `À vista: ${terms.join(' / ')}` : '',
    installment.enabled ? `Cartão: ${installment.amountLabel}` : '',
    installment.enabled ? installment.conditionsLabel : '',
  ].filter(Boolean);
  const removalCost = number(budget.removal_cost);
  const removalRolls = number(budget.removal_rolls) || number(budget.total_rolls);
  const totals = [['Subtotal do serviço', money(budget.subtotal_rolls)]];
  if (removalCost > 0) totals.push([number(budget.removal_price_per_roll) > 0 ? `Remoção (${removalRolls} rolos x ${money(budget.removal_price_per_roll)})` : 'Remoção', money(removalCost)]);
  if (detail) totals.unshift([`${decimal(budget.total_area)} m² / ${number(budget.total_rolls)} rolos`, '']);
  const totalHeight = totals.length * 16 + (compact ? 36 : 48);
  room(totalHeight);
  totals.forEach(([label, value]) => {
    write(label, M + 8, y, width - 144, { size: 9, color: MUTED });
    fixed(value, right - 135, y, 127, { color: INK, align: 'right' });
    y += 16;
  });
  const totalBox = compact ? 35 : 45;
  if (compact) rule(y);
  else doc.rect(M, y, width, totalBox).fill('#EDF3FA');
  fixed('Total do orçamento', M + 10, y + totalBox / 2 - 5, width / 2, { size: 11, color: accentText, bold: true });
  fixed(total, right - 200, y + totalBox / 2 - 9, 190, { size: compact ? 17 : 21, color: accentText, bold: true, align: 'right' });
  y += totalBox + pad;

  const commercial = [
    ...(payment.length ? payment : ['Formas de pagamento não informadas.']),
    `Validade: ${valid} (${branding.validity_days} dias da emissão)`,
    formatDate(budget.approved_date) && `Aprovado em: ${formatDate(budget.approved_date)}`,
    formatDate(budget.schedule_date) && `Instalação: ${formatDate(budget.schedule_date)}`,
  ].filter(Boolean);
  room(20 + commercial.reduce((sum, line) => sum + measure(line, width, 9) + 2, 0));
  heading('Pagamento e condições');
  commercial.forEach(line => {
    write(line, M, y, width, { size: 9, color: MUTED });
    y += measure(line, width, 9) + 2;
  });
  y += pad;
  if (branding.show_scope) paragraph('Escopo e observações', branding.scope_text || defaultScope);
  paragraph('Mensagem final', branding.closing_text);
  if (branding.show_signature) {
    room(40);
    const each = (width - 26) / 2;
    rule(y + 14, M, M + each);
    rule(y + 14, right - each, right);
    fixed('Assinatura do cliente', M, y + 21, each);
    fixed('Assinatura do instalador', right - each, y + 21, each);
  }

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(pages.start + index);
    const bottom = doc.page.height - 42;
    rule(bottom - 8);
    fixed(isPro ? `${brand} / ${identifier}` : 'Gerado com InstalarPro', M, bottom, width * 0.48, { size: 8 });
    if (branding.show_contact && user.phone) fixed(clean(user.phone, 40), M + width * 0.50, bottom, width * 0.30, { size: 8 });
    fixed(`${index + 1} / ${pages.count}`, right - 60, bottom, 60, { size: 8, align: 'right' });
  }
}

module.exports = async function generateBudgetPDF({
  budget, client = {}, environments = [], user = {}, isPro = false, branding = null, example = false,
}) {
  const normalized = normalizePdfBranding(isPro || example ? branding : null);
  // Keep the same rendering path for a real quote and an unsaved example.
  const [terms, logo, photo] = await Promise.all([
    import('../../shared/installmentTerms.mjs'),
    (isPro || example) && normalized.show_logo ? brandImage(user.logo, user.id, 'logo') : null,
    (isPro || example) && normalized.show_installer_photo ? brandImage(user.installer_photo, user.id, 'installer-photo') : null,
  ]);
  const installment = terms.installmentInfo(budget);
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, info: { Title: `Orçamento #${clean(budget.id, 45)}` } });
  const chunks = [];
  const pdf = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
  try {
    render(doc, {
      budget, client, environments, user, isPro: isPro || example, branding: normalized, logo, photo, example,
      installment: { ...installment, amountLabel: terms.installmentAmountLabel(installment), conditionsLabel: terms.installmentConditionsLabel(installment) },
    });
    doc.end();
  } catch (error) {
    doc.destroy();
    throw error;
  }
  const contents = await pdf;
  const directory = path.join(os.tmpdir(), 'instalapro-pdf');
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `orcamento-${crypto.randomUUID()}.pdf`);
  await fs.writeFile(file, contents, { flag: 'wx' });
  return file;
};
