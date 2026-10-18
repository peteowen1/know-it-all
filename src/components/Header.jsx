import React, { useEffect, useRef } from 'react';
import { Flame, Moon, Settings as Gear, Sun } from 'lucide-react';
import AccountButton from './AccountButton';
import { useTheme, toggleMode } from '../lib/theme';

// Four tabs, so the row fits a phone without scrolling (Pete, 2026-10-18).
// The Saturday paper, Daily five and Decks are on the games page and in its
// Today row; their addresses are unchanged. Every game screen lights Games.
const TABS = [
  { id: 'home', label: 'Games' },
  { id: 'quiz', label: 'Weekend quiz' },
  { id: 'vault', label: 'Vault' },
  { id: 'analytics', label: 'Progress' }
];
const OWN_TAB = new Set(['quiz', 'vault', 'analytics', 'settings']);
// A vault drill lights Vault, a challenge round lights Weekend quiz.
const LIGHTS = { revision: 'vault', challenge: 'quiz' };
const litTab = (tab) => LIGHTS[tab] || (OWN_TAB.has(tab) ? tab : 'home');

export default function Header({ onHome, activeTab, setActiveTab, stats, weaknessCount, onReset }) {
  const navRef = useRef(null);

  // If the tab row has to scroll (a narrow phone, a wide look), keep the
  // active tab in view.
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
  const { mode } = useTheme();
  const next = mode === 'light' ? 'dark' : 'light';

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
            <span className="wordmark-text">Know-It-All</span>
          </a>
        </h1>

        <div className="header-actions">
          <span className="pill header-streak" title="Days in a row with a finished quiz or daily round">
            <Flame size={14} strokeWidth={1.75} aria-hidden="true" />
            {streak}<span className="streak-unit"> day streak</span>
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleMode}
            aria-label={`Switch to ${next} mode`}
            title={`Switch to ${next} mode`}
          >
            {mode === 'light' ? <Moon size={18} strokeWidth={1.75} /> : <Sun size={18} strokeWidth={1.75} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setActiveTab('settings')}
            aria-label="Settings"
            title="Settings"
            aria-current={activeTab === 'settings' ? 'page' : undefined}
          >
            <Gear size={18} strokeWidth={1.75} />
          </button>
          <AccountButton onReset={onReset} />
        </div>
      </div>

      <nav className="nav-tabs" ref={navRef} aria-label="Sections">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className="tab-btn"
            aria-current={litTab(activeTab) === id ? 'page' : undefined}
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
