import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { COUNTRIES, POPULATION_YEAR } from './countries';
import { REGIONS, countryPool, nextChallenger, formatPopulation } from './geoPool';
import { gameEntry } from '../../lib/gameStats';
import { AnswerRow, Button, Chip, Flag, GameCard, GameResults, Pill, SetupRow } from '../../components/ui';
import { GameSetup, PlayHead, NextBar } from '../shared/Play';
import { makeRng } from '../../lib/rng';
import { saveLive, usePersistentState } from '../../lib/persist';

/** "US$1.80 trillion", "US$57.3 million": World Bank GDP in US dollars. */
function formatMoney(n) {
  if (n == null) return '—';
  if (n >= 1e12) return `US$${(n / 1e12).toFixed(2)} trillion`;
  if (n >= 1e9) return `US$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)} billion`;
  if (n >= 1e6) return `US$${(n / 1e6).toFixed(1)} million`;
  return `US$${Math.round(n).toLocaleString('en-AU')}`;
}
// GDP a person, for the measure of that name.
const WITH_PER_HEAD = COUNTRIES.map((c) => ({ ...c, gdpPerHead: c.gdp && c.population ? c.gdp / c.population : null }));
const SOURCE = {
  population: `World Bank population, ${POPULATION_YEAR}.`,
  area: 'Area, from REST Countries.',
  gdp: 'World Bank GDP in US dollars, each country\'s latest year.',
  gdpPerHead: 'World Bank GDP divided by population, each country\'s latest year.'
};
const formatArea = (n) => (n == null ? '—' : `${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString('en-AU')} km²`);

/**
 * What the run compares. Each measure keeps its own best run under `statId`
 * (population keeps the game's original id, so its record carries on).
 * GDP a person is worked out here from GDP and population.
 */
const MEASURES = {
  population: {
    label: 'Population', field: 'population', statId: 'population', format: formatPopulation,
    up: 'More', down: 'Fewer', ask: (r, l) => <>Does <strong>{r}</strong> have more or fewer people than {l}?</>,
    told: (r, l, more) => `${r.name} has ${formatPopulation(r.population)} people, ${more ? 'more' : 'fewer'} than ${l.name}.`
  },
  area: {
    label: 'Area', field: 'area', statId: 'higher-lower-area', format: formatArea,
    up: 'Bigger', down: 'Smaller', ask: (r, l) => <>Is <strong>{r}</strong> bigger or smaller than {l}?</>,
    told: (r, l, more) => `${r.name} covers ${formatArea(r.area)}, ${more ? 'more' : 'less'} than ${l.name}.`
  },
  gdp: {
    label: 'GDP', field: 'gdp', statId: 'higher-lower-gdp', format: formatMoney,
    up: 'Bigger', down: 'Smaller', ask: (r, l) => <>Is <strong>{r}</strong>&rsquo;s economy bigger or smaller than {l}&rsquo;s?</>,
    told: (r, l, more) => `${r.name}'s GDP is ${formatMoney(r.gdp)}, ${more ? 'more' : 'less'} than ${l.name}'s.`
  },
  gdpPerHead: {
    label: 'GDP a person', field: 'gdpPerHead', statId: 'higher-lower-gdp-head', format: formatMoney,
    up: 'Higher', down: 'Lower', ask: (r, l) => <>Is GDP a person in <strong>{r}</strong> higher or lower than in {l}?</>,
    told: (r, l, more) => `GDP a person in ${r.name} is ${formatMoney(r.gdpPerHead)}, ${more ? 'higher' : 'lower'} than in ${l.name}.`
  }
};

/**
 * Higher or lower, one country at a time. The left card shows its figure for
 * the chosen measure (population, area, GDP, GDP a person); guess whether the
 * right one is higher or lower. A right guess slides the right card over to
 * become the new left one, so the run is a chain.
 *
 * A run ends on the first miss. That makes the score honest (no partial credit)
 * and makes the best run the number worth chasing.
 */
export default function HigherLower({ stats, onRoundComplete, onExit }) {
  const [region, setRegion] = useState('World');
  const [measureKey, setMeasureKey] = usePersistentState('population_measure', 'population');
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [state, setState] = usePersistentState('population', null);
  // A saved run keeps the measure it was started with.
  const m = MEASURES[state?.measure || measureKey] || MEASURES.population;
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
    const id = (MEASURES[s.measure] || MEASURES.population).statId;
    save.current(id, { score: u.run, total: u.answers.length, answers: u.answers, run: u.run });
    // Written directly: the component is unmounting, so no further render
    // would save a state update.
    saveLive('population', { ...s, recordedRun: u.run });
  }, []);

  const pool = useMemo(() => countryPool(WITH_PER_HEAD, { region, needs: m.field }), [region, m.field]);
  const entry = gameEntry(stats, m.statId);
  const pick = (c, rng) => nextChallenger(c, pool, rng, { field: m.field });

  const start = () => {
    // Pick a left country that has a challenger. A tiny region can leave some
    // countries with none (every other one is within 15%), so try again rather
    // than store a null `right`.
    let left = null;
    let right = null;
    for (let tries = 0; tries < 30 && !right; tries++) {
      left = pool[Math.floor(rand.current() * pool.length)];
      right = pick(left, rand.current);
    }
    // Still nothing: pair it with any other country, however close.
    if (!right) right = pool.find((c) => c.code !== left.code) ?? null;
    if (!right) return;
    setState({ left, right, run: 0, verdict: null, answers: [], measure: measureKey });
  };

  if (!state) {
    return (
      <GameSetup
        title="Higher or lower"
        section="geo"
        onExit={onExit}
        record={
          <>
            {entry.plays ? `Best run ${entry.bestRun} · ${entry.plays} runs played` : 'One miss ends the run.'}
            {' '}{SOURCE[m.field]}
          </>
        }
      >
        <SetupRow label="Measure">
          {Object.entries(MEASURES).map(([key, x]) => (
            <Chip key={key} active={measureKey === key} onClick={() => setMeasureKey(key)}>{x.label}</Chip>
          ))}
        </SetupRow>
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
    const correct = higher === right[m.field] > left[m.field];
    const nextAnswers = [...answers, { key: right.code, correct }];
    setState({ ...state, verdict: correct ? 'right' : 'wrong', run: run + (correct ? 1 : 0), answers: nextAnswers });
    if (correct) {
      unsaved.current = { run: run + 1, answers: nextAnswers };
    } else {
      unsaved.current = null;
      // A run already recorded on an earlier leave keeps its answers out of this one.
      onRoundComplete(m.statId, { score: run, total: nextAnswers.length, answers: nextAnswers.slice(alreadyRecorded), run });
    }
  };

  const advance = () => {
    const nextRight = pick(right, rand.current);
    if (!nextRight) {
      // No country is far enough from this one: the pool is exhausted. End the
      // run on the results screen and record it like any other finished run.
      unsaved.current = null;
      onRoundComplete(m.statId, { score: run, total: answers.length, answers: answers.slice(alreadyRecorded), run });
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
        eyebrow={`Higher or lower · ${m.label}`}
        hero={`${run} in a row`}
        score={run}
        total={answers.length}
        celebrate={false}
        verdict={
          lost
            ? m.told(right, left, right[m.field] > left[m.field])
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
            <AnswerRow state="pending" lead={<Flag code={left.code} size="sm" decorative />} trail={m.format(left[m.field])}>
              <strong>{left.name}</strong>
            </AnswerRow>
            <AnswerRow state="missed" lead={<Flag code={right.code} size="sm" decorative />} trail={m.format(right[m.field])}>
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
        <CountryCard c={left} shown value={m.format(left[m.field])} />
        <div className="hl-vs" aria-hidden="true">vs</div>
        <CountryCard c={right} shown={verdict !== null} verdict={verdict} value={m.format(right[m.field])} />
      </div>

      {verdict === null && (
        <div className="hl-buttons">
          <p>{m.ask(right.name, left.name)}</p>
          <div className="play-grade">
            <Button variant="secondary" onClick={() => guess(true)}><ArrowUp size={18} aria-hidden="true" /> {m.up}</Button>
            <Button variant="secondary" onClick={() => guess(false)}><ArrowDown size={18} aria-hidden="true" /> {m.down}</Button>
          </div>
        </div>
      )}
      {verdict === 'right' && <NextBar onClick={advance} />}
    </GameCard>
  );
}

function CountryCard({ c, shown, value, verdict = null }) {
  return (
    <div className="hl-card" data-verdict={verdict || undefined}>
      <Flag code={c.code} size="md" decorative />
      <strong>{c.name}</strong>
      <span className="hl-pop">{shown ? value : '?'}</span>
    </div>
  );
}
