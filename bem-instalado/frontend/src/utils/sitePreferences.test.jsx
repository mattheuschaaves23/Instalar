// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SITE_PREFERENCES,
  applySitePreferences,
  normalizeSitePreferences,
} from './sitePreferences';

describe('preferências visuais', () => {
  it('migra preferências antigas para o fundo branco principal', () => {
    expect(normalizeSitePreferences({ accentColor: '#e2b42d' })).toMatchObject({
      theme: 'light',
      accentColor: '#c48400',
      density: 'comfortable',
      motion: 'smooth',
    });
  });

  it('preserva o fundo preto quando ele foi escolhido na versão atual', () => {
    expect(
      normalizeSitePreferences({
        ...DEFAULT_SITE_PREFERENCES,
        theme: 'dark',
      })
    ).toMatchObject({
      theme: 'dark',
      accentColor: '#c48400',
    });
  });

  it('aplica azul no tema Preto e restaura a cor original ao voltar ao Branco', () => {
    const root = document.documentElement;
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    try {
      applySitePreferences({ theme: 'dark', themeVersion: 2, accentColor: '#c48400', density: 'compact' });
      expect(root.dataset.siteTheme).toBe('dark');
      expect(root.dataset.siteDensity).toBe('compact');
      expect(root.style.getPropertyValue('--site-accent')).toBe('#75b4ff');
      expect(root.style.getPropertyValue('--gold-strong')).toBe('#a4ceff');
      expect(meta.content).toBe('#0b0d10');
      applySitePreferences({ theme: 'light', themeVersion: 2 });
      expect(root.dataset.siteTheme).toBe('light');
      expect(root.style.getPropertyValue('--site-accent')).toBe('#c48400');
      expect(meta.content).toBe('#e3e1dc');
    } finally {
      root.removeAttribute('style');
      meta.remove();
    }
  });

  it('descarta uma cor antiga salva e mantém o padrão visual do produto', () => {
    expect(
      normalizeSitePreferences({
        accentColor: '#8b5cf6',
        accentVersion: 3,
        theme: 'light',
        themeVersion: 2,
      })
    ).toMatchObject({
      accentColor: '#c48400',
      theme: 'light',
    });
  });

  it('descarta valores de tema inválidos', () => {
    expect(normalizeSitePreferences({ theme: 'automatic' }).theme).toBe('light');
  });
});
