import React, { useMemo, useState } from 'react';
import { Trash2, BookOpen, Play, Clock, AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '../data/categories';
import { getQuestion } from '../data/questionBank';
import { materialise } from '../lib/quizBuilder';
import { isDue, describeDue, INTERVALS, GRADUATED_BOX } from '../lib/scheduler';

export default function WeaknessVault({ vault, summary, onRemove, onClearAll, onStartRevision }) {
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  // Seeding the shuffle off anything derived from the question itself — its id,
  // or that id's length — is constant, so it would reshuffle to the same order
  // every visit and the vault could be beaten by remembering a position.
  const [visit, setVisit] = useState(0);

  // Due first, then by how far along the schedule they are: the questions you
  // know least well should be the ones at the top of the list.
  const rows = useMemo(
    () =>
      vault
        .map((entry) => ({ entry, question: getQuestion(entry.id) }))
        .filter((r) => r.question)
        .sort((a, b) => {
          const dueDiff = Number(isDue(b.entry)) - Number(isDue(a.entry));
          if (dueDiff) return dueDiff;
          return a.entry.box - b.entry.box || b.entry.lapses - a.entry.lapses;
        }),
    [vault]
  );

  const active = useMemo(() => {
    const row = rows.find((r) => r.entry.id === activeId);
    return row ? { ...materialise(row.question, visit), entry: row.entry } : null;
  }, [activeId, visit, rows]);

  if (!rows.length) {
    return (
      <div className="empty-vault-card">
        <span className="empty-icon">🎉</span>
        <h2>Nothing in the vault</h2>
        <p>Questions you get wrong land here automatically, with their explanations.</p>
        <p className="empty-sub">
          They then come back on a schedule — one day later, then three, then a week, then three
          weeks, then two months. Clear all five and the question leaves for good.
        </p>
      </div>
    );
  }

  const pick = (row) => {
    setActiveId(row.entry.id);
    setVisit((v) => v + 1);
    setSelected(null);
    setAnswered(false);
  };

  return (
    <div className="weakness-vault-container">
      <div className="vault-header">
        <div>
          <h2>Weakness vault</h2>
          <p>
            {summary.due > 0 ? (
              <>
                <strong>{summary.due} due now</strong> of {summary.total} tracked.
              </>
            ) : (
              <>
                Nothing due today — {summary.total} tracked, next one {describeDue({ due: summary.nextDue })}.
              </>
            )}
            {summary.struggling > 0 && ` ${summary.struggling} you have now missed more than once.`}
          </p>
        </div>
        <div className="vault-header-actions">
          <button className="btn btn-primary" onClick={() => onStartRevision()} disabled={!summary.due}>
            <Play size={16} /> Drill {summary.due} due
          </button>
          <button className="btn btn-ghost" onClick={() => onStartRevision({ all: true })}>
            Drill all {summary.total}
          </button>
          <button className="btn btn-outline-danger" onClick={onClearAll}>
            <Trash2 size={16} /> Clear
          </button>
        </div>
      </div>

      <div className="vault-split-layout">
        <div className="missed-questions-list">
          {rows.map(({ entry, question }) => {
            const cat = CATEGORIES[question.category] || { name: 'General', icon: '❓' };
            const due = isDue(entry);
            return (
              <div
                key={entry.id}
                className={`missed-q-item ${activeId === entry.id ? 'active' : ''} ${due ? 'is-due' : ''}`}
                onClick={() => pick({ entry, question })}
              >
                <div className="missed-q-top">
                  <span className="cat-badge">{cat.icon} {cat.short || cat.name}</span>
                  <button
                    className="remove-q-btn"
                    title="Remove from vault"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(entry.id);
                      if (activeId === entry.id) setActiveId(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <p className="missed-q-title">{question.question}</p>
                <div className="missed-q-meta">
                  <span className={`due-pill ${due ? 'due-now' : ''}`}>
                    <Clock size={12} /> {describeDue(entry)}
                  </span>
                  <span className="box-pill" title={`Stage ${entry.box + 1} of ${GRADUATED_BOX}`}>
                    {'●'.repeat(entry.box)}{'○'.repeat(GRADUATED_BOX - entry.box)}
                  </span>
                  {entry.lapses >= 2 && (
                    <span className="lapse-pill" title={`Missed ${entry.lapses} times`}>
                      <AlertTriangle size={12} /> {entry.lapses}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="vault-practice-pane">
          {active ? (
            <div className="vault-practice-card">
              <div className="vault-practice-meta">
                <span className={`diff-pill ${active.difficulty}`}>{active.difficulty}</span>
                <span className="setup-note">
                  Stage {active.entry.box + 1} of {GRADUATED_BOX} · next interval{' '}
                  {INTERVALS[Math.min(active.entry.box, INTERVALS.length - 1)]} days
                </span>
              </div>
              <h3>{active.question}</h3>

              <div className="options-grid">
                {active.options.map((opt, idx) => {
                  let state = '';
                  if (answered) {
                    if (idx === active.correctIndex) state = 'correct';
                    else if (idx === selected) state = 'incorrect';
                    else state = 'disabled';
                  }
                  return (
                    <button
                      key={idx}
                      className={`option-btn ${state}`}
                      onClick={() => { setSelected(idx); setAnswered(true); }}
                      disabled={answered}
                    >
                      <span className="option-prefix">{String.fromCharCode(65 + idx)}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className="vault-explanation-box">
                  <p>{active.explanation}</p>
                  <p className="tip-text"><strong>Remember it:</strong> {active.hook}</p>
                  <p className="empty-sub">
                    Practising here does not advance the schedule — only the drill rounds do, so
                    that the intervals keep meaning something.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="select-prompt-card">
              <BookOpen size={40} className="icon-muted" />
              <h3>Pick a question to look at</h3>
              <p>Or run a drill round, which is what actually moves questions along the schedule.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
