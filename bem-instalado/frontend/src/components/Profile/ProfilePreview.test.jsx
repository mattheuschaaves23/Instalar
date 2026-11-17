import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';

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
});
