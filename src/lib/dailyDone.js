// Which daily rounds are finished today, for the Today row on the games page.
// Stored as { tab: 'YYYY-MM-DD' } in the synced key daily_done, so a daily
// finished on the phone ticks on the laptop too. GameResults marks a round
// when a daily's results appear (the rounds that get a share button).

import { getStored, setStored } from './storage.js';
import { addDaysToKey, localDateKey } from './dates.js';

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

// App listens so a finished daily round also advances the streak.
const listeners = new Set();
export function onDailyDone(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Record that today's round of `tab` is finished. */
export function markDailyDone(tab, today = localDateKey()) {
  const done = getStored('daily_done', {}, isObject);
  // Never moves back: finishing an earlier day's board (?day=) after today's
  // must not take today's tick away.
  if (done[tab] && done[tab] >= today) return;
  setStored('daily_done', { ...done, [tab]: today });
  listeners.forEach((fn) => fn(tab, today));
}

/** The tabs whose daily round is finished today. */
export function dailyDoneToday(today = localDateKey()) {
  const done = getStored('daily_done', {}, isObject);
  return new Set(Object.keys(done).filter((tab) => done[tab] === today));
}

// Which daily rounds have already counted in the totals, as { 'game:YYYY-MM-DD': 1 }.
// Replaying a day's round (today's again, or an earlier day's from ?day=) is
// allowed, but only the first finish adds to plays, scores and the Progress
// page. Kept for KEEP_DAYS; an older day's round never counts, which costs
// nothing because the Day row offers only the last week.
const COUNTED = 'daily_counted';
const KEEP_DAYS = 14;

/** True the first time `game`'s round for `date` is finished, false for a replay. */
export function firstFinish(game, date, today = localDateKey()) {
  const oldest = addDaysToKey(today, -KEEP_DAYS);
  if (date < oldest) return false;
  const seen = getStored(COUNTED, {}, isObject);
  const key = `${game}:${date}`;
  if (seen[key]) return false;
  const kept = Object.fromEntries(Object.entries(seen).filter(([k]) => k.slice(-10) >= oldest));
  setStored(COUNTED, { ...kept, [key]: 1 });
  return true;
}
