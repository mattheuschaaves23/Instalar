import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const fixtures = vi.hoisted(() => ({ subscription: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn(), user: { name: 'Conta fictícia', account_type: 'installer' } }) }));
vi.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: () => fixtures.subscription }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('./panelBadgeCounts', () => ({ formatPanelBadgeCount: String, getPanelBadgeValue: () => null, usePanelBadgeCounts: () => ({}), notifyPanelBadgeCountsChanged: vi.fn() }));
vi.mock('../Subscription/PlanUsage', () => ({ default: () => null }));

import { SidebarContent } from './InstallerPanelShell';
import Clients from '../Clients/Clients';
import Agenda from '../Agenda/Agenda';
import BudgetForm from '../Budgets/BudgetForm';

beforeEach(() => {
  fixtures.subscription = { isPro: false, loading: false, subscription: { plan: 'free' }, planAccess: { limits: {} }, refreshSubscription: vi.fn(async () => null) };
});
const render = (element) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

it('centro do gráfico usa superfície legível no tema claro', () => {
  const root = postcss.parse(readFileSync(new URL('../../index.css', import.meta.url), 'utf8'));
  const backgrounds = [];
  root.walkRules('.dashboard-neo-donut-hole', rule => {
    if (rule.parent.type === 'root') rule.walkDecls('background', decl => backgrounds.push(decl.value));
  });
  expect(backgrounds.at(-1)).toBe('var(--surface, #ffffff)');
});

describe('rótulo do plano no menu', () => {
  it.each([[false, 'Instalador Grátis'], [true, 'Instalador Pro']])('usa acesso real quando Pro=%s', (isPro, label) => {
    fixtures.subscription.isPro = isPro;
    const markup = render(<SidebarContent initials="CF" userName="Conta fictícia" />);
    expect(markup).toContain(`<small>${label}</small>`);
  });
  it('não anuncia um plano antes da consulta inicial', () => {
    fixtures.subscription.loading = true; fixtures.subscription.subscription = null;
    expect(render(<SidebarContent initials="CF" userName="Conta fictícia" />)).toContain('<small>Consultando plano</small>');
  });
  it('nome acessível indica se o menu está recolhido', () => {
    expect(render(<SidebarContent allowCollapse collapsed initials="CF" userName="Conta fictícia" />)).toContain('aria-label="Expandir menu"');
  });
});

describe('carteira acessível em todas as larguras', () => {
  it('a regra padrão não esconde a única lista de clientes', () => {
    const root = postcss.parse(readFileSync(new URL('../../index.css', import.meta.url), 'utf8'));
    const values = [];
    root.walkRules((rule) => {
      if (rule.selector.split(',').map((value) => value.trim()).includes('.client-intake-mobile-list') && rule.parent.type === 'root') {
        rule.walkDecls('display', (decl) => values.push(decl.value));
      }
    });
    expect(values.at(-1)).toBe('grid');
    const markup = render(<Clients />);
    expect(markup).toContain('Clientes cadastrados');
    expect(markup).toContain('Nenhum cliente cadastrado');
    expect(markup).toContain('aria-label="Novo cliente"');
    expect(markup).toContain('aria-label="Voltar ao início"');
  });
});

it('controles da agenda e retorno do orçamento têm nomes acessíveis', () => {
  const agenda = render(<Agenda />);
  expect(agenda).toContain('aria-label="Mês anterior"');
  expect(agenda).toContain('aria-label="Próximo mês"');
  expect(render(<BudgetForm />)).toContain('aria-label="Voltar aos orçamentos"');
});

it('a prévia do PDF mantém texto claro sobre cabeçalho e rodapé escuros', () => {
  const css = postcss.parse(readFileSync(new URL('../../index.css', import.meta.url), 'utf8'));
  const colors = new Map();
  css.walkRules(rule => {
    for (const selector of rule.selector.split(',').map(value => value.trim())) {
      if (!selector.startsWith('.dashboard-reference-layout .pdf-branding-preview ')) continue;
      rule.walkDecls('color', decl => { if (decl.important) colors.set(selector, decl.value); });
    }
  });
  expect(colors.get('.dashboard-reference-layout .pdf-branding-preview header .pdf-branding-preview-brand strong')).toBe('var(--pdf-accent)');
  expect(colors.get('.dashboard-reference-layout .pdf-branding-preview header .pdf-branding-preview-brand small')).toBe('#f5f2ec');
  expect(colors.get('.dashboard-reference-layout .pdf-branding-preview footer span')).toBe('#f5f2ec');
});
