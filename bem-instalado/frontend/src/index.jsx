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
  document.title = 'InstalarPro Instaladores';
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
                  background: 'var(--dark-ui-surface, rgba(11, 10, 9, 0.94))',
                  color: 'var(--dark-ui-text, #f6efdf)',
                  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.3)',
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
