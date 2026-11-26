import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import data from '../../data/whosOlder.json';
import { POOLS, firstPair, nextPerson, bornBefore, formatYear } from './olderLogic';
import { gameEntry } from '../../lib/gameStats';
import { AnswerRow, Button, Chip, GameCard, GameResults, Pill, SetupRow } from '../../components/ui';
import { GameSetup, PlayHead, NextBar } from '../shared/Play';
import { makeRng } from '../../lib/rng';
import { saveLive, usePersistentState } from '../../lib/persist';
import { finishClock, newClock, validClock } from '../../lib/roundClock';
import { ClockPill, RoundTime } from '../shared/RoundClock';
import { clockSetter, useRoundClock } from '../shared/useRoundClock';

const STAT_ID = 'whos-older';
const boardOf = (s) => `${STAT_ID}:${s.pool || 'household'}`;
const POOL_LABELS = { household: 'Household names', known: 'Well known' };

/**
 * Who's older?: the left card shows when someone was born; is the right one
 * older or younger? A right call moves the right card across, so a run is
 * a chain, and one miss ends it. The gaps close as the run grows (see
 * olderLogic.js gapRange). Same save-on-leave rules as Higher or lower.
 */
export default function WhosOlder({ stats, times = {}, onRoundComplete, onExit }) {
  const [poolKey, setPoolKey] = usePersistentState('whos_older_pool', 'household');
  // Saved so a run survives the app being closed (see src/lib/persist.js).
  const [state, setState] = usePersistentState('whos_older', null);
  const size = POOLS[state?.pool || poolKey] || POOLS.household;
  const pool = useMemo(() => data.people.slice(0, size), [size]);
  const entry = gameEntry(stats, STAT_ID);
  const rand = useRef(makeRng(Date.now() >>> 0));

  // A run left part-way is recorded on the way out; `recordedRun` (saved with
  // the run) stops a reopened run being recorded twice.
  const alreadyRecorded = state?.recordedRun ?? 0;
  const unsaved = useRef(state && !state.verdict?.match(/wrong|done/) && state.run > alreadyRecorded ? { run: state.run, total: state.total } : null);
  const save = useRef(onRoundComplete);
  save.current = onRoundComplete;
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => () => {
    const u = unsaved.current;
    const s = latest.current;
    if (!u || !s || u.run <= (s.recordedRun ?? 0)) return;
    const c = validClock(s.clock);
    const time = c ? { ...finishClock(c), board: boardOf(s) } : null;
    // No per-person answers: a person each would grow the synced stats without limit.
    save.current(STAT_ID, { score: u.run, total: u.total, answers: [], run: u.run, ...(time ? { time } : {}) });
    saveLive('whos_older', { ...s, recordedRun: u.run });
  }, []);

  const clock = validClock(state?.clock);
  // Stopped while a verdict is showing, which includes the results.
  const showing = state?.verdict != null;
  useRoundClock(clock, clockSetter(setState), showing);

  const start = () => {
    const pair = firstPair(pool, rand.current);
    if (!pair) return;
    setState({ ...pair, seen: [pair.left.id, pair.right.id], run: 0, total: 0, verdict: null, pool: poolKey, clock: newClock() });
  };

  if (!state) {
    return (
      <GameSetup
        title="Who's older?"
        section="lab"
        onExit={onExit}
        record={
          <>
            {entry.plays ? `Best run ${entry.bestRun} · ${entry.plays} runs played. ` : 'One miss ends the run. '}
            The gaps get closer the longer you last.
          </>
        }
        note="Birth years from Wikidata. The most-read people on English Wikipedia since 2016, never two born the same year."
      >
        <SetupRow label="People" caption={`The ${size.toLocaleString('en-AU')} most-read`}>
          {Object.entries(POOL_LABELS).map(([key, label]) => (
            <Chip key={key} active={poolKey === key} onClick={() => setPoolKey(key)}>{label}</Chip>
          ))}
        </SetupRow>
        <Button variant="primary" className="game-start" onClick={start}>Start</Button>
      </GameSetup>
    );
  }

  const { left, right, run, total, verdict, seen } = state;

  // Older sits on the left and younger on the right, like a timeline.
  const guess = (older) => {
    const correct = older === bornBefore(right, left);
    const nextRun = run + (correct ? 1 : 0);
    const time = !correct && clock ? { ...finishClock(clock), board: boardOf(state) } : null;
    setState({ ...state, verdict: correct ? 'right' : 'wrong', run: nextRun, total: total + 1, ...(time ? { time } : {}) });
    if (correct) {
      unsaved.current = { run: nextRun, total: total + 1 };
    } else {
      unsaved.current = null;
      onRoundComplete(STAT_ID, { score: run, total: total + 1, answers: [], run, ...(time ? { time } : {}) });
    }
  };

  const advance = () => {
    const next = nextPerson(right, pool, rand.current, { seen: new Set(seen), run });
    if (!next) {
      unsaved.current = null;
      const time = clock ? { ...finishClock(clock), board: boardOf(state) } : null;
      onRoundComplete(STAT_ID, { score: run, total, answers: [], run, ...(time ? { time } : {}) });
      setState({ ...state, verdict: 'done', recordedRun: run, ...(time ? { time } : {}) });
      return;
    }
    setState({ ...state, left: right, right: next, seen: [...seen, next.id], verdict: null });
  };

  if (verdict === 'wrong' || verdict === 'done') {
    const lost = verdict === 'wrong';
    return (
      <GameResults
        data-section="lab"
        eyebrow="Who's older?"
        hero={`${run} in a row`}
        score={run}
        total={total}
        celebrate={false}
        verdict={
          lost
            ? `${right.name} was born in ${formatYear(right.born)}, so is ${bornBefore(right, left) ? 'older' : 'younger'} than ${left.name}.`
            : 'You ran out of people to compare. That is everyone in this set.'
        }
        onPlayAgain={start}
        playAgainLabel="New run"
        onChangeSettings={() => setState(null)}
      >
        {state.time && <RoundTime time={state.time} best={times[boardOf(state)]} score={run} />}
        {lost && (
          <>
            <h3 className="eyebrow">The last pair</h3>
            <AnswerRow state="pending" trail={formatYear(left.born)}><strong>{left.name}</strong></AnswerRow>
            <AnswerRow state="missed" trail={formatYear(right.born)}><strong>{right.name}</strong></AnswerRow>
          </>
        )}
      </GameResults>
    );
  }

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Run ${run}`}>
        {clock && <Pill><ClockPill clock={clock} /></Pill>}
        <Pill variant="accent">Best {Math.max(entry.bestRun, run)}</Pill>
      </PlayHead>

      <div className="hl-cards">
        <PersonCard p={left} shown />
        <div className="hl-vs" aria-hidden="true">vs</div>
        <PersonCard p={right} shown={verdict !== null} verdict={verdict} />
      </div>

      {verdict === null && (
        <div className="hl-buttons">
          <p><strong>{right.name}</strong>: older or younger than {left.name}?</p>
          <div className="play-grade">
            <Button variant="secondary" onClick={() => guess(true)}><ArrowLeft size={18} aria-hidden="true" /> Older</Button>
            <Button variant="secondary" onClick={() => guess(false)}>Younger <ArrowRight size={18} aria-hidden="true" /></Button>
          </div>
        </div>
      )}
      {verdict === 'right' && <NextBar onClick={advance} />}
    </GameCard>
  );
}

function PersonCard({ p, shown, verdict = null }) {
  return (
    <div className="hl-card" data-verdict={verdict || undefined}>
      <strong>{p.name}</strong>
      <span className="older-who">{p.who}</span>
      <span className="hl-pop">{shown ? `Born ${formatYear(p.born)}` : '?'}</span>
    </div>
  );
}
