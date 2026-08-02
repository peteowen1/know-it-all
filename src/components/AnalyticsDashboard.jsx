import React from 'react';
import { CATEGORIES } from '../data/questionsData';
import { Award, Flame, Target, TrendingUp, CheckCircle, Lightbulb, ShieldAlert } from 'lucide-react';

export default function AnalyticsDashboard({ stats }) {
  const categoryStats = stats.categoryStats || {};

  // Compute category accuracy
  const categoryBreakdown = Object.keys(CATEGORIES).map(catKey => {
    const cat = CATEGORIES[catKey];
    const catData = categoryStats[cat.id] || { total: 0, correct: 0 };
    const accuracy = catData.total > 0 ? Math.round((catData.correct / catData.total) * 100) : 0;
    return {
      ...cat,
      total: catData.total,
      correct: catData.correct,
      accuracy
    };
  });

  // Sort categories by lowest accuracy to give recommendation
  const weakestCat = [...categoryBreakdown]
    .filter(c => c.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  const badges = [
    { title: 'First Quiz', desc: 'Completed 1 full quiz', unlocked: stats.totalQuizzes >= 1, icon: '📜' },
    { title: 'Saturday Coffee', desc: '3 Day Quiz Streak', unlocked: stats.streak >= 3, icon: '☕' },
    { title: 'High Scorer', desc: 'Scored 20+ out of 25', unlocked: stats.highScore >= 20, icon: '🥇' },
    { title: 'Perfect 25', desc: 'Achieved 25/25 perfection', unlocked: stats.highScore === 25, icon: '🏆' },
    { title: 'Trivia Centurion', desc: 'Answered 100+ questions', unlocked: stats.totalAnswered >= 100, icon: '💯' }
  ];

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>📊 Performance Analytics & Category Heatmap</h2>
        <p>Track your strengths, identify blind spots, and monitor your quiz mastery over time.</p>
      </div>

      {/* Overview Cards */}
      <div className="stats-cards-grid">
        <div className="stat-card">
          <div className="card-icon-bg icon-blue"><Target size={24} /></div>
          <div>
            <span className="stat-value">{stats.totalQuizzes || 0}</span>
            <span className="stat-title">Quizzes Completed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="card-icon-bg icon-amber"><Flame size={24} /></div>
          <div>
            <span className="stat-value">{stats.streak || 0} Days</span>
            <span className="stat-title">Current Streak</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="card-icon-bg icon-green"><Award size={24} /></div>
          <div>
            <span className="stat-value">{stats.highScore || 0} / 25</span>
            <span className="stat-title">Personal Best</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="card-icon-bg icon-purple"><TrendingUp size={24} /></div>
          <div>
            <span className="stat-value">{stats.overallAccuracy || 0}%</span>
            <span className="stat-title">Overall Accuracy</span>
          </div>
        </div>
      </div>

      {/* Weakness Alert / Recommendation */}
      {weakestCat && (
        <div className="recommendation-banner">
          <ShieldAlert size={22} className="rec-icon" />
          <div>
            <h4>Recommended Study Focus: {weakestCat.icon} {weakestCat.name}</h4>
            <p>Your accuracy in this category is <strong>{weakestCat.accuracy}%</strong> ({weakestCat.correct}/{weakestCat.total} correct). Practice flashcards in this category to bump your Saturday score!</p>
          </div>
        </div>
      )}

      {/* Category Accuracy Heatmap Bars */}
      <div className="category-heatmap-card">
        <h3>Category Accuracy Breakdown</h3>
        <div className="heatmap-bars-grid">
          {categoryBreakdown.map(cat => (
            <div key={cat.id} className="heatmap-item">
              <div className="cat-header-label">
                <span>{cat.icon} {cat.name}</span>
                <span className="accuracy-label">
                  {cat.total > 0 ? `${cat.accuracy}% (${cat.correct}/${cat.total})` : 'No data yet'}
                </span>
              </div>
              <div className="bar-track">
                <div 
                  className="bar-fill" 
                  style={{ 
                    width: `${cat.accuracy}%`,
                    backgroundColor: cat.color 
                  }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements / Trophy Case */}
      <div className="achievements-section">
        <h3>🏆 Achievements & Mastery Badges</h3>
        <div className="badges-grid">
          {badges.map((b, i) => (
            <div key={i} className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`}>
              <span className="badge-card-icon">{b.icon}</span>
              <div>
                <h4>{b.title}</h4>
                <p>{b.desc}</p>
                <span className="status-pill">{b.unlocked ? 'Unlocked' : 'Locked'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
