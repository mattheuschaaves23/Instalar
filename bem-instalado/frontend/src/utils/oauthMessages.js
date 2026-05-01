const OAUTH_ERROR_MESSAGES = {
  google_not_configured:
    'Login com Google ainda nao esta configurado. Preencha GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no backend.',
  apple_not_configured: 'Login com Apple ainda nao esta configurado. Preencha as chaves da Apple no backend.',
  google_token_exchange_failed: 'O Google recusou o callback. Confira a URL autorizada no Google Cloud.',
  google_audience_invalid: 'O Client ID do Google nao confere com esta aplicacao.',
  oauth_email_missing: 'Essa conta social nao retornou um e-mail para login.',
  oauth_email_unverified: 'Essa conta social ainda nao tem e-mail verificado.',
  oauth_failed: 'Nao foi possivel concluir o login social. Confira as credenciais OAuth.',
  oauth_start_failed: 'Nao foi possivel iniciar o login social. Confira a configuracao OAuth.',
};

export function getOAuthErrorMessage(errorCode) {
  return OAUTH_ERROR_MESSAGES[errorCode] || 'Nao foi possivel entrar com essa conta social.';
}

export function clearOAuthErrorFromUrl() {
  const params = new URLSearchParams(window.location.search);

  if (!params.has('oauth_error')) {
    return;
  }

  params.delete('oauth_error');

  const query = params.toString();
  const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
}
