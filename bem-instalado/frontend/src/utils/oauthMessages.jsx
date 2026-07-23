const OAUTH_ERROR_MESSAGES = {
  account_type_mismatch: 'Esse e-mail já pertence ao outro tipo de conta. Entre pela tela correta.',
  google_not_configured:
    'Login com Google ainda não está configurado. Preencha GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET no backend.',
  google_token_exchange_failed: 'O Google recusou o callback. Confira a URL autorizada no Google Cloud.',
  google_id_token_missing: 'O Google não retornou o token da conta. Confira o Client ID e o Client Secret.',
  google_token_verify_failed: 'Não foi possível validar o token do Google. Tente novamente em alguns minutos.',
  google_audience_invalid: 'O Client ID do Google não confere com esta aplicação.',
  access_denied: 'Login cancelado na tela do provedor social.',
  code_missing: 'O provedor social não retornou o código de autorização.',
  oauth_state_expired: 'A tentativa de login expirou. Clique em entrar com Google novamente.',
  oauth_state_invalid: 'A tentativa de login social ficou inválida. Tente novamente pela tela de login.',
  state_provider_mismatch: 'O retorno do login social não confere com o provedor escolhido.',
  oauth_email_missing: 'Essa conta social não retornou um e-mail para login.',
  oauth_email_unverified: 'Essa conta social ainda não tem e-mail verificado.',
  oauth_subject_missing: 'Essa conta social não retornou uma identificação válida.',
  oauth_failed: 'Não foi possível concluir o login social. Confira as credenciais OAuth.',
  oauth_start_failed: 'Não foi possível iniciar o login social. Confira a configuração OAuth.',
};

export function getOAuthErrorMessage(errorCode) {
  return OAUTH_ERROR_MESSAGES[errorCode] || 'Não foi possível entrar com essa conta social.';
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
