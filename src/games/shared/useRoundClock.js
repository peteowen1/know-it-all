import { useEffect, useRef } from 'react';
import { pauseClock, reopenClock, resumeClock } from '../../lib/roundClock';

/**
 * Keeps a round's clock (src/lib/roundClock.js) paused while the page is
 * hidden or `paused` is true (an answer on screen), and running otherwise.
 *
 * `setClock(fn)` updates the clock inside the game's saved round; it is
 * called only when the clock changes state, so the round is never saved on a
 * tick. Use `clockSetter(setGame)` to build it.
 */
// Clocks of rounds left for another screen in this session, paused at the
// moment of leaving. An update after unmount is never saved, so without this
// the time thought since the last answer would be lost on coming back (and
// leaving and returning on each question would hide it).
const leftAt = new Map();

export function useRoundClock(clock, setClock, paused) {
  const latest = useRef(clock);
  latest.current = clock;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const set = useRef(setClock);
  set.current = setClock;
  const id = clock?.id;

  // A round picked back up does not count the time it sat away: after another
  // screen, it carries on from the moment it was left; after the app was
  // closed, from its last save (the save on hide).
  useEffect(() => {
    if (!id) return undefined;
    const left = leftAt.get(id);
    leftAt.delete(id);
    set.current((c) => (left && left.id === c.id ? left : reopenClock(c)));
    return () => {
      if (latest.current?.id === id) leftAt.set(id, pauseClock(latest.current));
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    set.current((c) => (paused || document.hidden ? pauseClock(c) : resumeClock(c)));
  }, [id, paused]);

  useEffect(() => {
    const onVisibility = () => set.current((c) => (document.hidden || pausedRef.current ? pauseClock(c) : resumeClock(c)));
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}

/** A `setClock` for a game whose saved round keeps its clock under `clock`. */
export const clockSetter = (setGame) => (fn) =>
  setGame((g) => {
    if (!g?.clock) return g;
    const next = fn(g.clock);
    return next === g.clock ? g : { ...g, clock: next };
  });
