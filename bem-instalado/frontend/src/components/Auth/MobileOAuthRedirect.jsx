import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import BrandWordmark from '../Layout/BrandWordmark';
import OAuthCallback from './OAuthCallback';
import { buildNativeOAuthFallbackUrl } from '../../utils/nativeOAuth';

const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';

export default function MobileOAuthRedirect() {
  const appUrl = useMemo(
    () => buildNativeOAuthFallbackUrl(window.location.href),
    []
  );

  useEffect(() => {
    if (IS_INSTALLER_APP || !appUrl) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      window.location.assign(appUrl);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [appUrl]);

  if (IS_INSTALLER_APP) {
    return <OAuthCallback />;
  }

  return (
    <main className="mobile-oauth-return-page">
      <section className="mobile-oauth-return-card">
        <BrandWordmark className="mobile-oauth-return-logo" size="md" />
        <span className="mobile-oauth-return-pulse" aria-hidden="true" />
        <h1>Voltando para o aplicativo</h1>
        <p>Seu acesso foi confirmado. Abra o InstalarPro para continuar.</p>
        {appUrl ? (
          <a className="mobile-oauth-return-button" href={appUrl}>
            Abrir o aplicativo
          </a>
        ) : null}
        <Link to="/instalador/entrar">Voltar ao login</Link>
      </section>
    </main>
  );
}
