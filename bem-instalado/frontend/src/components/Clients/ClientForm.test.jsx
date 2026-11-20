// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import BudgetForm from '../Budgets/BudgetForm';
import ClientForm from './ClientForm';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ isPro: true, refreshSubscription: async () => null }),
}));

HTMLDialogElement.prototype.showModal ??= function showModal() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function close(value = '') {
  this.returnValue = value;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close', { bubbles: true }));
};

beforeEach(() => {
  api.get.mockReset().mockImplementation(async (path) => {
    if (path === '/clients') return { data: [] };
    if (path === '/users/profile') return { data: { roll_price: 80 } };
    throw new Error(`Rota inesperada: ${path}`);
  });
  api.post.mockReset().mockImplementation(async (path, body) => {
    if (path !== '/clients' || body.quick_create !== true) throw new Error('Use o cadastro rápido');
    return { data: { id: 7, name: body.name, phone: '', document_id: null } };
  });
  api.put.mockReset().mockImplementation(async (path, body) => {
    if (path !== '/clients/7') throw new Error(`Rota inesperada: ${path}`);
    return { data: { id: 7, ...body, document_id: null } };
  });
});
afterEach(cleanup);

it('começa o cálculo sem pedir CPF, telefone ou endereço para um novo orçamento manual', async () => {
  render(<MemoryRouter><BudgetForm /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));
  fireEvent.click(screen.getByRole('button', { name: /Cadastrar cliente depois/ }));
  expect(screen.queryAllByLabelText(/CPF|Telefone|CEP/)).toHaveLength(0);
  fireEvent.change(screen.getByRole('textbox', { name: /nome do cliente/i }), { target: { value: '  Cliente avulso  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
  expect(await screen.findByRole('button', { name: 'Voltar ao cliente' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Voltar ao cliente' }));
  expect(screen.getByRole('combobox', { name: 'Cliente' }).value).toBe('7');
});

it('edita o e-mail de um contato sem exigir os demais dados', async () => {
  let saved;
  render(<ClientForm client={{ id: 7, name: 'Cliente avulso', phone: '', document_id: null }} onSaved={(client) => { saved = client; }} onClose={cleanup} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'E-mail' }), { target: { value: 'contato@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await waitFor(() => expect(saved?.email).toBe('contato@example.test'));
  expect(saved?.document_id).toBeNull();
  expect(api.put.mock.calls[0][1]).not.toHaveProperty('phone');
});
