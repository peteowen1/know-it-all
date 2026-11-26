import React from 'react';
// Only what the rounds use; see scripts/build-game-slices.mjs.
import data from '../../data/oddOne.json';
import { buildOddRounds, ROUNDS } from './oddLogic';
import { localDateKey } from '../../lib/dates';
import { useDaySave, daysOwn, clearDay } from '../../lib/day';
import { gameEntry } from '../../lib/gameStats';
import { finishClock, newClock, validClock } from '../../lib/roundClock';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, GameCard, GameResults, Pill, EarlierDays } from '../../components/ui';
import { Ask, GameSetup, NextBar, Option, OptionGrid, PlayHead } from '../shared/Play';
import { ClockPill, RoundTime } from '../shared/RoundClock';
import { clockSetter, useRoundClock } from '../shared/useRoundClock';

/**
 * Odd one out: four answers, three share a link and one does not. Pick the
 * odd one; the reveal names the link and where the odd one belongs.
 */
const boardOf = (g) => `odd-one-out:${g.daily ? 'daily' : 'random'}`;

export default function OddOneOut({ stats, times = {}, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame, day] = useDaySave('odd_one_out');
  const entry = gameEntry(stats, 'odd-one-out');
  const clock = validClock(game?.clock);
  // Stopped while an answer is showing and on the results.
  const showing = Boolean(game && (game.results.length > game.index || game.index >= game.rounds.length));
  useRoundClock(clock, clockSetter(setGame), showing);

  const start = (daily) => {
    // A random round is not tied to a day, so it leaves the earlier day's address.
    if (!daily) clearDay();
    const date = daily ? day || localDateKey() : localDateKey();
    const seed = daily ? date : `${Date.now()}`;
    setGame({ daily, date, rounds: buildOddRounds(data.categories, { seed }), index: 0, results: [], clock: newClock() });
  };

  if (!game) {
    return (
      <GameSetup
        title="Odd one out"
        section="lab"
        onExit={onExit}
        record={
          <>
            Four answers: three share a link, one does not. Spot the odd one out. {ROUNDS} rounds.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS}.` : ''}
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
  const score = results.filter((r) => r.right).length;

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Odd one out"
        hero={`${score} / ${rounds.length}`}
        score={score}
        total={rounds.length}
        verdict={score === rounds.length ? 'Every odd one spotted.' : score > 0 ? 'Some spotted. The links are below.' : 'None this time. The links are below.'}
        squares={results.map((r) => r.right)}
        celebrate={score === rounds.length}
        onPlayAgain={() => start(false)}
        share={game.daily ? dailyShare('Odd one out', 'odd-one-out', game.date) : undefined}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {game.time && <RoundTime time={game.time} best={times[boardOf(game)]} score={score} />}
        {rounds.map((r, i) => (
          <AnswerRow key={r.id} state={results[i].right ? 'got' : 'missed'} trail={r.link}>
            {r.odd}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const res = done ? results[index] : null;

  const pick = (i) => {
    if (done) return;
    const next = [...results, { picked: i, right: i === r.oddIndex }];
    const last = next.length === rounds.length;
    const time = last && clock ? { ...finishClock(clock), board: boardOf(game) } : null;
    setGame({ ...game, results: next, ...(time ? { time } : {}) });
    if (last) {
      onRoundComplete('odd-one-out', { day: game.daily ? game.date : null, score: next.filter((x) => x.right).length, total: rounds.length, answers: [], ...(time ? { time } : {}) });
    }
  };

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Round ${index + 1} of ${rounds.length}`}>
        {clock && <Pill><ClockPill clock={clock} /></Pill>}
        <Pill variant="accent">{score} right</Pill>
      </PlayHead>

      <Ask>{done ? 'The odd one out' : 'Which one does not belong?'}</Ask>
      <OptionGrid>
        {r.options.map((opt, i) => {
          let state = 'idle';
          if (done) state = i === r.oddIndex ? 'correct' : i === res.picked ? 'wrong' : 'dim';
          return (
            <Option key={opt} letter={'ABCD'[i]} state={state} disabled={done} onClick={() => pick(i)}>
              {opt}
            </Option>
          );
        })}
      </OptionGrid>

      {done && (
        <>
          <p className="play-fact">
            The link: <strong>{r.link}</strong>. {r.odd} is {r.oddLink.replace(/^A /, 'a ')}.
          </p>
          <NextBar onClick={() => setGame({ ...game, index: index + 1 })}>
            {index < rounds.length - 1 ? 'Next round' : 'Results'}
          </NextBar>
        </>
      )}
    </GameCard>
  );
}
