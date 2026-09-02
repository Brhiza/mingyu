import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { registerServiceWorker } from './registerServiceWorker';
import { registerDeploymentRecovery } from './lib/deployment-recovery';
import { applyWorkspaceTheme, readWorkspacePreferences } from './lib/workspace';
import './styles.css';
import './workspace.css';
import './workspace-ui.css';
import './traditional-charts.css';

applyWorkspaceTheme(readWorkspacePreferences().theme);
registerDeploymentRecovery();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

registerServiceWorker();
