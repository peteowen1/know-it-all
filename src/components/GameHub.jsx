import React from 'react';
import { Check, Flame } from 'lucide-react';
import { GAMES, SECTIONS } from '../games/registry';
import { gameEntry } from '../lib/gameStats';
import { saturdayKey } from '../lib/dates';
import GameIcon from './ui/GameIcon';
import { dailyDoneToday } from '../lib/dailyDone';

// The rounds that are the same for everyone, in the order the Today row shows them.
const TODAY_TABS = ['daily', 'weekly', 'connections', 'clue-ladder', 'odd-one-out', 'who-am-i', 'missing-link', 'timeline', 'year-guess', 'pointless'];

/**
 * The home screen: every game, grouped by section. Each section sets its own
 * accent; each card shows a one-line record, formatted by the game's own
 * `recordFormat` in games/registry.js.
 */
export default function GameHub({ onOpen, gameStats, quizStats, vaultDue, weeklyScores }) {
  const ctx = { quizStats, vaultDue, weeklyScore: weeklyScores?.[saturdayKey()], gameStats };
  // Today's rounds, NYT style: every game with a round that is the same for
  // everyone, ticked once finished (lib/dailyDone.js). The Saturday paper
  // ticks for the week.
  const done = dailyDoneToday();
  const today = TODAY_TABS.map((tab) => GAMES.find((g) => g.tab === tab)).filter(Boolean);
  const isDone = (g) => (g.tab === 'weekly' ? Boolean(weeklyScores?.[saturdayKey()]) : done.has(g.tab));
  const doneCount = today.filter(isDone).length;

  return (
    <div className="game-hub">
      <section className="today-row" aria-labelledby="today-title">
        <div className="today-head">
          <h2 id="today-title">Today</h2>
          <p>{doneCount === today.length ? 'All done. Back tomorrow.' : `${doneCount} of ${today.length} done`}</p>
        </div>
        <div className="today-chips">
          {today.map((g) => (
            <button key={g.id} type="button" className="today-chip" data-done={isDone(g) || undefined} onClick={() => onOpen(g.tab)}>
              <GameIcon id={g.id} size={18} />
              <span>{g.tab === 'weekly' ? 'Saturday paper' : g.title}</span>
              {isDone(g) && <Check size={16} strokeWidth={2.25} aria-label="done" />}
            </button>
          ))}
        </div>
      </section>
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
