import React from 'react';
import data from '../../data/obscure.json';
import { buildOddRounds, ROUNDS } from './oddLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, GameCard, GameResults, Pill } from '../../components/ui';
import { Ask, GameSetup, NextBar, Option, OptionGrid, PlayHead } from '../shared/Play';

/**
 * Odd one out: four answers, three share a link and one does not. Pick the
 * odd one; the reveal names the link and where the odd one belongs.
 */
export default function OddOneOut({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('odd_one_out', null);
  const entry = gameEntry(stats, 'odd-one-out');

  const start = (daily) => {
    const seed = daily ? localDateKey() : `${Date.now()}`;
    setGame({ daily, date: localDateKey(), rounds: buildOddRounds(data.categories, { seed }), index: 0, results: [] });
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
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>Today's five</Button>
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
    setGame({ ...game, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('odd-one-out', { score: next.filter((x) => x.right).length, total: rounds.length, answers: [] });
    }
  };

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Round ${index + 1} of ${rounds.length}`}>
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
