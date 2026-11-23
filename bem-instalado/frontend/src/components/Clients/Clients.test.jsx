// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ConfirmProvider } from '../../contexts/ConfirmContext';
import api from '../../services/api';
import Clients from './Clients';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
const subscription = vi.hoisted(() => ({ isPro: true, planAccess: null }));
vi.mock('../../contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ ...subscription, refreshSubscription: async () => {} }),
}));
const platform = vi.hoisted(() => ({ storeApp: false }));
vi.mock('../../utils/nativePlatform', async (importOriginal) => ({
  ...(await importOriginal()),
  isNativeStoreApp: () => platform.storeApp,
}));
vi.mock('./ClientForm', () => ({
  default: ({ client, onClose, onSaved }) => (
    <div aria-label={client ? `Editar ${client.name}` : 'Novo cadastro'} role="dialog">
      <button type="button" onClick={onClose}>Fechar formulário</button>
      {client ? <button type="button" onClick={() => {
        onSaved({ ...client, name: 'Rafael Lima' });
        onClose();
      }}>Salvar ficha</button> : null}
    </div>
  ),
}));

HTMLDialogElement.prototype.showModal ??= function showModal() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close ??= function close(value) {
  this.returnValue = value;
  this.removeAttribute('open');
  this.dispatchEvent(new Event('close'));
};

const address = { street: 'Rua de Teste', house_number: '12', neighborhood: 'Centro', zip_code: '88000-000', state: 'SC' };
const records = [
  { id: 1, name: 'Rafael Costa', ...address, city: 'Palhoça', phone: '(48) 99999-0000', address_reference: 'Portão azul', email: 'rafael@example.com' },
  { id: 2, name: 'Bruno Martins' },
  { id: 3, name: 'Mariana Silva', email: 'mariana@example.com' },
  { id: 4, name: 'Álvaro Lima', ...address, city: 'São José', email: 'alvaro@example.com' },
];

function open(entry = '/clients') {
  return render(<MemoryRouter initialEntries={[entry]}><ConfirmProvider><Routes>
    <Route path="/clients" element={<Clients />} />
    <Route path="/clients/new" element={<Clients />} />
  </Routes></ConfirmProvider></MemoryRouter>);
}

const names = () => screen.queryAllByRole('rowheader').map((row) => row.querySelector('[title]').textContent);
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.resetAllMocks();
  subscription.isPro = true;
  subscription.planAccess = null;
  platform.storeApp = false;
  api.get.mockResolvedValue({ data: records });
  api.delete.mockResolvedValue({ data: { success: true } });
});
afterEach(cleanup);

describe('carteira de clientes', () => {
  it('lista em A–Z e explica quais cadastros podem ser completados', async () => {
    open();
    await screen.findByText('Só nome');
    expect(names()).toEqual(['Álvaro Lima', 'Bruno Martins', 'Mariana Silva', 'Rafael Costa']);
    expect(screen.getAllByText('Completo')).toHaveLength(2);
    expect(screen.getByText('Sem endereço')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Dados pendentes/ }));
    expect(names()).toEqual(['Bruno Martins', 'Mariana Silva']);
    expect(screen.getByText('2 clientes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Completos/ }));
    change('Filtrar por cidade', 'palhoca, sc');
    expect(names()).toEqual(['Rafael Costa']);
    expect(screen.getByText('1 cliente')).toBeTruthy();
  });

  it('busca por nome sem acento, telefone sem pontuação e e-mail, e troca a ordenação', async () => {
    open();
    await screen.findByText('4 clientes');
    change('Buscar clientes', 'alvaro');
    expect(names()).toEqual(['Álvaro Lima']);
    change('Buscar clientes', '48999990000');
    expect(names()).toEqual(['Rafael Costa']);
    change('Buscar clientes', 'mariana@example');
    expect(names()).toEqual(['Mariana Silva']);
    change('Buscar clientes', 'zzz');
    expect(screen.getByText('Nenhum cliente encontrado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    change('Ordenar clientes', 'za');
    expect(names()).toEqual(['Rafael Costa', 'Mariana Silva', 'Bruno Martins', 'Álvaro Lima']);
  });

  it('abre a ficha de leitura e atualiza a tabela após a edição', async () => {
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver ficha de Rafael Costa' }));
    const file = screen.getByRole('dialog', { name: 'Rafael Costa' });
    expect(within(file).getByText('Portão azul')).toBeTruthy();
    fireEvent.click(within(file).getByRole('button', { name: 'Editar cadastro' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Editar Rafael Costa' })).getByRole('button', { name: 'Salvar ficha' }));
    expect(screen.getByRole('button', { name: 'Ver ficha de Rafael Lima' })).toBeTruthy();
  });

  it('não exclui pelo menu sem confirmar', async () => {
    open();
    const menu = await screen.findByLabelText('Mais ações de Bruno Martins');
    const requestDeletion = () => {
      fireEvent.click(menu);
      fireEvent.click(within(menu.parentElement).getByRole('button', { name: 'Excluir cliente' }));
    };
    requestDeletion();
    const confirmation = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancelar' }));
    expect(api.delete).not.toHaveBeenCalled();

    requestDeletion();
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir cliente' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/clients/2'));
    await waitFor(() => expect(names()).not.toContain('Bruno Martins'));
  });

  it('mantém a rota de cadastrar cliente com formulário', async () => {
    open();
    await screen.findByText('4 clientes');
    fireEvent.click(screen.getByRole('button', { name: 'Novo cliente' }));
    const create = screen.getByRole('dialog', { name: 'Novo cadastro' });
    fireEvent.click(within(create).getByRole('button', { name: 'Fechar formulário' }));
    expect(screen.queryByRole('dialog', { name: 'Novo cadastro' })).toBeNull();
  });

  it('mostra a cota do plano Grátis sem esconder a tabela', async () => {
    subscription.isPro = false;
    subscription.planAccess = { limits: { clients: 15 } };
    open();
    expect(await screen.findByText('4 de 15 no plano Grátis')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Conhecer o Pro' }).getAttribute('href')).toBe('/subscription');
    expect(names()).toHaveLength(4);
  });

  // Regressao (fd523dc): a carteira nova trouxe "Conhecer o Pro" literal; no app das lojas
  // nenhuma tela pode convidar a assinar (politica de pagamento do Google e da Apple).
  it('no app das lojas a cota do plano Gratis nao convida a assinar o Pro', async () => {
    platform.storeApp = true;
    subscription.isPro = false;
    subscription.planAccess = { limits: { clients: 15 } };
    open();
    expect(await screen.findByText('4 de 15 no plano Grátis')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver meu plano' }).getAttribute('href')).toBe('/subscription');
    expect(screen.queryByText(/Conhecer o Pro/)).toBeNull();
  });

  it('reinicia a paginação quando se aplica uma busca e permite recuperar erro de carregamento', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: [
      ...records, { id: 5, name: 'Carla' }, { id: 6, name: 'Daniel' }, { id: 7, name: 'Elisa' },
    ] });
    open();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível carregar/);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('7 clientes');
    fireEvent.click(screen.getByRole('button', { name: /Próxima/ }));
    expect(names()).toEqual(['Rafael Costa']);
    change('Buscar clientes', 'elisa');
    expect(names()).toEqual(['Elisa']);
  });
});
