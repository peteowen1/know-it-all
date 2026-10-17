import React, { useState } from 'react';
import { Play, SlidersHorizontal, LayoutGrid } from 'lucide-react';
import { CATEGORY_LIST, DIFFICULTIES } from '../data/categories';
import { Button, CategoryIcon, Chip } from './ui';

const LENGTHS = [10, 25, 50];
const fmt = (n) => n.toLocaleString('en-AU');

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
      ? bankStats?.total ?? 0
      : selectedCats.reduce((n, id) => n + (bankStats?.byCategory?.[id] || 0), 0);

  const categoryCount = Object.keys(bankStats?.byCategory ?? {}).length || CATEGORY_LIST.length;

  const summary = [
    `${draft.count} questions`,
    draft.categories === 'all' ? 'all categories' : `${selectedCats.length} ${selectedCats.length === 1 ? 'category' : 'categories'}`,
    draft.difficulty === 'all' ? 'mixed difficulty' : draft.difficulty
  ].join(' · ');

  return (
    <section className="card quiz-setup quiz-screen" aria-label="Round setup">
      <div className="setup-summary-row">
        <div>
          <span className="eyebrow">Current round</span>
          <strong className="setup-summary">{summary}</strong>
        </div>
        <div className="setup-actions">
          <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <SlidersHorizontal size={16} aria-hidden="true" /> {open ? 'Hide options' : 'Change'}
          </Button>
          {/* Close the options on start: left open, the panel sat above the
              quiz and its results, pushing the score below the fold on a phone.
              It is the screen's one primary only while the options are open; the
              rest of the time the quiz below owns the primary action. */}
          <Button
            variant={open ? 'primary' : 'secondary'}
            onClick={() => { setOpen(false); onStart(draft); }}
          >
            <Play size={16} aria-hidden="true" /> Start new round
          </Button>
        </div>
      </div>

      {open && (
        <div className="setup-panel">
          <div className="setup-group">
            <span className="setup-group-label">Length</span>
            <div className="chip-row">
              {LENGTHS.map((n) => (
                <Chip key={n} active={draft.count === n} onClick={() => setDraft({ ...draft, count: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          <div className="setup-group">
            <span className="setup-group-label">Difficulty</span>
            <div className="chip-row wrap">
              <Chip active={draft.difficulty === 'all'} onClick={() => setDraft({ ...draft, difficulty: 'all' })}>
                Mixed (ramps up)
              </Chip>
              {DIFFICULTIES.map((d) => (
                <Chip
                  key={d.id}
                  active={draft.difficulty === d.id}
                  onClick={() => setDraft({ ...draft, difficulty: d.id })}
                  title={d.hint}
                >
                  {d.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="setup-group">
            <span className="setup-group-label">
              Categories
              <span className="setup-note">
                {draft.categories === 'all'
                  ? `All ${categoryCount}, evenly spread`
                  : `${fmt(available)} questions available`}
              </span>
            </span>
            <div className="chip-row wrap">
              <Chip active={draft.categories === 'all'} onClick={() => setDraft({ ...draft, categories: 'all' })}>
                <LayoutGrid size={16} aria-hidden="true" /> All categories
              </Chip>
              {CATEGORY_LIST.map((c) => (
                <Chip
                  key={c.id}
                  active={selectedCats.includes(c.id)}
                  onClick={() => toggleCategory(c.id)}
                  title={c.blurb}
                >
                  <CategoryIcon id={c.id} size={16} aria-hidden="true" /> {c.short}
                </Chip>
              ))}
            </div>
          </div>

          {draft.count > available && (
            <p className="setup-warning" role="status">
              Only {fmt(available)} questions match these filters, so the round will be {fmt(available)} long.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
