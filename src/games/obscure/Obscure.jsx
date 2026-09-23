import React from 'react';
import { ArrowRight, CalendarDays, RotateCcw, Shuffle } from 'lucide-react';
import data from '../../data/obscure.json';
import { pickCategories, scoreGuess, ROUNDS } from './obscureLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';

const KIND_ICON = { geo: '🌍', people: '🌟', music: '🎵', film: '🎬' };

/**
 * Obscure-est: one answer per category, any right answer scores, rarer right
 * answers score more (1 for the one everyone gives, 100 for the deepest cut).
 * After each answer the rarest and the most obvious answers are shown, which
 * is where the learning is.
 */
export default function Obscure({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('obscure', null);
  const entry = gameEntry(stats, 'pointless');

  const start = (daily) => {
    const seed = daily ? localDateKey() : `${Date.now()}`;
    setGame({ daily, cats: pickCategories(data.categories, seed), index: 0, results: [], input: '', note: null });
  };

  if (!game) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Obscure-est</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          One answer per category. Any right answer scores; the rarer it is, the more it scores, up to 100. Wrong
          scores nothing. {ROUNDS} categories.
          {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS * 100}.` : ''}
        </p>
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={() => start(true)}><CalendarDays size={18} /> Today's five</button>
          <button className="btn btn-ghost" onClick={() => start(false)}><Shuffle size={18} /> Random</button>
        </div>
        <p className="game-record small">
          Rarity is measured: population for countries and capitals, Wikipedia readership for people, chart points for
          songs and box office for films. A small country you know well can still score high.
        </p>
      </div>
    );
  }

  const { cats, index, results } = game;
  const total = results.reduce((s, r) => s + r.score, 0);

  if (index >= cats.length) {
    return (
      <div className="card game-results">
        <h2>{total} / {cats.length * 100}</h2>
        <div className="ny-summary">
          {cats.map((c, i) => (
            <div key={c.id} className="ny-sum-row">
              <span>{c.prompt}</span>
              <strong>{results[i].answer ? `${results[i].answer.text} · ${results[i].score}` : `"${results[i].guess}" · 0`}</strong>
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

  const cat = cats[index];
  const done = results.length > index;
  const res = done ? results[index] : null;

  const submit = (e) => {
    e.preventDefault();
    const guess = game.input.trim();
    if (done || !guess) return;
    const r = scoreGuess(cat, guess);
    // Ambiguous is not an answer yet: ask for more rather than score it 0.
    if (r.ambiguous) {
      setGame({ ...game, note: 'That matches more than one answer here. Be more specific.' });
      return;
    }
    const next = [...results, { ...r, guess }];
    setGame({ ...game, results: next, note: null });
    if (next.length === cats.length) {
      onRoundComplete('pointless', { score: next.reduce((s, x) => s + x.score, 0), total: cats.length * 100, answers: [] });
    }
  };

  return (
    <div className="card geo-question">
      <div className="progress-text">
        <span>Category {index + 1} of {cats.length}</span>
        <span className="score-pill">{total} pts</span>
      </div>
      <h2 className="geo-prompt-text chart-prompt">
        <span aria-hidden="true">{KIND_ICON[cat.kind]}</span> {cat.prompt}
      </h2>
      <p className="game-record small">{cat.answers.length} right answers on the list.</p>

      {!done ? (
        <form className="names-input-row" onSubmit={submit}>
          <input
            autoFocus
            value={game.input}
            onChange={(e) => setGame({ ...game, input: e.target.value, note: null })}
            placeholder="Your answer…"
            aria-label="Your answer"
            autoComplete="off"
            spellCheck="false"
          />
          <button className="btn btn-primary" type="submit" disabled={!game.input.trim()}>Answer</button>
        </form>
      ) : (
        <>
          <p className={`ny-verdict ${res.score >= 70 ? 'good' : res.score > 0 ? 'meh' : 'bad'}`}>
            {res.answer ? `${res.answer.text}: ${res.score} point${res.score === 1 ? '' : 's'}` : `"${res.guess}" is not on the list: 0`}
          </p>
          <div className="obs-reveal">
            <div>
              <span className="setup-group-label">Rarest</span>
              {cat.answers.slice(-4).reverse().map((a) => <span key={a.text}>{a.text} <em>{a.score}</em></span>)}
            </div>
            <div>
              <span className="setup-group-label">Most obvious</span>
              {cat.answers.slice(0, 4).map((a) => <span key={a.text}>{a.text} <em>{a.score}</em></span>)}
            </div>
          </div>
          <div className="next-action-bar">
            <button className="btn btn-primary next-btn" autoFocus onClick={() => setGame({ ...game, index: index + 1, input: '' })}>
              {index < cats.length - 1 ? 'Next category' : 'Results'} <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
      {game.note && <p className="names-msg meh">{game.note}</p>}
    </div>
  );
}
