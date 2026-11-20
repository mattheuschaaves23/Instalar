// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import api from '../../services/api';
import InstallerProfile from './InstallerProfile';
import Profile from '../Profile/Profile';
import Opportunities from '../Opportunities/Opportunities';
import Notifications from '../Notifications/Notifications';

const state = vi.hoisted(() => ({ user: null }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: () => ({ isPro: true, refreshSubscription: vi.fn() }) }));
vi.mock('../Layout/panelBadgeCounts', () => ({ notifyPanelBadgeCountsChanged: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { defaults: {}, get: vi.fn(), post: vi.fn() } }));
vi.mock('../Security/Turnstile', () => ({
  isTurnstileEnabled: () => true,
  default: ({ onVerify, onError }) => <>
    <button type="button" onClick={() => onVerify('qa-challenge')}>Confirmar verificação QA</button>
    <button type="button" onClick={() => onError?.()}>Simular falha na verificação</button>
  </>,
}));

const installer = { id: 42, display_name: 'Instalador QA', installation_gallery: [], accepts_direct_requests: true };
const owner = { id: 42, name: 'Instalador QA', phone: '48999990000', city: 'Palhoça', state: 'SC', email: 'qa@example.test', email_verified: true, public_profile: true, certification_verified: true };
const opportunity = { id: 32, is_direct: true, status: 'open', service_label: 'Instalação de papel de parede', city: 'Curitiba', state: 'PR' };
const accessCode = '1234567890abcdef1234567890abcdef1234567890abcdef';
const openProfile = (initialEntry, ownerPreview) => render(
  <MemoryRouter initialEntries={[initialEntry]}><Routes>
    <Route path="/installers/:id" element={<InstallerProfile ownerPreview={ownerPreview} />} />
  </Routes></MemoryRouter>
);
const openOwner = () => render(<MemoryRouter initialEntries={['/profile#link-para-clientes']}><Profile /></MemoryRouter>);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  state.user = null;
  api.get.mockReset().mockImplementation(async (url) => {
    if (url === '/users/profile') return { data: owner };
    if (url === '/public/installers/42') return { data: { installer } };
    if (url === '/opportunities') return { data: { opportunities: [opportunity], eligibility: { can_express_interest: false }, stats: { open: 1 } } };
    throw new Error('Unexpected GET');
  });
  api.post.mockReset().mockImplementation(async (url) => {
    if (url === '/public/installers/42/direct-requests') return { data: { service_request: { id: 32, client_access_token: accessCode } } };
    if (url === '/opportunities/32/accept-direct') return { data: { budget_id: 18 } };
    throw new Error('Unexpected POST');
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('mostra 2,5 como nota inicial sem contar uma avaliação de cliente', async () => {
  openProfile('/installers/42#avaliacoes');
  const initialRating = await screen.findByRole('link', { name: /2,5.*nota inicial/i });
  expect(initialRating.getAttribute('href')).toContain('#avaliacoes');
  const reviews = within(screen.getByRole('tabpanel', { name: 'Avaliações' }));
  expect(reviews.getByText('0 avaliações de clientes')).toBeTruthy();
  expect(reviews.getByRole('img', { name: '2,5 de 5 estrelas' })).toBeTruthy();
});

it('substitui a nota inicial pela média real mesmo quando a primeira nota é menor', async () => {
  api.get.mockResolvedValueOnce({ data: {
    installer: { ...installer, average_rating: '2.0', review_count: 1 },
    reviews: [{ reviewer_name: 'Cliente de teste', rating: 2, comment: 'Atendimento concluído' }],
  } });
  openProfile('/installers/42#avaliacoes');
  expect(await screen.findByRole('link', { name: /2,0.*1 avaliação/i })).toBeTruthy();
  const reviews = within(screen.getByRole('tabpanel', { name: 'Avaliações' }));
  expect(reviews.getAllByRole('img', { name: '2,0 de 5 estrelas' })).toHaveLength(2);
  expect(screen.queryByText('Nota inicial')).toBeNull();
});

it('instalador com perfil público pode copiar o link em Meu perfil sem certificado', async () => {
  state.user = { id: 42, account_type: 'installer' };
  api.get.mockImplementation(async (url) => url === '/users/profile'
    ? { data: { ...owner, certification_verified: false } }
    : { data: { installer: { ...installer, certificate_verified: false } } });
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', Object.assign(Object.create(window.navigator), { clipboard: { writeText } }));
  openOwner();
  const section = within(await screen.findByRole('region', { name: 'Link para clientes' }));
  expect(section.getByText(/cliente preenche o pedido sem criar conta/i)).toBeTruthy();
  expect(section.getByText(/chega só para você/i)).toBeTruthy();
  const copy = await section.findByRole('button', { name: 'Copiar link para clientes' });
  expect(screen.getAllByRole('button', { name: /copiar link/i })).toHaveLength(1);
  fireEvent.click(copy);
  expect((await section.findByRole('status')).textContent).toContain('Link copiado');
  expect(writeText).toHaveBeenCalledWith('https://instalarpro.com.br/installers/42?orcamento=1');
});

it('explica por que o link não está disponível quando o perfil é oculto', async () => {
  state.user = { id: 42, account_type: 'installer' };
  api.get.mockImplementation(async (url) => url === '/users/profile'
    ? { data: { ...owner, public_profile: false, certification_verified: false } }
    : { data: { installer: { ...installer, accepts_direct_requests: false } } });
  openOwner();
  const section = within(await screen.findByRole('region', { name: 'Link para clientes' }));
  expect(section.getByText(/perfil público.*análise/i)).toBeTruthy();
  expect(section.queryByRole('button', { name: /copiar link/i })).toBeNull();
  expect(section.getByText(/não precisa de certificado/i)).toBeTruthy();
  expect(section.getByRole('link', { name: 'Pedir liberação pelo suporte' }).getAttribute('href')).toBe('/support');
});

it('abre a seção de compartilhamento direto pelo atalho em Oportunidades', async () => {
  state.user = { id: 42, account_type: 'installer' };
  render(<MemoryRouter initialEntries={['/opportunities']}><Routes>
    <Route path="/opportunities" element={<Opportunities />} />
    <Route path="/profile" element={<Profile />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: 'Link para clientes' }));
  await screen.findByRole('button', { name: 'Copiar link para clientes' });
  expect(document.activeElement.textContent).toBe('Link para clientes');
});

it('oferece cópia manual quando o navegador não autoriza a área de transferência', async () => {
  state.user = { id: 42, account_type: 'installer' };
  vi.stubGlobal('navigator', Object.assign(Object.create(window.navigator), { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } }));
  openOwner();
  fireEvent.click(await screen.findByRole('button', { name: 'Copiar link para clientes' }));
  expect((await screen.findByRole('textbox', { name: 'Link para copiar manualmente' })).value).toBe('https://instalarpro.com.br/installers/42?orcamento=1');
});

it('visitante envia só para o instalador do perfil e recebe o link privado de acompanhamento', async () => {
  openProfile('/installers/42?orcamento=1');
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir orçamento a este instalador' }));
  const send = screen.getByRole('button', { name: 'Enviar pedido ao instalador' });
  expect(send.disabled).toBe(true);
  const entries = [
    ['Seu nome', 'Cliente visitante'], ['WhatsApp com DDD', '(48) 99999-0001'],
    ['Cidade da instalação', 'Curitiba'], ['Estado', 'PR'], ['O que você precisa?', 'Papel de parede na sala'],
  ];
  for (const [field, value] of entries) fireEvent.change(screen.getByLabelText(field), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar verificação QA' }));
  expect(send.disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(send);
  const tracking = await screen.findByRole('link', { name: 'Acompanhar pedido' });
  expect(tracking.getAttribute('href')).toBe('/cliente/pedido#pedido=32&acesso=' + accessCode);
  expect(api.post).toHaveBeenCalledWith('/public/installers/42/direct-requests', {
    client_name: 'Cliente visitante', client_phone: '(48) 99999-0001', city: 'Curitiba', state: 'PR',
    details: 'Papel de parede na sala', privacy_consent: true, turnstile_token: 'qa-challenge',
  });
});

it('aceita o pedido direto no painel e abre o rascunho sem abrir WhatsApp', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  render(<MemoryRouter initialEntries={['/opportunities']}><Routes>
    <Route path="/opportunities" element={<Opportunities />} />
    <Route path="/budgets/18/complete" element={<h1>Rascunho do pedido direto</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Aceitar e montar orçamento' }));
  expect(await screen.findByRole('heading', { name: 'Rascunho do pedido direto' })).toBeTruthy();
  expect(api.post).toHaveBeenCalledWith('/opportunities/32/accept-direct');
  expect(open).not.toHaveBeenCalled();
});

it('abre as oportunidades a partir do aviso de pedido direto', async () => {
  api.get.mockResolvedValueOnce({ data: [{ id: 12, title: 'Pedido direto recebido', message: 'Você recebeu o pedido #32.', type: 'info', read: false, action_path: '/opportunities' }] });
  render(<MemoryRouter><Notifications /></MemoryRouter>);
  const link = await screen.findByRole('link', { name: 'Ver pedido' });
  expect(link.getAttribute('href')).toBe('/opportunities?pedido=32');
});

it('abre primeiro o pedido indicado pelo aviso, sem depender da página atual da lista', async () => {
  render(<MemoryRouter initialEntries={['/opportunities?pedido=32']}><Opportunities /></MemoryRouter>);
  const detail = await screen.findByRole('complementary', { name: 'Detalhes do pedido' });
  expect(detail.textContent).toContain('Pedido direto #32');
  expect(api.get).toHaveBeenCalledWith('/opportunities', expect.objectContaining({
    params: expect.objectContaining({ status: 'all', request_id: '32' }),
  }));
  expect(document.querySelector('[data-detail-open]').getAttribute('data-detail-open')).toBe('true');
});

it('permite tentar o antirrobô novamente sem apagar os dados preenchidos', async () => {
  openProfile('/installers/42?orcamento=1');
  fireEvent.click(await screen.findByRole('button', { name: 'Pedir orçamento a este instalador' }));
  const form = within(screen.getByRole('region', { name: 'Pedir orçamento a este instalador' }));
  fireEvent.change(form.getByLabelText('Seu nome'), { target: { value: 'Cliente visitante' } });
  fireEvent.click(form.getByRole('button', { name: 'Simular falha na verificação' }));
  expect(form.getByRole('alert').textContent).toContain('verificação');
  fireEvent.click(form.getByRole('button', { name: 'Tentar verificação novamente' }));
  expect(form.queryByRole('alert')).toBeNull();
  expect(form.getByLabelText('Seu nome').value).toBe('Cliente visitante');
});
