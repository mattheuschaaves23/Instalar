const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { installmentInfo, installmentAmountLabel, installmentConditionsLabel } = require('../../shared/installmentTerms.mjs');

const COLORS = {
  bg: '#0F0D09',
  panel: '#18140D',
  panelSoft: '#14110B',
  border: '#3A2F1A',
  line: '#2B2315',
  gold: '#CDA349',
  goldSoft: '#F0D28A',
  text: '#F7F0E0',
  muted: '#B8A983',
  success: '#27B07D',
  danger: '#D15454',
  warning: '#D1A545',
};

const MARGIN = 40;
const BOTTOM_SAFE_AREA = 72;
const HEADER_HEIGHT = 124;

function toNumber(value) {
  return Number(value || 0);
}

function toText(value) {
  return String(value || '').trim();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(toNumber(value));
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function addDays(value, amount) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setDate(date.getDate() + amount);
  return date;
}

function statusLabel(status) {
  const normalized = toText(status).toLowerCase();
  if (normalized === 'approved') return 'Aprovado';
  if (normalized === 'rejected') return 'Rejeitado';
  if (normalized === 'pending') return 'Pendente';
  if (normalized === 'completed') return 'Concluído';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Pendente';
}

function statusColor(status) {
  const normalized = toText(status).toLowerCase();
  if (normalized === 'approved' || normalized === 'completed') return COLORS.success;
  if (normalized === 'rejected' || normalized === 'canceled') return COLORS.danger;
  return COLORS.warning;
}

function decodeImage(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (value.startsWith('data:image/')) {
    const base64 = value.split(',')[1];
    if (!base64) {
      return null;
    }
    try {
      return Buffer.from(base64, 'base64');
    } catch (_error) {
      return null;
    }
  }

  if (fs.existsSync(value)) {
    return value;
  }

  return null;
}

function cleanBrandingText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function resolveBranding(branding, user, isPro) {
  const source = isPro && branding && typeof branding === 'object' && !Array.isArray(branding)
    ? branding
    : {};
  const accent = cleanBrandingText(source.accent_color, 7).toUpperCase();

  return {
    brandName: cleanBrandingText(source.brand_name, 80) || cleanBrandingText(user?.business_name, 80) || 'InstalaPro',
    documentTitle: cleanBrandingText(source.document_title, 100) || 'Proposta comercial de instalação',
    introText: cleanBrandingText(source.intro_text, 320),
    closingText: cleanBrandingText(source.closing_text, 320),
    accentColor: /^#[0-9A-F]{6}$/.test(accent) ? accent : COLORS.goldSoft,
    showLogo: source.show_logo === undefined ? true : Boolean(source.show_logo),
    showInstallerPhoto: source.show_installer_photo === undefined ? true : Boolean(source.show_installer_photo),
    showContact: source.show_contact === undefined ? true : Boolean(source.show_contact),
  };
}

const UPFRONT_PAYMENT_LABELS = {
  pix: 'Pix',
  boleto: 'Boleto',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão à vista',
  cash: 'Dinheiro',
  bank_transfer: 'Transferência',
};

function upfrontPaymentInfo(budget) {
  let terms = budget?.payment_terms;

  if (typeof terms === 'string') {
    try {
      terms = JSON.parse(terms);
    } catch (_error) {
      terms = [];
    }
  }

  if (!Array.isArray(terms)) {
    return [];
  }

  return terms.reduce((result, term) => {
    const method = toText(term?.method).toLowerCase();
    const discountPercent = toNumber(term?.discount_percent);
    const label = UPFRONT_PAYMENT_LABELS[method];

    if (!label || !Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      return result;
    }

    return [...result, { label, discountPercent }];
  }, []);
}

function buildClientAddress(client) {
  const line1 = [toText(client?.street), toText(client?.house_number) && `Nº ${toText(client?.house_number)}`]
    .filter(Boolean)
    .join(', ');
  const line2 = [toText(client?.neighborhood), [toText(client?.city), toText(client?.state)].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(', ');
  const line3 = toText(client?.zip_code) ? `CEP ${toText(client?.zip_code)}` : '';
  const fallback = toText(client?.address);

  return [line1, line2, line3].filter(Boolean).join(' • ') || fallback || '-';
}

function canFit(doc, y, heightNeeded) {
  return y + heightNeeded <= doc.page.height - BOTTOM_SAFE_AREA;
}

function drawMainHeader(doc, budget, user, isPro, branding) {
  const pageWidth = doc.page.width;
  const logo = isPro && branding.showLogo ? decodeImage(user.logo) : null;
  const photo = isPro && branding.showInstallerPhoto ? decodeImage(user.installer_photo) : null;

  doc.save();
  doc.rect(0, 0, pageWidth, HEADER_HEIGHT).fill(COLORS.bg);
  doc.restore();

  doc.save();
  doc.moveTo(MARGIN, HEADER_HEIGHT - 1).lineTo(pageWidth - MARGIN, HEADER_HEIGHT - 1).lineWidth(1).stroke(COLORS.border);
  doc.restore();

  let leftX = MARGIN;
  const rightBlockWidth = 170;
  const rightX = pageWidth - MARGIN - rightBlockWidth - (photo ? 60 : 0);

  if (logo) {
    try {
      doc.image(logo, MARGIN, 20, { fit: [74, 74], align: 'left', valign: 'center' });
      leftX = MARGIN + 86;
    } catch (_error) {
      leftX = MARGIN;
    }
  }

  const leftTextWidth = rightX - leftX - 16;
  doc.fillColor(branding.accentColor).font('Helvetica-Bold').fontSize(19).text(branding.brandName, leftX, 28, {
    width: leftTextWidth,
    height: 24,
    ellipsis: true,
  });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(13).text(branding.documentTitle, leftX, 52, {
    width: leftTextWidth,
    height: 18,
    ellipsis: true,
  });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Documento profissional para apresentação e fechamento.', leftX, 76, {
    width: leftTextWidth, height: 24, ellipsis: true,
  });

  const badgeText = statusLabel(budget.status);
  const badgeWidth = 88;
  const badgeX = rightX + rightBlockWidth - badgeWidth;
  const badgeY = 20;

  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(`ORÇAMENTO #${budget.id}`, rightX, 54, {
    width: rightBlockWidth,
    align: 'right',
  });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text(`Emissão: ${formatDate(new Date())}`, rightX, 76, {
    width: rightBlockWidth,
    align: 'right',
  });

  doc.save();
  doc.roundedRect(badgeX, badgeY, badgeWidth, 22, 11).fillAndStroke(COLORS.panel, statusColor(budget.status));
  doc.restore();
  doc.fillColor(branding.accentColor).font('Helvetica-Bold').fontSize(9).text(badgeText.toUpperCase(), badgeX, badgeY + 7, {
    width: badgeWidth,
    align: 'center',
  });

  if (photo) {
    try {
      const photoX = pageWidth - MARGIN - 48;
      const photoY = 20;
      doc.image(photo, photoX, photoY, { fit: [48, 48], align: 'center', valign: 'center' });
      doc.roundedRect(photoX, photoY, 48, 48, 10).lineWidth(1).stroke(COLORS.border);
    } catch (_error) {
      // ignora falha de imagem
    }
  }
}

function drawSubHeader(doc, budget, branding) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 56).fill(COLORS.bg);
  doc.restore();

  doc.fillColor(branding.accentColor).font('Helvetica-Bold').fontSize(13).text(`Orçamento #${budget.id}`, MARGIN, 20);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(`Continuação • ${formatDate(new Date())}`, MARGIN, 36);
}

function drawBrandMessage(doc, title, message, y, width, branding) {
  if (!message) {
    return 0;
  }

  const textWidth = width - 28;
  doc.font('Helvetica').fontSize(10);
  const textHeight = doc.heightOfString(message, { width: textWidth, lineGap: 2 });
  const panelHeight = Math.max(62, textHeight + 42);

  doc.save();
  doc.roundedRect(MARGIN, y, width, panelHeight, 12).fillAndStroke(COLORS.panelSoft, branding.accentColor);
  doc.restore();
  doc.fillColor(branding.accentColor).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), MARGIN + 14, y + 12);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(message, MARGIN + 14, y + 29, {
    width: textWidth,
    lineGap: 2,
  });

  return panelHeight;
}

function drawSectionTitle(doc, title, y) {
  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), MARGIN, y);
  const lineY = y + 14;
  doc.save();
  doc.moveTo(MARGIN, lineY).lineTo(doc.page.width - MARGIN, lineY).lineWidth(1).stroke(COLORS.line);
  doc.restore();
  return lineY + 8;
}

function drawInfoBox(doc, title, lines, x, y, width) {
  const contentTop = y + 28;
  doc.font('Helvetica').fontSize(10);
  const heights = lines.map((line) => Math.max(14, doc.heightOfString(line, { width: width - 24 }) + 3));
  const boxHeight = 34 + heights.reduce((sum, height) => sum + height, 0) + 10;

  doc.save();
  doc.roundedRect(x, y, width, boxHeight, 10).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(title.toUpperCase(), x + 12, y + 11, {
    width: width - 24,
  });

  let lineY = contentTop;
  lines.forEach((line, index) => {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(line, x + 12, lineY, {
      width: width - 24,
      ellipsis: true,
    });
    lineY += heights[index];
  });

  return boxHeight;
}

function drawMetricCard(doc, label, value, x, y, width) {
  const height = 62;

  doc.save();
  doc.roundedRect(x, y, width, height, 10).fillAndStroke(COLORS.panelSoft, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(label.toUpperCase(), x + 12, y + 11, {
    width: width - 24,
  });
  doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12).text(value, x + 12, y + 31, {
    width: width - 24,
  });

  return height;
}

function drawTableHeader(doc, y, widths) {
  const headers = ['Ambiente', 'Medidas', 'Área', 'Rolos', 'Valor'];
  const rowHeight = 24;
  let x = MARGIN;

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 8).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  headers.forEach((header, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(header, x + 8, y + 8, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawEnvironmentRow(doc, environment, y, widths, isAlt) {
  const rowHeight = 24;
  const rolls = toNumber(environment.rolls_manual) > 0
    ? toNumber(environment.rolls_manual)
    : toNumber(environment.rolls_auto);

  const values = [
    toText(environment.name) || '-',
    `${toNumber(environment.height).toFixed(2)}m x ${toNumber(environment.width).toFixed(2)}m`,
    `${toNumber(environment.area).toFixed(2)}m²`,
    `${rolls}`,
    formatCurrency(toNumber(environment.total) - toNumber(environment.removal_total)),
  ];

  let x = MARGIN;
  const background = isAlt ? '#15110C' : '#110E09';

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 0).fillAndStroke(background, COLORS.line);
  doc.restore();

  values.forEach((value, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(value, x + 8, y + 7, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawTableHeaderWithRemoval(doc, y, widths) {
  const headers = ['Ambiente', 'Medidas', 'Área', 'Rolos', 'Remoção', 'Valor'];
  const rowHeight = 24;
  let x = MARGIN;

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 8).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  headers.forEach((header, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(9).text(header, x + 8, y + 8, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawEnvironmentRowWithRemoval(doc, environment, y, widths, isAlt) {
  const rowHeight = 24;
  const rolls = toNumber(environment.rolls_manual) > 0
    ? toNumber(environment.rolls_manual)
    : toNumber(environment.rolls_auto);
  const removalTotal = toNumber(environment.removal_total);

  const values = [
    toText(environment.name) || '-',
    `${toNumber(environment.height).toFixed(2)}m x ${toNumber(environment.width).toFixed(2)}m`,
    `${toNumber(environment.area).toFixed(2)}m²`,
    `${rolls}`,
    formatCurrency(removalTotal),
    formatCurrency(environment.total),
  ];

  let x = MARGIN;
  const background = isAlt ? '#15110C' : '#110E09';

  doc.save();
  doc.roundedRect(MARGIN, y, doc.page.width - MARGIN * 2, rowHeight, 0).fillAndStroke(background, COLORS.line);
  doc.restore();

  values.forEach((value, index) => {
    const align = index >= 2 ? 'right' : 'left';
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(value, x + 8, y + 7, {
      width: widths[index] - 14,
      align,
      ellipsis: true,
    });
    x += widths[index];
  });

  return y + rowHeight;
}

function drawTotalsPanel(doc, budget, installment, y, width) {
  const total = formatCurrency(budget.total_amount);
  const removalPricePerRoll = toNumber(budget.removal_price_per_roll);
  const removalRolls = toNumber(budget.removal_rolls) || toNumber(budget.total_rolls);
  const removalDescription = removalPricePerRoll > 0
    ? `Remoção: ${removalRolls} rolos selecionados x ${formatCurrency(removalPricePerRoll)} = ${formatCurrency(budget.removal_cost)}`
    : `Remoção: ${formatCurrency(budget.removal_cost)}`;
  const upfrontTerms = upfrontPaymentInfo(budget);
  const upfrontTermsDescription = upfrontTerms
    .map((term) => `${term.label}${term.discountPercent > 0 ? ` (${term.discountPercent}% de desconto)` : ''}`)
    .join(' • ');
  const lines = [
    `Subtotal do serviço: ${formatCurrency(budget.subtotal_rolls)}`,
    removalDescription,
    `Pagamento à vista: ${total}`,
    upfrontTermsDescription ? `Formas à vista: ${upfrontTermsDescription}` : 'Formas à vista: não informadas',
    installment.enabled
      ? `Pagamento parcelado: ${installmentAmountLabel(installment)}`
      : 'Pagamento parcelado: não habilitado',
    installment.enabled
      ? installmentConditionsLabel(installment)
      : '',
  ];
  const textWidth = width - 28;
  doc.font('Helvetica').fontSize(10);
  const linesHeight = lines.reduce(
    (totalHeight, line) => totalHeight + doc.heightOfString(line, { width: textWidth, lineGap: 2 }) + 4,
    0
  );
  const panelHeight = Math.max(136, 34 + linesHeight + 48);

  doc.save();
  doc.roundedRect(MARGIN, y, width, panelHeight, 12).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('RESUMO FINANCEIRO', MARGIN + 14, y + 12);

  let lineY = y + 34;
  lines.forEach((line) => {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(line, MARGIN + 14, lineY, {
      width: textWidth,
      lineGap: 2,
    });
    lineY += doc.heightOfString(line, { width: textWidth, lineGap: 2 }) + 4;
  });

  doc.save();
  doc.roundedRect(MARGIN + 12, y + panelHeight - 40, width - 24, 26, 8).fillAndStroke('#1F1910', COLORS.border);
  doc.restore();
  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(12).text(`TOTAL GERAL: ${total}`, MARGIN + 18, y + panelHeight - 31);

  return panelHeight;
}

function drawCommercialPanel(doc, budget, y, width) {
  const validityDate = addDays(budget.created_at || new Date(), 30);
  const lines = [
    `Status atual: ${statusLabel(budget.status)}`,
    `Aprovado em: ${formatDate(budget.approved_date)}`,
    `Data sugerida para instalação: ${formatDate(budget.schedule_date)}`,
    `Validade desta proposta: ${formatDate(validityDate)}`,
  ];
  const panelHeight = 110;

  doc.save();
  doc.roundedRect(MARGIN, y, width, panelHeight, 12).fillAndStroke(COLORS.panelSoft, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('CONDIÇÕES COMERCIAIS', MARGIN + 14, y + 12);

  lines.forEach((line, index) => {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(line, MARGIN + 14, y + 34 + index * 16, {
      width: width - 28,
    });
  });

  return panelHeight;
}

function drawScopeAndSignature(doc, y, width, userName) {
  const scopeHeight = 132;
  doc.save();
  doc.roundedRect(MARGIN, y, width, scopeHeight, 12).fillAndStroke(COLORS.panel, COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('ESCOPO E OBSERVAÇÕES', MARGIN + 14, y + 12);
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10).text(
    '• Instalação conforme medidas aprovadas e condições do ambiente.\n' +
      '• Materiais, prazos e logística devem ser confirmados no fechamento.\n' +
      '• Alterações após aprovação podem gerar atualização de valores.\n' +
      '• Recomenda-se vistoria final conjunta ao término da instalação.',
    MARGIN + 14,
    y + 34,
    { width: width - 28, lineGap: 2 }
  );

  const signatureY = y + scopeHeight + 14;
  const gap = 34;
  const each = (width - gap) / 2;
  const lineY = signatureY + 24;

  doc.fillColor(COLORS.goldSoft).font('Helvetica-Bold').fontSize(10).text('ASSINATURAS', MARGIN, signatureY);

  doc.save();
  doc.moveTo(MARGIN, lineY).lineTo(MARGIN + each, lineY).lineWidth(1).stroke(COLORS.border);
  doc.moveTo(MARGIN + each + gap, lineY).lineTo(MARGIN + each + gap + each, lineY).lineWidth(1).stroke(COLORS.border);
  doc.restore();

  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Cliente', MARGIN, lineY + 6, { width: each, align: 'center' });
  doc.text(userName ? `Instalador • ${userName}` : 'Instalador', MARGIN + each + gap, lineY + 6, {
    width: each,
    align: 'center',
  });

  return scopeHeight + 58;
}

function drawFooter(doc, pageNumber, pageCount, budgetId, user, isPro, branding) {
  const footerY = doc.page.height - 44;

  doc.save();
  doc.moveTo(MARGIN, footerY - 8).lineTo(doc.page.width - MARGIN, footerY - 8).lineWidth(1).stroke(COLORS.line);
  doc.restore();

  const leftText = `${isPro ? branding.brandName : 'InstalaPro'} • Orçamento #${budgetId}`;
  const centerText = isPro
    ? (branding.showContact && toText(user?.phone) ? `Contato: ${toText(user.phone)}` : 'Documento profissional')
    : 'Criado gratuitamente com InstalaPro';
  const rightText = `Página ${pageNumber} de ${pageCount}`;

  // Footer is positioned outside the flowing content area. Never let text()
  // paginate here: it would add three empty pages while numbering each page.
  const contentWidth = doc.page.width - MARGIN * 2;
  const widths = [165, contentWidth - 255, 90];
  doc.font('Helvetica').fontSize(8.5);
  const singleLine = (value, width) => {
    let text = value;
    while (text.length && doc.widthOfString(text) > width) text = text.slice(0, -1);
    return text === value ? text : `${text.slice(0, -3)}...`;
  };
  const center = singleLine(centerText, widths[1]);
  const fixedText = { width: 0, lineBreak: false };
  doc.fillColor(COLORS.muted).text(singleLine(leftText, widths[0]), MARGIN, footerY, fixedText);
  doc.text(center, MARGIN + widths[0] + (widths[1] - doc.widthOfString(center)) / 2, footerY, fixedText);
  doc.text(rightText, doc.page.width - MARGIN - doc.widthOfString(rightText), footerY, fixedText);
}

module.exports = function generateBudgetPDF({ budget, client, environments, user, isPro = false, branding = null }) {
  return new Promise((resolve, reject) => {
    // Em ambientes serverless, como a Vercel, somente a pasta temporária do SO é gravável.
    // O identificador aleatório evita que duas requisições do mesmo orçamento disputem o mesmo arquivo.
    const tempDir = path.join(os.tmpdir(), 'instalapro-pdf');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const safeBudgetId = String(budget?.id || 'novo').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `orcamento-${safeBudgetId || 'novo'}-${crypto.randomUUID()}.pdf`;
    const filePath = path.join(tempDir, fileName);
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });
    const stream = fs.createWriteStream(filePath);

    stream.on('error', reject);
    doc.pipe(stream);

    const resolvedBranding = resolveBranding(branding, user, isPro);
    drawMainHeader(doc, budget, user, isPro, resolvedBranding);

    const contentWidth = doc.page.width - MARGIN * 2;
    const gap = 14;
    const halfWidth = (contentWidth - gap) / 2;
    let y = 142;

    if (resolvedBranding.introText) {
      y += drawBrandMessage(doc, 'Mensagem de apresentação', resolvedBranding.introText, y, contentWidth, resolvedBranding) + 14;
    }

    y = drawSectionTitle(doc, 'Dados do projeto', y);

    const professionalLines = [
      `Profissional: ${toText(user.name) || '-'}`,
      `Telefone: ${toText(user.phone) || '-'}`,
      `E-mail: ${toText(user.email) || '-'}`,
    ];

    const clientLines = [
      `Cliente: ${toText(client.name) || '-'}`,
      `Telefone: ${toText(client.phone) || '-'}`,
      `E-mail: ${toText(client.email) || '-'}`,
      `Endereço: ${buildClientAddress(client)}`,
    ];

    const leftHeight = drawInfoBox(doc, 'Instalador', professionalLines, MARGIN, y, halfWidth);
    const rightHeight = drawInfoBox(doc, 'Cliente e local', clientLines, MARGIN + halfWidth + gap, y, halfWidth);
    y += Math.max(leftHeight, rightHeight) + 16;

    const installment = installmentInfo(budget);
    const metricWidth = (contentWidth - gap * 3) / 4;
    drawMetricCard(doc, 'Rolos', `${toNumber(budget.total_rolls)} un`, MARGIN, y, metricWidth);
    drawMetricCard(doc, 'Área total', `${toNumber(budget.total_area).toFixed(2)} m²`, MARGIN + metricWidth + gap, y, metricWidth);
    drawMetricCard(doc, 'Valor total', formatCurrency(budget.total_amount), MARGIN + (metricWidth + gap) * 2, y, metricWidth);
    drawMetricCard(
      doc,
      'Parcelamento',
      installment.enabled ? `${installment.count}x • valor base` : 'À vista',
      MARGIN + (metricWidth + gap) * 3,
      y,
      metricWidth
    );
    y += 76;

    y = drawSectionTitle(doc, 'Detalhamento dos ambientes', y);
    const tableWidths = [190, 120, 75, 60, contentWidth - (190 + 120 + 75 + 60)];
    y = drawTableHeader(doc, y, tableWidths);

    environments.forEach((environment, index) => {
      if (!canFit(doc, y, 28)) {
        doc.addPage();
        drawSubHeader(doc, budget, resolvedBranding);
        y = 72;
        y = drawSectionTitle(doc, 'Detalhamento dos ambientes (continuação)', y);
        y = drawTableHeader(doc, y, tableWidths);
      }

      y = drawEnvironmentRow(doc, environment, y, tableWidths, index % 2 === 1);
    });

    y += 14;

    const closingMessageHeight = resolvedBranding.closingText ? 96 : 0;
    if (!canFit(doc, y, 430 + closingMessageHeight)) {
      doc.addPage();
      drawSubHeader(doc, budget, resolvedBranding);
      y = 72;
    }

    y = drawSectionTitle(doc, 'Resumo e fechamento', y);
    y += drawTotalsPanel(doc, budget, installment, y, contentWidth) + 12;
    if (resolvedBranding.closingText) {
      doc.font('Helvetica').fontSize(10);
      const closingHeight = Math.max(62, doc.heightOfString(resolvedBranding.closingText, { width: contentWidth - 28, lineGap: 2 }) + 42);
      if (!canFit(doc, y, closingHeight)) {
        doc.addPage();
        drawSubHeader(doc, budget, resolvedBranding);
        y = 72;
      }
      y += drawBrandMessage(doc, 'Mensagem final', resolvedBranding.closingText, y, contentWidth, resolvedBranding) + 12;
    }
    if (!canFit(doc, y, 110)) {
      doc.addPage();
      drawSubHeader(doc, budget, resolvedBranding);
      y = 72;
    }
    y += drawCommercialPanel(doc, budget, y, contentWidth) + 12;
    if (!canFit(doc, y, 190)) {
      doc.addPage();
      drawSubHeader(doc, budget, resolvedBranding);
      y = 72;
    }
    drawScopeAndSignature(doc, y, contentWidth, toText(user.name));

    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i += 1) {
      doc.switchToPage(i);
      drawFooter(doc, i + 1, pageRange.count, budget.id, user, isPro, resolvedBranding);
    }

    doc.end();

    stream.on('finish', () => resolve(filePath));
  });
};
