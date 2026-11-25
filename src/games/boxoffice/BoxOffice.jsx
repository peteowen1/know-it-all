import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import films from '../../data/charts/films.json';
import { filmPool, firstFilms, nextFilm, madeMore, formatGross, YEAR_WINDOW } from './boxLogic';
import { gameEntry } from '../../lib/gameStats';
import { AnswerRow, Button, GameCard, GameResults, Pill } from '../../components/ui';
import { GameSetup, PlayHead, NextBar } from '../shared/Play';
import { makeRng } from '../../lib/rng';
import { saveLive, usePersistentState } from '../../lib/persist';

const STAT_ID = 'box-office';

/**
 * Box office: the left card shows what a hit film made worldwide; did the
 * right one make more or less? A right call moves the right card across, so
 * a run is a chain, and one miss ends it. Built like Who's older?
 * (src/games/older/WhosOlder.jsx), with the same save-on-leave rules.
 */
export default function BoxOffice({ stats, onRoundComplete, onExit }) {
  // Saved so a run survives the app being closed (see src/lib/persist.js).
  const [state, setState] = usePersistentState('box_office', null);
  const pool = useMemo(() => filmPool(films.boxOffice), []);
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
    save.current(STAT_ID, { score: u.run, total: u.total, answers: [], run: u.run });
    saveLive('box_office', { ...s, recordedRun: u.run });
  }, []);

  const start = () => {
    const pair = firstFilms(pool, rand.current);
    if (!pair) return;
    setState({ ...pair, seen: [pair.left.id, pair.right.id], run: 0, total: 0, verdict: null });
  };

  if (!state) {
    return (
      <GameSetup
        title="Box office"
        section="lab"
        onExit={onExit}
        record={
          <>
            {entry.plays ? `Best run ${entry.bestRun} · ${entry.plays} runs played. ` : 'One miss ends the run. '}
            The gaps get closer the longer you last.
          </>
        }
        note={`Each year's ten biggest films from 1988, ${pool.length} in all. Worldwide gross in US dollars from its first run in cinemas, not adjusted for inflation, from Wikipedia's "Year in film" pages. The two films are always released within ${YEAR_WINDOW} years of each other.`}
      >
        <Button variant="primary" className="game-start" onClick={start}>Start</Button>
      </GameSetup>
    );
  }

  const { left, right, run, total, verdict, seen } = state;

  const guess = (more) => {
    const correct = more === madeMore(right, left);
    const nextRun = run + (correct ? 1 : 0);
    setState({ ...state, verdict: correct ? 'right' : 'wrong', run: nextRun, total: total + 1 });
    if (correct) {
      unsaved.current = { run: nextRun, total: total + 1 };
    } else {
      unsaved.current = null;
      onRoundComplete(STAT_ID, { score: run, total: total + 1, answers: [], run });
    }
  };

  const advance = () => {
    const next = nextFilm(right, pool, rand.current, { seen: new Set(seen), run });
    if (!next) {
      unsaved.current = null;
      onRoundComplete(STAT_ID, { score: run, total, answers: [], run });
      setState({ ...state, verdict: 'done', recordedRun: run });
      return;
    }
    setState({ ...state, left: right, right: next, seen: [...seen, next.id], verdict: null });
  };

  const label = (f) => `${f.title} (${f.year})`;

  if (verdict === 'wrong' || verdict === 'done') {
    const lost = verdict === 'wrong';
    return (
      <GameResults
        data-section="lab"
        eyebrow="Box office"
        hero={`${run} in a row`}
        score={run}
        total={total}
        celebrate={false}
        verdict={
          lost
            ? `${label(right)} made ${formatGross(right.gross)}, ${madeMore(right, left) ? 'more' : 'less'} than ${left.title}.`
            : 'You ran out of films to compare. That is every film in the set.'
        }
        onPlayAgain={start}
        playAgainLabel="New run"
        onChangeSettings={() => setState(null)}
        settingsLabel="Back"
      >
        {lost && (
          <>
            <h3 className="eyebrow">The last pair</h3>
            <AnswerRow state="pending" trail={formatGross(left.gross)}><strong>{label(left)}</strong></AnswerRow>
            <AnswerRow state="missed" trail={formatGross(right.gross)}><strong>{label(right)}</strong></AnswerRow>
          </>
        )}
      </GameResults>
    );
  }

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Run ${run}`}>
        <Pill variant="accent">Best {Math.max(entry.bestRun, run)}</Pill>
      </PlayHead>

      <div className="hl-cards">
        <FilmCard f={left} shown />
        <div className="hl-vs" aria-hidden="true">vs</div>
        <FilmCard f={right} shown={verdict !== null} verdict={verdict} />
      </div>

      {verdict === null && (
        <div className="hl-buttons">
          <p>Did <strong>{right.title}</strong> make more or less than {left.title}?</p>
          <div className="play-grade">
            <Button variant="secondary" onClick={() => guess(false)}><ArrowDown size={18} aria-hidden="true" /> Less</Button>
            <Button variant="secondary" onClick={() => guess(true)}><ArrowUp size={18} aria-hidden="true" /> More</Button>
          </div>
        </div>
      )}
      {verdict === 'right' && <NextBar onClick={advance} />}
    </GameCard>
  );
}

function FilmCard({ f, shown, verdict = null }) {
  return (
    <div className="hl-card" data-verdict={verdict || undefined}>
      <strong>{f.title}</strong>
      <span className="older-who">{f.year} · {f.director}</span>
      <span className="hl-pop">{shown ? formatGross(f.gross) : '?'}</span>
    </div>
  );
}
