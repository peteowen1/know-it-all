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

import { diffSnapshot, planPull, mergeSnapshots, rebaseSnapshots, tombstoneWrites, isSyncedKey } from './syncCore.js';
import { onDirty, SYNC_BASE_KEY as BASE_KEY } from './storage.js';

const META_KEY = 'kia_sync';
const PUSH_DELAY_MS = 1500;
const STARTUP_WAIT_MS = 3000;
// Browsers refuse keepalive requests with a body over 64 KB (bytes, not characters).
const KEEPALIVE_LIMIT = 60_000;

// touched: when each key was last written on this device. Each key is sent
// with its own time, so a batch after a spell offline does not stamp a late
// edit with the time of the first one (which could make it lose a clash).
const blankMeta = () => ({ email: null, shadow: {}, updated: {}, touched: {} });

let meta = loadMeta();
let pushTimer = null;
let applying = false;
let signingIn = false;
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

/** Stop syncing, keeping what this device last agreed with the account. */
function forgetAccount() {
  // Mid sign-in the shadow is still empty; saving it would replace the real
  // base with one that makes every local key look newly played.
  if (meta.email && !signingIn && Object.keys(meta.shadow).length) {
    try {
      localStorage.setItem(BASE_KEY, JSON.stringify({ email: meta.email, shadow: meta.shadow }));
    } catch (err) {
      console.warn('Could not keep the last synced copy.', err);
    }
  }
  meta = blankMeta();
  saveMeta();
  setStatus('signed-out');
}

function loadBase(email) {
  try {
    const base = JSON.parse(localStorage.getItem(BASE_KEY) || 'null');
    const ok = base && base.email === email && base.shadow && typeof base.shadow === 'object';
    return ok && Object.keys(base.shadow).length ? base.shadow : null;
  } catch {
    return null;
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
    // Mid sign-in, meta holds the email but an empty shadow; saving it now would
    // let a reload push every local key over the account's. Sign-in saves it.
    if (!signingIn) saveMeta();
  }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => push(), PUSH_DELAY_MS);
}

// Saves go through storage.js, which reaches this file only via this hook.
onDirty(markDirty);

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (res.status === 401) {
    // The session expired or was revoked. Keep the local data, stop syncing,
    // and show the sign-in button again.
    forgetAccount();
    throw new Error('signed out');
  }
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

/** Send changed keys. Resolves true when the server has everything this device has. */
export async function push({ keepalive = false } = {}) {
  // While signing in, the merge has not run yet: pushing now would send every
  // local key as the newest copy over the account's.
  if (!meta.email || signingIn) return false;
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
    const res = await api('/sync', { method: 'PUT', body, keepalive: keepalive && new TextEncoder().encode(body).length < KEEPALIVE_LIMIT });
    if (res.received !== Object.keys(keys).length) {
      throw new Error(`server took ${res.received} of ${Object.keys(keys).length} keys`);
    }
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) delete meta.shadow[k];
      else meta.shadow[k] = v;
      // The server never stores a time later than its own clock; record what it kept.
      meta.updated[k] = Math.min(keys[k].updatedAt, res.now ?? Infinity);
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
    const apply = planPull(server, meta.updated, readSnapshot(), meta.touched);
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
  // Google's callback can fire twice; a second merge on top of the first would
  // add the totals together again.
  if (signingIn) return;
  // push() refuses to run until the merge is done: before then it would send
  // every local key as the newest copy over the account's.
  signingIn = true;
  try {
    await signInAndMerge(credential);
  } finally {
    signingIn = false;
  }
  // Remount BEFORE the push awaits: the app still holds the pre-merge values in
  // memory, and any save it made during the network wait would overwrite the
  // merge in storage and then be pushed as the newest copy.
  remount();
  await push();
}

async function signInAndMerge(credential) {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Sign-in failed.');
  const { email, hasData } = await res.json();

  // The email is saved only once the merge has run. If the fetch fails, this
  // device stays signed out rather than holding an empty shadow that the next
  // save would push over the account's newer copies.
  meta = { ...blankMeta(), email };
  setStatus('syncing');

  try {
    if (hasData) {
      const { keys: server } = await api('/sync');
      const local = readSnapshot();
      const base = loadBase(email);
      if (base) {
        // Back to an account this device synced with before: keep what was
        // played here since, without adding the account's totals in twice.
        const values = {};
        for (const [k, e] of Object.entries(server)) values[k] = e.value;
        writeKeys(rebaseSnapshots(local, values, base));
      } else {
        // First sign-in on this device: this browser and the account are two
        // separate histories, so they are merged (never on later syncs).
        const incoming = {};
        for (const [k, e] of Object.entries(server)) if (e.value !== null) incoming[k] = e.value;
        writeKeys({ ...mergeSnapshots(local, incoming), ...tombstoneWrites(server, local) });
      }
      // Record the server's copy as agreed, so push sends only what the merge changed.
      for (const [k, e] of Object.entries(server)) {
        meta.updated[k] = e.updatedAt;
        if (e.value !== null) meta.shadow[k] = e.value;
      }
    }
  } catch (err) {
    meta = blankMeta();
    saveMeta();
    setStatus('signed-out');
    throw err;
  }
  saveMeta();
  localStorage.removeItem(BASE_KEY);
}

export async function signOut() {
  await push();
  // Signed out locally either way: the app stops sending with this session.
  // A server session left behind by a failed call expires on its own.
  await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' }).catch((err) =>
    console.warn('Sign-out did not reach the server; the session will expire on its own.', err)
  );
  forgetAccount();
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
      if (!me.signedIn) forgetAccount();
    }).catch(() => {});
  }

  // Another tab of the app shares this storage. When it signs in or out, or
  // pushes and moves the agreed copy on, take its sync state, or this tab would
  // later write back its own older copy: after a sign-out elsewhere, that
  // stale copy would be saved as the base and double totals on the next
  // sign-in (see forgetAccount).
  window.addEventListener('storage', (e) => {
    if (e.key !== META_KEY || signingIn) return;
    const fresh = loadMeta();
    const sameAccount = fresh.email && fresh.email === meta.email;
    // Unsent writes from this tab still have to go; keep their marks.
    meta = sameAccount ? { ...fresh, touched: { ...fresh.touched, ...meta.touched } } : fresh;
    if (!meta.email) {
      clearTimeout(pushTimer);
      setStatus('signed-out');
    } else if (!sameAccount) {
      setStatus('idle');
      pull().then((changed) => changed && remount());
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (!meta.email) return;
    if (document.visibilityState === 'hidden') push({ keepalive: true });
    else if (await pull()) remount();
  });
}
