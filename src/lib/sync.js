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

import { adoptAccount, diffSnapshot, planPull, mergeSnapshots, rebaseSnapshots, resolveConflicts, tombstoneWrites, isSyncedKey } from './syncCore.js';
import { onDirty, SYNC_BASE_KEY as BASE_KEY } from './storage.js';

const META_KEY = 'kia_sync';
const PUSH_DELAY_MS = 1500;
const STARTUP_WAIT_MS = 3000;
// Browsers refuse keepalive requests with a body over 64 KB (bytes, not characters).
const KEEPALIVE_LIMIT = 60_000;

// touched: when each key was last written on this device. Each key is sent
// with its own time, so a batch after a spell offline does not stamp a late
// edit with the time of the first one (which could make it lose a clash).
// pending: per key, the writes sent whose reply has not come back yet, as
// [{ wid, value }]. If one landed without its reply, the server's copy may be
// built on it; the server's write ids say so, and that value is then the base
// for merging rather than the older agreed copy.
const blankMeta = () => ({ email: null, shadow: {}, updated: {}, touched: {}, pending: {} });

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
    return { ...blankMeta(), ...saved, touched: saved.touched || {}, pending: saved.pending || {} };
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

/** The email the kept base copy belongs to, or null. */
function baseOwner() {
  try {
    return JSON.parse(localStorage.getItem(BASE_KEY) || 'null')?.email || null;
  } catch {
    return null;
  }
}

// What a sign-in as a different account replaced, kept on this device only
// (not a synced key) so nothing played while signed out is lost for good.
const SWITCHED_FROM_KEY = 'kia_switched_from';

function newWid() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

// A refused push merges and tries again; another device racing every retry is
// not plausible, so a few attempts is plenty before leaving it for the next save.
const PUSH_ATTEMPTS = 3;
// Same value again reuses its entry, so only new play while offline adds one.
const PENDING_KEEP = 10;

/** Send changed keys. Resolves true when the server has everything this device has. */
export async function push({ keepalive = false } = {}) {
  // While signing in, the merge has not run yet: pushing now would send every
  // local key as the newest copy over the account's.
  if (!meta.email || signingIn) return false;
  clearTimeout(pushTimer);
  for (let attempt = 0; attempt < PUSH_ATTEMPTS; attempt++) {
    const result = await pushOnce({ keepalive });
    if (result !== 'refused') return result;
  }
  setStatus('offline');
  console.warn('Sync push kept clashing with another device; will retry on the next save or visit.');
  return false;
}

/** One push. Resolves true, false (failed), or 'refused' (merged; push again). */
async function pushOnce({ keepalive }) {
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
  // `base`: the server copy these changes were made on top of. The server
  // refuses the write if another device has written since.
  // Noted before sending: if the server stores this but the reply is lost,
  // the next push must recognise the server's copy as built on this write.
  for (const [k, v] of Object.entries(changes)) {
    const list = meta.pending[k] || [];
    if (!list.some((p) => p.value === v)) meta.pending[k] = [...list, { wid: newWid(), value: v }].slice(-PENDING_KEEP);
  }
  saveMeta();
  for (const [k, v] of Object.entries(changes)) {
    const wid = meta.pending[k].find((p) => p.value === v).wid;
    keys[k] = { value: v, updatedAt: meta.touched[k] || sentAt, base: meta.updated[k] || 0, wid };
  }
  const body = JSON.stringify({ keys });

  const email = meta.email;
  setStatus('syncing');
  try {
    const res = await api('/sync', { method: 'PUT', body, keepalive: keepalive && new TextEncoder().encode(body).length < KEEPALIVE_LIMIT });
    // Another tab signed out or switched account while this was in flight:
    // this tab's sync state is no longer that account's, so leave it alone.
    if (meta.email !== email) return false;
    if (res.received !== Object.keys(keys).length) {
      throw new Error(`server took ${res.received} of ${Object.keys(keys).length} keys`);
    }
    // A server from before refusals existed sends neither map: every key it
    // took counts as stored at the time sent, as before.
    const stored = res.stored || Object.fromEntries(Object.keys(keys).map((k) => [k, Math.min(keys[k].updatedAt, res.now ?? Infinity)]));
    const conflicts = res.conflicts || {};

    // A refused key whose server copy is something this device sent is its own
    // earlier write whose reply never arrived (keepalive on locking the phone,
    // a dropped connection). That copy is the agreed one, with no merge:
    // merging would add this device's plays in a second time.
    // Every key sent must come back stored or refused; anything else is a
    // reply this device cannot account for, so it must not report success.
    const answered = new Set([...Object.keys(stored), ...Object.keys(conflicts)]);
    const unanswered = Object.keys(keys).filter((k) => !answered.has(k));
    if (unanswered.length) throw new Error(`server answered neither way for ${unanswered.join(', ')}`);

    const clashes = {};
    const ownEarlier = {};
    // Per key, what this device's changes are measured from: the agreed copy,
    // or its own newest write the server's copy is built on.
    const bases = { ...meta.shadow };
    let mergedSomething = false;
    for (const [k, e] of Object.entries(conflicts)) {
      const sent = meta.pending[k] || [];
      const landed = [...sent].reverse().find((p) => (e.wids || []).includes(p.wid));
      if (e.value === changes[k]) stored[k] = e.updatedAt;
      else if (sent.some((p) => p.value === e.value)) ownEarlier[k] = e;
      else {
        if (landed) bases[k] = landed.value;
        clashes[k] = e;
      }
    }

    // Merge against the copy these changes were made on, before moving it on,
    // and from storage as it is now: anything played while the request was out
    // is part of what this device adds. The merge is written before the
    // server's copy is recorded as agreed, so a failed write leaves the old
    // bookkeeping and the next push clashes and merges again.
    if (Object.keys(clashes).length) {
      const merged = resolveConflicts(readSnapshot(), bases, clashes);
      if (Object.keys(merged).length) writeKeys(merged);
      mergedSomething = Object.keys(merged).length > 0;
    }

    const agree = (k, value, updatedAt) => {
      if (value === null) delete meta.shadow[k];
      else meta.shadow[k] = value;
      meta.updated[k] = updatedAt;
    };
    for (const [k, t] of Object.entries(stored)) {
      if (!(k in changes)) continue;
      agree(k, changes[k], t);
      // Keep the mark if the key was written again while this was in flight;
      // that newer write still has to go.
      if (meta.touched[k] === keys[k].updatedAt || !meta.touched[k]) delete meta.touched[k];
    }
    // The other device's copy is now the agreed one; this device's merged (or,
    // for rounds and settings, own) value still differs from it, so the next
    // attempt sends it on top.
    for (const [k, e] of Object.entries({ ...clashes, ...ownEarlier })) agree(k, e.value, e.updatedAt);
    // Every reply here settles what was sent for these keys.
    for (const k of Object.keys(changes)) delete meta.pending[k];
    // Saves that rewrote an identical value leave a mark but no change; drop
    // those, or a later write that bypasses markDirty would inherit the old time.
    const now = readSnapshot();
    for (const k of Object.keys(meta.touched)) {
      if (!(k in changes) && (now[k] ?? null) === (meta.shadow[k] ?? null)) delete meta.touched[k];
    }
    saveMeta();
    if (!Object.keys(clashes).length && !Object.keys(ownEarlier).length) {
      setStatus('idle');
      return true;
    }
    // Remount in the same synchronous run as the merge write: the app still
    // holds the old values in memory and would otherwise save them back over it.
    if (mergedSomething) remount();
    return 'refused';
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
  const email = meta.email;
  setStatus('syncing');
  try {
    const { keys: server } = await api('/sync');
    if (meta.email !== email) return false; // as in push()
    const apply = planPull(server, meta.updated, readSnapshot(), meta.touched);
    writeKeys(apply);
    for (const [k, entry] of Object.entries(server)) {
      if (!isSyncedKey(k)) continue;
      // Written here after the server copy and kept (see planPull): the base
      // stays the old copy, so the next push is refused and merged instead of
      // overwriting the other device's progress.
      if ((meta.touched[k] || 0) > (entry.updatedAt || 0) && !(k in apply)) continue;
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
    const base = loadBase(email);
    const previous = baseOwner();
    // Last synced as someone else: the progress stored here is theirs.
    const switching = !base && Boolean(previous) && previous !== email;
    if (hasData || switching) {
      const { keys: server } = hasData ? await api('/sync') : { keys: {} };
      const local = readSnapshot();
      if (switching) {
        // Take the account as it is. Merging would add the other account's
        // totals into this one, and switching back would add them again.
        if (Object.keys(local).length) {
          try {
            localStorage.setItem(SWITCHED_FROM_KEY, JSON.stringify({ email: previous, at: Date.now(), snapshot: local }));
          } catch (err) {
            console.warn('Could not keep a copy of the progress replaced by this sign-in.', err);
          }
        }
        writeKeys(adoptAccount(server, local));
      } else if (base) {
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
      // Always remount: the other tab's merge already rewrote storage, so this
      // pull may change nothing, yet the app here still holds the old values
      // in memory and would save them over the merge.
      pull().then(() => remount());
    }
  });

  document.addEventListener('visibilitychange', async () => {
    if (!meta.email) return;
    if (document.visibilityState === 'hidden') push({ keepalive: true });
    else if (await pull()) remount();
  });
}
