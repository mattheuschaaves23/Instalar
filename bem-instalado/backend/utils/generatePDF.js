const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const PDFDocument = require('pdfkit');
const { decodeAssetKey, isObjectStorageConfigured } = require('../services/objectStorage');
const { defaultScope } = require('../../shared/pdfBranding.json');
const { resolvePdfBranding, normalizeText } = require('./pdfBranding');
const { APP_TIME_ZONE } = require('./appTimeZone');

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
  return new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIME_ZONE, dateStyle: 'short' }).format(date);
}

function validUntil(value, days) {
  const issue = formatDate(value || new Date()) || formatDate(new Date());
  const [day, month, year] = issue.split('/').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return formatDate(date);
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

function render(doc, { budget, client, environments, user, branding, logo, photo, installment, example, colors }) {
  const width = doc.page.width - 2 * M;
  const right = M + width;
  const basic = branding.template === 'basic';
  const technical = branding.template === 'compact';
  const classic = branding.template === 'classic';
  const studio = branding.template === 'studio';
  const compact = branding.density === 'dense' || (branding.density === 'auto' && (basic || technical));
  const accent = branding.accent_color;
  const accentText = colors.accentInk(accent);
  const brand = basic ? 'InstalarPro' : branding.brand_name || clean(user.business_name, 80) || clean(user.name, 80) || 'InstalarPro';
  const themeTint = basic ? '#F1F3F5' : colors.tint(accent, 0.09);
  const background = branding.paper_tone === 'tinted' ? colors.tint(accent, 0.035) : classic && branding.paper_tone === 'auto' ? '#FCF9F3' : PAPER;
  const headingFont = ({
    sans: 'Helvetica-Bold', serif: 'Times-Bold', mono: 'Courier-Bold',
  })[branding.heading_font] || (classic ? 'Times-Bold' : technical ? 'Courier-Bold' : 'Helvetica-Bold');
  const issue = formatDate(budget.created_at || new Date());
  const valid = validUntil(budget.created_at, branding.validity_days);
  const id = clean(budget.id, 45);
  const identifier = `Orçamento #${id}`;
  const rawStatus = clean(budget.status, 24).toLowerCase();
  const status = ({ approved: 'Aprovado', rejected: 'Rejeitado', pending: 'Pendente', completed: 'Concluído', canceled: 'Cancelado' })[rawStatus] || 'Pendente';
  const total = money(budget.total_amount);
  const pad = compact ? 10 : branding.density === 'spacious' ? 22 : 16;
  let y = 0;

  const style = (size, color = INK, bold = false, font) => doc.font(font || (bold ? 'Helvetica-Bold' : 'Helvetica')).fontSize(size).fillColor(color);
  const measure = (value, w, size, bold = false, font) => style(size, INK, bold, font).heightOfString(value, { width: w, lineGap: 2 });
  function write(value, x, top, w, { size = 10, color = INK, bold = false, align = 'left', font } = {}) {
    style(size, color, bold, font).text(value, x, top, { width: w, align, lineGap: 2 });
  }
  function fixed(value, x, top, w, { size = 9, color = MUTED, bold = false, align = 'left', font } = {}) {
    style(size, color, bold, font);
    let output = value;
    if (doc.widthOfString(output) > w) {
      while (output.length && doc.widthOfString(output + '...') > w) output = output.slice(0, -1);
      output += '...';
    }
    const remaining = w - doc.widthOfString(output);
    doc.text(output, x + (align === 'right' ? remaining : align === 'center' ? remaining / 2 : 0), top, { width: 0, lineBreak: false });
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
    if (background !== PAPER) doc.rect(0, 0, doc.page.width, doc.page.height).fill(background);
    if (continued) {
      fixed(brand, M, 32, width / 2, { size: 12, font: headingFont, color: INK });
      fixed(`${identifier} / Continuação`, M + width / 2, 34, width / 2, { align: 'right' });
      rule(56);
      y = 73;
      return;
    }
    const title = branding.document_title;
    const subtitle = branding.document_subtitle;
    const metadata = [identifier, `Emissão: ${issue || '-'}`, branding.show_status ? status : '', example ? 'Exemplo ilustrativo' : ''].filter(Boolean);
    const titleOptions = { font: headingFont };
    if (studio) {
      const leftWidth = width - 156;
      const titleTop = 84;
      const titleHeight = measure(title, leftWidth, 28, true, headingFont);
      const subHeight = subtitle ? measure(subtitle, leftWidth, 10) + 5 : 0;
      const end = Math.max(190, titleTop + titleHeight + subHeight + pad + 4);
      doc.rect(0, 0, doc.page.width, end).fill(accentText);
      if (branding.show_pattern) {
        doc.save().rect(0, 0, doc.page.width, end).clip().strokeOpacity(0.14).lineWidth(1);
        for (let dx = -10; dx <= 55; dx += 13) doc.moveTo(doc.page.width - 145 + dx, end).lineTo(doc.page.width + dx, end - 80).stroke(PAPER);
        doc.restore();
      }
      const hasLogo = image(logo, M, 26, 51, 32);
      fixed(brand, M + (hasLogo ? 62 : 0), 42, leftWidth - (hasLogo ? 62 : 0), { size: 12, bold: true, color: PAPER });
      write(title, M, titleTop, leftWidth, { ...titleOptions, size: 28, color: PAPER });
      if (subtitle) write(subtitle, M, titleTop + titleHeight + 4, leftWidth, { size: 10, color: PAPER });
      image(photo, right - 37, 25, 37, 37);
      metadata.forEach((line, i) => fixed(line, right - 130, 77 + i * 13, 130, { align: 'right', color: PAPER }));
      fixed('Total do orçamento', right - 135, end - 47, 135, { align: 'right', color: PAPER });
      fixed(total, right - 142, end - 34, 142, { align: 'right', color: PAPER, size: 19, bold: true });
      y = end + pad;
      return;
    }
    if (classic) {
      const centered = { align: 'center' };
      image(logo, M, 32, 44, 36);
      image(photo, right - 38, 32, 38, 38);
      fixed(brand, M + 55, 42, width - 110, { ...centered, size: 12, color: accentText, bold: true });
      if (branding.show_pattern) {
        rule(64, M + width / 2 - 42, M + width / 2 + 42);
        doc.save().translate(M + width / 2, 64).rotate(45).rect(-2.5, -2.5, 5, 5).fill(accent).restore();
      }
      const top = 77;
      const h = measure(title, width - 32, 32, true, headingFont);
      write(title, M + 16, top, width - 32, { ...centered, ...titleOptions, size: 32 });
      if (subtitle) write(subtitle, M + 24, top + h + 1, width - 48, { ...centered, size: 10, color: MUTED });
      const metaY = top + h + (subtitle ? measure(subtitle, width - 48, 10) + 9 : 9);
      fixed(metadata.join('   /   '), M, metaY, width, { ...centered, size: 9 });
      rule(metaY + 20);
      y = metaY + 20 + pad;
      return;
    }
    const top = 35;
    const badge = technical ? 137 : 112;
    const titleWidth = width - badge - 14;
    const titleSize = basic ? 21 : 22;
    const titleY = 56;
    const titleH = measure(title, titleWidth, titleSize, true, headingFont);
    const subtitleH = subtitle ? measure(subtitle, titleWidth, 10) + 3 : 0;
    if (technical) {
      doc.rect(M, 23, width, 3).fill(accent);
      doc.rect(right - badge, top, badge, 62).lineWidth(0.7).stroke(accentText);
      if (branding.show_pattern) {
        for (let step = 0; step < 7; step += 1) doc.rect(M + step * 5, 27, 1, step % 2 ? 4 : 6).fill(accent);
      }
      image(photo, right - badge + 8, top + 20, 25, 25);
    }
    const hasLogo = image(logo, M, top - 3, 34, 17);
    fixed(brand, M + (hasLogo ? 39 : 0), top + 3, titleWidth - (hasLogo ? 39 : 0), { size: 10, bold: true, color: accentText });
    write(title, M, titleY, titleWidth, { ...titleOptions, size: titleSize });
    if (subtitle) write(subtitle, M, titleY + titleH + 2, titleWidth, { size: 10, color: MUTED });
    const metaInset = technical && photo ? 32 : 0;
    metadata.forEach((line, i) => fixed(line, right - badge + 5 + metaInset, top + 8 + i * 14, badge - (technical ? 13 : 5) - metaInset, { align: 'right', bold: i === 0 }));
    const line = Math.max(technical ? 105 : 87, top + 8 + (metadata.length - 1) * 14 + 13, titleY + titleH + subtitleH + 8);
    rule(line);
    y = line + pad;
  }

  function room(height) {
    if (y + height <= doc.page.height - 62) return false;
    doc.addPage();
    header(true);
    return true;
  }
  function heading(title) {
    write(title, M, y, width, { size: classic ? 16 : 13, font: headingFont });
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
  const gutter = technical ? 28 : 20;
  const half = (width - gutter) / 2;
  const contact = (person, enabled) => enabled ? [clean(person.phone, 40), clean(person.email, 125)].filter(Boolean) : [];
  const parties = [
    { label: 'Preparado por', name: clean(user.name, 100) || brand, lines: contact(user, branding.show_contact) },
    { label: 'Cliente e local', name: clean(client.name, 120) || 'Cliente', lines: [...contact(client, branding.show_client_contact), address].filter(Boolean) },
  ];
  if (studio || technical) parties.reverse();
  const partyHeight = Math.max(...parties.map(({ name, lines }) =>
    measure(name, half, 11, true) + lines.reduce((sum, line) => sum + measure(line, half, 9) + 2, 0)));
  room(partyHeight + 29);
  if (technical) doc.rect(M - 6, y - 5, width + 12, partyHeight + 26).fill(themeTint);
  parties.forEach(({ label, name, lines }, index) => {
    const x = M + index * (half + gutter);
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
  const fixedPrice = budget.pricing_mode === 'fixed';
  const prices = branding.show_environment_prices;
  const cols = [...(technical ? [['Nº', 34]] : []), ['Ambiente', 0],
    ...(detail ? [['Medidas', 102], ['Área', 68], ['Rolos', 46]] : []), ...(prices ? [['Valor', 108]] : [])];
  const nameIndex = technical ? 1 : 0;
  const nameWidth = width - cols.reduce((sum, column) => sum + column[1], 0);
  cols[nameIndex][1] = nameWidth;
  const cardNameWidth = prices ? width - 177 : width - 65;
  function tableHeader(continued = false) {
    heading(continued ? 'Ambientes (continuação)' : 'Ambientes');
    if (studio) {
      y += 3;
      return;
    }
    if (!classic) doc.rect(M, y, width, 24).fill(technical ? accentText : themeTint);
    else rule(y);
    let x = M;
    cols.forEach(([label, colWidth], i) => {
      fixed(label, x + 8, y + 7, colWidth - 16, { bold: true, color: technical ? PAPER : MUTED, align: i <= nameIndex ? 'left' : 'right' });
      x += colWidth;
    });
    y += 24;
    if (classic) rule(y);
  }
  const roomName = environment => clean(environment.name, 180) || 'Ambiente';
  const rowSize = name => studio
    ? Math.max(compact ? 29 : 35, measure(name, cardNameWidth, 11, true) + 14 + (detail ? 13 : 0))
    : Math.max(compact ? 22 : 27, measure(name, nameWidth - 16, 10) + 10);
  room(43 + (environments.length ? rowSize(roomName(environments[0])) : 27));
  if (fixedPrice) {
    heading('Serviço a valor fechado');
    write('Instalação combinada sem detalhamento de medidas.', M + 8, y + 6, width - 16, { color: MUTED });
    y += 26;
    rule(y);
  } else {
    tableHeader();
  }
  if (!fixedPrice && !environments.length) {
    write('Nenhum ambiente discriminado.', M + 8, y + 7, width - 16, { color: MUTED });
    y += 27;
    rule(y);
  }
  environments.forEach((environment, index) => {
    const rolls = number(environment.rolls_manual) > 0 ? number(environment.rolls_manual) : number(environment.rolls_auto);
    const name = roomName(environment);
    const dimensions = `${decimal(environment.width)} x ${decimal(environment.height)} m`;
    const area = `${decimal(environment.area)} m²`;
    const value = money(number(environment.total) - number(environment.removal_total));
    const rank = String(index + 1).padStart(2, '0');
    const rowHeight = rowSize(name);
    if (room(rowHeight + (studio ? 5 : 0))) tableHeader(true);
    if (studio) {
      doc.roundedRect(M, y, width, rowHeight, 5).fill(themeTint);
      doc.circle(M + 19, y + 16, 10).fill(accentText);
      fixed(rank, M + 9, y + 12, 20, { size: 7, color: PAPER, bold: true, align: 'center' });
      write(name, M + 38, y + 7, cardNameWidth, { size: 11, bold: true });
      if (detail) fixed(`${dimensions}  /  ${area}  /  ${rolls} ${rolls === 1 ? 'rolo' : 'rolos'}`, M + 38,
        y + 7 + measure(name, cardNameWidth, 11, true), cardNameWidth, { size: 8 });
      if (prices) fixed(value, right - 120, y + 11, 108, { align: 'right', color: accentText, size: 11, bold: true });
      y += rowHeight + (compact ? 4 : 6);
      return;
    }
    const values = [...(technical ? [rank] : []), name, ...(detail ? [dimensions, area, String(rolls)] : []), ...(prices ? [value] : [])];
    if (technical && index % 2 === 0) doc.rect(M, y, width, rowHeight).fill(themeTint);
    let x = M;
    values.forEach((value, i) => {
      const colWidth = cols[i][1];
      if (i === nameIndex) write(value, x + 8, y + 6, colWidth - 16);
      else fixed(value, x + 8, y + 7, colWidth - 16, { color: i === 0 ? accentText : INK, align: i === 0 ? 'left' : 'right', font: technical && i === 0 ? 'Courier-Bold' : undefined });
      if (technical && i > 0) doc.moveTo(x, y).lineTo(x, y + rowHeight).lineWidth(0.5).stroke(RULE);
      x += colWidth;
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
  if (detail && !fixedPrice) totals.unshift([`${decimal(budget.total_area)} m² / ${number(budget.total_rolls)} rolos`, '']);
  const totalHeight = totals.length * 16 + (studio || classic ? 0 : compact ? 36 : 48);
  room(totalHeight);
  totals.forEach(([label, value]) => {
    write(label, M + 8, y, width - 144, { size: 9, color: MUTED });
    fixed(value, right - 135, y, 127, { color: INK, align: 'right' });
    y += 16;
  });
  if (!studio && !classic) {
    const totalBox = compact ? 35 : 45;
    if (basic) rule(y);
    else doc.rect(M, y, width, totalBox).fill(themeTint);
    fixed('Total do orçamento', M + 10, y + totalBox / 2 - 5, width / 2, { size: 11, color: accentText, bold: true });
    fixed(total, right - 200, y + totalBox / 2 - 9, 190, { size: compact ? 17 : 21, color: accentText, bold: true, align: 'right' });
    y += totalBox;
  }
  y += pad;

  const commercial = [
    ...(payment.length ? payment : ['Formas de pagamento não informadas.']),
    `Validade: ${valid} (${branding.validity_days} dias da emissão)`,
    formatDate(budget.approved_date) && `Aprovado em: ${formatDate(budget.approved_date)}`,
    formatDate(budget.schedule_date) && `Instalação: ${formatDate(budget.schedule_date)}`,
  ].filter(Boolean);
  const commercialWidth = classic ? width - 200 : width;
  const termsHeight = 20 + commercial.reduce((sum, line) => sum + measure(line, commercialWidth, 9) + 2, 0);
  room(classic ? Math.max(termsHeight, 70) : termsHeight);
  const termsY = y;
  heading('Pagamento e condições');
  commercial.forEach(line => {
    write(line, M, y, commercialWidth, { size: 9, color: MUTED });
    y += measure(line, commercialWidth, 9) + 2;
  });
  if (classic) {
    doc.rect(right - 171, termsY, 171, 63).lineWidth(0.8).stroke(accentText);
    fixed('Total do orçamento', right - 162, termsY + 12, 153, { size: 10, align: 'center', color: accentText });
    fixed(total, right - 162, termsY + 29, 153, { size: 22, align: 'center', color: accentText, font: headingFont });
    y = Math.max(y, termsY + 63);
  }
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
    fixed(basic ? 'Gerado com InstalarPro' : branding.footer_text || `${brand} / ${identifier}`, M, bottom, width * 0.48, { size: 8 });
    if (branding.show_contact && user.phone) fixed(clean(user.phone, 40), M + width * 0.50, bottom, width * 0.30, { size: 8 });
    fixed(`${index + 1} / ${pages.count}`, right - 60, bottom, 60, { size: 8, align: 'right' });
  }
}

module.exports = async function generateBudgetPDF({
  budget, client = {}, environments = [], user = {}, isPro = false, branding = null, example = false,
}) {
  const normalized = resolvePdfBranding(branding, isPro || example);
  // Keep the same rendering path for a real quote and an unsaved example.
  const [terms, colors, logo, photo] = await Promise.all([
    import('../../shared/installmentTerms.mjs'),
    import('../../shared/pdfColors.mjs'),
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
      budget, client, environments, user, branding: normalized, logo, photo, example, colors,
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

module.exports.formatDate = formatDate;
