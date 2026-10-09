// Prefetch only JavaScript modules, never private API responses or mutations.
export function preloadableImport(importModule) {
  let pending;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(importModule).catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

const imports = {
  ClientLogin: () => import('../components/Auth/ClientLogin'),
  InstallerOnboarding: () => import('../components/Auth/InstallerOnboarding'),
  Login: () => import('../components/Auth/Login'),
  MobileOAuthRedirect: () => import('../components/Auth/MobileOAuthRedirect'),
  OAuthCallback: () => import('../components/Auth/OAuthCallback'),
  PasswordRecovery: () => import('../components/Auth/PasswordRecovery'),
  Register: () => import('../components/Auth/Register'),
  AdminDashboard: () => import('../components/Admin/AdminDashboard'),
  Agenda: () => import('../components/Agenda/Agenda'),
  Budgets: () => import('../components/Budgets/Budgets'),
  BudgetForm: () => import('../components/Budgets/BudgetForm'),
  Clients: () => import('../components/Clients/Clients'),
  Dashboard: () => import('../components/Dashboard/Dashboard'),
  Layout: () => import('../components/Layout/Layout'),
  Notifications: () => import('../components/Notifications/Notifications'),
  Opportunities: () => import('../components/Opportunities/Opportunities'),
  Profile: () => import('../components/Profile/Profile'),
  PdfBranding: () => import('../components/PdfBranding/PdfBranding'),
  Home: () => import('../components/Public/Home'),
  InstallerProfile: () => import('../components/Public/InstallerProfile'),
  LegalPage: () => import('../components/Public/LegalPage'),
  AccountDeletionPage: () => import('../components/Public/AccountDeletionPage'),
  ReviewsDashboard: () => import('../components/Reviews/ReviewsDashboard'),
  Settings: () => import('../components/Settings/Settings'),
  SupportChat: () => import('../components/Support/SupportChat'),
  Subscription: () => import('../components/Subscription/Subscription'),
  AppDownload: () => import('../components/AppDownload/AppDownload'),
  EmailVerification: () => import('../components/Auth/EmailVerification'),
};

export const routeModules = Object.fromEntries(
  Object.entries(imports).map(([name, importer]) => [name, preloadableImport(importer)])
);

const publicRoutes = {
  '/cliente/entrar': 'ClientLogin', '/login': 'ClientLogin',
  '/instalador/boas-vindas': 'InstallerOnboarding', '/instalador/entrar': 'Login',
  '/instalador/recuperar-senha': 'PasswordRecovery', '/cliente/recuperar-senha': 'PasswordRecovery',
  '/instalador/cadastro': 'Register', '/cliente': 'Home', '/cliente/pedido': 'Home',
  '/cliente/pedidos': 'Home', '/papelperto': 'Home', '/privacidade': 'LegalPage',
  '/termos': 'LegalPage', '/excluir-conta': 'AccountDeletionPage',
};
const panelRoutes = {
  '/dashboard': 'Dashboard', '/opportunities': 'Opportunities', '/agenda': 'Agenda',
  '/budgets': 'Budgets', '/budgets/new': 'BudgetForm', '/clients': 'Clients',
  '/clients/new': 'Clients', '/reviews': 'ReviewsDashboard', '/profile': 'Profile',
  '/pdf-profissional': 'PdfBranding', '/settings': 'Settings', '/subscription': 'Subscription',
  '/notifications': 'Notifications', '/support': 'SupportChat', '/download-app': 'AppDownload',
  '/admin': 'AdminDashboard',
};

export function getRouteModules(path) {
  const pathname = String(path || '').split(/[?#]/)[0].replace(/\/$/, '') || '/';
  if (panelRoutes[pathname]) return ['Layout', panelRoutes[pathname]];
  if (publicRoutes[pathname]) return [publicRoutes[pathname]];
  if (/^\/installers\/[^/]+$/.test(pathname)) return ['InstallerProfile'];
  return [];
}

export function preloadRoute(path) {
  return Promise.all(getRouteModules(path).map((name) => routeModules[name]()));
}

export function getInternalLinkPath(href, origin) {
  try {
    const url = new URL(href, origin);
    return url.origin === origin && !url.hash ? url.pathname : null;
  } catch {
    return null;
  }
}

export function canPrefetch(connection) {
  return !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType);
}
