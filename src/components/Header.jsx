import React, { useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import AccountButton from './AccountButton';

const TABS = [
  { id: 'home', label: 'Games' },
  { id: 'weekly', label: 'Saturday paper' },
  { id: 'quiz', label: 'Weekend quiz' },
  { id: 'daily', label: 'Daily five' },
  { id: 'flashcards', label: 'Decks' },
  { id: 'vault', label: 'Vault' },
  { id: 'analytics', label: 'Progress' }
];

export default function Header({ onHome, activeTab, setActiveTab, stats, weaknessCount, onReset }) {
  const navRef = useRef(null);

  // On a phone the tab row scrolls; keep the active tab in view.
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector('[aria-current="page"]');
    if (!nav || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = left - 16;
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth + 16;
  }, [activeTab]);

  const streak = stats.streak || 0;

  return (
    <header className="app-header">
      <div className="header-top">
        <h1 className="wordmark">
          <a
            href="./"
            onClick={(e) => {
              // Let ctrl/cmd/shift-click open the site in a new tab; a plain click goes home.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onHome();
            }}
          >
            <span className="wordmark-dot" aria-hidden="true" />
            Know-It-All
          </a>
        </h1>

        <div className="header-actions">
          <span className="pill" title="Days in a row with a finished quiz">
            <Flame size={14} strokeWidth={1.75} aria-hidden="true" />
            {streak} day streak
          </span>
          <AccountButton onReset={onReset} />
        </div>
      </div>

      <nav className="nav-tabs" ref={navRef} aria-label="Sections">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className="tab-btn"
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => setActiveTab(id)}
          >
            <span>{label}</span>
            {id === 'vault' && weaknessCount > 0 && (
              <span className="tab-count" aria-label={`${weaknessCount} due`}>{weaknessCount}</span>
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}
