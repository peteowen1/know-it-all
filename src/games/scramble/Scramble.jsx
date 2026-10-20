import React, { useState } from 'react';
import { COUNTRIES } from '../geo/countries';
import { REGIONS } from '../geo/geoPool';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { AnswerRow, Button, Chip, GameBoard, GameResults, SetupRow, TextInput } from '../../components/ui';
import { GameSetup, NextBar } from '../shared/Play';
import { ROUNDS, MAX_POINTS, buildScrambleRounds, isCorrect, pointsFor } from './scrambleLogic';
import './scramble.css';

const MODES = [
  { id: 'countries', label: 'Countries' },
  { id: 'capitals', label: 'Capitals' }
];

const plural = (n) => `${n} point${n === 1 ? '' : 's'}`;

/**
 * Scramble: the letters of a country or capital, shuffled into tiles. Type the
 * answer. 2 points clean, 1 after a hint (asked for, or given by a wrong
 * guess), 0 if skipped. Ten rounds.
 */
export default function Scramble({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('scramble', null);
  const [setup, setSetup] = useState({ mode: 'countries', region: 'World' });
  const [guess, setGuess] = useState('');
  const entry = gameEntry(stats, 'scramble');

  const start = (opts = setup) => {
    const rounds = buildScrambleRounds(COUNTRIES, { ...opts, seed: `${Date.now()}` });
    setGuess('');
    setGame({ ...opts, rounds, index: 0, hinted: false, miss: false, results: [] });
  };

  if (!game) {
    return (
      <GameSetup
        title="Scramble"
        section="lab"
        onExit={onExit}
        record={
          <>
            Unscramble the letters. 2 points, or 1 if you use a hint, or 0 if you skip. {ROUNDS} rounds.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS * MAX_POINTS}.` : ''}
          </>
        }
      >
        <SetupRow label="Unscramble">
          {MODES.map((m) => (
            <Chip key={m.id} active={setup.mode === m.id} onClick={() => setSetup({ ...setup, mode: m.id })}>
              {m.label}
            </Chip>
          ))}
        </SetupRow>
        <SetupRow label="Region">
          {REGIONS.map((r) => (
            <Chip key={r} active={setup.region === r} onClick={() => setSetup({ ...setup, region: r })}>
              {r}
            </Chip>
          ))}
        </SetupRow>
        <div className="setup-actions">
          <Button variant="primary" icon="Shuffle" onClick={() => start()}>Start</Button>
        </div>
      </GameSetup>
    );
  }

  const { rounds, index, hinted, miss, results } = game;
  const total = results.reduce((s, r) => s + r.points, 0);
  const max = rounds.length * MAX_POINTS;

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Scramble"
        hero={`${total} / ${max} points`}
        score={total}
        total={max}
        verdict={total >= max * 0.8 ? 'Sharp. You unscrambled them fast.' : total > 0 ? 'Some came out. The rest are below.' : 'None this time. They are all below.'}
        squares={results.map((x) => x.points > 0)}
        celebrate={total === max}
        onPlayAgain={() => start({ mode: game.mode, region: game.region })}
        playAgainLabel="Another ten"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Change settings"
      >
        {rounds.map((r, i) => (
          <AnswerRow
            key={r.key}
            state={results[i].points ? 'got' : 'missed'}
            trail={results[i].points ? plural(results[i].points) : 'skipped'}
          >
            {r.answer}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const res = done ? results[index] : null;

  const finish = (outcome) => {
    const next = [...results, outcome];
    setGame({ ...game, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('scramble', {
        score: next.reduce((s, x) => s + x.points, 0),
        total: max,
        answers: next.map((x, i) => ({ key: rounds[i].key, correct: x.points > 0 }))
      });
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (done || !guess.trim()) return;
    if (isCorrect(guess, r)) {
      finish({ points: pointsFor({ hinted, skipped: false }), hinted, skipped: false });
    } else {
      // A wrong guess gives the hint, and the round is then worth 1.
      setGame({ ...game, hinted: true, miss: true });
    }
  };

  const next = () => {
    setGuess('');
    setGame({ ...game, index: index + 1, hinted: false, miss: false });
  };

  let message = null;
  let tone;
  if (done) {
    message = res.skipped ? `It was ${r.answer}.` : `Yes, ${r.answer}. ${plural(res.points)}.`;
    tone = res.skipped ? 'bad' : 'good';
  } else if (miss) {
    message = 'Not quite. Have another go, or skip.';
    tone = 'bad';
  }

  return (
    <GameBoard
      data-section="lab"
      className="scramble"
      title="Scramble"
      subtitle={`Round ${index + 1} of ${rounds.length}`}
      score={`${total} pts`}
      message={message}
      tone={tone}
      footer={done ? <NextBar onClick={next}>{index < rounds.length - 1 ? 'Next round' : 'Results'}</NextBar> : null}
    >
      <p className="eyebrow">{done ? 'The answer' : `Worth ${hinted ? 1 : 2} now`}</p>
      <div className="scramble-tiles" role="img" aria-label={`Scrambled letters: ${(done ? r.answer : r.tiles).split('').join(' ')}`}>
        {[...(done ? r.answer : r.tiles)].map((ch, i) =>
          /[ '’-]/.test(ch) ? (
            <span key={i} className="scramble-gap" aria-hidden="true">{ch === ' ' ? '' : ch}</span>
          ) : (
            <span key={i} className="scramble-tile" data-done={done || undefined} aria-hidden="true">{ch.toUpperCase()}</span>
          )
        )}
      </div>

      {/* Once the round is over, facts about the answer, right or wrong.
          Rounds saved before facts existed fall back to the hint. */}
      {done ? <p className="scramble-fact">{r.fact || r.hint}</p> : hinted && <p className="scramble-hint">{r.hint}</p>}

      {!done && (
        <form className="scramble-form" onSubmit={submit}>
          <TextInput
            label="Your answer"
            placeholder="Type the answer"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            autoFocus
          />
          <div className="play-grade">
            <Button type="submit" variant="primary" icon="Check" disabled={!guess.trim()}>Check</Button>
            {!hinted && (
              <Button type="button" variant="secondary" icon="Lightbulb" onClick={() => setGame({ ...game, hinted: true })}>
                Hint
              </Button>
            )}
            <Button type="button" variant="tertiary" icon="ArrowRight" onClick={() => finish({ points: 0, hinted, skipped: true })}>
              Skip
            </Button>
          </div>
        </form>
      )}
    </GameBoard>
  );
}
