import { describe, expect, it, vi } from 'vitest';
import { canPrefetch, getInternalLinkPath, getRouteModules, preloadableImport } from './routeModules';

describe('carregamento antecipado de páginas', () => {
  it('compartilha o download entre intenção, clique e revisita', async () => {
    const module = { default: () => null };
    const importer = vi.fn(async () => module);
    const load = preloadableImport(importer);
    const first = load();
    expect(load()).toBe(first);
    expect(await first).toBe(module);
    expect(await load()).toBe(module);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('permite nova tentativa após falha no prefetch', async () => {
    const module = { default: () => null };
    const importer = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(module);
    const load = preloadableImport(importer);
    await expect(load()).rejects.toThrow('offline');
    expect(await load()).toBe(module);
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it('começa shell e página do painel juntos, sem substituir orçamento novo pela lista', () => {
    expect(getRouteModules('/budgets/new?copy=1')).toEqual(['Layout', 'BudgetForm']);
    expect(getRouteModules('/agenda')).toEqual(['Layout', 'Agenda']);
    expect(getRouteModules('/cliente/pedidos')).toEqual(['Home']);
    expect(getRouteModules('/instalador/entrar')).toEqual(['Login']);
    expect(getRouteModules('/installers/123')).toEqual(['InstallerProfile']);
  });

  it('não antecipa rotas desconhecidas nem endpoints de API', () => {
    expect(getRouteModules('/api/operations/run')).toEqual([]);
    expect(getRouteModules('/unknown')).toEqual([]);
    expect(getRouteModules('/profile/unknown')).toEqual([]);
  });

  it('ignora links externos, mailto e âncoras', () => {
    const origin = 'https://instalar-sigma.vercel.app';
    expect(getInternalLinkPath('/agenda?view=month', origin)).toBe('/agenda');
    expect(getInternalLinkPath(`${origin}/clients`, origin)).toBe('/clients');
    expect(getInternalLinkPath('https://other.test/clients', origin)).toBeNull();
    expect(getInternalLinkPath('mailto:someone@example.test', origin)).toBeNull();
    expect(getInternalLinkPath('/#lojas', origin)).toBeNull();
  });

  it('respeita economia de dados e conexão lenta', () => {
    expect(canPrefetch({ saveData: true, effectiveType: '4g' })).toBe(false);
    expect(canPrefetch({ effectiveType: '2g' })).toBe(false);
    expect(canPrefetch({ effectiveType: 'slow-2g' })).toBe(false);
    expect(canPrefetch({ effectiveType: '4g' })).toBe(true);
    expect(canPrefetch()).toBe(true);
  });
});
