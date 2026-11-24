import { describe, expect, it } from 'vitest';
import { buildNativeOAuthFallbackUrl, getNativeOAuthRoute } from './nativeOAuth';

describe('retorno OAuth do aplicativo Android', () => {
  const publicHosts = ['instalar-sigma.vercel.app', 'instalarpro.com.br'];

  it.each(publicHosts)('aceita o App Link de %s e preserva o fragmento de autenticação', (host) => {
    const route = getNativeOAuthRoute(
      `https://${host}/auth/mobile/callback#token=abc&next=%2Fdashboard`
    );

    expect(route).toBe('/auth/social/callback#token=abc&next=%2Fdashboard');
  });

  it('aceita o esquema de contingência do InstalaPro', () => {
    expect(
      getNativeOAuthRoute('instalapro://auth/callback#oauth_error=access_denied')
    ).toBe('/auth/social/callback#oauth_error=access_denied');
  });

  it('rejeita domínios, protocolos e caminhos que não pertencem ao login', () => {
    expect(getNativeOAuthRoute('https://example.com/auth/mobile/callback#token=abc')).toBe('');
    expect(getNativeOAuthRoute('http://instalarpro.com.br/auth/mobile/callback#token=abc')).toBe('');
    expect(getNativeOAuthRoute('https://instalarpro.com.br/auth/mobile/callback/outro#token=abc')).toBe('');
    expect(getNativeOAuthRoute('instalapro://profile/callback#token=abc')).toBe('');
    expect(getNativeOAuthRoute('javascript:alert(1)')).toBe('');
  });

  it.each(publicHosts)('cria a contingência de %s sem mover o token para a query string', (host) => {
    expect(
      buildNativeOAuthFallbackUrl(
        `https://${host}/auth/mobile/callback#token=abc&next=%2Fdashboard`
      )
    ).toBe('instalapro://auth/callback#token=abc&next=%2Fdashboard');
  });
});
