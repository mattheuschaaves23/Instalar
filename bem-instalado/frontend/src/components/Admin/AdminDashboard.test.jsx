// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import AdminDashboard from './AdminDashboard';
import { AdminWorkspace } from './AdminWorkspace';

const fixtures = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => fixtures.confirm }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

function open(path) {
  return render(<MemoryRouter initialEntries={[path]}><AdminWorkspace><AdminDashboard /></AdminWorkspace></MemoryRouter>);
}
const record = { id: 14, name: 'Marina Souza', public_profile: false, certificate_file: 'https://example.test/certificado.pdf', certification_status: 'pending' };

beforeEach(() => {
  vi.resetAllMocks();
  fixtures.confirm.mockResolvedValue(true);
  api.post.mockResolvedValue({ data: { delivered_count: 2 } });
  api.get.mockImplementation(async (path, config) => {
    if (path === '/admin/overview') return { data: { metrics: { pending_payments: 3 } } };
    if (path === '/admin/installer-verifications') return { data: { verifications: config.params.status === 'pending' ? [record] : [] } };
    if (path === '/admin/service-requests') return { data: { requests: [{ id: 82, city: 'São José', status: 'open', interests_count: 2 }] } };
    if (path === '/admin/service-requests/82/interests') return { data: { interests: [
      { id: 12, status: 'interested', installer_name: 'Rosa Lima' }, { id: 13, status: 'selected', installer_name: 'Rosa Lima' },
    ] } };
    return { data: {} };
  });
});
afterEach(cleanup);

describe('novo painel administrativo', () => {
  it('marca a seção ativa e abre interessados só quando solicitado', async () => {
    open('/admin?section=requests');
    expect(within(screen.getByRole('navigation', { name: 'Áreas administrativas' }))
      .getByRole('link', { name: 'Pedidos' }).getAttribute('aria-current')).toBe('page');
    expect(api.get).not.toHaveBeenCalledWith('/admin/service-requests/82/interests', expect.anything());
    fireEvent.click(await screen.findByRole('button', { name: 'Ver interessados' }));
    expect(await screen.findAllByText('Rosa Lima')).toHaveLength(2);
  });

  it('mantém publicar o perfil como escolha separada da aprovação do certificado', async () => {
    open('/admin?section=verifications');
    const checkbox = await screen.findByRole('checkbox', { name: 'Publicar perfil na busca' });
    expect(checkbox.checked).toBe(false);
    expect(screen.getByRole('link', { name: 'Abrir certificado' }).getAttribute('rel')).toContain('noopener');
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar certificado' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/installer-verifications/14/decision', { decision: 'approve', publish: false }));
  });

  it('aplica o atalho de cobranças pendentes e envia o período escolhido à API', async () => {
    open('/admin');
    fireEvent.click(await screen.findByRole('link', { name: 'Conferir' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/payments', expect.objectContaining({
      params: expect.objectContaining({ status: 'pending' }),
    })));
    fireEvent.change(screen.getByRole('combobox', { name: 'Período da cobrança' }), { target: { value: 'month' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/payments', expect.objectContaining({
      params: expect.objectContaining({ status: 'pending', period: 'month' }),
    })));
  });

  it('não dispara comunicado quando o administrador cancela a revisão', async () => {
    fixtures.confirm.mockResolvedValue(false);
    open('/admin?section=announcements');
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Manutenção' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem' }), { target: { value: 'Voltamos em breve.' } });
    expect(screen.getByRole('heading', { name: 'Manutenção' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar envio' }));
    await waitFor(() => expect(fixtures.confirm).toHaveBeenCalledTimes(1));
    expect(api.post).not.toHaveBeenCalled();
  });
});
