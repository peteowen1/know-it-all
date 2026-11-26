import React, { useState } from 'react';
import data from '../../data/curves.json';
import { buildCurveRounds, peakNote, PER_ROUND, ROUNDS } from './curveLogic';
import { localDateKey } from '../../lib/dates';
import { useDaySave, daysOwn, clearDay } from '../../lib/day';
import { gameEntry } from '../../lib/gameStats';
import { finishClock, newClock, validClock } from '../../lib/roundClock';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, Chip, GameCard, GameResults, Pill, EarlierDays } from '../../components/ui';
import { Ask, GameSetup, NextBar, PlayHead } from '../shared/Play';
import { ClockPill, RoundTime } from '../shared/RoundClock';
import { clockSetter, useRoundClock } from '../shared/useRoundClock';
import './curves.css';

const TOTAL = ROUNDS * PER_ROUND;
const FIRST_YEAR = +data.from.slice(0, 4);
// A gridline every other January, labelled.
const YEARS = Array.from({ length: Math.floor((data.months - 1) / 12) + 1 }, (_, i) => FIRST_YEAR + i).filter((y) => y % 2 === 0);

/** One readership curve, scaled to its own peak (each has its own scale). */
function Curve({ s }) {
  const w = s.length - 1;
  const line = s.map((v, i) => `${i},${40 - (v / 99) * 38}`).join(' ');
  return (
    <svg className="curve-svg" viewBox={`0 0 ${w} 48`} preserveAspectRatio="none" aria-hidden="true">
      {YEARS.map((y) => {
        const x = (y - FIRST_YEAR) * 12;
        return <line key={y} className="curve-grid" x1={x} x2={x} y1="0" y2="40" vectorEffect="non-scaling-stroke" />;
      })}
      <polygon className="curve-area" points={`0,40 ${line} ${w},40`} />
      <polyline className="curve-line" points={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const Years = () => (
  <div className="curve-years" aria-hidden="true">
    {YEARS.map((y) => (
      <span key={y} style={{ left: `${(100 * (y - FIRST_YEAR) * 12) / (data.months - 1)}%` }}>{y}</span>
    ))}
  </div>
);

/**
 * Fame lines (was Match the curve): four famous people, four curves of how much their English
 * Wikipedia article was read each month since 2016. Tap a name, then its
 * curve; check when all four are placed.
 */
const boardOf = (g) => `match-curve:${g.daily ? 'daily' : 'random'}`;

export default function MatchCurve({ stats, times = {}, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame, day] = useDaySave('match_curve');
  const [chosen, setChosen] = useState(null);
  const entry = gameEntry(stats, 'match-curve');
  const clock = validClock(game?.clock);
  // Stopped while a round's answer is showing and on the results.
  const showing = Boolean(game && (game.results.length > game.index || game.index >= game.rounds.length));
  useRoundClock(clock, clockSetter(setGame), showing);

  const start = (daily) => {
    if (!daily) clearDay();
    const date = daily ? day || localDateKey() : localDateKey();
    const seed = daily ? date : `${Date.now()}`;
    setChosen(null);
    setGame({ daily, date, rounds: buildCurveRounds(data.people, { seed }), index: 0, placed: [], results: [], clock: newClock() });
  };

  if (!game) {
    return (
      <GameSetup
        title="Fame lines"
        section="lab"
        onExit={onExit}
        record={
          <>
            Four famous names, four curves of how much their Wikipedia page was read each month since {FIRST_YEAR}. Match each name to its curve. {ROUNDS} rounds.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${TOTAL}.` : ''}
          </>
        }
      >
        <EarlierDays day={day} />
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>{daysOwn(day)} five</Button>
          <Button variant="secondary" icon="Shuffle" onClick={() => start(false)}>Random</Button>
        </div>
      </GameSetup>
    );
  }

  const { rounds, index, results } = game;
  const score = results.reduce((n, r) => n + r.right, 0);

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Fame lines"
        hero={`${score} / ${TOTAL}`}
        score={score}
        total={TOTAL}
        verdict={score === TOTAL ? 'Every curve matched.' : score >= TOTAL / 2 ? 'A good eye for a spike.' : 'Hard ones. The peaks are below.'}
        squares={results.map((r) => r.right === PER_ROUND)}
        celebrate={score === TOTAL}
        onPlayAgain={() => start(false)}
        share={game.daily ? dailyShare('Fame lines', 'match-curve', game.date) : undefined}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {game.time && <RoundTime time={game.time} best={times[boardOf(game)]} score={score} />}
        {rounds.flatMap((r, i) =>
          r.people.map((p, j) => (
            <AnswerRow key={p.id} state={results[i].marks[j] ? 'got' : 'missed'} trail={peakNote(p)}>
              {p.name}
            </AnswerRow>
          ))
        )}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  // placed[slot] = index into r.people of the name put on the curve in that slot.
  const placed = done ? results[index].placed : game.placed;
  const slotOf = (person) => placed.indexOf(person);

  const place = (slot) => {
    if (done) return;
    const next = [...placed];
    if (chosen == null) {
      // Tapping a placed curve with no name chosen takes its name back off.
      next[slot] = undefined;
    } else {
      const from = next.indexOf(chosen);
      if (from >= 0) next[from] = undefined;
      next[slot] = chosen;
    }
    setChosen(null);
    setGame({ ...game, placed: next });
  };

  const check = () => {
    // marks[j]: whether person j was put on their own curve.
    const marks = r.people.map((_, j) => r.order[placed.indexOf(j)] === j);
    const right = marks.filter(Boolean).length;
    const next = [...results, { placed, marks, right }];
    // A name picked but never placed must not stay picked into the next round.
    setChosen(null);
    const last = next.length === rounds.length;
    const time = last && clock ? { ...finishClock(clock), board: boardOf(game) } : null;
    setGame({ ...game, results: next, placed: [], ...(time ? { time } : {}) });
    if (last) {
      onRoundComplete('match-curve', { day: game.daily ? game.date : null, score: next.reduce((n, x) => n + x.right, 0), total: TOTAL, answers: [], ...(time ? { time } : {}) });
    }
  };

  const allPlaced = r.people.every((_, j) => slotOf(j) >= 0);

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Round ${index + 1} of ${rounds.length}`}>
        {clock && <Pill><ClockPill clock={clock} /></Pill>}
        <Pill variant="accent">{score} matched</Pill>
      </PlayHead>

      <Ask>{done ? `${results[index].right} of ${PER_ROUND} matched` : 'Tap a name, then its curve'}</Ask>
      <div className="curve-names">
        {r.people.map((p, j) => (
          <Chip key={p.id} active={chosen === j} disabled={done} className={slotOf(j) >= 0 ? 'curve-name-placed' : ''} onClick={() => setChosen(chosen === j ? null : j)}>
            {p.name}
          </Chip>
        ))}
      </div>

      <div className="curve-grid-list">
        {r.order.map((who, slot) => {
          const name = placed[slot];
          const state = done ? (name === who ? 'right' : 'wrong') : name != null ? 'placed' : chosen != null ? 'open' : 'idle';
          return (
            <button key={slot} type="button" className="curve-card" data-state={state} disabled={done} onClick={() => place(slot)}>
              <span className="curve-label">
                {done ? r.people[who].name : name != null ? r.people[name].name : `Curve ${'ABCD'[slot]}`}
              </span>
              <Curve s={r.people[who].s} />
              <Years />
              {done && (
                <span className="curve-note">
                  {r.people[who].what}. {peakNote(r.people[who])}
                  {name !== who && name != null ? ` · you said ${r.people[name].name}` : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {done ? (
        <NextBar onClick={() => setGame({ ...game, index: index + 1 })}>{index < rounds.length - 1 ? 'Next round' : 'Results'}</NextBar>
      ) : (
        <div className="setup-actions">
          <Button variant="primary" disabled={!allPlaced} onClick={check}>Check</Button>
        </div>
      )}
    </GameCard>
  );
}
