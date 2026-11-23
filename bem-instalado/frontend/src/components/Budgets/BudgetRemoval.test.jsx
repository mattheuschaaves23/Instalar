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
    if (url === '/clients') return { data: [{ id: 7, name: 'Cliente QA' }] };
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

it('mantém a remoção independente da instalação e valida antes de revisar', async () => {
  api.post.mockResolvedValue({ data: { id: 55 } });
  render(<MemoryRouter><BudgetForm /></MemoryRouter>);
  await screen.findByRole('option', { name: 'Cliente QA' });
  change('Cliente', '7');
  click('Continuar para o cálculo');
  expect(screen.queryByText('Cartão à vista')).toBeNull();
  expect(screen.getByText('Cartão de débito')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Aceitar pagamento parcelado' })).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /^Pix/ }));
  change('Ambiente', 'Sala');
  change('Largura (m)', '4');
  change('Altura (m)', '2');
  change('Rolos (opcional)', '2');
  const input = screen.getByRole('spinbutton', { name: 'Rolos a remover' });
  expect(input.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Remover papel' }));
  expect(input.disabled).toBe(false);
  expect(input.placeholder).toBe('2');
  expect(screen.getByText(/2 rolos • R\$\s*100,00/)).toBeTruthy();

  change('Rolos a remover', '2.5');
  expect(input.getAttribute('aria-invalid')).toBe('true');
  click('Revisar resumo');
  expect(screen.queryByRole('button', { name: 'Continuar para salvar' })).toBeNull();

  change('Rolos a remover', '1');
  expect(screen.getByText(/1 rolo • R\$\s*50,00/)).toBeTruthy();
  change('Rolos a remover', '');
  expect(screen.getByText(/2 rolos • R\$\s*100,00/)).toBeTruthy();
  change('Rolos a remover', '3');
  expect(screen.getByText(/3 rolos • R\$\s*150,00/)).toBeTruthy();
  expect(screen.getByLabelText('Rolos (opcional)').value).toBe('2');

  click('Revisar resumo');
  expect(screen.getByText('Remoção por rolo (3 rolos)')).toBeTruthy();
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
  fireEvent.change(screen.getByRole('spinbutton', { name: /^Preço do rolo/ }), { target: { value: '80' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: /^03 · Remoção por rolo/ }), { target: { value: '25' } });
  change('Rolos a remover', '4');
  click('Revisar resumo');
  click('Continuar para salvar');
  click('Salvar orçamento');
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/budgets/18/draft', expect.objectContaining({
    removal_rolls: 4,
    removal_price_per_roll: 25,
    environments: [expect.objectContaining({ rolls_manual: 2, removal_included: true })],
  })));
});
