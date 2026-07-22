import { Component } from 'react';

function isChunkError(error) {
  const message = String(error?.message || error || '').toLowerCase();

  return (
    error?.name === 'ChunkLoadError' ||
    message.includes('loading chunk') ||
    message.includes('failed to fetch dynamically imported module')
  );
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
    if (process.env.NODE_ENV !== 'production') {
      console.error('Erro de renderização capturado pelo AppErrorBoundary:', error, errorInfo);
    }

    if (typeof window !== 'undefined') {
      fetch('/api/public/client-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: String(error?.message || error || 'Erro de renderização'),
          stack: String(error?.stack || ''),
          component_stack: String(errorInfo?.componentStack || ''),
          browser: window.navigator?.userAgent || '',
          release: process.env.REACT_APP_RELEASE || '',
        }),
      }).catch(() => null);
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
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

    return (
      <main className="auth-scene flex min-h-screen items-center justify-center px-6 py-10">
        <section className="lux-panel w-full max-w-md p-7 text-center">
          <p className="eyebrow">{chunkError ? 'Atualização necessária' : 'Falha temporária'}</p>
          <h1 className="page-title mt-3 text-[2rem]">
            {chunkError ? 'Atualize a página' : 'Não foi possível abrir esta tela'}
          </h1>
          <p className="page-copy mt-3">
            {chunkError
              ? 'Uma nova versão do painel foi publicada e o navegador ainda está com arquivos antigos em cache.'
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
