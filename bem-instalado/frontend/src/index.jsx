import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/Layout/AppErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { applyStoredSitePreferences } from './utils/sitePreferences';

const root = ReactDOM.createRoot(document.getElementById('root'));

applyStoredSitePreferences();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => null);
  });
}

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <ConfirmProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  borderRadius: '18px',
                  border: '1px solid var(--site-accent-line)',
                  background: 'rgba(11, 10, 9, 0.94)',
                  color: '#f6efdf',
                  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.3)',
                },
              }}
            />
          </ConfirmProvider>
        </NotificationProvider>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
