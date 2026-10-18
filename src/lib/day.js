// A past day's daily round has its own address: /four-by-four?day=2026-10-17.
// A query string rather than a second path level, because the build loads its
// files by relative path (see src/lib/route.js). Every daily is built from a
// seed made of its date, so any earlier day can be rebuilt on demand.

import { useSyncExternalStore } from 'react';
import { addDaysToKey, localDateKey } from './dates.js';

const EVENT = 'kia:day';
const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
// The earliest day a link may ask for; the archive row offers the last week.
export const FIRST_DAY = '2026-01-01';

/**
 * The past day the address asks for, or null for today. Only a real calendar
 * day before today counts: a future day would reveal tomorrow's board, and
 * today is just the normal daily.
 */
export function requestedDay(search = typeof location === 'undefined' ? '' : location.search, today = localDateKey()) {
  const raw = new URLSearchParams(search).get('day');
  const m = raw && KEY.exec(raw);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(y, mo - 1, d);
  if (real.getFullYear() !== y || real.getMonth() !== mo - 1 || real.getDate() !== d) return null;
  return raw >= FIRST_DAY && raw < today ? raw : null;
}

const subscribe = (fn) => {
  window.addEventListener('popstate', fn);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener('popstate', fn);
    window.removeEventListener(EVENT, fn);
  };
};

/** The past day the current address asks for, or null; re-renders when it changes. */
export const useDay = () => useSyncExternalStore(subscribe, () => requestedDay(), () => null);

/** The address search string with `day` set, or removed when `day` is null. */
export function searchWithDay(search, day) {
  const params = new URLSearchParams(search);
  if (day) params.set('day', day);
  else params.delete('day');
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Go to a past day's round on this screen (null for today), as a new history entry. */
export function openDay(day) {
  const url = location.pathname + searchWithDay(location.search, day) + location.hash;
  window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(EVENT));
}

/** The `n` days before today, newest first. */
export const pastDays = (n = 7, today = localDateKey()) => Array.from({ length: n }, (_, i) => addDaysToKey(today, -(i + 1)));

/** '2026-10-17' -> 'Fri 17 Oct'. */
export function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Today's" or "Fri 17 Oct's", for the daily button's label. */
export const daysOwn = (day) => (day ? `${dayLabel(day)}'s` : "Today's");

/** Back to today's address without a new history entry (a random round started from an earlier day). */
export function clearDay() {
  if (!requestedDay()) return;
  window.history.replaceState(null, '', location.pathname + searchWithDay(location.search, null) + location.hash);
  window.dispatchEvent(new Event(EVENT));
}
