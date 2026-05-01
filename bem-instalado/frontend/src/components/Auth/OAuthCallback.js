import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { getProfileRequest } from '../../services/auth';

function readCallbackParams() {
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const params = new URLSearchParams(rawHash || window.location.search);

  return {
    token: params.get('token') || '',
    next: params.get('next') || '/dashboard',
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

  return nextPath.startsWith('/cliente') || nextPath.startsWith('/installers/') ? fallback : nextPath;
}

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function finishLogin() {
      const { token, next } = readCallbackParams();

      if (!token) {
        setError('Token de acesso ausente.');
        return;
      }

      try {
        localStorage.setItem('token', token);
        const profile = await getProfileRequest();

        if (!isMounted) {
          return;
        }

        setUser(profile);
        toast.success('Login realizado.');
        navigate(resolveNextPath(next, profile), { replace: true });
      } catch (_error) {
        localStorage.removeItem('token');

        if (isMounted) {
          setError('Nao foi possivel concluir o login social.');
        }
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
