import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { readFileSync } from 'node:fs';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 42, account_type: 'installer' } }) }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));
import InstallerProfile from '../Public/InstallerProfile';

describe('prévia privada do perfil', () => {
  const preview = {
    installer: { id: 42, display_name: 'Instalador de Teste', city: 'Palhoça', state: 'SC', installation_gallery: [], safety: {} },
    reviews: [],
  };
  it('mostra a apresentação do cliente mesmo sem publicação ou chamada à API pública', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/installers/42']}><Routes><Route path="/installers/:id" element={<InstallerProfile ownerPreview={preview} />} /></Routes></MemoryRouter>);
    expect(html).toContain('<h1>Instalador de Teste</h1>');
    expect(html).toContain('Editar perfil');
    expect(html).toContain('/profile?editar=1');
    expect(html).toContain('Conteúdos do perfil');
    expect(html).not.toContain('Encontrar instaladores');
    expect(html).not.toContain('Escolher este instalador');
  });
  it('identifica o indicador de agenda com um papel acessível válido', () => {
    const html = renderToStaticMarkup(<MemoryRouter><InstallerProfile ownerPreview={preview} /></MemoryRouter>);
    expect(html).toMatch(/<i[^>]*role="img"[^>]*aria-label="Agenda a consultar"/);
  });
  it('o texto secundário do perfil claro tem contraste AA sobre branco', () => {
    const css = readFileSync(new URL('../Public/InstallerProfile.css', import.meta.url), 'utf8');
    const color = css.match(/--ig-muted:\s*#([0-9a-f]{6})/i)[1];
    const linear = [0, 2, 4].map((index) => parseInt(color.slice(index, index + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
