module.exports = (...allowedTypes) => (req, res, next) => {
  const allowed = allowedTypes.length > 0 ? allowedTypes : ['installer'];
  const accountType = req.user?.account_type || 'installer';

  if (req.user?.is_admin && allowed.includes('installer')) {
    return next();
  }

  if (allowed.includes(accountType)) {
    return next();
  }

  return res.status(403).json({
    error: 'Acesso restrito para este tipo de conta.',
    code: 'ACCOUNT_TYPE_FORBIDDEN',
    account_type: accountType,
    required_account_type: allowed[0],
  });
};
