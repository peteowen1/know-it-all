import React from 'react';
import AccountButton from './AccountButton';
import { getEmail } from '../lib/sync';
import { Home, Newspaper, BookOpen, Award, Flame, RotateCcw, Sparkles, Layers, Database, Target, BarChart3 } from 'lucide-react';

const TABS = [
  { id: 'home', label: 'Games', icon: Home },
  { id: 'weekly', label: 'Saturday paper', icon: Newspaper },
  { id: 'quiz', label: 'Weekend quiz', icon: BookOpen },
  { id: 'daily', label: 'Daily five', icon: Sparkles },
  { id: 'flashcards', label: 'Decks', icon: Layers },
  { id: 'vault', label: 'Vault', icon: Target },
  { id: 'analytics', label: 'Progress', icon: BarChart3 }
];

export default function Header({ onHome, activeTab, setActiveTab, stats, bankSize, weaknessCount, onReset }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <button className="brand-title brand-home" onClick={onHome} title="Home">
          <div className="brand-logo"><span className="logo-icon">🧠</span></div>
          <div>
            <div className="tagline">Trivia, drilled until it sticks</div>
            <h1>Know-It-All</h1>
          </div>
        </button>

        <div className="header-stats">
          <AccountButton />
          <div className="stat-badge bank">
            <Database className="icon-bank" size={18} />
            <span>{bankSize}+ questions</span>
          </div>
          <div className="stat-badge streak">
            <Flame className="icon-flame" size={18} />
            <span>{stats.streak || 0} day streak</span>
          </div>
          <div className="stat-badge score">
            <Award className="icon-award" size={18} />
            <span>{stats.overallAccuracy || 0}% accuracy</span>
          </div>
          <button
            className="stat-badge reset-cache-btn"
            title="Clear all local progress and start fresh"
            onClick={() => {
              // Signed in, a reset syncs like any other change, so say so.
              const where = getEmail() ? 'on every device signed in to this account' : 'on this device';
              if (window.confirm(`Clear all saved progress ${where}? This cannot be undone.`)) {
                onReset();
              }
            }}
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <nav className="nav-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab-btn ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === 'vault' && weaknessCount > 0 && <span className="tab-count">{weaknessCount}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}
