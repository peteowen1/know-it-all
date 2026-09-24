import { useSyncExternalStore } from 'react';
import App from './App.jsx';
import { subscribe, getGeneration } from './lib/sync.js';

// App reads storage once, when it mounts. When a sync pulls newer progress in
// from another device, bumping the key remounts it so it re-reads everything.
export default function Root() {
  const generation = useSyncExternalStore(subscribe, getGeneration);
  return <App key={generation} />;
}
