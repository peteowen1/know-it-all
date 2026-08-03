import React, { useState } from 'react';
import { Play, SlidersHorizontal } from 'lucide-react';
import { CATEGORY_LIST, DIFFICULTIES } from '../data/categories';

const LENGTHS = [10, 25, 50];

export default function QuizSetup({ setup, onStart, bankStats }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(setup);

  const selectedCats = draft.categories === 'all' ? [] : [].concat(draft.categories);

  const toggleCategory = (id) => {
    const next = selectedCats.includes(id)
      ? selectedCats.filter((c) => c !== id)
      : [...selectedCats, id];
    setDraft({ ...draft, categories: next.length ? next : 'all' });
  };

  // How many questions the current filters actually leave available, so the
  // user isn't silently given a shorter quiz than they asked for.
  const available =
    draft.categories === 'all'
      ? bankStats.total
      : selectedCats.reduce((n, id) => n + (bankStats.byCategory[id] || 0), 0);

  const summary = [
    `${draft.count} questions`,
    draft.categories === 'all' ? 'all categories' : `${selectedCats.length} categories`,
    draft.difficulty === 'all' ? 'mixed difficulty' : draft.difficulty
  ].join(' · ');

  return (
    <section className="quiz-setup">
      <div className="setup-summary-row">
        <div>
          <span className="setup-label">Current round</span>
          <strong className="setup-summary">{summary}</strong>
        </div>
        <div className="setup-actions">
          <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>
            <SlidersHorizontal size={16} /> {open ? 'Hide options' : 'Change'}
          </button>
          <button className="btn btn-primary" onClick={() => onStart(draft)}>
            <Play size={16} /> Start new round
          </button>
        </div>
      </div>

      {open && (
        <div className="setup-panel">
          <div className="setup-group">
            <span className="setup-group-label">Length</span>
            <div className="chip-row">
              {LENGTHS.map((n) => (
                <button
                  key={n}
                  className={`filter-chip ${draft.count === n ? 'active' : ''}`}
                  onClick={() => setDraft({ ...draft, count: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-group">
            <span className="setup-group-label">Difficulty</span>
            <div className="chip-row">
              <button
                className={`filter-chip ${draft.difficulty === 'all' ? 'active' : ''}`}
                onClick={() => setDraft({ ...draft, difficulty: 'all' })}
              >
                Mixed (ramps up)
              </button>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  className={`filter-chip ${draft.difficulty === d.id ? 'active' : ''}`}
                  onClick={() => setDraft({ ...draft, difficulty: d.id })}
                  title={d.hint}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-group">
            <span className="setup-group-label">
              Categories
              <span className="setup-note">
                {draft.categories === 'all'
                  ? 'All eight, evenly spread'
                  : `${available} questions available`}
              </span>
            </span>
            <div className="chip-row wrap">
              <button
                className={`filter-chip ${draft.categories === 'all' ? 'active' : ''}`}
                onClick={() => setDraft({ ...draft, categories: 'all' })}
              >
                🌟 All eight
              </button>
              {CATEGORY_LIST.map((c) => (
                <button
                  key={c.id}
                  className={`filter-chip ${selectedCats.includes(c.id) ? 'active' : ''}`}
                  onClick={() => toggleCategory(c.id)}
                  title={c.blurb}
                >
                  {c.icon} {c.short}
                </button>
              ))}
            </div>
          </div>

          {draft.count > available && (
            <p className="setup-warning">
              Only {available} questions match these filters, so the round will be {available} long.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
