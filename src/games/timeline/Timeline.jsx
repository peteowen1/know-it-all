import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, RotateCcw, Shuffle } from 'lucide-react';
import data from '../../data/timeline.json';
import { buildRound, scoreOrder } from './timelineLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';
import { Chip, SetupRow } from '../geo/CountryQuiz';

const KIND_ICON = { music: '🎵', film: '🎬', oscars: '🏆', tv: '📺', leaders: '🏛️', people: '👶' };

/**
 * Timeline: put five events in order, oldest at the top. Scored on how many of
 * the ten pairs are the right way round, so a near-miss still scores.
 */
export default function Timeline({ stats, onRoundComplete, onExit }) {
  const [difficulty, setDifficulty] = useState('easy');
  const [round, setRound] = useState(null);
  const entry = gameEntry(stats, 'timeline');

  const start = (daily) => {
    const seed = daily ? `${localDateKey()}:${difficulty}` : `${Date.now()}`;
    setRound({ daily, order: buildRound(data.events, { difficulty, seed }), checked: false });
  };

  if (!round) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Timeline</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          Five events. Put them in order, oldest at the top. Every pair you have the right way round scores.
          {entry.plays ? ` ${entry.plays} played · best ${entry.bestPct}%.` : ''}
        </p>
        <SetupRow label="Difficulty">
          <Chip active={difficulty === 'easy'} onClick={() => setDifficulty('easy')}>Easy: years well apart</Chip>
          <Chip active={difficulty === 'hard'} onClick={() => setDifficulty('hard')}>Hard: all within 12 years</Chip>
        </SetupRow>
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={() => start(true)}><CalendarDays size={18} /> Today's timeline</button>
          <button className="btn btn-ghost" onClick={() => start(false)}><Shuffle size={18} /> Random</button>
        </div>
        <p className="game-record small">
          {data.events.length} events: number-one songs and films, Best Picture and Emmy winners, leaders taking
          office, and famous births.
        </p>
      </div>
    );
  }

  const { order, checked } = round;
  const move = (i, d) => {
    const j = i + d;
    if (checked || j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setRound({ ...round, order: next });
  };
  const check = () => {
    const s = scoreOrder(order);
    setRound({ ...round, checked: true, score: s });
    onRoundComplete('timeline', { score: s.correct, total: s.total, answers: [] });
  };
  const truth = [...order].sort((a, b) => a.year - b.year);

  return (
    <div className="card names-game">
      <div className="progress-text">
        <span className="names-title">{round.daily ? "Today's timeline" : 'Timeline'}</span>
        <span className="score-pill">{checked ? `${round.score.correct}/${round.score.total} pairs` : 'Oldest at the top'}</span>
      </div>

      {/* Direction labels on the list itself: a note in the corner was missed,
          and a fully reversed order scores 1 of 10 with no clue why. */}
      <div className="tl-end">▲ Oldest</div>
      <ol className="tl-list">
        {order.map((e, i) => {
          const right = checked && truth[i] === e;
          return (
            <li key={e.text} className={`tl-card ${checked ? (right ? 'got' : 'missed') : ''}`}>
              <span className="tl-icon" aria-hidden="true">{KIND_ICON[e.kind]}</span>
              <span className="tl-text">
                {e.text}
                {checked && <strong className="tl-year">{e.year}</strong>}
              </span>
              {!checked && (
                <span className="tl-moves">
                  <button className="btn btn-ghost tl-move" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier"><ArrowUp size={16} /></button>
                  <button className="btn btn-ghost tl-move" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move later"><ArrowDown size={16} /></button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="tl-end">▼ Newest</div>

      {checked && round.score.correct <= 2 && (
        <p className="names-msg meh">Looks like newest-first. Oldest goes at the top; flipped, that was {round.score.total - round.score.correct}/{round.score.total}.</p>
      )}
      {checked && round.score.correct < round.score.total && (
        <p className="game-record">
          Right order: {truth.map((e) => e.year).join(' → ')}
        </p>
      )}

      <div className="actions-bar centered">
        {!checked ? (
          <button className="btn btn-primary" onClick={check}>Check order</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={() => start(false)} autoFocus><RotateCcw size={18} /> Another</button>
            <button className="btn btn-ghost" onClick={() => setRound(null)}>Settings</button>
          </>
        )}
      </div>
    </div>
  );
}
