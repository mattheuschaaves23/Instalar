import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/Layout/AppErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { applyStoredSitePreferences } from './utils/sitePreferences';
import { initializeSentry } from './services/sentry';

const root = ReactDOM.createRoot(document.getElementById('root'));
const isInstallerApp = process.env.REACT_APP_INSTALLER_APP === 'true';

applyStoredSitePreferences();
initializeSentry();

if (isInstallerApp) {
  document.documentElement.dataset.installerApp = 'true';
  document.title = 'InstalaPro Instaladores';
}

if (import.meta.env.PROD && !isInstallerApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => null);
  });
}

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <SubscriptionProvider>
          <NotificationProvider>
            <ConfirmProvider>
              <App />
              <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  borderRadius: '18px',
                  border: '1px solid var(--site-accent-line)',
                  background: 'var(--surface-strong)',
                  color: 'var(--text)',
                  boxShadow: 'var(--shadow)',
                },
              }}
              />
            </ConfirmProvider>
          </NotificationProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
