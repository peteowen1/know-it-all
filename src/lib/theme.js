// The site's look (one of LOOKS) and light/dark mode. Both live on <html> as
// data-look and data-mode; themes.css does the rest.
//
// Saved under kia_ keys, not through storage.js: a look is a per-device
// preference, so it should neither sync to other devices nor be wiped by
// Reset. index.html applies the saved values before first paint (and must
// list the same look ids), so this module only has to keep them in step.
import { useSyncExternalStore } from 'react';

export const LOOKS = [
  { id: 'riso', name: 'Risograph', blurb: 'Fat outlines, hard shadows, fluoro ink. Cards tilt.' },
  { id: 'chalk', name: 'Chalkboard', blurb: 'Pub quiz night: chalk on green, or marker on a whiteboard.' },
  { id: 'evening', name: 'Evening edition', blurb: 'Calm and editorial. Serif headings, soft gold.' },
  { id: 'broadsheet', name: 'Broadsheet', blurb: 'A newspaper front page with a blackletter masthead.' },
  { id: 'showtime', name: 'Quiz show', blurb: 'Studio lights, a soft neon glow and marquee bulbs.' }
];
const DEFAULT_LOOK = 'riso';

const LOOK_KEY = 'kia_look';
const MODE_KEY = 'kia_mode';
const isLook = (id) => LOOKS.some((l) => l.id === id);
const systemMode = () => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing: the choice lasts until the tab closes, which is fine.
  }
}

let state = {
  look: isLook(read(LOOK_KEY)) ? read(LOOK_KEY) : DEFAULT_LOOK,
  // null = follow the system setting
  savedMode: read(MODE_KEY) === 'light' || read(MODE_KEY) === 'dark' ? read(MODE_KEY) : null
};
const listeners = new Set();

function snapshot() {
  return { look: state.look, mode: state.savedMode || systemMode(), followsSystem: !state.savedMode };
}
let current = snapshot();

function apply() {
  current = snapshot();
  const root = document.documentElement;
  root.dataset.look = current.look;
  root.dataset.mode = current.mode;
  // The phone's status bar matches the page.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#15131f');
  listeners.forEach((fn) => fn());
}

export function setLook(id) {
  if (!isLook(id)) return;
  state = { ...state, look: id };
  write(LOOK_KEY, id);
  apply();
}

/** 'light', 'dark', or null to follow the system setting again. */
export function setMode(mode) {
  state = { ...state, savedMode: mode };
  if (mode) write(MODE_KEY, mode);
  else {
    try {
      localStorage.removeItem(MODE_KEY);
    } catch {
      // nothing saved to clear
    }
  }
  apply();
}

export const toggleMode = () => setMode(current.mode === 'light' ? 'dark' : 'light');

window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (!state.savedMode) apply();
});

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** { look, mode, followsSystem }, re-rendering when either changes. */
export const useTheme = () => useSyncExternalStore(subscribe, () => current);

apply();
