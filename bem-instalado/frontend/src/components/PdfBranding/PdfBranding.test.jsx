// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  })));
  await waitFor(() => expect(save.disabled).toBe(true));
});

it('deixa o plano gratuito testar a aparência sem poder aplicar aos orçamentos', async () => {
  subscription.isPro = false;
  await open();
  fireEvent.click(screen.getByRole('radio', { name: 'Essencial' }));
  expect(screen.getByRole('article').getAttribute('data-template')).toBe('compact');
  expect(screen.getByRole('button', { name: 'Salvar modelo' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Baixar PDF de teste' }).disabled).toBe(false);
  expect(api.put).not.toHaveBeenCalled();
});
