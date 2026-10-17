import React from 'react';
import { Check, Film, Flag, Monitor, Moon, Sun } from 'lucide-react';
import { LOOKS, setLook, setMode, useTheme } from '../lib/theme';

const MODES = [
  { id: 'light', label: 'Light', Glyph: Sun },
  { id: 'dark', label: 'Dark', Glyph: Moon },
  { id: null, label: 'Match my phone', Glyph: Monitor }
];

/**
 * Settings: per-device preferences, opened from the gear in the header.
 * For now that is appearance. Each look tile is a small live scene drawn with
 * the real component classes inside a container that carries its own
 * data-look and data-mode, so what you see is exactly what the site becomes.
 */
export default function Settings() {
  const { look, mode, followsSystem } = useTheme();

  return (
    <div className="quiz-screen quiz-screen--wide settings">
      <div className="screen-head">
        <h2>Settings</h2>
        <p>Saved on this device only. Your scores and progress are not affected.</p>
      </div>

      <h3 className="setup-group-label">Light or dark</h3>

      <div className="looks-modes chip-row wrap" role="group" aria-label="Light or dark">
        {MODES.map(({ id, label, Glyph }) => {
          const on = id === null ? followsSystem : !followsSystem && mode === id;
          return (
            <button key={label} type="button" className="filter-chip" aria-pressed={on} onClick={() => setMode(id)}>
              <Glyph size={16} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <h3 className="setup-group-label">Look</h3>
      <div className="looks-grid">
        {LOOKS.map((l) => (
          <button
            key={l.id}
            type="button"
            className="look-tile"
            aria-pressed={look === l.id}
            onClick={() => setLook(l.id)}
          >
            <div className="look-preview" data-look={l.id} data-mode={mode} aria-hidden="true">
              <div className="wordmark">
                <span className="wordmark-dot" />
                <span className="wordmark-text">Know-It-All</span>
              </div>
              <div className="hub-section-head" data-section="geo">
                <h2>Geography</h2>
              </div>
              <div className="look-preview-row">
                <div className="hub-card" data-section="geo">
                  <span className="hub-icon"><Flag size={20} strokeWidth={1.75} /></span>
                  <span className="hub-title">Flags</span>
                  <span className="hub-record">12 played · best 90%</span>
                </div>
                <div className="hub-card" data-section="pop">
                  <span className="hub-icon"><Film size={20} strokeWidth={1.75} /></span>
                  <span className="hub-title">Films by year</span>
                  <span className="hub-record">best 8 of 10</span>
                </div>
              </div>
              <div className="answer-row" data-state="got">
                <span className="answer-row-lead">B</span>
                <span className="answer-row-main">Canberra</span>
                <Check size={18} className="icon-right" />
              </div>
              <div className="look-preview-actions" data-section="weekend">
                <span className="btn btn-primary">Play today's five</span>
                <span className="pill pill-accent">3 day streak</span>
              </div>
            </div>
            <span className="look-caption">
              <span className="look-name">
                {l.name}
                {look === l.id && <span className="pill pill-accent">Wearing</span>}
              </span>
              <span className="look-blurb">{l.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
