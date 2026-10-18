import React, { useState } from 'react';
import data from '../../data/famous.json';
import { buildWhoRounds, guessIsRight, whoPoints, yearText, ROUNDS, RUNGS } from './whoLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, GameCard, GameResults, Pill, TextInput } from '../../components/ui';
import { Ask, GameSetup, NextBar, Option, OptionGrid, PlayHead } from '../shared/Play';
// The clue stack and guess box look the same as Clue ladder's.
import '../clueladder/clueladder.css';

const MAX = ROUNDS * RUNGS;
const RUNG_LABEL = ['', 'Known for', 'Born', 'First name'];

/**
 * Who am I: a famous person in three clues, vaguest first (what they are known
 * for, the year they were born, their first name), then four names to choose
 * from. Type a guess at any clue: 4 points on the first, then 3, 2, and 1 for
 * picking from the four.
 */
export default function WhoAmI({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('who_am_i', null);
  const [guess, setGuess] = useState('');
  const entry = gameEntry(stats, 'who-am-i');

  const start = (daily) => {
    const seed = daily ? localDateKey() : `${Date.now()}`;
    setGuess('');
    setGame({ daily, rounds: buildWhoRounds(data.names, { seed }), index: 0, rung: 1, misses: [], results: [] });
  };

  if (!game) {
    return (
      <GameSetup
        title="Who am I"
        section="lab"
        onExit={onExit}
        record={
          <>
            A famous person in three clues: what they are known for, the year they were born, their first name. Guess
            early for more points: 4, 3, 2, then 1 for picking from four names. {ROUNDS} people.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${MAX}.` : ''}
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

  const { rounds, index, rung, misses, results } = game;
  const total = results.reduce((s, r) => s + r.points, 0);

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Who am I"
        hero={`${total} / ${MAX} points`}
        score={total}
        total={MAX}
        verdict={total >= MAX * 0.75 ? 'Sharp. You knew them from the first clues.' : total > 0 ? 'Some came early. Everyone is below.' : 'None this time. Everyone is below.'}
        squares={results.map((x) => x.points > 0)}
        celebrate={total === MAX}
        onPlayAgain={() => start(false)}
        share={game.daily ? dailyShare('Who am I', 'who-am-i') : undefined}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {rounds.map((r, i) => (
          <AnswerRow key={r.id} state={results[i].points ? 'got' : 'missed'} trail={results[i].points ? `${results[i].points} point${results[i].points === 1 ? '' : 's'}` : 'missed'}>
            {r.name}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const res = done ? results[index] : null;
  const shown = done ? RUNGS : rung;
  const clues = [r.knownFor, yearText(r.born), r.first];

  const finish = (points, extra) => {
    const next = [...results, { points, ...extra }];
    setGame({ ...game, results: next });
    setGuess('');
    if (next.length === rounds.length) {
      onRoundComplete('who-am-i', { score: next.reduce((s, x) => s + x.points, 0), total: MAX, answers: [] });
    }
  };

  const submitGuess = (e) => {
    e.preventDefault();
    const g = guess.trim();
    if (done || !g) return;
    if (guessIsRight(g, r)) finish(whoPoints(rung), { guess: g });
    else {
      setGame({ ...game, rung: rung + 1, misses: [...misses, g] });
      setGuess('');
    }
  };

  const pick = (i) => {
    if (done) return;
    finish(i === r.answerIndex ? whoPoints(RUNGS) : 0, { picked: i });
  };

  return (
    <GameCard data-section="lab" className="cl">
      <PlayHead left={`Person ${index + 1} of ${rounds.length}`}>
        <Pill variant="accent">{total} pts</Pill>
      </PlayHead>

      <ol className="cl-rungs">
        {clues.slice(0, Math.min(shown, 3)).map((t, i) => (
          <li key={i} className={i === shown - 1 && !done ? 'cl-rung cl-new' : 'cl-rung'}>
            <span className="cl-rung-label">{i + 1}. {RUNG_LABEL[i + 1]}</span>
            <span className="cl-rung-text">{t}</span>
          </li>
        ))}
      </ol>

      {!done && misses.length > 0 && <p className="cl-misses">Not {misses.map((m) => `"${m}"`).join(', ')}.</p>}

      {!done && rung < RUNGS && (
        <form className="cl-guess" onSubmit={submitGuess}>
          <Ask>Worth {whoPoints(rung)} now. Who am I?</Ask>
          <div className="cl-guess-row">
            <TextInput label="Your guess" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Name or surname" />
            <Button variant="primary" type="submit" icon="Check" disabled={!guess.trim()}>Guess</Button>
          </div>
          <div className="play-grade">
            <Button variant="secondary" icon="Eye" onClick={() => setGame({ ...game, rung: rung + 1 })}>
              Next clue (worth {whoPoints(rung + 1)})
            </Button>
          </div>
        </form>
      )}

      {(done || rung === RUNGS) && (
        <>
          <Ask>{done ? 'Who it was' : `Pick one. Worth ${whoPoints(RUNGS)}`}</Ask>
          <OptionGrid>
            {r.options.map((opt, i) => {
              let state = 'idle';
              if (done) state = i === r.answerIndex ? 'correct' : res.picked === i ? 'wrong' : 'dim';
              return (
                <Option key={opt} letter={'ABCD'[i]} state={state} disabled={done} onClick={() => pick(i)}>
                  {opt}
                </Option>
              );
            })}
          </OptionGrid>
        </>
      )}

      {done && (
        <>
          <div className="cl-reveal" role="status">
            <p className="cl-reveal-head">
              {res.points ? `${res.points} point${res.points === 1 ? '' : 's'}` : 'No points'}: {r.name}
            </p>
            <p>{r.description}</p>
          </div>
          <NextBar onClick={() => setGame({ ...game, index: index + 1, rung: 1, misses: [] })}>
            {index < rounds.length - 1 ? 'Next person' : 'Results'}
          </NextBar>
        </>
      )}
    </GameCard>
  );
}
