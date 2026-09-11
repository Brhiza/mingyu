import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { registerServiceWorker } from './registerServiceWorker';
import './styles.css';
import './styles/features.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>,
);

registerServiceWorker();
