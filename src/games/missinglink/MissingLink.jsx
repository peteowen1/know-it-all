import React, { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, Eye, RotateCcw, Shuffle, XCircle } from 'lucide-react';
import data from '../../data/obscure.json';
import { buildLinkRounds, linkPoints, CLUES } from './linkLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';

/**
 * Missing link: clues arrive one at a time, rarest first. Pick the link from
 * four options whenever you like: 4 points after one clue, down to 1 after
 * all four. A wrong pick scores nothing and shows the rest.
 */
export default function MissingLink({ stats, onRoundComplete, onExit }) {
  const [game, setGame] = useState(null);
  const entry = gameEntry(stats, 'missing-link');

  const start = (daily) => {
    const seed = daily ? localDateKey() : `${Date.now()}`;
    setGame({ daily, rounds: buildLinkRounds(data.categories, { seed }), index: 0, shown: 1, results: [] });
  };

  if (!game) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Missing link</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          Four clues, rarest first. Name the link as early as you dare: 4 points after one clue, 1 after all four,
          nothing if wrong. Five rounds.
          {entry.plays ? ` ${entry.plays} played · best ${entry.best}/20.` : ''}
        </p>
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={() => start(true)}><CalendarDays size={18} /> Today's five</button>
          <button className="btn btn-ghost" onClick={() => start(false)}><Shuffle size={18} /> Random</button>
        </div>
      </div>
    );
  }

  const { rounds, index, shown, results } = game;
  const total = results.reduce((s, r) => s + r.points, 0);

  if (index >= rounds.length) {
    return (
      <div className="card game-results">
        <h2>{total} / {rounds.length * CLUES}</h2>
        <div className="ny-summary">
          {rounds.map((r, i) => (
            <div key={r.id} className="ny-sum-row">
              <span>{r.link}</span>
              <strong>{results[i].points ? `${results[i].points} pts` : 'missed'}</strong>
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
  const done = results.length > index;
  const res = done ? results[index] : null;
  const visible = done ? CLUES : shown;

  const pick = (i) => {
    if (done) return;
    const right = i === r.correctIndex;
    const next = [...results, { picked: i, points: right ? linkPoints(shown) : 0 }];
    setGame({ ...game, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('missing-link', { score: next.reduce((s, x) => s + x.points, 0), total: rounds.length * CLUES, answers: [] });
    }
  };

  return (
    <div className="card geo-question">
      <div className="progress-text">
        <span>Round {index + 1} of {rounds.length}</span>
        <span className="score-pill">{total} pts</span>
      </div>

      <ol className="ml-clues">
        {r.clues.map((c, i) => (
          <li key={c.answer} className={i < visible ? 'on' : ''}>
            {i < visible ? c.text : '?'}
          </li>
        ))}
      </ol>

      {!done && shown < CLUES && (
        <div className="actions-bar centered">
          <button className="btn btn-ghost" onClick={() => setGame({ ...game, shown: shown + 1 })}>
            <Eye size={16} /> Next clue (worth {linkPoints(shown + 1)} after)
          </button>
        </div>
      )}

      <p className="geo-ask">{done ? 'The link' : `What links them? Worth ${linkPoints(shown)} now`}</p>
      <div className="options-grid">
        {r.options.map((opt, i) => {
          let state = '';
          if (done) state = i === r.correctIndex ? 'correct' : i === res.picked ? 'incorrect' : 'disabled';
          return (
            <button key={opt} className={`option-btn ${state}`} disabled={done} onClick={() => pick(i)}>
              <span className="option-label">{opt}</span>
              {done && i === r.correctIndex && <CheckCircle2 className="icon-right" size={20} />}
              {done && i === res.picked && i !== r.correctIndex && <XCircle className="icon-wrong" size={20} />}
            </button>
          );
        })}
      </div>

      {done && (
        <div className="next-action-bar">
          <button className="btn btn-primary next-btn" autoFocus onClick={() => setGame({ ...game, index: index + 1, shown: 1 })}>
            {index < rounds.length - 1 ? 'Next round' : 'Results'} <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
