// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Home from './Home';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock('../../contexts/NotificationContext', () => ({ useNotifications: () => ({ notifications: [], refreshNotifications: vi.fn() }) }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => vi.fn().mockResolvedValue(true) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../Security/Turnstile', () => ({ default: () => null, isTurnstileEnabled: () => false }));

const region = { city: 'Palhoça', state: 'SC', street: '', addressReference: '', label: 'Palhoça', displayName: 'Palhoça, SC', latitude: -27.645, longitude: -48.668 };
const street = { ...region, street: 'Rua Turquesa', addressReference: 'Rua Turquesa', label: 'Rua Turquesa', displayName: 'Rua Turquesa, Palhoça, SC' };

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem('papelperto_client_location_checked', 'done');
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  Element.prototype.scrollIntoView = vi.fn();
  api.get.mockReset();
  api.get.mockImplementation(async (url) => ({ data: url.includes('/location/search') ? { suggestions: [region] } : {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openLocation() {
  render(<MemoryRouter initialEntries={['/cliente']}><Home /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Casa ou apartamento/ }));
  fireEvent.click(screen.getByRole('button', { name: /Papel vinílico/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Sala' }));
  fireEvent.click(screen.getByRole('button', { name: 'Já comprei o papel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Não sei as medidas' }));
  fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
  await screen.findByRole('combobox', { name: 'Endereço da instalação' });
}

describe('confirmação da localização no formulário real', () => {
  it('não avança com um resultado que contém só cidade; pede a rua sem apagar cidade e UF', async () => {
    await openLocation();
    fireEvent.change(screen.getByRole('combobox', { name: 'Endereço da instalação' }), { target: { value: 'Palhoça' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
    const input = await screen.findByRole('textbox', { name: /Rua ou referência/ });
    expect(input.value).toBe('');
    expect(screen.getByRole('textbox', { name: /Cidade/ }).value).toBe('Palhoça');
    expect(screen.getByRole('combobox', { name: /Estado/ }).value).toBe('SC');
    expect(screen.queryByText('Revise seu pedido')).toBeNull();
    fireEvent.change(input, { target: { value: 'Estrada sem cadastro' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
    expect(await screen.findByText('Revise seu pedido')).toBeTruthy();
  });
  it('também exige rua quando a pessoa escolhe uma sugestão de cidade', async () => {
    await openLocation();
    fireEvent.change(screen.getByRole('combobox', { name: 'Endereço da instalação' }), { target: { value: 'Palhoça' } });
    fireEvent.click(await screen.findByRole('option', { name: /Palhoça/ }));
    expect(await screen.findByRole('textbox', { name: /Rua ou referência/ })).toBeTruthy();
    expect(screen.queryByText('Revise seu pedido')).toBeNull();
  });
  it('não deixa uma busca antiga sobrescrever o endereço digitado depois', async () => {
    let finish;
    api.get.mockImplementation((url) => url.includes('/location/search') ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve({ data: {} }));
    await openLocation();
    const input = screen.getByRole('combobox', { name: 'Endereço da instalação' });
    fireEvent.change(input, { target: { value: 'Rua antiga' } });
    fireEvent.click(screen.getByRole('button', { name: /^Continuar/ }));
    fireEvent.change(input, { target: { value: 'Rua nova' } });
    await act(async () => finish({ data: { suggestions: [street] } }));
    expect(input.value).toBe('Rua nova');
    expect(screen.queryByText('Revise seu pedido')).toBeNull();
  });
});
