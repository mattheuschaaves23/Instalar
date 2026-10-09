import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import Sidebar from './Sidebar';
import Header from './Header';
import InstallerPanelShell from './InstallerPanelShell';
import { EmailVerificationNotice } from '../Auth/EmailVerification';
import DecoratingWallLoader from './DecoratingWallLoader';

function PageOutlet() {
  return (
    <Suspense fallback={<DecoratingWallLoader embedded phrase="Abrindo esta área do painel." />}>
      <Outlet />
    </Suspense>
  );
}

const PANEL_ROUTE_PREFIXES = [
  '/agenda',
  '/budgets',
  '/clients',
  '/dashboard',
  '/download-app',
  '/opportunities',
  '/reviews',
  '/profile',
  '/pdf-profissional',
  '/settings',
  '/subscription',
  '/notifications',
  '/support',
  '/admin',
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isInstallerPanelRoute = PANEL_ROUTE_PREFIXES.some((route) =>
    location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (isInstallerPanelRoute) {
    return (
      <div className="app-layout dashboard-reference-layout installer-workspace aqua-panel-theme">
        <InstallerPanelShell>
          <EmailVerificationNotice />
          <PageOutlet />
        </InstallerPanelShell>
      </div>
    );
  }

  return (
    <div className="app-layout app-layout-shell overflow-x-hidden md:flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="relative min-w-0 flex-1">
        <Header onOpenMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1480px] px-4 pb-10 pt-6 sm:px-5 lg:px-8 xl:px-10">
          <div className="min-w-0 space-y-6">
            <EmailVerificationNotice />
            <PageOutlet />
          </div>
        </main>
      </div>
    </div>
  );
}
