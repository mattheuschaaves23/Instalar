import { describe, expect, it } from 'vitest';
import { PASSWORD_REVOKED_NOTICE, readOAuthCallbackParams } from './oauthMessages';

// O backend avisa com password_revoked=1 quando o login Google desativou a
// senha de uma conta que nunca confirmou o e-mail. Sem ler esse sinal, a pessoa
// só descobre depois, pelo "Credenciais inválidas".
describe('retorno do login Google', () => {
  it('lê o aviso de senha desativada no hash do app', () => {
    const params = readOAuthCallbackParams('#token=abc&next=%2Fdashboard&platform=android&password_revoked=1', '');
    expect(params).toMatchObject({ token: 'abc', next: '/dashboard', passwordRevoked: true });
  });

  it('lê o aviso de senha desativada na query da web', () => {
    const params = readOAuthCallbackParams('', '?next=%2Fdashboard&password_revoked=1');
    expect(params).toMatchObject({ token: '', next: '/dashboard', passwordRevoked: true });
  });

  it('sem o sinal não mostra aviso', () => {
    expect(readOAuthCallbackParams('#token=abc&next=%2Fdashboard', '').passwordRevoked).toBe(false);
    expect(readOAuthCallbackParams('', '?oauth_error=access_denied')).toMatchObject({ oauthError: 'access_denied', passwordRevoked: false });
  });

  it('o aviso explica o que fazer para voltar a entrar com senha', () => {
    expect(PASSWORD_REVOKED_NOTICE).toMatch(/senha antiga desta conta foi desativada/i);
    expect(PASSWORD_REVOKED_NOTICE).toMatch(/Esqueceu sua senha\?/);
  });
});
