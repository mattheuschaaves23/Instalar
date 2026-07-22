import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ClientLanding from './components/Public/ClientLanding';

const ClientLogin = lazy(() => import('./components/Auth/ClientLogin'));
const Login = lazy(() => import('./components/Auth/Login'));
const OAuthCallback = lazy(() => import('./components/Auth/OAuthCallback'));
const PasswordRecovery = lazy(() => import('./components/Auth/PasswordRecovery'));
const Register = lazy(() => import('./components/Auth/Register'));
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'));
const Agenda = lazy(() => import('./components/Agenda/Agenda'));
const Budgets = lazy(() => import('./components/Budgets/Budgets'));
const BudgetForm = lazy(() => import('./components/Budgets/BudgetForm'));
const Clients = lazy(() => import('./components/Clients/Clients'));
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const AdminRoute = lazy(() => import('./components/Layout/AdminRoute'));
const Layout = lazy(() => import('./components/Layout/Layout'));
const ProtectedRoute = lazy(() => import('./components/Layout/ProtectedRoute'));
const SubscriptionGate = lazy(() => import('./components/Layout/SubscriptionGate'));
const Notifications = lazy(() => import('./components/Notifications/Notifications'));
const Opportunities = lazy(() => import('./components/Opportunities/Opportunities'));
const Profile = lazy(() => import('./components/Profile/Profile'));
const Home = lazy(() => import('./components/Public/Home'));
const InstallerProfile = lazy(() => import('./components/Public/InstallerProfile'));
const LegalPage = lazy(() => import('./components/Public/LegalPage'));
const ReviewsDashboard = lazy(() => import('./components/Reviews/ReviewsDashboard'));
const Settings = lazy(() => import('./components/Settings/Settings'));
const SupportChat = lazy(() => import('./components/Support/SupportChat'));
const Subscription = lazy(() => import('./components/Subscription/Subscription'));

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<ClientLanding />} path="/" />
          <Route element={<ClientLogin />} path="/cliente/entrar" />
          <Route element={<ClientLogin />} path="/login" />
          <Route element={<Login />} path="/instalador/entrar" />
          <Route element={<PasswordRecovery />} path="/instalador/recuperar-senha" />
          <Route element={<PasswordRecovery />} path="/cliente/recuperar-senha" />
          <Route element={<OAuthCallback />} path="/auth/social/callback" />
          <Route element={<Navigate replace to="/" />} path="/register" />
          <Route element={<Register />} path="/instalador/cadastro" />
          <Route element={<Home />} path="/cliente" />
          <Route element={<Home />} path="/cliente/pedido" />
          <Route element={<Home />} path="/papelperto" />
          <Route element={<InstallerProfile />} path="/installers/:id" />
          <Route element={<LegalPage type="privacy" />} path="/privacidade" />
          <Route element={<LegalPage type="terms" />} path="/termos" />

          <Route element={<ProtectedRoute allowedAccountTypes={['client']} loginPath="/cliente/entrar" />}>
            <Route element={<Home />} path="/cliente/pedidos" />
          </Route>

          <Route element={<ProtectedRoute allowedAccountTypes={['installer']} loginPath="/instalador/entrar" />}>
            <Route element={<Layout />}>
              <Route element={<Profile />} path="/profile" />
              <Route element={<Settings />} path="/settings" />
              <Route element={<Subscription />} path="/subscription" />
              <Route element={<SupportChat />} path="/support" />
              <Route element={<AdminRoute />}>
                <Route element={<AdminDashboard />} path="/admin" />
              </Route>

              <Route element={<SubscriptionGate />}>
                <Route element={<Dashboard />} path="/dashboard" />
                <Route element={<Opportunities />} path="/opportunities" />
                <Route element={<Clients />} path="/clients" />
                <Route element={<Budgets />} path="/budgets" />
                <Route element={<BudgetForm />} path="/budgets/new" />
                <Route element={<Agenda />} path="/agenda" />
                <Route element={<ReviewsDashboard />} path="/reviews" />
                <Route element={<Notifications />} path="/notifications" />
              </Route>
            </Route>
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
