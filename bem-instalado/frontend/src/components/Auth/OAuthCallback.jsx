import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { getProfileRequest } from '../../services/auth';
import { clearAuthToken, getAuthSessionVersion, setAuthToken } from '../../utils/safeStorage';
import { isInvalidSession } from '../../utils/authSession';
import { isNativeStoreApp } from '../../utils/nativePlatform';
import { getOAuthErrorMessage } from '../../utils/oauthMessages';

const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';

function readCallbackParams() {
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const params = new URLSearchParams(rawHash || window.location.search);

  return {
    token: params.get('token') || '',
    next: params.get('next') || '/dashboard',
    oauthError: params.get('oauth_error') || '',
  };
}

function sanitizeNextPath(value) {
  const nextPath = String(value || '').trim();
  return nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard';
}

function getAccountHomePath(profile) {
  return profile?.account_type === 'client' ? '/cliente' : '/dashboard';
}

function resolveNextPath(next, profile) {
  const fallback = getAccountHomePath(profile);
  const nextPath = sanitizeNextPath(next);

  if (profile?.account_type === 'client') {
    return nextPath === '/cliente' || nextPath.startsWith('/installers/') ? nextPath : fallback;
  }

  return nextPath;
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function finishLogin() {
      const { token, next, oauthError } = readCallbackParams();

      if (oauthError) {
        setError(getOAuthErrorMessage(oauthError));
        return;
      }

      if (isNativeStoreApp() && !token) {
        setError('O login com o Google não retornou uma sessão. Volte e tente novamente.');
        return;
      }

      let version = getAuthSessionVersion();
      const isCurrent = () => isMounted && version === getAuthSessionVersion();
      try {
        if (token) {
          const saved = setAuthToken(token, true);
          version = getAuthSessionVersion();
          await saved;
        }
        if (!isCurrent()) return;
        const profile = await getProfileRequest();

        if (!isCurrent()) return;

        if (
          IS_INSTALLER_APP
          && profile?.account_type !== 'installer'
          && !profile?.is_admin
        ) {
          void clearAuthToken();
          setError('Este aplicativo aceita somente contas de instalador.');
          return;
        }

        setUser(profile);
        toast.success('Login realizado.');
        navigate(resolveNextPath(next, profile), { replace: true });
      } catch (error) {
        if (!isCurrent()) return;
        if (isInvalidSession(error)) void clearAuthToken();
        setError('Não foi possível concluir o login social.');
      }
    }

    finishLogin();

    return () => {
      isMounted = false;
    };
  }, [navigate, setUser]);

  return (
    <main className="oauth-callback-page">
      <section className="oauth-callback-card">
        <h1>{error ? 'Falha no acesso' : 'Concluindo acesso...'}</h1>
        <p>
          {error || 'Estamos validando sua conta e preparando o redirecionamento.'}
        </p>
        {error ? (
          <Link to="/instalador/entrar">Voltar para o login</Link>
        ) : null}
      </section>
    </main>
  );
}
