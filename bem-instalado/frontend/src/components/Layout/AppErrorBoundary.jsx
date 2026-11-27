import { Component } from 'react';
import { Link } from 'react-router';
import api from '../../services/api';
import { captureFrontendException } from '../../services/sentry';
import { getRouteModules } from '../../utils/routeModules';

function isChunkError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return (
    error?.name === 'ChunkLoadError' ||
    message.includes('loading chunk') ||
    message.includes('dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('unable to preload css')
  );
}

function diagnosticText(value, limit) {
  return String(value || '')
    .replace(/\bhttps?:\/\/[^\s"'<>)]*/gi, '[url]')
    .replace(/([?&#])[^\s"'<>)]*/g, '$1[removido]')
    .replace(/\b(?:bearer|basic)\s+[^\s,;]+/gi, '[credencial]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .slice(0, limit);
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    const context = this.props.embedded ? 'react.page-error-boundary' : 'react.error-boundary';
    captureFrontendException(error, { source: context, stack: errorInfo?.componentStack || '' });
    if (process.env.NODE_ENV !== 'production') {
      console.error('Erro de renderização capturado pelo AppErrorBoundary:', error, errorInfo);
    }

    if (typeof window !== 'undefined') {
      const apiBase = String(api.defaults?.baseURL || '/api').replace(/\/+$/, '');
      const view = getRouteModules(window.location.pathname).at(-1) || 'App';
      fetch(`${apiBase}/public/client-errors`, {
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: diagnosticText(error?.message || error || 'Erro de renderização', 1200),
          stack: diagnosticText(error?.stack, 4000),
          component_stack: diagnosticText(errorInfo?.componentStack, 1200),
          browser: window.navigator?.userAgent || '',
          release: process.env.REACT_APP_RELEASE || '',
          view,
        }),
      }).catch(() => null);
    }
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && this.props.navigationKey !== previousProps.navigationKey) {
      this.setState({ error: null });
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handlePageRetry = () => {
    if (isChunkError(this.state.error)) {
      // React.lazy remembers a rejected import; a remount cannot retry it.
      this.handleReload();
      return;
    }
    this.setState({ error: null });
  };

  handleHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const chunkError = isChunkError(this.state.error);

    if (this.props.embedded) {
      return (
        <section className="lux-panel w-full p-5 sm:p-7">
          <h2 className="page-title">Esta área não abriu</h2>
          <p className="page-copy mt-3" role="alert">
            {chunkError
              ? 'Não foi possível carregar os arquivos desta tela. Recarregue a página ou acesse outra área pelo menu.'
              : 'Não foi possível carregar o conteúdo. Tente abrir esta área novamente ou continue em outra parte do painel.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="gold-button" type="button" onClick={this.handlePageRetry}>
              {chunkError ? 'Recarregar página' : 'Tentar de novo'}
            </button>
            <Link className="ghost-button" to="/dashboard">Ir para o painel</Link>
          </div>
        </section>
      );
    }

    return (
      <main className="auth-scene flex min-h-screen items-center justify-center px-6 py-10">
        <section className="lux-panel w-full max-w-md p-7 text-center">
          <p className="eyebrow">{chunkError ? 'Atualização necessária' : 'Falha temporária'}</p>
          <h1 className="page-title mt-3 text-[2rem]">
            {chunkError ? 'Atualize a página' : 'Não foi possível abrir esta tela'}
          </h1>
          <p className="page-copy mt-3">
            {chunkError
              ? 'Alguns arquivos da tela não carregaram. Confira sua conexão ou recarregue a página para tentar novamente.'
              : 'A tela encontrou um erro inesperado. Você pode recarregar sem perder a sessão.'}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button className="gold-button" type="button" onClick={this.handleReload}>
              Recarregar
            </button>
            <button className="ghost-button" type="button" onClick={this.handleHome}>
              Ir para o início
            </button>
          </div>
        </section>
      </main>
    );
  }
}
