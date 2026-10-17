import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { COUNTRIES, POPULATION_YEAR } from './countries';
import { REGIONS, countryPool, nextChallenger, formatPopulation } from './geoPool';
import { gameEntry } from '../../lib/gameStats';
import { AnswerRow, Button, Chip, Flag, GameCard, GameResults, Pill, SetupRow } from '../../components/ui';
import { GameSetup, PlayHead, NextBar } from '../shared/Play';
import { makeRng } from '../../lib/rng';
import { saveLive, usePersistentState } from '../../lib/persist';

/**
 * Higher or lower, one country at a time. The left card shows its population;
 * guess whether the right one has more or fewer people. A right guess slides
 * the right card over to become the new left one, so the run is a chain.
 *
 * A run ends on the first miss. That makes the score honest (no partial credit)
 * and makes the best run the number worth chasing.
 */
export default function HigherLower({ stats, onRoundComplete, onExit }) {
  const [region, setRegion] = useState('World');
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [state, setState] = usePersistentState('population', null);
  const rand = useRef(makeRng(Date.now() >>> 0));

  // A run in progress that has not been saved yet. A run is normally saved when
  // it ends on a miss; if the player leaves mid-run instead, this is saved on
  // the way out so a best run is never lost to the All games button.
  //
  // Because the run now survives the app closing, leaving can happen several
  // times in one run. `recordedRun` (saved with the run) is the length already
  // recorded, so each leave records only a run that has grown since, rather
  // than the same run again on every reopen-and-leave.
  const alreadyRecorded = state?.recordedRun ?? 0;
  const unsaved = useRef(
    state && state.verdict !== 'wrong' && state.verdict !== 'done' && state.run > alreadyRecorded ? { run: state.run, answers: state.answers } : null
  );
  const save = useRef(onRoundComplete);
  save.current = onRoundComplete;
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => () => {
    const u = unsaved.current;
    const s = latest.current;
    if (!u || !s || u.run <= (s.recordedRun ?? 0)) return;
    save.current('population', { score: u.run, total: u.answers.length, answers: u.answers, run: u.run });
    // Written directly: the component is unmounting, so no further render
    // would save a state update.
    saveLive('population', { ...s, recordedRun: u.run });
  }, []);

  const pool = useMemo(() => countryPool(COUNTRIES, { region, needs: 'population' }), [region]);
  const entry = gameEntry(stats, 'population');

  const start = () => {
    // Pick a left country that has a challenger. A tiny region can leave some
    // countries with none (every other one is within 15%), so try again rather
    // than store a null `right`.
    let left = null;
    let right = null;
    for (let tries = 0; tries < 30 && !right; tries++) {
      left = pool[Math.floor(rand.current() * pool.length)];
      right = nextChallenger(left, pool, rand.current);
    }
    // Still nothing: pair it with any other country, however close.
    if (!right) right = pool.find((c) => c.code !== left.code) ?? null;
    if (!right) return;
    setState({ left, right, run: 0, verdict: null, answers: [] });
  };

  if (!state) {
    return (
      <GameSetup
        title="Population: higher or lower"
        section="geo"
        onExit={onExit}
        record={
          <>
            {entry.plays ? `Best run ${entry.bestRun} · ${entry.plays} runs played` : 'One miss ends the run.'}
            {' '}World Bank figures, {POPULATION_YEAR}.
          </>
        }
      >
        <SetupRow label="Region" caption={`${pool.length.toLocaleString('en-AU')} countries available`}>
          {REGIONS.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>
          ))}
        </SetupRow>
        <Button variant="primary" className="game-start" onClick={start} disabled={pool.length < 2}>Start</Button>
      </GameSetup>
    );
  }

  const { left, right, run, verdict, answers } = state;

  const guess = (higher) => {
    const correct = higher === right.population > left.population;
    const nextAnswers = [...answers, { key: right.code, correct }];
    setState({ ...state, verdict: correct ? 'right' : 'wrong', run: run + (correct ? 1 : 0), answers: nextAnswers });
    if (correct) {
      unsaved.current = { run: run + 1, answers: nextAnswers };
    } else {
      unsaved.current = null;
      onRoundComplete('population', { score: run, total: nextAnswers.length, answers: nextAnswers, run });
    }
  };

  const advance = () => {
    const nextRight = nextChallenger(right, pool, rand.current);
    if (!nextRight) {
      // No country is far enough from this one: the pool is exhausted. End the
      // run on the results screen and record it like any other finished run.
      unsaved.current = null;
      onRoundComplete('population', { score: run, total: answers.length, answers, run });
      setState({ ...state, verdict: 'done', recordedRun: run });
      return;
    }
    setState({ ...state, left: right, right: nextRight, verdict: null });
  };

  if (verdict === 'wrong' || verdict === 'done') {
    const lost = verdict === 'wrong';
    return (
      <GameResults
        data-section="geo"
        eyebrow="Higher or lower · final run"
        hero={String(run)}
        score={run}
        total={answers.length}
        celebrate={false}
        verdict={
          lost
            ? `${right.name} has ${formatPopulation(right.population)} people, ${right.population > left.population ? 'more' : 'fewer'} than ${left.name}.`
            : 'You ran out of countries to compare. That is every pairing in this region.'
        }
        squares={answers.map((a) => a.correct)}
        onPlayAgain={start}
        playAgainLabel="New run"
        onChangeSettings={() => setState(null)}
      >
        {lost && (
          <>
            <h3 className="eyebrow">The last pair</h3>
            <AnswerRow state="pending" lead={<Flag code={left.code} size="sm" decorative />} trail={formatPopulation(left.population)}>
              <strong>{left.name}</strong>
            </AnswerRow>
            <AnswerRow state="missed" lead={<Flag code={right.code} size="sm" decorative />} trail={formatPopulation(right.population)}>
              <strong>{right.name}</strong>
            </AnswerRow>
          </>
        )}
      </GameResults>
    );
  }

  return (
    <GameCard data-section="geo">
      <PlayHead left={`Run ${run}`}>
        <Pill variant="accent">Best {Math.max(entry.bestRun, run)}</Pill>
      </PlayHead>

      <div className="hl-cards">
        <CountryCard c={left} shown />
        <div className="hl-vs" aria-hidden="true">vs</div>
        <CountryCard c={right} shown={verdict !== null} verdict={verdict} />
      </div>

      {verdict === null && (
        <div className="hl-buttons">
          <p>Does <strong>{right.name}</strong> have more or fewer people than {left.name}?</p>
          <div className="play-grade">
            <Button variant="secondary" onClick={() => guess(true)}><ArrowUp size={18} aria-hidden="true" /> More</Button>
            <Button variant="secondary" onClick={() => guess(false)}><ArrowDown size={18} aria-hidden="true" /> Fewer</Button>
          </div>
        </div>
      )}
      {verdict === 'right' && <NextBar onClick={advance} />}
    </GameCard>
  );
}

function CountryCard({ c, shown, verdict = null }) {
  return (
    <div className="hl-card" data-verdict={verdict || undefined}>
      <Flag code={c.code} size="md" decorative />
      <strong>{c.name}</strong>
      <span className="hl-pop">{shown ? formatPopulation(c.population) : '?'}</span>
    </div>
  );
}
