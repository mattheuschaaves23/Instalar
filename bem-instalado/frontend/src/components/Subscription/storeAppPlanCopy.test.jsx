// App das lojas (Google Play e App Store): nenhuma tela diz para assinar, pagar ou
// ativar o Pro, nem mostra preco ou forma de pagamento. A compra so existe no site,
// e as politicas de pagamento das duas lojas proibem levar o usuario a pagar fora.
// O site continua com o botao de pagamento e o preco.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';

const fixtures = vi.hoisted(() => ({ storeApp: true, subscription: {} }));

vi.mock('../../utils/nativePlatform', () => ({
  isNativeStoreApp: () => fixtures.storeApp,
  isIosInstallerApp: () => false,
  getNativeStorePlatform: () => (fixtures.storeApp ? 'android' : 'web'),
}));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: () => fixtures.subscription }));
vi.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => vi.fn() }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ loading: false, login: vi.fn(), logout: vi.fn(), register: vi.fn(), user: null }),
}));
vi.mock('../../hooks/useAuthCapabilities', () => ({ default: () => ({ oauth: { google: false } }) }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../Security/Turnstile', () => ({ default: () => null, isTurnstileEnabled: () => false }));

import Subscription from './Subscription';
import PlanUsage, { ProFeatureNotice } from './PlanUsage';
import PdfBranding from '../PdfBranding/PdfBranding';
import Register from '../Auth/Register';
import Login from '../Auth/Login';
import { OpportunityDetail } from '../Opportunities/Opportunities';

// Frases que mandam assinar/pagar ou mostram o preco do Pro e o meio de pagamento.
// (R$ 0 do plano Gratis e os valores ficticios da previa do PDF nao contam.)
const STEERING = /(assine|assinar|pelo site|ative o|ativar o pro|evolua para o pro|conhecer o pro|ver plano pro|49[,.]9|\/m[eê]s|\bpix\b|cart[aã]o|asaas|pagamento protegido|ativação automática|continuar pagamento|recomendado)/i;

const freeSubscription = () => ({
  isPro: false,
  loading: false,
  subscription: { plan: 'free', access_mode: 'free', payment_mode: 'asaas', pricing: { amount: 49.9, period: 'mês' } },
  planAccess: { limits: { clients: 15, monthly_interests: 5 }, usage: { clients: 15, monthly_interests: 5 } },
  refreshSubscription: vi.fn(async () => null),
});

const limitEligibility = {
  can_express_interest: false,
  requirement_code: 'FREE_INTEREST_LIMIT',
  message: 'Você usou os 5 interesses deste mês. No Pro, os interesses são ilimitados.',
};
const opportunity = { id: 7, status: 'open', client_name: 'Cliente ficticio', photo_urls: [] };

const screens = {
  'tela de plano': () => <Subscription />,
  'uso do plano': () => <PlanUsage usageKey="clients" />,
  'aviso de recurso Pro': () => <ProFeatureNotice>Recurso avançado.</ProFeatureNotice>,
  'marca do PDF': () => <PdfBranding />,
  cadastro: () => <Register />,
  login: () => <Login />,
  'pedido no limite de interesses': () => (
    <OpportunityDetail eligibility={limitEligibility} item={opportunity} onClose={vi.fn()} onInterest={vi.fn()} onUpdated={vi.fn()} sending={false} />
  ),
};

const render = (Screen) => renderToStaticMarkup(<MemoryRouter><Screen /></MemoryRouter>);
const visibleText = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

beforeEach(() => {
  fixtures.subscription = freeSubscription();
});

describe('app das lojas nao direciona para pagamento fora da loja', () => {
  it.each(Object.entries(screens))('%s: sem instrucao de assinar, preco ou meio de pagamento', (_name, Screen) => {
    fixtures.storeApp = true;
    const text = visibleText(render(Screen));
    expect(text).not.toMatch(STEERING);
  });

  it('tela de plano mostra o plano atual e o uso, sem o texto Assine pelo site', () => {
    fixtures.storeApp = true;
    const text = visibleText(render(() => <Subscription />));
    expect(text).not.toContain('Assine pelo site');
    expect(text).toContain('Seu plano agora');
    expect(text).toContain('Grátis');
    expect(text).toContain('Clientes ativos');
    expect(text).not.toContain('49,90');
  });

  it('links internos para a tela de plano viram Ver meu plano', () => {
    fixtures.storeApp = true;
    const markup = render(() => <PlanUsage usageKey="clients" />);
    expect(markup).toContain('href="/subscription"');
    expect(visibleText(markup)).toContain('Ver meu plano');
  });
});

describe('site continua vendendo o Pro', () => {
  it('tela de plano no navegador mostra preco e botao de pagamento', () => {
    fixtures.storeApp = false;
    const text = visibleText(render(() => <Subscription />));
    expect(text).toMatch(/R\$\s?49,90/);
    expect(text).toContain('Ativar o Pro');
    expect(text).toContain('Pix mensal');
  });

  it('cadastro e uso do plano no navegador mantem o convite ao Pro', () => {
    fixtures.storeApp = false;
    expect(visibleText(render(() => <Register />))).toContain('assine o Pro por R$ 49.90/mês');
    expect(visibleText(render(() => <PlanUsage usageKey="clients" />))).toContain('Conhecer o Pro');
  });
});

describe('prévia da nova assinatura', () => {
  beforeEach(() => {
    fixtures.storeApp = false;
    fixtures.subscription.subscription.offer_preview = {
      checkout_available: false,
      trial_days: 7,
      annual_discount_percent: 10,
      options: { monthly: { amount: 49.9 }, yearly: { amount: 538.92, savings: 59.88 } },
    };
  });

  it('mostra as duas opções e quando cobra, sem oferecer o Grátis permanente ou usar o checkout anterior', () => {
    const text = visibleText(render(() => <Subscription />));
    expect(text).toContain('7 dias grátis');
    expect(text).toContain('validar um cartão de crédito');
    expect(text).toContain('A primeira cobrança só acontece depois');
    expect(text).toMatch(/R\$\s?49,90 por mês/);
    expect(text).toMatch(/R\$\s?538,92 por ano/);
    expect(text).toContain('10% de desconto');
    expect(text).toContain('ainda não está disponível');
    expect(text).toContain('Quem já está no Grátis');
    expect(text).not.toMatch(/para sempre|Ativar o Pro|Pix mensal/);
  });

  it('não migra a assinatura Pro atual e preserva a opção de gerenciamento', () => {
    fixtures.subscription.isPro = true;
    fixtures.subscription.subscription.access_mode = 'pro';
    const text = visibleText(render(() => <Subscription />));
    expect(text).toContain('Pro ativo');
    expect(text).toContain('Sua assinatura continua como está');
    expect(text).toContain('Cancelar assinatura');
  });

  it('não mostra os novos valores nem CTA nos apps da loja', () => {
    fixtures.storeApp = true;
    const text = visibleText(render(() => <Subscription />));
    expect(text).not.toMatch(/538,92|7 dias grátis|Novos planos em preparação/);
    expect(text).not.toMatch(STEERING);
  });

  it('oferece escolha e consentimento apenas quando a API libera o Sandbox', () => {
    const form = () => render(() => <Subscription />);
    expect(form()).not.toContain('Preparar checkout de teste');
    fixtures.subscription.subscription.offer_preview.checkout_available = true;
    expect(form()).toContain('Preparar checkout de teste');
    expect(form()).toContain('não devo usar um cartão real');
    expect(form()).not.toMatch(/(https:\/\/asaas\.com|Continuar pagamento)/);
  });
});
