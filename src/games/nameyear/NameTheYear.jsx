import React from 'react';
import { ArrowRight, CalendarDays, RotateCcw, Shuffle } from 'lucide-react';
import data from '../../data/timeline.json';
import { buildYearRounds, yearPoints, ROUNDS } from './nameYearLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { Chip, SetupRow } from '../geo/CountryQuiz';

const KIND_ICON = { music: '🎵', film: '🎬', oscars: '🏆', tv: '📺', leaders: '🏛️', people: '👶' };

/**
 * Name the year: three clues from the same year, five rounds, 10 points for
 * the exact year and two fewer per year out. Easy picks from four years; hard
 * types the year.
 */
export default function NameTheYear({ stats, answerMode, onAnswerModeChange, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('name_year', null);
  const entry = gameEntry(stats, 'year-guess');

  const start = (daily) => {
    const seed = daily ? localDateKey() : `${Date.now()}`;
    setGame({ daily, rounds: buildYearRounds(data.events, { seed }), index: 0, guesses: [], input: '' });
  };

  if (!game) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Name the year</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          Three clues from one year. Exact year scores 10, two fewer for every year out. {ROUNDS} rounds.
          {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS * 10}.` : ''}
        </p>
        <SetupRow label="Answer">
          <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Easy: pick from four years</Chip>
          <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: type the year</Chip>
        </SetupRow>
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={() => start(true)}><CalendarDays size={18} /> Today's five</button>
          <button className="btn btn-ghost" onClick={() => start(false)}><Shuffle size={18} /> Random</button>
        </div>
      </div>
    );
  }

  const { rounds, index, guesses } = game;
  const total = guesses.reduce((s, g, i) => s + yearPoints(g, rounds[i].year), 0);

  if (index >= rounds.length) {
    return (
      <div className="card game-results">
        <h2>{total} / {rounds.length * 10}</h2>
        <div className="ny-summary">
          {rounds.map((r, i) => (
            <div key={r.year} className="ny-sum-row">
              <strong>{r.year}</strong>
              <span>you said {guesses[i]} · {yearPoints(guesses[i], r.year)} pts</span>
            </div>
          ))}
        </div>
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={() => start(false)}><RotateCcw size={18} /> Another five</button>
          <button className="btn btn-ghost" onClick={() => setGame(null)}>Back</button>
        </div>
      </div>
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
    <div className="card geo-question">
      <div className="progress-text">
        <span>Year {index + 1} of {rounds.length}</span>
        <span className="score-pill">{total} pts</span>
      </div>
      <ul className="ny-clues">
        {r.clues.map((c) => (
          <li key={c.text}><span aria-hidden="true">{KIND_ICON[c.kind]}</span> {c.text}</li>
        ))}
      </ul>

      {!answered && answerMode === 'choice' && (
        <div className="options-grid">
          {r.options.map((y) => (
            <button key={y} className="option-btn" onClick={() => guess(y)}>
              <span className="option-label">{y}</span>
            </button>
          ))}
        </div>
      )}
      {!answered && answerMode !== 'choice' && (
        <form
          className="names-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            guess(game.input);
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            maxLength={4}
            value={game.input}
            onChange={(e) => setGame({ ...game, input: e.target.value.replace(/\D/g, '') })}
            placeholder="Year…"
            aria-label="Your year"
          />
          <button className="btn btn-primary" type="submit" disabled={game.input.length !== 4}>Guess</button>
        </form>
      )}

      {answered && (
        <>
          <p className={`ny-verdict ${pts === 10 ? 'good' : pts > 0 ? 'meh' : 'bad'}`}>
            {r.year}. You said {guesses[index]}: {pts} point{pts === 1 ? '' : 's'}.
          </p>
          <div className="next-action-bar">
            <button className="btn btn-primary next-btn" autoFocus onClick={() => setGame({ ...game, index: index + 1, input: '' })}>
              {index < rounds.length - 1 ? 'Next year' : 'Results'} <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
