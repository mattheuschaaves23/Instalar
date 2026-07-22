export function getAuthRequestErrorMessage(error, fallback = 'Não foi possível entrar.') {
  if (error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout')) {
    return 'A conexão demorou mais que o esperado. Verifique sua internet e tente novamente.';
  }

  if (!error?.response) {
    return 'Não foi possível conectar ao InstalaPro. Confira a internet do aparelho e tente novamente.';
  }

  if (error.response.status === 429) {
    const retryAfter = Number(error.response?.data?.retry_after_seconds || 0);
    const minutes = retryAfter > 0 ? Math.max(1, Math.ceil(retryAfter / 60)) : null;
    return minutes
      ? `Muitas tentativas de acesso. Aguarde cerca de ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} e tente novamente.`
      : 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.';
  }

  return error.response?.data?.error || fallback;
}
