// Keeping this browser's saved progress in step with the account on the server.
//
// How it works, in the order things happen:
//   - Every save in the app calls markDirty(key). A push follows ~1.5 s later,
//     sending only the keys whose value changed since the last agreed copy
//     (the "shadow").
//   - On opening the app, and on switching back to it, a pull fetches the
//     server copy and writes any newer keys into localStorage. If anything
//     changed, listeners are told so the app remounts and re-reads storage.
//   - On switching away, a final push goes out with keepalive, so the answer
//     given just before locking the phone still arrives.
//
// Signed out, none of this runs: markDirty() returns immediately and the app
// is exactly the local-only app it was before.

import { diffSnapshot, planPull, mergeSnapshots, isSyncedKey } from './syncCore.js';

const META_KEY = 'kia_sync';
const PUSH_DELAY_MS = 1500;
const STARTUP_WAIT_MS = 3000;
// Browsers refuse keepalive requests with a body over 64 KB.
const KEEPALIVE_LIMIT = 60_000;

// touched: when each key was last written on this device. Each key is sent
// with its own time, so a batch after a spell offline does not stamp a late
// edit with the time of the first one (which could make it lose a clash).
const blankMeta = () => ({ email: null, shadow: {}, updated: {}, touched: {} });

let meta = loadMeta();
let pushTimer = null;
let applying = false;
let generation = 0;
let status = meta.email ? 'idle' : 'signed-out';
const listeners = new Set();

function loadMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    return { ...blankMeta(), ...saved, touched: saved.touched || {} };
  } catch {
    return blankMeta();
  }
}
function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (err) {
    console.warn('Could not save sync state.', err);
  }
}

function readSnapshot() {
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isSyncedKey(k)) snap[k] = localStorage.getItem(k);
  }
  return snap;
}

function writeKeys(writes) {
  applying = true;
  try {
    for (const [k, v] of Object.entries(writes)) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  } finally {
    applying = false;
  }
}

function setStatus(next) {
  status = next;
  listeners.forEach((fn) => fn());
}

// ------------------------------------------------------------------ for React

/** Subscribe to status and remount changes (useSyncExternalStore shape). */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
/** Bumped whenever pulled data changed storage; the app remounts on change. */
export const getGeneration = () => generation;
export const getStatus = () => status;
export const getEmail = () => meta.email;

// ------------------------------------------------------------------ core

/** Called by every save in the app with the localStorage key it just wrote. */
export function markDirty(key) {
  if (!meta.email || applying) return;
  if (key) {
    meta.touched[key] = Date.now();
    saveMeta();
  }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(), PUSH_DELAY_MS);
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (res.status === 401) {
    // The session expired or was revoked. Keep the local data, stop syncing,
    // and show the sign-in button again.
    meta = blankMeta();
    saveMeta();
    setStatus('signed-out');
    throw new Error('signed out');
  }
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

/** Send changed keys. Resolves true when the server has everything this device has. */
export async function push({ keepalive = false } = {}) {
  if (!meta.email) return false;
  clearTimeout(pushTimer);
  const current = readSnapshot();
  const changes = diffSnapshot(current, meta.shadow);
  if (!Object.keys(changes).length) {
    if (Object.keys(meta.touched).length) {
      meta.touched = {};
      saveMeta();
    }
    return true;
  }
  // Writes that bypassed markDirty (reset, a hand-over) count as happening now.
  const sentAt = Date.now();
  const keys = {};
  for (const [k, v] of Object.entries(changes)) keys[k] = { value: v, updatedAt: meta.touched[k] || sentAt };
  const body = JSON.stringify({ keys });

  setStatus('syncing');
  try {
    const res = await api('/sync', { method: 'PUT', body, keepalive: keepalive && body.length < KEEPALIVE_LIMIT });
    if (res.received !== Object.keys(keys).length) {
      throw new Error(`server took ${res.received} of ${Object.keys(keys).length} keys`);
    }
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) delete meta.shadow[k];
      else meta.shadow[k] = v;
      meta.updated[k] = keys[k].updatedAt;
      // Keep the mark if the key was written again while this was in flight;
      // that newer write still has to go.
      if (meta.touched[k] === keys[k].updatedAt || !meta.touched[k]) delete meta.touched[k];
    }
    // Saves that rewrote an identical value leave a mark but no change; drop
    // those, or a later write that bypasses markDirty would inherit the old time.
    const now = readSnapshot();
    for (const k of Object.keys(meta.touched)) {
      if (!(k in changes) && (now[k] ?? null) === (meta.shadow[k] ?? null)) delete meta.touched[k];
    }
    saveMeta();
    setStatus('idle');
    return true;
  } catch (err) {
    if (meta.email) setStatus('offline');
    console.warn('Sync push failed; will retry on the next save or visit.', err);
    return false;
  }
}

/** Fetch newer keys. Resolves true if anything in storage changed. */
export async function pull() {
  if (!meta.email) return false;
  // Push first, so a local change is never overwritten by an older server copy.
  // If the push cannot get through, the pull would not be safe either.
  if (!(await push())) return false;
  setStatus('syncing');
  try {
    const { keys: server } = await api('/sync');
    const apply = planPull(server, meta.updated, readSnapshot());
    writeKeys(apply);
    for (const [k, entry] of Object.entries(server)) {
      if (!isSyncedKey(k)) continue;
      if ((entry.updatedAt || 0) > (meta.updated[k] || 0)) {
        meta.updated[k] = entry.updatedAt;
        if (entry.value === null) delete meta.shadow[k];
        else meta.shadow[k] = entry.value;
      }
    }
    saveMeta();
    setStatus('idle');
    return Object.keys(apply).length > 0;
  } catch (err) {
    if (meta.email) setStatus('offline');
    console.warn('Sync pull failed.', err);
    return false;
  }
}

function remount() {
  generation++;
  listeners.forEach((fn) => fn());
}

// ------------------------------------------------------------------ sign in / out

/** Called with the credential from Google's sign-in button. */
export async function signInWithGoogle(credential) {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Sign-in failed.');
  const { email, hasData } = await res.json();

  meta = { ...blankMeta(), email };
  saveMeta();
  setStatus('syncing');

  // First sign-in on this device: this browser and the account are two
  // separate histories, so they are merged (never on later syncs).
  if (hasData) {
    const { keys: server } = await api('/sync');
    const incoming = {};
    for (const [k, e] of Object.entries(server)) if (e.value !== null) incoming[k] = e.value;
    const writes = mergeSnapshots(readSnapshot(), incoming);
    writeKeys(writes);
    // Record the server's copy as agreed, so push sends only what the merge changed.
    for (const [k, e] of Object.entries(server)) {
      meta.updated[k] = e.updatedAt;
      if (e.value !== null) meta.shadow[k] = e.value;
    }
  }
  saveMeta();
  // Remount BEFORE the push awaits: the app still holds the pre-merge values in
  // memory, and any save it made during the network wait would overwrite the
  // merge in storage and then be pushed as the newest copy.
  remount();
  await push();
}

export async function signOut() {
  await push();
  // Signed out locally either way: the app stops sending with this session.
  // A server session left behind by a failed call expires on its own.
  await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' }).catch((err) =>
    console.warn('Sign-out did not reach the server; the session will expire on its own.', err)
  );
  meta = blankMeta();
  saveMeta();
  setStatus('signed-out');
}

// ------------------------------------------------------------------ lifecycle

/**
 * Run before the app first renders. Waits up to 3 s for the server copy so the
 * app opens on the latest progress, then gives up and opens on local data so a
 * slow connection never leaves a blank screen.
 */
export async function startSync() {
  if (meta.email) {
    // If the timer wins, the app renders on local data while the pull carries
    // on. When it lands it must remount the app, or the app's in-memory copy
    // (older) would be saved over what was just pulled, and then pushed.
    let rendered = false;
    const pulling = pull().then((changed) => {
      if (changed && rendered) remount();
    });
    await Promise.race([pulling, new Promise((r) => setTimeout(r, STARTUP_WAIT_MS))]);
    rendered = true;
    // Confirm the session is still alive (it may have expired on the server).
    api('/me').then((me) => {
      if (!me.signedIn) {
        meta = blankMeta();
        saveMeta();
        setStatus('signed-out');
      }
    }).catch(() => {});
  }

  document.addEventListener('visibilitychange', async () => {
    if (!meta.email) return;
    if (document.visibilityState === 'hidden') push({ keepalive: true });
    else if (await pull()) remount();
  });
}
