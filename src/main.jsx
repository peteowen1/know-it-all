import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import './games.css';
import Root from './Root.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { startSync } from './lib/sync.js';
import { leaveOldHost, collectHandoff } from './lib/handoff.js';

async function boot() {
  if (await leaveOldHost()) return;
  await collectHandoff();
  await startSync();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </StrictMode>
  );
}

boot();
