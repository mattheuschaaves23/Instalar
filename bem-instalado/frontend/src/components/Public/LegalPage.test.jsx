// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import LegalPage from './LegalPage';
import AccountDeletionPage from './AccountDeletionPage';

afterEach(cleanup);
const open = (type = 'privacy') => render(<MemoryRouter><LegalPage type={type} /></MemoryRouter>);

describe('documentos legais atuais', () => {
  it('identifica controlador, CNPJ, canal e versão atual da privacidade', () => {
    open();
    expect(screen.getByText(/BEM INSTALADO HOME DECOR LTDA/)).toBeTruthy();
    expect(screen.getByText(/55\.445\.091\/0001-60/)).toBeTruthy();
    expect(screen.getByText(/Versão 2026-11-19/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'instalaproo@gmail.com' }).getAttribute('href')).toBe('mailto:instalaproo@gmail.com');
  });
  it('explica WhatsApp manual, GPS externo, armazenamento e exercício de direitos', () => {
    open();
    const body = document.body.textContent;
    for (const expression of [/não envia a mensagem automaticamente/i, /Photon/, /ViaCEP/, /BrasilAPI/, /cookies/i,
      /Asaas/, /Turnstile/, /Sentry/, /Neon/, /revogar/i, /portabilidade/i, /ANPD/, /fora do Brasil/]) {
      expect(body).toMatch(expression);
    }
  });
  it.each([
    ['privacy', '/privacidade', 'Política de Privacidade'],
    ['terms', '/termos', 'Termos de Uso'],
  ])('cada documento tem título e endereço canônico próprios: %s', (type, path, title) => {
    open(type);
    expect(document.title).toContain(title);
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe(`${window.location.origin}${path}`);
  });
  it('não muda retroativamente a versão dos termos ao atualizar somente a privacidade', () => {
    open('terms');
    expect(screen.getByText(/Versão 2026-08-24/)).toBeTruthy();
    expect(screen.queryByText(/Versão 2026-11-19/)).toBeNull();
  });
  it('a página de exclusão também publica seu próprio título e endereço', () => {
    render(<MemoryRouter><AccountDeletionPage /></MemoryRouter>);
    expect(document.title).toContain('Excluir conta');
    expect(document.head.querySelector('link[rel="canonical"]').href).toBe(`${window.location.origin}/excluir-conta`);
  });
});

describe('domínio público dos documentos', () => {
  const root = resolve(process.cwd(), '../..');
  const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
  it.each(['/privacidade', '/termos', '/excluir-conta'])('o link legado %s redireciona somente no host antigo', (path) => {
    const rule = (vercel.redirects || []).find((rule) => rule.source === path);
    expect(rule).toMatchObject({ destination: `https://instalarpro.com.br${path}`, permanent: true,
      has: [{ type: 'host', value: 'instalar-sigma.vercel.app' }] });
  });
  it('não redireciona APIs, OAuth, downloads ou rotas autenticadas do aplicativo', () => {
    expect((vercel.redirects || []).every((rule) => ['/privacidade', '/termos', '/excluir-conta'].includes(rule.source))).toBe(true);
  });
  it('o HTML inicial e os links de cadastro nas lojas não anunciam mais o domínio antigo', () => {
    const html = readFileSync(resolve(root, 'bem-instalado/frontend/index.html'), 'utf8');
    expect(html).toContain('https://instalarpro.com.br/');
    expect(html).not.toContain('instalar-sigma.vercel.app');
    for (const path of ['README.md', 'pt-BR/google-play.md', 'pt-BR/app-store.md', 'pt-BR/privacy-data.md']) {
      const text = readFileSync(resolve(root, `bem-instalado/frontend/store-listing/${path}`), 'utf8');
      expect(text).not.toContain('instalar-sigma.vercel.app');
    }
  });
});
