import React from 'react';
import { Award, Flame, Target, TrendingUp, ShieldAlert, Compass } from 'lucide-react';
import { CATEGORY_LIST, DIFFICULTIES } from '../data/categories';

const pct = (correct, total) => (total ? Math.round((correct / total) * 100) : 0);

export default function AnalyticsDashboard({ stats, bankStats, weaknessCount, seenCount, totalBank }) {
  const categoryStats = stats.categoryStats || {};
  const difficultyStats = stats.difficultyStats || {};

  const breakdown = CATEGORY_LIST.map((cat) => {
    const d = categoryStats[cat.id] || { total: 0, correct: 0 };
    return { ...cat, ...d, accuracy: pct(d.correct, d.total), bankCount: bankStats.byCategory[cat.id] || 0 };
  });

  // Only recommend a focus once there is enough data for the number to mean
  // anything — a single wrong answer is not a weakness.
  const rated = breakdown.filter((c) => c.total >= 5);
  const weakest = [...rated].sort((a, b) => a.accuracy - b.accuracy)[0];
  const strongest = [...rated].sort((a, b) => b.accuracy - a.accuracy)[0];
  const unexplored = breakdown.filter((c) => c.total === 0);

  const badges = [
    { title: 'First round', desc: 'Finish one quiz', unlocked: stats.totalQuizzes >= 1, icon: '📜' },
    { title: 'Week of it', desc: 'Seven day streak', unlocked: stats.streak >= 7, icon: '☕' },
    { title: 'Century', desc: 'Answer 100 questions', unlocked: stats.totalAnswered >= 100, icon: '💯' },
    { title: 'Half the bank', desc: `See ${Math.floor(totalBank / 2)} different questions`, unlocked: seenCount >= totalBank / 2, icon: '📚' },
    { title: 'Sharp', desc: '80% overall accuracy over 100+ questions', unlocked: stats.totalAnswered >= 100 && stats.overallAccuracy >= 80, icon: '🎯' },
    { title: 'Vault cleared', desc: 'Empty the weakness vault after missing 20+', unlocked: stats.totalAnswered >= 100 && weaknessCount === 0, icon: '🧹' }
  ];

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>Progress</h2>
        <p>Where you are strong, where you are not, and what to drill next.</p>
      </div>

      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="card-icon-bg icon-blue"><Target size={24} /></div>
          <div>
            <span className="stat-value">{stats.totalQuizzes || 0}</span>
            <span className="stat-title">Rounds completed</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="card-icon-bg icon-amber"><Flame size={24} /></div>
          <div>
            <span className="stat-value">{stats.streak || 0}</span>
            <span className="stat-title">Day streak</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="card-icon-bg icon-purple"><TrendingUp size={24} /></div>
          <div>
            <span className="stat-value">{stats.overallAccuracy || 0}%</span>
            <span className="stat-title">Overall accuracy</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="card-icon-bg icon-green"><Award size={24} /></div>
          <div>
            <span className="stat-value">{seenCount} / {totalBank}</span>
            <span className="stat-title">Bank seen</span>
          </div>
        </div>
      </div>

      {weakest && strongest && weakest.id !== strongest.id && (
        <div className="recommendation-banner">
          <ShieldAlert size={22} className="rec-icon" />
          <div>
            <h4>Drill next: {weakest.icon} {weakest.name}</h4>
            <p>
              You are on {weakest.accuracy}% there ({weakest.correct}/{weakest.total}) against{' '}
              {strongest.accuracy}% in {strongest.name}. That gap is {strongest.accuracy - weakest.accuracy}{' '}
              points — closing it is worth more than anything else you could practise.
            </p>
          </div>
        </div>
      )}

      {unexplored.length > 0 && stats.totalQuizzes > 0 && (
        <div className="recommendation-banner subtle">
          <Compass size={22} className="rec-icon" />
          <div>
            <h4>Not touched yet</h4>
            <p>
              {unexplored.map((c) => c.name).join(', ')} — no data at all. Run a focused round before
              trusting the numbers above.
            </p>
          </div>
        </div>
      )}

      <div className="category-heatmap-card">
        <h3>By category</h3>
        <div className="heatmap-bars-grid">
          {breakdown.map((cat) => (
            <div key={cat.id} className="heatmap-item">
              <div className="cat-header-label">
                <span>{cat.icon} {cat.name}</span>
                <span className="accuracy-label">
                  {cat.total > 0 ? `${cat.accuracy}% (${cat.correct}/${cat.total})` : 'no data'}
                </span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${cat.accuracy}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="category-heatmap-card">
        <h3>By difficulty</h3>
        <div className="heatmap-bars-grid">
          {DIFFICULTIES.map((d) => {
            const s = difficultyStats[d.id] || { total: 0, correct: 0 };
            const accuracy = pct(s.correct, s.total);
            return (
              <div key={d.id} className="heatmap-item">
                <div className="cat-header-label">
                  <span>{d.label} <span className="setup-note">{d.hint}</span></span>
                  <span className="accuracy-label">
                    {s.total > 0 ? `${accuracy}% (${s.correct}/${s.total})` : 'no data'}
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${accuracy}%`, backgroundColor: d.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="achievements-section">
        <h3>Milestones</h3>
        <div className="badges-grid">
          {badges.map((b) => (
            <div key={b.title} className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`}>
              <span className="badge-card-icon">{b.icon}</span>
              <div>
                <h4>{b.title}</h4>
                <p>{b.desc}</p>
                <span className="status-pill">{b.unlocked ? 'Done' : 'Not yet'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
