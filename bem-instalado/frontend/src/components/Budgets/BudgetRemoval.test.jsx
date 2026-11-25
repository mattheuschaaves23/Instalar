// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import BudgetForm from './BudgetForm';
import api from '../../services/api';

vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ isPro: true, refreshSubscription: vi.fn() }),
}));
vi.mock('../Layout/panelBadgeCounts', () => ({ notifyPanelBadgeCountsChanged: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockImplementation(async (url) => {
    if (url === '/clients') return { data: [{ id: 7, name: 'Cliente QA' }, { id: 8, name: 'João Silva', phone: '+55 (48) 99999-1234', email: 'joao@example.test' }] };
    if (url === '/users/profile') return { data: { default_price_per_roll: 80, default_removal_price: 50 } };
    return { data: { request: {
      id: 32, is_direct: true, client_name: 'Cliente QA',
      direct_quote_details: { environments: [
        { name: 'Sala', width: 4, height: 2, rolls: 2, removal: 'yes' },
      ] },
    } } };
  });
});
afterEach(cleanup);

const change = (name, value) => fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value } });
const click = (name) => fireEvent.click(screen.getByRole('button', { name, exact: true }));

it('salva um orçamento com valor fechado sem informar medidas nem ambientes', async () => {
  api.post.mockResolvedValue({ data: { id: 55 } });
  render(<MemoryRouter><BudgetForm /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('radio', { name: 'Cliente QA' }));
  click('Continuar para o cálculo');
  fireEvent.click(screen.getByRole('radio', { name: 'Valor fechado (sem medidas)' }));
  expect(screen.queryByLabelText('Largura (m)')).toBeNull();
  change('Valor do serviço', '450.50');
  click('Revisar orçamento');
  expect(screen.getByText('Valor fechado', { exact: true })).toBeTruthy();
  click('Continuar para salvar');
  click('Salvar orçamento');
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/budgets', expect.objectContaining({
    client_id: 7, pricing_mode: 'fixed', fixed_price: 450.50, environments: [],
  })));
});

it('encontra clientes sem acentos e por telefone formatado', async () => {
  render(<MemoryRouter><BudgetForm /></MemoryRouter>);
  await screen.findByRole('radio', { name: 'João Silva' });
  const search = screen.getByRole('searchbox', { name: 'Buscar cliente' });
  fireEvent.change(search, { target: { value: 'joao silva' } });
  expect(screen.queryByRole('radio', { name: 'Cliente QA' })).toBeNull();
  expect(screen.getByRole('radio', { name: 'João Silva' })).toBeTruthy();
  fireEvent.change(search, { target: { value: '48 99999-1234' } });
  fireEvent.click(screen.getByRole('radio', { name: 'João Silva' }));
  fireEvent.change(search, { target: { value: '' } });
  expect(screen.getByRole('radio', { name: 'João Silva' }).checked).toBe(true);
});

it('mostra o total ao calcular e permite corrigir o pagamento sem perder as medidas', async () => {
  render(<MemoryRouter><BudgetForm /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('radio', { name: 'Cliente QA' }));
  click('Continuar para o cálculo');
  change('Ambiente', 'Sala');
  change('Largura (m)', '2');
  change('Altura (m)', '3');
  expect(screen.getByRole('region', { name: 'Resumo do cálculo' }).textContent).toMatch(/Total estimado\s*R\$\s*160,00/);
  click('Revisar orçamento');
  click('Editar pagamento');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Pagamento' }));
  expect(screen.getByLabelText('Largura (m)').value).toBe('2');
});

it('mantém a remoção independente da instalação e valida antes de revisar', async () => {
  api.post.mockResolvedValue({ data: { id: 55 } });
  render(<MemoryRouter><BudgetForm /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('radio', { name: 'Cliente QA' }));
  click('Continuar para o cálculo');
  expect(screen.queryByText('Cartão à vista')).toBeNull();
  expect(screen.getByText('Cartão de débito')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Aceitar parcelamento' })).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /^Pix/ }));
  change('Ambiente', 'Sala');
  change('Largura (m)', '4');
  change('Altura (m)', '2');
  change('Rolos (opcional)', '2');
  expect(screen.queryByRole('spinbutton', { name: 'Rolos a remover' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Remover papel' }));
  const input = screen.getByRole('spinbutton', { name: 'Rolos a remover' });
  expect(input.disabled).toBe(false);
  expect(input.placeholder).toBe('2');
  expect(screen.getByText(/2 rolos • R\$\s*100,00/)).toBeTruthy();

  change('Rolos a remover', '2.5');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  click('Revisar orçamento');
  expect(screen.queryByRole('button', { name: 'Continuar para salvar' })).toBeNull();

  change('Rolos a remover', '1');
  expect(screen.getByText(/1 rolo • R\$\s*50,00/)).toBeTruthy();
  change('Rolos a remover', '');
  expect(screen.getByText(/2 rolos • R\$\s*100,00/)).toBeTruthy();
  change('Rolos a remover', '3');
  expect(screen.getByText(/3 rolos • R\$\s*150,00/)).toBeTruthy();
  expect(screen.getByLabelText('Rolos (opcional)').value).toBe('2');

  click('Revisar orçamento');
  expect(screen.getByText('Remoção (3 rolos)')).toBeTruthy();
  click('Continuar para salvar');
  click('Salvar orçamento');
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/budgets', expect.objectContaining({
    removal_rolls: 3,
    removal_price_per_roll: 50,
    upfront_payment_terms: [{ method: 'pix', label: 'Pix', discount_percent: 0 }],
    environments: [expect.objectContaining({ rolls_manual: 2, removal_included: true })],
  })));
});

it('envia a quantidade também ao concluir um rascunho criado de um pedido', async () => {
  api.put.mockResolvedValue({ data: { id: 18 } });
  render(<MemoryRouter initialEntries={['/budgets/18/complete']}><Routes>
    <Route path="/budgets/:draftId/complete" element={<BudgetForm />} />
    <Route path="/budgets" element={<p>Lista de orçamentos</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar para o cálculo' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Preço por rolo' }), { target: { value: '80' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Valor por rolo' }), { target: { value: '25' } });
  change('Rolos a remover', '4');
  click('Revisar orçamento');
  click('Continuar para salvar');
  click('Salvar orçamento');
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/budgets/18/draft', expect.objectContaining({
    removal_rolls: 4,
    removal_price_per_roll: 25,
    environments: [expect.objectContaining({ rolls_manual: 2, removal_included: true })],
  })));
});
