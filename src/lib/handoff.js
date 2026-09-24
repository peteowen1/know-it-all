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
const COLLECTED = 'kia_handoffs_collected';

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
  const id = m[1];
  const clearUrl = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);

  let collected = [];
  try {
    collected = JSON.parse(localStorage.getItem(COLLECTED) || '[]');
  } catch {
    collected = [];
  }
  // Already merged (a reload after success): merging again would add the
  // totals a second time.
  if (collected.includes(id)) return clearUrl();

  // Anyone can create a parcel (the server cannot tell the old site from a
  // forger), so a parcel is only accepted when the browser genuinely arrived
  // here from the old address. A link someone sends you carries their page, or
  // nothing, as the referrer. Reloads keep the original referrer, so the
  // retry-by-reload path below still works.
  if (!document.referrer.startsWith(`https://${OLD_HOST}/`)) {
    console.warn('Ignored a progress hand-over that did not come from the old address.');
    return clearUrl();
  }

  try {
    const res = await fetch(`/api/handoff/${id}`, { method: 'POST', credentials: 'same-origin' });
    if (res.status === 404) {
      // Expired (15 minutes) or never existed. The progress is still safe in
      // the old address's storage; nothing more can be done from here.
      console.warn('Progress hand-over has expired.');
      return clearUrl();
    }
    if (!res.ok) throw new Error(`handoff ${res.status}`);
    const { snapshot } = await res.json();
    const local = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (isSyncedKey(k)) local[k] = localStorage.getItem(k);
    }
    for (const [k, v] of Object.entries(mergeSnapshots(local, snapshot))) localStorage.setItem(k, v);
    localStorage.setItem(COLLECTED, JSON.stringify([...collected, id].slice(-10)));
    clearUrl();
  } catch (err) {
    // The id stays in the address bar, so reloading retries (the parcel stays
    // readable for 15 minutes). Say so where the user will see it.
    console.warn('Could not collect progress from the old address.', err);
    window.alert('Your progress from the old address has not come across yet. Reload this page to try again.');
  }
}
