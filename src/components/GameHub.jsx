import React from 'react';
import { GAMES, SECTIONS } from '../games/registry';
import { gameEntry } from '../lib/gameStats';
import { saturdayKey } from '../lib/dates';

/**
 * The home screen: every game, grouped by section, with a one-line record for
 * the ones you have played. Planned games are shown greyed so the roadmap lives
 * in the app rather than in a doc nobody opens.
 */
export default function GameHub({ onOpen, gameStats, quizStats, vaultDue, weeklyScores }) {
  const thisSaturday = saturdayKey();
  const recordFor = (g) => {
    if (g.id === 'quiz') return quizStats.totalQuizzes ? `${quizStats.totalQuizzes} played · best ${quizStats.bestPercentage}%` : null;
    if (g.id === 'vault') return vaultDue ? `${vaultDue} due today` : null;
    if (g.id === 'weekly') {
      const s = weeklyScores?.[thisSaturday];
      return s ? `This week: ${s.score}/${s.total}` : 'This week\'s paper is out';
    }
    const e = gameEntry(gameStats, g.id);
    if (!e.plays) return null;
    if (g.id === 'population') return `best run ${e.bestRun}`;
    if (g.id === 'first-names') return `${e.plays} played · best ${e.best}/15`;
    if (g.id === 'year-guess') return `${e.plays} played · best ${e.best}/50`;
    return `${e.plays} played · best ${e.bestPct}%`;
  };

  return (
    <div className="game-hub">
      {SECTIONS.map((s) => (
        <section key={s.id} className="hub-section">
          <div className="hub-section-head">
            <h2>{s.title}</h2>
            <p>{s.blurb}</p>
          </div>
          <div className="hub-grid">
            {GAMES.filter((g) => g.section === s.id).map((g) => {
              const ready = g.status === 'ready';
              const record = ready && recordFor(g);
              return (
                <button
                  key={g.id}
                  className={`hub-card ${ready ? '' : 'hub-card-soon'}`}
                  onClick={() => ready && onOpen(g.tab)}
                  disabled={!ready}
                >
                  <span className="hub-icon">{g.icon}</span>
                  <span className="hub-title">{g.title}</span>
                  <span className="hub-blurb">{g.blurb}</span>
                  {ready ? record && <span className="hub-record">{record}</span> : <span className="hub-soon">Coming</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
