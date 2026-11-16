function redactDiagnostic(value, maxLength = 1200) {
  return String(value || '')
    .replace(/\b(?:https?|postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?|amqps?):\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/([?&#])[^\s"'<>]+/g, '$1[removido]')
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, '[credencial]')
    .replace(/\b((?:[\w-]*(?:password|senha|secret|token|authorization|cookie|api[_-]?key)[\w-]*))["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, '$1=[removido]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[telefone]')
    .replace(/\b[a-z0-9._-]{24,}\b/gi, '[segredo]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function diagnosticRoute(req) {
  const route = req?.route?.path;
  if (typeof route === 'string') return `${req?.baseUrl || ''}${route}`.slice(0, 180);
  // No matched route: do not persist arbitrary URL input.
  return '';
}

module.exports = { redactDiagnostic, diagnosticRoute };
