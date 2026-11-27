// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import AppErrorBoundary from './AppErrorBoundary';
import Layout from './Layout';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('../../services/api', () => ({ default: { defaults: { baseURL: 'https://api.example.test/api' } } }));
vi.mock('../Auth/EmailVerification', () => ({ EmailVerificationNotice: () => null }));
vi.mock('./InstallerPanelShell', () => ({
  default: ({ children }) => <><nav aria-label="Menu do instalador"><Link to="/agenda">Agenda</Link></nav>{children}</>,
}));

let falha;
function Orders() {
  if (falha) throw new Error('Falha de teste ao carregar orçamentos');
  return <h1>Orçamentos recuperados</h1>;
}

beforeEach(() => {
  falha = true;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function openPanel() {
  return render(
    <AppErrorBoundary>
      <MemoryRouter initialEntries={['/budgets']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/budgets" element={<Orders />} />
            <Route path="/agenda" element={<h1>Agenda disponível</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppErrorBoundary>,
  );
}

it('mantém o menu utilizável e permite sair de uma página que falhou', () => {
  openPanel();
  expect(screen.getByRole('navigation', { name: 'Menu do instalador' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name: 'Agenda' }));
  expect(screen.getByRole('heading', { name: 'Agenda disponível' })).toBeTruthy();
});

it('recupera uma falha transitória tentando apenas a área com erro', () => {
  openPanel();
  const menu = screen.getByRole('navigation');
  falha = false;
  fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
  expect(screen.getByRole('heading', { name: 'Orçamentos recuperados' })).toBeTruthy();
  expect(screen.getByRole('navigation')).toBe(menu);
});

it('entrega o diagnóstico à API configurada e identifica a tela sem enviar endereço completo', () => {
  window.history.replaceState(null, '', '/budgets/789/edit?token=identificador-privado#rascunho');
  render(<AppErrorBoundary><Orders /></AppErrorBoundary>);
  const [url, request] = fetch.mock.calls[0];
  expect(url).toBe('https://api.example.test/api/public/client-errors');
  expect(request.credentials).toBe('omit');
  expect(JSON.parse(request.body).view).toBe('BudgetForm');
  expect(request.body).not.toMatch(/789|identificador-privado|#rascunho/);
});
