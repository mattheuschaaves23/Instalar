import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function getAccountType(user) {
  return user?.account_type === 'client' ? 'client' : 'installer';
}

function getHomePath(user) {
  return getAccountType(user) === 'client' ? '/cliente' : '/dashboard';
}

export default function ProtectedRoute({ allowedAccountTypes = ['installer'], loginPath = '/instalador/entrar' }) {
  const location = useLocation();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-scene flex min-h-screen items-center justify-center px-6">
        <div className="lux-panel fade-up max-w-lg p-8 text-center">
          <p className="eyebrow">InstaLar</p>
          <h1 className="page-title mt-4 text-[3rem]">Abrindo seu acesso</h1>
          <p className="page-copy mt-4">
            Estamos validando sua conta antes de liberar a proxima tela.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to={loginPath} />;
  }

  if (allowedAccountTypes.length > 0 && !allowedAccountTypes.includes(getAccountType(user))) {
    return <Navigate replace to={getHomePath(user)} />;
  }

  return <Outlet />;
}
