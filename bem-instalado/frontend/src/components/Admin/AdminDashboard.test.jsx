// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import AdminDashboard from './AdminDashboard';
import { AdminWorkspace } from './AdminWorkspace';

const fixtures = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => fixtures.confirm }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

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

  it('mostra a resolução recomendada na lista de anúncios sem abrir o editor', async () => {
    open('/admin?section=advertising&tab=ads');
    await screen.findByText('Nenhum item encontrado.');
    expect(screen.getByText('1440 × 240 px')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Novo anúncio' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lojas recomendadas' }));
    expect(screen.queryByText('1440 × 240 px')).toBeNull();
  });

  it('mostra a resolução da arte selecionada e envia o arquivo com o anúncio', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:banner-qa');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    try {
      open('/admin?section=advertising&tab=ads');
      fireEvent.click(screen.getByRole('button', { name: 'Novo anúncio' }));
      expect(screen.getByText(/^Recomendado: 1440 × 240 px/)).toBeTruthy();
      expect(screen.queryByRole('textbox', { name: 'URL da imagem' })).toBeNull();
      expect(screen.getByRole('textbox', { name: 'Link de destino' })).toBeTruthy();
      fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Banner de teste' } });
      const file = new File(['arquivo'], 'banner.png', { type: 'image/png' });
      const fileInput = screen.getByLabelText('Arquivo da imagem');
      expect(fileInput.type).toBe('file');
      fireEvent.change(fileInput, { target: { files: [file] } });
      const preview = await screen.findByRole('img', { name: 'Prévia da imagem do anúncio' });
      Object.defineProperties(preview, { naturalWidth: { value: 1500 }, naturalHeight: { value: 250 } });
      fireEvent.load(preview);
      expect(await screen.findByText(/1500 × 250 px/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => {
        const [path, data] = api.post.mock.calls.at(-1) || [];
        expect(path).toBe('/admin/dashboard-ads');
        expect(data.get('title')).toBe('Banner de teste');
        expect(data.get('file')).toEqual(file);
      });
      await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:banner-qa'));
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('envia um vídeo maior em partes antes de publicar o anúncio', async () => {
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL() { return 'blob:video-banner-qa'; }
      static revokeObjectURL() {}
    });
    const chunk = 3 * 1024 * 1024;
    const uploadId = '46081db6-32ef-4bfc-ba7e-e012ac612aa7';
    api.post.mockImplementation(async (url) => ({
      data: url.endsWith('/uploads') ? { id: uploadId, chunk_size: chunk } : {},
    }));
    api.put.mockResolvedValue({ status: 204 });
    try {
      open('/admin?section=advertising&tab=ads');
      fireEvent.click(screen.getByRole('button', { name: 'Novo anúncio' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), { target: { value: 'Vídeo maior' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Formato' }), { target: { value: 'video' } });
      const file = new File([new Uint8Array(2 * chunk + 7)], 'banner.mp4', { type: 'video/mp4' });
      fireEvent.change(screen.getByLabelText('Arquivo do vídeo'), { target: { files: [file] } });
      const preview = await screen.findByLabelText('Prévia do vídeo');
      Object.defineProperties(preview, { videoWidth: { value: 1440 }, videoHeight: { value: 240 } });
      fireEvent.loadedMetadata(preview);
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/dashboard-ads', expect.objectContaining({ upload_id: uploadId })));
      expect(api.put.mock.calls.map(([url, data]) => [url, data.get('file').size])).toEqual(
        [chunk, chunk, 7].map((size, part) => ['/admin/dashboard-ads/uploads/' + uploadId + '/' + part, size])
      );
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });
});
