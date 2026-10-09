import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import NativeOAuthBridge from './components/Auth/NativeOAuthBridge';
import DecoratingWallLoader from './components/Layout/DecoratingWallLoader';
import ClientLanding from './components/Public/ClientLanding';
import { useAuth } from './contexts/AuthContext';
import AdminRoute from './components/Layout/AdminRoute';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import RoutePrefetch from './components/Layout/RoutePrefetch';
import { routeModules } from './utils/routeModules';

const IS_INSTALLER_APP = process.env.REACT_APP_INSTALLER_APP === 'true';
const INSTALLER_APP_PATHS = [
  '/instalador',
  '/auth/social/callback',
  '/auth/mobile/callback',
  '/dashboard',
  '/opportunities',
  '/clients',
  '/budgets',
  '/agenda',
  '/reviews',
  '/notifications',
  '/profile',
  '/pdf-profissional',
  '/settings',
  '/excluir-conta',
  '/subscription',
  '/support',
];

const ClientLogin = lazy(routeModules.ClientLogin);
const InstallerOnboarding = lazy(routeModules.InstallerOnboarding);
const Login = lazy(routeModules.Login);
const MobileOAuthRedirect = lazy(routeModules.MobileOAuthRedirect);
const OAuthCallback = lazy(routeModules.OAuthCallback);
const PasswordRecovery = lazy(routeModules.PasswordRecovery);
const Register = lazy(routeModules.Register);
const AdminDashboard = lazy(routeModules.AdminDashboard);
const Agenda = lazy(routeModules.Agenda);
const Budgets = lazy(routeModules.Budgets);
const BudgetForm = lazy(routeModules.BudgetForm);
const Clients = lazy(routeModules.Clients);
const Dashboard = lazy(routeModules.Dashboard);
const Layout = lazy(routeModules.Layout);
const Notifications = lazy(routeModules.Notifications);
const Opportunities = lazy(routeModules.Opportunities);
const Profile = lazy(routeModules.Profile);
const PdfBranding = lazy(routeModules.PdfBranding);
const Home = lazy(routeModules.Home);
const InstallerProfile = lazy(routeModules.InstallerProfile);
const LegalPage = lazy(routeModules.LegalPage);
const AccountDeletionPage = lazy(routeModules.AccountDeletionPage);
const ReviewsDashboard = lazy(routeModules.ReviewsDashboard);
const Settings = lazy(routeModules.Settings);
const SupportChat = lazy(routeModules.SupportChat);
const Subscription = lazy(routeModules.Subscription);
const AppDownload = lazy(routeModules.AppDownload);
const EmailVerification = lazy(routeModules.EmailVerification);

function RouteLoading() {
  return (
    <DecoratingWallLoader phrase="Preparando o próximo ambiente da sua experiência." />
  );
}

function InstallerAppGuard({ children }) {
  const location = useLocation();
  const { loading, user } = useAuth();

  if (!IS_INSTALLER_APP) {
    return children;
  }

  const isInstallerPath = INSTALLER_APP_PATHS.some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  if (isInstallerPath) {
    return children;
  }

  if (loading) {
    return <RouteLoading />;
  }

  const target = user?.account_type === 'installer' || user?.is_admin
    ? '/dashboard'
    : '/instalador/boas-vindas';
  return <Navigate replace to={target} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <RoutePrefetch />
      <NativeOAuthBridge />
      <InstallerAppGuard>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
          <Route element={<ClientLanding />} path="/" />
          <Route element={<ClientLogin />} path="/cliente/entrar" />
          <Route element={<ClientLogin />} path="/login" />
          <Route element={<InstallerOnboarding />} path="/instalador/boas-vindas" />
          <Route element={<Login />} path="/instalador/entrar" />
          <Route element={<PasswordRecovery />} path="/instalador/recuperar-senha" />
          <Route element={<PasswordRecovery />} path="/cliente/recuperar-senha" />
          <Route element={<OAuthCallback />} path="/auth/social/callback" />
          <Route element={<EmailVerification />} path="/auth/confirmar-email" />
          <Route element={<MobileOAuthRedirect />} path="/auth/mobile/callback" />
          <Route element={<Navigate replace to="/" />} path="/register" />
          <Route element={<Register />} path="/instalador/cadastro" />
          <Route element={<Home />} path="/cliente" />
          <Route element={<Home />} path="/cliente/pedido" />
          <Route element={<Home />} path="/papelperto" />
          <Route element={<InstallerProfile />} path="/installers/:id" />
          <Route element={<LegalPage type="privacy" />} path="/privacidade" />
          <Route element={<LegalPage type="terms" />} path="/termos" />
          <Route element={<AccountDeletionPage />} path="/excluir-conta" />

          <Route element={<ProtectedRoute allowedAccountTypes={['client']} loginPath="/cliente/entrar" />}>
            <Route element={<Home />} path="/cliente/pedidos" />
          </Route>

          <Route element={<ProtectedRoute allowedAccountTypes={['installer']} loginPath="/instalador/entrar" />}>
            <Route element={<Layout />}>
              <Route element={<Profile />} path="/profile" />
              <Route element={<PdfBranding />} path="/pdf-profissional" />
              <Route element={<Settings />} path="/settings" />
              <Route element={<Subscription />} path="/subscription" />
              <Route element={<AppDownload />} path="/download-app" />
              <Route element={<SupportChat />} path="/support" />
              <Route element={<AdminRoute />}>
                <Route element={<AdminDashboard />} path="/admin" />
              </Route>

              <Route element={<Dashboard />} path="/dashboard" />
              <Route element={<Opportunities />} path="/opportunities" />
              <Route element={<Clients />} path="/clients" />
              <Route element={<Clients />} path="/clients/new" />
              <Route element={<Budgets />} path="/budgets" />
              <Route element={<BudgetForm />} path="/budgets/new" />
              <Route element={<Agenda />} path="/agenda" />
              <Route element={<ReviewsDashboard />} path="/reviews" />
              <Route element={<Notifications />} path="/notifications" />
            </Route>
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </Suspense>
      </InstallerAppGuard>
    </BrowserRouter>
  );
}
