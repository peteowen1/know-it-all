import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { activeMs, formatClock } from '../../lib/roundClock';

/**
 * The time so far, ticking once a second. Its own component, so only the
 * pill re-renders each second, not the game.
 */
export function ClockPill({ clock }) {
  const [, tick] = useState(0);
  const runningNow = clock?.runningSince != null;
  useEffect(() => {
    if (!runningNow) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [runningNow]);
  if (!clock) return null;
  return (
    <span className="round-clock" title="Time so far (pauses while you are away from the page)">
      <Clock size={14} aria-hidden="true" />
      <span className="visually-hidden">Time so far </span>
      {formatClock(activeMs(clock))}
    </span>
  );
}

/**
 * The round's time on the results, and how it stands against your best on
 * the same settings. `best` may already be this round (it is recorded as the
 * results appear), so it is compared by time and score.
 */
export function RoundTime({ time, best, score }) {
  const isBest = best && best.activeMs === time.activeMs && best.score === score;
  return (
    <p className="round-time">
      Time {formatClock(time.activeMs)}
      {isBest ? ' · your best on these settings' : best ? ` · your best: ${best.score} points in ${formatClock(best.activeMs)}` : ''}
    </p>
  );
}
