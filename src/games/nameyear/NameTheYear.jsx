import React from 'react';
import data from '../../data/timeline.json';
import { buildYearRounds, yearPoints, ROUNDS } from './nameYearLogic';
import { localDateKey } from '../../lib/dates';
import { useDaySave, daysOwn, clearDay } from '../../lib/day';
import { gameEntry } from '../../lib/gameStats';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, Chip, GameCard, GameResults, Pill, SetupRow, TextInput, EarlierDays } from '../../components/ui';
import { GameSetup, NextBar, Option, OptionGrid, PlayHead } from '../shared/Play';
import KindIcon from '../shared/KindIcon';

/**
 * Name the year: three clues from the same year, five rounds, 10 points for
 * the exact year and two fewer per year out. Easy picks from four years; hard
 * types the year.
 */
export default function NameTheYear({ stats, answerMode, onAnswerModeChange, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame, day] = useDaySave('name_year');
  const entry = gameEntry(stats, 'year-guess');

  const start = (daily) => {
    // A random round is not tied to a day, so it leaves the earlier day's address.
    if (!daily) clearDay();
    const date = daily ? day || localDateKey() : localDateKey();
    const seed = daily ? date : `${Date.now()}`;
    setGame({ daily, date, rounds: buildYearRounds(data.events, { seed }), index: 0, guesses: [], input: '' });
  };

  if (!game) {
    return (
      <GameSetup
        title="Name the year"
        section="lab"
        onExit={onExit}
        record={
          <>
            Three clues from one year. Exact year scores 10, two fewer for every year out. {ROUNDS} rounds.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS * 10}.` : ''}
          </>
        }
      >
        <SetupRow
          label="Answer"
          caption={answerMode === 'choice' ? 'Pick the year from four options.' : 'Type the year yourself.'}
        >
          <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Easy: pick from four years</Chip>
          <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: type the year</Chip>
        </SetupRow>
        <EarlierDays day={day} />
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>{daysOwn(day)} five</Button>
          <Button variant="secondary" icon="Shuffle" onClick={() => start(false)}>Random</Button>
        </div>
      </GameSetup>
    );
  }

  const { rounds, index, guesses } = game;
  const total = guesses.reduce((s, g, i) => s + yearPoints(g, rounds[i].year), 0);

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Name the year"
        score={total}
        total={rounds.length * 10}
        verdict={total >= rounds.length * 8 ? 'You know your years.' : total >= rounds.length * 4 ? 'Close more often than not.' : 'The years are below. Each one has its clues.'}
        squares={guesses.map((g, i) => yearPoints(g, rounds[i].year) > 0)}
        celebrate={total === rounds.length * 10}
        onPlayAgain={() => start(false)}
        share={game.daily ? dailyShare('Name the year', 'year-guess', game.date) : undefined}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {rounds.map((r, i) => {
          const p = yearPoints(guesses[i], r.year);
          return (
            <AnswerRow
              key={r.year}
              state={p === 10 ? 'got' : p > 0 ? 'pending' : 'missed'}
              lead={<strong>{r.year}</strong>}
              trail={`You said ${guesses[i]} · ${p} point${p === 1 ? '' : 's'}`}
            >
              {/* The clues, so the result teaches which events belong to the year. */}
              <ul className="ny-sum-clues">
                {r.clues.map((c) => <li key={c.text}>{c.text}</li>)}
              </ul>
            </AnswerRow>
          );
        })}
      </GameResults>
    );
  }

  const r = rounds[index];
  const answered = guesses.length > index;
  const guess = (y) => {
    // A four-digit year only; the disabled button is not the only way in.
    if (answered || !/^\d{4}$/.test(String(y).trim())) return;
    const next = [...guesses, Number(y)];
    setGame({ ...game, guesses: next });
    if (next.length === rounds.length) {
      const score = next.reduce((s, g, i) => s + yearPoints(g, rounds[i].year), 0);
      onRoundComplete('year-guess', { score, total: rounds.length * 10, answers: [] });
    }
  };
  const pts = answered ? yearPoints(guesses[index], r.year) : null;

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Year ${index + 1} of ${rounds.length}`}>
        <Pill variant="accent">{total} pts</Pill>
      </PlayHead>
      <ul className="ny-clues">
        {r.clues.map((c) => (
          <AnswerRow key={c.text} as="li" lead={<KindIcon kind={c.kind} />}>{c.text}</AnswerRow>
        ))}
      </ul>

      {!answered && answerMode === 'choice' && (
        <OptionGrid>
          {r.options.map((y, i) => (
            <Option key={y} letter={'ABCD'[i]} onClick={() => guess(y)}>{y}</Option>
          ))}
        </OptionGrid>
      )}
      {!answered && answerMode !== 'choice' && (
        <form
          className="board-form"
          onSubmit={(e) => {
            e.preventDefault();
            guess(game.input);
          }}
        >
          <TextInput
            autoFocus
            inputMode="numeric"
            maxLength={4}
            value={game.input}
            onChange={(e) => setGame({ ...game, input: e.target.value.replace(/\D/g, '') })}
            placeholder="Year…"
            label="Your year"
          />
          <Button variant="primary" type="submit" disabled={game.input.length !== 4}>Guess</Button>
        </form>
      )}

      {answered && (
        <>
          <p className="play-verdict" data-tone={pts === 10 ? 'good' : pts > 0 ? 'meh' : 'bad'} role="status">
            {r.year}. You said {guesses[index]}: {pts} point{pts === 1 ? '' : 's'}.
          </p>
          <NextBar onClick={() => setGame({ ...game, index: index + 1, input: '' })}>
            {index < rounds.length - 1 ? 'Next year' : 'Results'}
          </NextBar>
        </>
      )}
    </GameCard>
  );
}
