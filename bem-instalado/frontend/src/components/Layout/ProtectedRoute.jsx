import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasAdminAccess } from '../../utils/adminAccess';

function getAccountType(user) {
  return user?.account_type === 'client' ? 'client' : 'installer';
}

function getHomePath(user) {
  return getAccountType(user) === 'client' ? '/cliente' : '/dashboard';
}

export default function ProtectedRoute({ allowedAccountTypes = ['installer'], loginPath = '/instalador/entrar' }) {
  const location = useLocation();
  const { user, loading, authError, retryProfile, logout } = useAuth();

  if (loading) {
    return (
      <div className="auth-scene flex min-h-screen items-center justify-center px-6">
        <div className="lux-panel fade-up max-w-lg p-8 text-center">
          <p className="eyebrow">InstalaPro</p>
          <h1 className="page-title mt-4 text-[3rem]">Abrindo seu acesso</h1>
          <p className="page-copy mt-4">
            Estamos validando sua conta antes de liberar a próxima tela.
          </p>
        </div>
      </div>
    );
  }

  if (!user && authError) {
    return (
      <main className="auth-scene flex min-h-screen items-center justify-center px-6 py-10">
        <section className="lux-panel w-full max-w-lg p-8 text-center" role="alert">
          <p className="eyebrow">Conexão temporariamente indisponível</p>
          <h1 className="page-title mt-4 text-[2.6rem]">Seu login continua salvo</h1>
          <p className="page-copy mt-4">{authError}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button className="gold-button" onClick={retryProfile} type="button">
              Tentar novamente
            </button>
            <button className="ghost-button" onClick={logout} type="button">
              Sair da conta
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to={loginPath} />;
  }

  const adminCanUseInstallerArea = hasAdminAccess(user) && allowedAccountTypes.includes('installer');

  if (allowedAccountTypes.length > 0 && !allowedAccountTypes.includes(getAccountType(user)) && !adminCanUseInstallerArea) {
    return <Navigate replace to={getHomePath(user)} />;
  }

  return <Outlet />;
}
