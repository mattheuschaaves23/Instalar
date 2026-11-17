import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DecoratingWallLoader from './DecoratingWallLoader';

describe('espera discreta pelo conteúdo', () => {
  it('renderiza imediatamente sem animação, porcentagem inventada ou tela cheia', () => {
    const markup = renderToStaticMarkup(<DecoratingWallLoader />);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('loading-placeholder-lines');
    expect(markup).not.toMatch(/wall-loader|<svg|<main|%|transformação/i);
  });

  it('preserva a mensagem acessível e o modo embutido das páginas', () => {
    const markup = renderToStaticMarkup(<DecoratingWallLoader embedded phrase="Carregando mensagens" />);
    expect(markup).toContain('aria-label="Carregando mensagens"');
    expect(markup).toContain('loading-placeholder--embedded');
  });
});
