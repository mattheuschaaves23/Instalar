import { describe, expect, it } from 'vitest';
import { getCanonicalLegalRedirect } from './canonicalLegalUrl';

describe('domínio canônico após navegação interna sem recarregar a página', () => {
  it.each(['/privacidade', '/termos', '/excluir-conta'])('corrige também a rota SPA %s do endereço legado', (path) => {
    expect(getCanonicalLegalRedirect('https://instalar-sigma.vercel.app', path, '?origem=rodape', '#direitos'))
      .toBe(`https://instalarpro.com.br${path}?origem=rodape#direitos`);
  });
  it.each(['https://instalarpro.com.br', 'https://preview.vercel.app', 'http://127.0.0.1:3018', 'https://localhost', 'capacitor://localhost'])('não redireciona outros ambientes: %s', (origin) => {
    expect(getCanonicalLegalRedirect(origin, '/privacidade')).toBe('');
  });
  it.each(['/api/health', '/auth/mobile/callback', '/dashboard', '/downloads/app.apk', '//outro.site'])('não altera rotas fora dos documentos: %s', (path) => {
    expect(getCanonicalLegalRedirect('https://instalar-sigma.vercel.app', path)).toBe('');
  });
});
