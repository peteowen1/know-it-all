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
export function useRoundClock(clock, setClock, paused) {
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const set = useRef(setClock);
  set.current = setClock;
  const id = clock?.id;

  // A round picked back up (after the app was closed, or another screen)
  // does not count the time it sat saved.
  useEffect(() => {
    if (id) set.current((c) => reopenClock(c));
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
