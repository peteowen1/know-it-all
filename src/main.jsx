import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'flag-icons/css/flag-icons.min.css';
import './index.css';
import './games.css';
import Root from './Root.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { startSync } from './lib/sync.js';
import { leaveOldHost, collectHandoff } from './lib/handoff.js';

// A deploy deletes the old hashed chunks, so a tab opened before it fails when
// it lazy-loads a screen it hasn't shown yet. Reload once to pick up the new
// build; the session flag stops a reload loop when the failure is being offline.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('kia_reloaded_for_chunk')) return;
    sessionStorage.setItem('kia_reloaded_for_chunk', '1');
  } catch {
    return; // no session storage: let ErrorBoundary show its retry screen
  }
  event.preventDefault();
  window.location.reload();
});

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
