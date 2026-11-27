// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import api from '../../services/api';
import SubscriptionOfferPreview from './SubscriptionOfferPreview';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));

const offer = {
  trial_days: 7, annual_discount_percent: 10, checkout_available: false,
  options: { monthly: { amount: 49.90 }, yearly: { amount: 538.92, savings: 59.88 } },
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('permite retomar um checkout ainda pendente e consultar o status sem criar cobrança', async () => {
  const onRefresh = vi.fn();
  api.post.mockResolvedValue({ data: { state: 'pending' } });
  render(<SubscriptionOfferPreview offer={{ ...offer, managed_trial: {
    state: 'pending', first_due_on: '2026-12-04',
    checkout_url: 'https://sandbox.asaas.com/checkoutSession/show?id=checkout-fixture',
  } }} features={[]} onRefresh={onRefresh} />);
  expect(screen.getByText('Primeiro vencimento: 04/12/2026.')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Continuar no Asaas' }).href).toContain('https://sandbox.asaas.com/');
  expect(screen.queryByRole('button', { name: 'Preparar checkout de teste' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Conferir status no Asaas' }));
  await waitFor(() => expect(onRefresh).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/subscriptions/managed-trial/refresh');
});

it('não oferece contratação quando a prévia está pausada', () => {
  render(<SubscriptionOfferPreview offer={offer} features={[]} isPro={false} />);
  expect(screen.getByText('A contratação ainda não está disponível.', { exact: false })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Preparar checkout de teste' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Conferir status no Asaas' })).toBeNull();
});

it('distingue o piloto real do Sandbox e exige consentimento do valor escolhido', async () => {
  api.post.mockResolvedValue({ data: {
    url: 'https://asaas.com/checkoutSession/show?id=pilot-fixture',
    first_charge_on: '2026-12-05', amount: 538.92,
  } });
  render(<SubscriptionOfferPreview offer={{ ...offer, checkout_available: true, checkout_environment: 'production',
    consent_version: 'asaas-pilot-v1', managed_trial: { state: 'eligible' },
  }} features={[]} />);
  screen.getByText('Piloto de produção.');
  expect(screen.queryByText(/Use somente o cartão fictício/)).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: /Anual/ }));
  const accept = screen.getByRole('checkbox', { name: /cobrança recorrente de R\$\s*538,92 por ano/ });
  fireEvent.click(accept);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar checkout no Asaas' }));
  expect(await screen.findByRole('link', { name: 'Continuar para o checkout do Asaas' })).toBeTruthy();
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/subscriptions/trial-checkout', {
    plan: 'yearly', accepted: true, consent_version: 'asaas-pilot-v1', amount_cents: 53892,
  });
});
