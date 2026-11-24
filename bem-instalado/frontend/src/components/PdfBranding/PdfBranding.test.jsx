// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import api from '../../services/api';
import PdfBranding from './PdfBranding';

const subscription = vi.hoisted(() => ({ isPro: true, loading: false }));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: () => subscription }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
  subscription.isPro = true;
  api.get.mockReset().mockResolvedValue({ data: { branding: { brand_name: 'Teste' }, profile: { name: 'Ana', email: 'ana@example.test' } } });
  api.put.mockReset().mockImplementation(async (_url, branding) => ({ data: { branding } }));
  api.post.mockReset();
});
afterEach(cleanup);

async function open() {
  render(<MemoryRouter><PdfBranding /></MemoryRouter>);
  await screen.findByRole('article', { name: 'Prévia ilustrativa do orçamento' });
}

it('atualiza a prévia e salva apenas opções da aparência', async () => {
  await open();
  fireEvent.click(screen.getByRole('radio', { name: 'Clássico' }));
  fireEvent.change(screen.getByLabelText('Subtítulo'), { target: { value: 'Revestimento decorativo' } });
  fireEvent.change(screen.getByLabelText('Fonte dos títulos'), { target: { value: 'mono' } });
  fireEvent.change(screen.getByLabelText('Espaçamento'), { target: { value: 'dense' } });
  fireEvent.change(screen.getByLabelText('Texto do rodapé'), { target: { value: 'Ateliê de teste' } });
  fireEvent.click(screen.getByLabelText('Meu telefone e e-mail'));
  fireEvent.change(screen.getByLabelText('Validade a partir da emissão'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('Código hexadecimal da cor'), { target: { value: '#abc' } });
  const save = screen.getByRole('button', { name: 'Salvar modelo' });
  expect(save.disabled).toBe(true);
  expect(screen.queryByText('ana@example.test')).toBeNull();
  expect(screen.getByText(/Validade: 30\/11\/2026/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Código hexadecimal da cor'), { target: { value: '#236328' } });
  fireEvent.click(save);
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/pdf-branding', expect.objectContaining({
    template: 'classic', accent_color: '#236328', show_contact: false, validity_days: 7,
    document_subtitle: 'Revestimento decorativo', heading_font: 'mono', density: 'dense', footer_text: 'Ateliê de teste',
  })));
  await waitFor(() => expect(save.disabled).toBe(true));
});

it('deixa o plano gratuito testar a aparência sem poder aplicar aos orçamentos', async () => {
  subscription.isPro = false;
  await open();
  expect(screen.getByRole('radio', { name: 'Gratuito' }).checked).toBe(true);
  expect(screen.getByText('Gerado com InstalarPro')).toBeTruthy();
  expect(screen.queryByLabelText('Nome da marca')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: 'Técnico' }));
  expect(screen.getByRole('article').getAttribute('data-template')).toBe('compact');
  expect(screen.getByRole('button', { name: 'Salvar modelo' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Baixar PDF de teste' }).disabled).toBe(false);
  expect(api.put).not.toHaveBeenCalled();
});

it('usa estruturas distintas e permite ocultar valores individuais sem retirar o total', async () => {
  await open();
  const preview = within(screen.getByRole('article'));
  expect(preview.getByRole('list')).toBeTruthy();
  expect(preview.queryByRole('table')).toBeNull();
  expect(preview.getByText('Total do orçamento').closest('header')).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Clássico' }));
  expect(preview.getByText('Total do orçamento').closest('.quote-paper-editorial-close')).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Técnico' }));
  expect(preview.getByRole('columnheader', { name: 'Nº' })).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Valores por ambiente'));
  expect(preview.queryByRole('columnheader', { name: 'Valor' })).toBeNull();
  expect(preview.getByText('Total do orçamento')).toBeTruthy();
});
