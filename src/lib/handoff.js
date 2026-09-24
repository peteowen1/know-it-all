// Moving from peteowen1.github.io to quiz.peteowen.dev without losing progress.
//
// Browsers keep each site's saved data separate, so the new address starts
// empty. The old copy (still deployed to GitHub Pages) posts its progress to
// the new server once, then redirects there with the parcel id in the URL
// fragment; the new copy collects it and merges it in. Every later visit to
// the old address just redirects.

import { APP_ORIGIN, OLD_HOST } from './syncConfig.js';
import { isSyncedKey, mergeSnapshots } from './syncCore.js';

const MOVED_FLAG = 'kia_moved';

/** On the old address: hand over and leave. Resolves false to carry on here. */
export async function leaveOldHost() {
  if (window.location.hostname !== OLD_HOST) return false;

  const snapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isSyncedKey(k)) snapshot[k] = localStorage.getItem(k);
  }
  const already = localStorage.getItem(MOVED_FLAG);
  if (already || !Object.keys(snapshot).length) {
    window.location.replace(APP_ORIGIN + '/');
    return true;
  }
  try {
    const res = await fetch(`${APP_ORIGIN}/api/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot })
    });
    if (!res.ok) throw new Error(`handoff ${res.status}`);
    const { id } = await res.json();
    localStorage.setItem(MOVED_FLAG, new Date().toISOString());
    window.location.replace(`${APP_ORIGIN}/#handoff=${id}`);
    return true;
  } catch (err) {
    // Better to keep playing here than strand the user on a blank page.
    console.warn('Could not hand progress to the new address; staying here.', err);
    return false;
  }
}

/** On the new address: collect a parcel from the old one, if the URL has one. */
export async function collectHandoff() {
  const m = window.location.hash.match(/^#handoff=([A-Za-z0-9_-]+)$/);
  if (!m) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  try {
    const res = await fetch(`/api/handoff/${m[1]}`, { method: 'POST', credentials: 'same-origin' });
    if (!res.ok) throw new Error(`handoff ${res.status}`);
    const { snapshot } = await res.json();
    const local = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isSyncedKey(k)) local[k] = localStorage.getItem(k);
    }
    for (const [k, v] of Object.entries(mergeSnapshots(local, snapshot))) localStorage.setItem(k, v);
  } catch (err) {
    console.warn('Could not collect progress from the old address.', err);
  }
}
