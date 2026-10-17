// The one place that knows how the app names and reads its localStorage keys.
//
// Everything the app saves starts with STORAGE_PREFIX. Changing the prefix
// orphans every existing player's progress, so bump it only when the shape of
// stored data changes; old entries are then never read again (only Reset
// removes them). The `sqt_` stem predates the rename to Know-It-All and stays.
//
// No imports and no work at load time, so the Worker and Node tests can import
// this file (via syncCore.js) without a browser.

export const STORAGE_VERSION = 'v4';
export const STORAGE_PREFIX = `sqt_${STORAGE_VERSION}_`;

/** Full localStorage key for a stored name. */
export const storageKey = (name) => STORAGE_PREFIX + name;

// Reset also clears keys from older storage versions and the pre-rename app.
const RESET_PREFIXES = ['sqt_', 'gw_'];

// sync.js registers itself here so saving a key can queue a push to the server
// without this file importing sync.js (which imports syncCore.js, which imports
// this file).
let dirtyHandler = null;
export const onDirty = (fn) => {
  dirtyHandler = fn;
};
export const markDirty = (key) => {
  if (dirtyHandler) dirtyHandler(key);
};

/**
 * Read a stored value by name, or `fallback`.
 *
 * Pass `isValid` for anything a screen indexes into: JSON.parse('null') and
 * JSON.parse('7') both succeed, so without a shape check a bad stored value
 * would be handed back and fail later at the call site as a blank page.
 */
export function getStored(name, fallback, isValid = () => true) {
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Save a value by name and queue a sync. Returns nothing, so it can be an effect body. */
export function setStored(name, value) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value));
    markDirty(storageKey(name));
  } catch (err) {
    // Storage full, or blocked in private browsing. Carrying on unsaved beats
    // breaking the quiz, but the player will only notice when tomorrow's streak
    // has vanished, so leave a trace in the console.
    console.warn(`Could not save "${name}"; progress will not persist.`, err);
  }
}

/** Remove a stored name and queue a sync of the deletion. */
export function removeStored(name) {
  try {
    localStorage.removeItem(storageKey(name));
    markDirty(storageKey(name));
  } catch (err) {
    console.warn(`Could not clear "${name}".`, err);
  }
}

/** Reset: remove every key this app (any version) has ever written. */
export function clearAllStored() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
  keys.filter((k) => RESET_PREFIXES.some((p) => k.startsWith(p))).forEach((k) => localStorage.removeItem(k));
}
