const OAUTH_ERROR_MESSAGES = {
  account_type_mismatch: 'Esse e-mail ja pertence ao outro tipo de conta. Entre pela tela correta.',
  google_not_configured:
    'Login com Google ainda nao esta configurado. Preencha GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no backend.',
  apple_not_configured: 'Login com Apple ainda nao esta configurado. Preencha as chaves da Apple no backend.',
  google_token_exchange_failed: 'O Google recusou o callback. Confira a URL autorizada no Google Cloud.',
  google_id_token_missing: 'O Google nao retornou o token da conta. Confira o Client ID e o Client Secret.',
  google_token_verify_failed: 'Nao foi possivel validar o token do Google. Tente novamente em alguns minutos.',
  google_audience_invalid: 'O Client ID do Google nao confere com esta aplicacao.',
  apple_token_exchange_failed: 'A Apple recusou o callback. Confira a URL autorizada e as chaves da Apple.',
  apple_id_token_missing: 'A Apple nao retornou o token da conta. Confira as chaves da Apple.',
  access_denied: 'Login cancelado na tela do provedor social.',
  code_missing: 'O provedor social nao retornou o codigo de autorizacao.',
  oauth_state_expired: 'A tentativa de login expirou. Clique em entrar com Google novamente.',
  oauth_state_invalid: 'A tentativa de login social ficou invalida. Tente novamente pela tela de login.',
  state_provider_mismatch: 'O retorno do login social nao confere com o provedor escolhido.',
  oauth_email_missing: 'Essa conta social nao retornou um e-mail para login.',
  oauth_email_unverified: 'Essa conta social ainda nao tem e-mail verificado.',
  oauth_subject_missing: 'Essa conta social nao retornou uma identificacao valida.',
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
