// Keeping a game in progress across the app being closed.
//
// On an iPhone home-screen web app, switching away often unloads the page, so
// anything held only in React state (the question you were on, the board you
// were filling) was lost and the game started again. Each game keeps its
// current state here instead, under one key per game, so reopening the app
// resumes it. Starting a new round simply overwrites that key.
//
// Same `sqt_v4_` prefix as the rest of the app's storage, so Reset clears it.

import { useEffect, useState } from 'react';

const KEY = (name) => `sqt_v4_live_${name}`;

export function loadLive(name) {
  try {
    const raw = localStorage.getItem(KEY(name));
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function saveLive(name, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(KEY(name));
    else localStorage.setItem(KEY(name), JSON.stringify(value));
  } catch (err) {
    // Full or blocked storage: the game still works, it just will not resume.
    console.warn(`Could not save progress for "${name}".`, err);
  }
}

/**
 * useState that survives a reload. `initial` is used when nothing is saved.
 * Values must be plain JSON (no functions, no Infinity).
 */
export function usePersistentState(name, initial) {
  const [value, setValue] = useState(() => {
    const saved = loadLive(name);
    return saved === undefined ? (typeof initial === 'function' ? initial() : initial) : saved;
  });
  useEffect(() => saveLive(name, value), [name, value]);
  return [value, setValue];
}
