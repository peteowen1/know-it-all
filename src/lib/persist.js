// Keeping a game in progress across the app being closed.
//
// An iPhone home-screen app often unloads when you switch away, so each game
// keeps its current state under one `live_<name>` key and reopening resumes it.
// Starting a new round overwrites that key. Same prefix as the rest of the
// app's storage (see storage.js), so Reset clears it.

import { useEffect, useState } from 'react';
import { getStored, setStored, removeStored } from './storage.js';

const liveName = (name) => `live_${name}`;

export function loadLive(name) {
  return getStored(liveName(name), undefined);
}

export function saveLive(name, value) {
  if (value === null || value === undefined) removeStored(liveName(name));
  else setStored(liveName(name), value);
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
