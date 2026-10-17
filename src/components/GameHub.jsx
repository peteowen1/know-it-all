import React from 'react';
import { Flame } from 'lucide-react';
import { GAMES, SECTIONS } from '../games/registry';
import { gameEntry } from '../lib/gameStats';
import { saturdayKey } from '../lib/dates';
import GameIcon from './ui/GameIcon';

/**
 * The home screen: every game, grouped by section. Each section sets its own
 * accent; each card shows a one-line record, formatted by the game's own
 * `recordFormat` in games/registry.js.
 */
export default function GameHub({ onOpen, gameStats, quizStats, vaultDue, weeklyScores }) {
  const ctx = { quizStats, vaultDue, weeklyScore: weeklyScores?.[saturdayKey()] };

  return (
    <div className="game-hub">
      {/* On a phone the header has no room for the streak, so it sits here. */}
      <p className="hub-streak">
        <Flame size={16} strokeWidth={1.75} aria-hidden="true" />
        {quizStats?.streak || 0} day streak
      </p>
      {SECTIONS.map((s) => (
        <section key={s.id} className="hub-section" data-section={s.id} style={{ '--accent': s.accent }}>
          <div className="hub-section-head">
            <h2>{s.title}</h2>
            <p>{s.blurb}</p>
          </div>
          <div className="hub-grid">
            {GAMES.filter((g) => g.section === s.id).map((g) => {
              const record = g.recordFormat(gameEntry(gameStats, g.id), ctx);
              return (
                <button key={g.id} className="hub-card" onClick={() => onOpen(g.tab)}>
                  <span className="hub-icon"><GameIcon id={g.id} size={24} /></span>
                  <span className="hub-title">{g.title}</span>
                  <span className="hub-blurb">{g.blurb}</span>
                  {record && <span className="hub-record">{record}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
