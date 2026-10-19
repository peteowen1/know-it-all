import React, { useEffect, useMemo, useState } from 'react';
import { localDateKey } from '../../lib/dates';
import { useDaySave, daysOwn, clearDay } from '../../lib/day';
import { gameEntry } from '../../lib/gameStats';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, GameCard, GameResults, Pill, TextInput, EarlierDays } from '../../components/ui';
import RouteFallback from '../../components/RouteFallback';
import { Ask, GameSetup, NextBar, Option, OptionGrid, PlayHead } from '../shared/Play';
import { MASK, ROUNDS, RUNGS, buildRung, guessIsRight, knownAnswers, ladderPoints, pickRounds } from './ladderLogic';
import './clueladder.css';

/** Clue text with each hidden word drawn as a blank line rather than ▢▢▢. */
function Masked({ text }) {
  const parts = text.split(MASK);
  return parts.map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {i < parts.length - 1 && <span className="cl-blank" role="img" aria-label="hidden word" />}
    </React.Fragment>
  ));
}

const RUNG_LABEL = ['', 'The explanation', 'The hook', 'The question', 'Choose one'];
const MAX = ROUNDS * RUNGS;

/**
 * Clue ladder: one question, climbed from the hardest clue down. The
 * explanation and the hook come first with the answer blanked out, then the
 * question, then four options. Right on the first rung is worth 4 points,
 * on the last 1, and a wrong pick on the last is 0.
 */
export default function ClueLadder({ stats, onRoundComplete, onExit }) {
  const [bank, setBank] = useState(null);
  const [failed, setFailed] = useState(false);
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame, day] = useDaySave('clue-ladder');
  const [guess, setGuess] = useState('');
  const entry = gameEntry(stats, 'clue-ladder');

  // The question bank is large, so it is loaded only when this game opens.
  useEffect(() => {
    let live = true;
    import('../../data/questionBank.js')
      .then((m) => live && setBank(m.ALL_QUESTIONS))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const byId = useMemo(() => (bank ? new Map(bank.map((q) => [q.id, q])) : null), [bank]);

  const known = useMemo(() => (bank ? knownAnswers(bank) : null), [bank]);

  // A saved round cannot be played on if a question has left the bank, or was
  // edited so it no longer makes a fair ladder.
  const stale = Boolean(game && byId && game.rounds.some((r) => !byId.has(r.id) || !buildRung(byId.get(r.id))));
  useEffect(() => {
    if (stale) setGame(null);
  }, [stale, setGame]);

  if (failed) {
    return (
      <GameSetup title="Clue ladder" section="lab" onExit={onExit} record="The questions would not load. Check your connection and try again.">
        <div className="setup-actions">
          <Button variant="primary" icon="RotateCcw" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </GameSetup>
    );
  }
  if (!bank || stale) return <RouteFallback />;

  const start = (daily) => {
    // A random round is not tied to a day, so it leaves the earlier day's address.
    if (!daily) clearDay();
    const date = daily ? day || localDateKey() : localDateKey();
    const seed = daily ? date : `${Date.now()}`;
    setGuess('');
    setGame({ daily, date, rounds: pickRounds(bank, { seed }), index: 0, rung: 1, misses: [], results: [] });
  };

  if (!game) {
    return (
      <GameSetup
        title="Clue ladder"
        section="lab"
        onExit={onExit}
        record={
          <>
            Start with the hardest clue: a fact with the answer blanked out. Fill the blanks. Guess early for more points: 4 on
            the first clue, then 3, 2 and 1 for the options. Five questions, 20 points.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${MAX}.` : ''}
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

  const { rounds, index, rung, misses, results } = game;
  const total = results.reduce((s, r) => s + r.points, 0);

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Clue ladder"
        hero={`${total} / ${MAX} points`}
        score={total}
        total={MAX}
        verdict={total >= MAX * 0.75 ? 'Sharp. You cracked them from the first clues.' : total > 0 ? 'Some came early. The rest are below.' : 'None this time. The answers are all below.'}
        squares={results.map((x) => x.points > 0)}
        celebrate={total === MAX}
        onPlayAgain={() => start(false)}
        share={game.daily ? dailyShare('Clue ladder', 'clue-ladder', game.date) : undefined}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {rounds.map((r, i) => {
          const q = byId.get(r.id);
          const p = results[i].points;
          return (
            <AnswerRow key={r.id} state={p ? 'got' : 'missed'} trail={p ? `${p} point${p === 1 ? '' : 's'}` : 'missed'}>
              {q.answer}
            </AnswerRow>
          );
        })}
      </GameResults>
    );
  }

  const round = rounds[index];
  const q = byId.get(round.id);
  const ladder = buildRung(q);
  const done = results.length > index;
  const res = done ? results[index] : null;
  const shown = done ? RUNGS : rung;

  const finish = (points, extra) => {
    const next = [...results, { points, rung: shown, ...extra }];
    setGame({ ...game, results: next });
    setGuess('');
    if (next.length === rounds.length) {
      onRoundComplete('clue-ladder', {
        day: game.daily ? game.date : null,
        score: next.reduce((s, x) => s + x.points, 0),
        total: MAX,
        answers: next.map((x, i) => ({ key: rounds[i].id, correct: x.points > 0 })),
      });
    }
  };

  const submitGuess = (e) => {
    e.preventDefault();
    const g = guess.trim();
    if (done || !g) return;
    if (guessIsRight(g, q.answer, q.distractors, known || undefined)) {
      finish(ladderPoints(rung), { guess: g });
    } else {
      setGame({ ...game, rung: rung + 1, misses: [...misses, g] });
      setGuess('');
    }
  };

  const pick = (i) => {
    if (done) return;
    const right = round.options[i] === q.answer;
    finish(right ? ladderPoints(RUNGS) : 0, { picked: i });
  };

  const texts = [ladder.explanation, ladder.hook, q.question];

  return (
    <GameCard data-section="lab" className="cl">
      <PlayHead left={`Question ${index + 1} of ${rounds.length}`}>
        <Pill variant="accent">{total} pts</Pill>
      </PlayHead>

      <ol className="cl-rungs">
        {texts.slice(0, Math.min(shown, 3)).map((t, i) => (
          <li key={i} className={i === shown - 1 && !done ? 'cl-rung cl-new' : 'cl-rung'}>
            <span className="cl-rung-label">{i + 1}. {RUNG_LABEL[i + 1]}</span>
            <span className="cl-rung-text"><Masked text={t} /></span>
          </li>
        ))}
      </ol>

      {!done && misses.length > 0 && (
        <p className="cl-misses">Not {misses.map((m) => `"${m}"`).join(', ')}.</p>
      )}

      {!done && rung < RUNGS && (
        <form className="cl-guess" onSubmit={submitGuess}>
          <Ask>Worth {ladderPoints(rung)} now. What goes in the blanks?</Ask>
          <div className="cl-guess-row">
            <TextInput label="Your answer" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type your answer" />
            <Button variant="primary" type="submit" icon="Check" disabled={!guess.trim()}>Guess</Button>
          </div>
          <div className="play-grade">
            <Button variant="secondary" icon="Eye" onClick={() => setGame({ ...game, rung: rung + 1 })}>
              Next clue (worth {ladderPoints(rung + 1)})
            </Button>
          </div>
        </form>
      )}

      {(done || rung === RUNGS) && (
        <>
          <Ask>{done ? 'The answer' : `Pick one. Worth ${ladderPoints(RUNGS)}`}</Ask>
          <OptionGrid>
            {round.options.map((opt, i) => {
              let state = 'idle';
              if (done) state = opt === q.answer ? 'correct' : res.picked === i ? 'wrong' : 'dim';
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
        <div className="cl-reveal" role="status">
          <p className="cl-reveal-head">
            {res.points ? `${res.points} point${res.points === 1 ? '' : 's'}` : 'No points'}: {q.answer}
          </p>
          <p>{q.explanation}</p>
        </div>
      )}

      {done && (
        <NextBar onClick={() => setGame({ ...game, index: index + 1, rung: 1, misses: [] })}>
          {index < rounds.length - 1 ? 'Next question' : 'Results'}
        </NextBar>
      )}
    </GameCard>
  );
}
