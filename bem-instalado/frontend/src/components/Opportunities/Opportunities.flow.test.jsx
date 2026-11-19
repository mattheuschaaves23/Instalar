// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Opportunities from './Opportunities';
import api from '../../services/api';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: () => ({ refreshSubscription: vi.fn().mockResolvedValue() }) }));
vi.mock('../Layout/panelBadgeCounts', () => ({ notifyPanelBadgeCountsChanged: vi.fn() }));
vi.mock('../Subscription/PlanUsage', () => ({ default: () => null }));
vi.mock('./MarketplaceProposal', () => ({ default: () => null }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const url = 'https://wa.me/5548988888888?text=Mensagem%20de%20teste';
const order = { id: 42, service_label: 'Instalação de papel', status: 'open', city: 'Palhoça', state: 'SC', can_contact_on_interest: true };
let popup;
beforeEach(() => {
  popup = { closed: false, location: { replace: vi.fn() }, close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(popup);
  api.get.mockReset(); api.post.mockReset();
  api.get.mockResolvedValue({ data: { opportunities: [order], eligibility: { can_express_interest: true } } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const open = async () => {
  render(<MemoryRouter><Opportunities /></MemoryRouter>);
  await screen.findByRole('button', { name: /Tenho interesse/ });
};

describe('interesse e abertura manual do WhatsApp', () => {
  it('registra uma vez, abre o rascunho e troca para Meus interesses', async () => {
    let finish;
    api.post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await open();
    const button = screen.getByRole('button', { name: /Tenho interesse/ });
    fireEvent.click(button); fireEvent.click(button);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    await act(async () => finish({ data: { opportunity: { ...order, interested_by_me: true, interest_whatsapp_url: url } } }));
    expect(popup.location.replace).toHaveBeenCalledWith(url);
    expect(popup.opener).toBeNull();
    expect(screen.getByRole('tab', { name: /Meus interesses/ }).getAttribute('aria-selected')).toBe('true');
    expect(api.post.mock.calls[0][0]).toBe('/opportunities/42/interest');
  });
  it('fecha a aba em branco quando o servidor recusa o interesse', async () => {
    api.post.mockRejectedValue({ response: { status: 403, data: { error: 'Complete seu perfil.' } } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Tenho interesse/ }));
    await waitFor(() => expect(popup.close).toHaveBeenCalledOnce());
    expect(popup.location.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /Novas/ }).getAttribute('aria-selected')).toBe('true');
  });
  it('sem consentimento do cliente não abre WhatsApp e continua nas três abas', async () => {
    api.get.mockResolvedValue({ data: { opportunities: [{ ...order, can_contact_on_interest: false }], eligibility: { can_express_interest: true } } });
    api.post.mockResolvedValue({ data: { opportunity: order } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Tenho interesse/ }));
    await waitFor(() => expect(screen.getByRole('tab', { name: /Meus interesses/ }).getAttribute('aria-selected')).toBe('true'));
    expect(window.open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: /Escolheram você/ }));
    expect(screen.getByRole('tab', { name: /Escolheram você/ }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(api.get.mock.calls.at(-1)[1].params.status).toBe('selected'));
  });
});
