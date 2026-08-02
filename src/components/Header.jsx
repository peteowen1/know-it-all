import React from 'react';
import { BookOpen, Award, Flame, Target, RotateCcw, Brain, Sparkles, Layers, Database } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, stats, totalBankCount }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <div className="brand-title">
          <div className="brand-logo">
            <span className="logo-icon">📰</span>
          </div>
          <div>
            <div className="tagline">The Sydney Morning Herald & The Age</div>
            <h1>Good Weekend Quiz Master</h1>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-badge bank">
            <Database className="icon-bank" size={18} />
            <span>{totalBankCount || 1040} Questions in Bank</span>
          </div>
          <div className="stat-badge streak">
            <Flame className="icon-flame" size={18} />
            <span>{stats.streak || 0} Day Streak</span>
          </div>
          <div className="stat-badge score">
            <Award className="icon-award" size={18} />
            <span>Best: {stats.highScore || 0}/25</span>
          </div>
          <button 
            className="stat-badge reset-cache-btn"
            title="Reset cached state & reload fresh dataset"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{ cursor: 'pointer', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171' }}
          >
            <RotateCcw size={16} />
            <span>Reset Cache</span>
          </button>
        </div>
      </div>

      <nav className="nav-tabs">
        <button 
          className={`tab-btn ${activeTab === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          <BookOpen size={18} />
          <span>Full 25-Q Quiz</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          <Sparkles size={18} />
          <span>Daily 5-Q Mini</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'flashcards' ? 'active' : ''}`}
          onClick={() => setActiveTab('flashcards')}
        >
          <Layers size={18} />
          <span>High-Yield Decks</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          <RotateCcw size={18} />
          <span>Weakness Vault ({stats.weaknessCount || 0})</span>
        </button>

        <button 
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <Brain size={18} />
          <span>Category Stats</span>
        </button>
      </nav>
    </header>
  );
}
