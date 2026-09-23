import React, { useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { COUNTRIES, POPULATION_YEAR } from './countries';
import { REGIONS, countryPool, nextChallenger, formatPopulation } from './geoPool';
import { gameEntry } from '../../lib/gameStats';
import { Chip, SetupRow } from './CountryQuiz';
import { makeRng } from '../../lib/rng';

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
  const [state, setState] = useState(null);
  const rand = useRef(makeRng(Date.now() >>> 0));

  const pool = useMemo(() => countryPool(COUNTRIES, { region, needs: 'population' }), [region]);
  const entry = gameEntry(stats, 'population');

  const start = () => {
    const left = pool[Math.floor(rand.current() * pool.length)];
    setState({ left, right: nextChallenger(left, pool, rand.current), run: 0, verdict: null, answers: [] });
  };

  if (!state) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Population: higher or lower</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          {entry.plays ? `Best run ${entry.bestRun} · ${entry.plays} runs played` : 'One miss ends the run.'}
          {' '}World Bank figures, {POPULATION_YEAR}.
        </p>
        <SetupRow label="Region">
          {REGIONS.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>
          ))}
        </SetupRow>
        <button className="btn btn-primary game-start" onClick={start}>Start</button>
      </div>
    );
  }

  const { left, right, run, verdict, answers } = state;

  const guess = (higher) => {
    const correct = higher === right.population > left.population;
    const nextAnswers = [...answers, { key: right.code, correct }];
    setState({ ...state, verdict: correct ? 'right' : 'wrong', run: run + (correct ? 1 : 0), answers: nextAnswers });
    if (!correct) {
      onRoundComplete('population', { score: run, total: nextAnswers.length, answers: nextAnswers, run });
    }
  };

  const advance = () => {
    const nextRight = nextChallenger(right, pool, rand.current);
    if (!nextRight) return start();
    setState({ ...state, left: right, right: nextRight, verdict: null });
  };

  return (
    <div className="card hl-game">
      <div className="progress-text">
        <span>Run {run}</span>
        <span className="score-pill">Best {Math.max(entry.bestRun, run)}</span>
      </div>

      <div className="hl-cards">
        <CountryCard c={left} shown />
        <div className="hl-vs">vs</div>
        <CountryCard c={right} shown={verdict !== null} verdict={verdict} />
      </div>

      {verdict === null && (
        <div className="hl-buttons">
          <p>Does <strong>{right.name}</strong> have more or fewer people than {left.name}?</p>
          <div className="grade-btns">
            <button className="btn btn-success" onClick={() => guess(true)}><ArrowUp size={18} /> More</button>
            <button className="btn btn-danger" onClick={() => guess(false)}><ArrowDown size={18} /> Fewer</button>
          </div>
        </div>
      )}
      {verdict === 'right' && (
        <div className="next-action-bar">
          <button className="btn btn-primary next-btn" onClick={advance} autoFocus>Next</button>
        </div>
      )}
      {verdict === 'wrong' && (
        <div className="hl-over">
          <h3>Run over: {run}</h3>
          <p>
            {right.name} has {formatPopulation(right.population)} people,{' '}
            {right.population > left.population ? 'more' : 'fewer'} than {left.name}'s{' '}
            {formatPopulation(left.population)}.
          </p>
          <div className="actions-bar centered">
            <button className="btn btn-primary" onClick={start} autoFocus><RotateCcw size={18} /> New run</button>
            <button className="btn btn-ghost" onClick={() => setState(null)}>Settings</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CountryCard({ c, shown, verdict = null }) {
  return (
    <div className={`hl-card ${verdict ? `hl-${verdict}` : ''}`}>
      <span className={`fi fi-${c.code.toLowerCase()} flag-md`} role="img" aria-label="flag" />
      <strong>{c.name}</strong>
      <span className="hl-pop">{shown ? formatPopulation(c.population) : '?'}</span>
    </div>
  );
}
