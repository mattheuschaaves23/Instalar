const { cleanText, logApplicationError, safeMetadata } = require('../utils/errorMonitoring');

exports.reportClientError = async (req, res) => {
  const message = cleanText(req.body?.message, 1200);

  if (!message) {
    return res.status(400).json({ error: 'Mensagem do erro não informada.' });
  }

  await logApplicationError({
    source: 'frontend',
    severity: 'error',
    message,
    stack: cleanText(req.body?.stack, 4000),
    statusCode: 0,
    req,
    metadata: safeMetadata({
      componentStack: req.body?.component_stack,
      browser: req.body?.browser,
      release: req.body?.release,
    }),
  });

  return res.status(202).json({ ok: true });
};
