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
const render = (element, path = '/') => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);

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
  it('mantém o menu completo e as mesmas seções ao entrar em Notificações', () => {
    const sidebar = <SidebarContent initials="CF" userName="Conta fictícia" />;
    const markup = render(sidebar, '/notifications');
    const menuStructure = (html) => html.match(/(?:<p>[^<]+<\/p>|href="\/(?!brand\/)[^"]+")/g);
    expect(menuStructure(markup)).toEqual(menuStructure(render(sidebar, '/budgets')));
    expect(markup).toContain('ref-panel-nav-link is-active');
    expect(markup).toContain('alt="Logo InstalarPro"');
    expect(markup).toContain('Avaliações');
    expect(markup).toContain('Suporte');
    expect(markup).not.toContain('Mais opções');
  });
});

describe('carteira acessível em todas as larguras', () => {
  it('mantém uma tabela e o cadastro acessíveis enquanto carrega', () => {
    const root = postcss.parse(readFileSync(new URL('../Clients/Clients.css', import.meta.url), 'utf8'));
    const hiddenTables = [];
    root.walkRules((rule) => {
      if (rule.selector.split(',').map((value) => value.trim()).includes('.clients-directory-table')) {
        rule.walkDecls('display', (decl) => {
          if (decl.value === 'none') hiddenTables.push(rule.selector);
        });
      }
    });
    expect(hiddenTables).toEqual([]);
    const markup = render(<Clients />);
    expect(markup).toContain('aria-label="Clientes cadastrados"');
    expect(markup).toContain('aria-label="Buscar clientes"');
    expect(markup).toContain('Carregando clientes');
    expect(markup).toContain('Novo cliente');
  });
});

it('controles da agenda e retorno do orçamento têm nomes acessíveis', () => {
  const agenda = render(<Agenda />);
  expect(agenda).toContain('aria-label="Mês anterior"');
  expect(agenda).toContain('aria-label="Próximo mês"');
  expect(render(<BudgetForm />)).toContain('aria-label="Voltar aos orçamentos"');
});

it('a prévia do PDF preserva papel branco e o contraste do modelo Clássico', () => {
  const css = postcss.parse(readFileSync(new URL('../PdfBranding/PdfBranding.css', import.meta.url), 'utf8'));
  const backgrounds = new Map();
  css.walkRules(rule => {
    rule.walkDecls('background', decl => backgrounds.set(rule.selector, decl.value));
  });
  expect(backgrounds.get('.quote-studio .quote-paper')).toBe('#fff');
  expect(backgrounds.get(".quote-paper[data-template='classic'] .quote-paper-head")).toBe('var(--paper-ink)');
});
