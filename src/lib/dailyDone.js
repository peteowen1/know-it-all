// Which daily rounds are finished today, for the Today row on the games page.
// Stored as { tab: 'YYYY-MM-DD' } in the synced key daily_done, so a daily
// finished on the phone ticks on the laptop too. GameResults marks a round
// when a daily's results appear (the rounds that get a share button).

import { getStored, setStored } from './storage.js';
import { localDateKey } from './dates.js';

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Record that today's round of `tab` is finished. */
export function markDailyDone(tab, today = localDateKey()) {
  const done = getStored('daily_done', {}, isObject);
  if (done[tab] === today) return;
  setStored('daily_done', { ...done, [tab]: today });
}

/** The tabs whose daily round is finished today. */
export function dailyDoneToday(today = localDateKey()) {
  const done = getStored('daily_done', {}, isObject);
  return new Set(Object.keys(done).filter((tab) => done[tab] === today));
}
