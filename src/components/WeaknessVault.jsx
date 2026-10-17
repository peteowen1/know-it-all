import React, { useMemo, useRef, useState } from 'react';
import { BookOpen, Play, AlertTriangle, X, ShieldCheck, Trash2 } from 'lucide-react';
import { getQuestion } from '../data/questionBank';
import { materialise } from '../lib/quizBuilder';
import { isDue, describeDue, formatIntervals, INTERVALS, GRADUATED_BOX } from '../lib/scheduler';
import { Button, Card, CategoryIcon, Pill } from './ui';
import { CATEGORIES } from '../data/categories';
import QuizOptions from './QuizOptions';

const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function WeaknessVault({ vault, summary, onRemove, onClearAll, onStartRevision }) {
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Seeding the shuffle off anything derived from the question itself (its id,
  // or that id's length) is constant, so it would reshuffle to the same order
  // every visit and the vault could be beaten by remembering a position.
  const [visit, setVisit] = useState(0);
  const paneRef = useRef(null);

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
      <Card className="vault-empty quiz-screen" data-section="weekend">
        <ShieldCheck size={40} strokeWidth={1.75} className="vault-empty-icon" aria-hidden="true" />
        <h2>Nothing in the vault</h2>
        <p>Questions you get wrong land here automatically, with their explanations.</p>
        <p className="vault-empty-sub">
          They then come back after {formatIntervals(INTERVALS)}. Clear all {GRADUATED_BOX} stages and the
          question leaves for good.
        </p>
      </Card>
    );
  }

  const pick = (row) => {
    setActiveId(row.entry.id);
    setVisit((v) => v + 1);
    setSelected(null);
    setAnswered(false);
    // On a phone the practice pane sits below the list; bring it into view.
    if (window.matchMedia('(max-width: 719px)').matches) {
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => paneRef.current?.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' }));
    }
  };

  return (
    <div className="vault quiz-screen quiz-screen--wide" data-section="weekend">
      <div className="vault-header">
        <div className="screen-head">
          <h2>Weakness vault</h2>
          <p>
            {summary.due > 0 ? (
              <>
                <strong>{summary.due} due now</strong> of {summary.total} tracked.
              </>
            ) : (
              <>
                Nothing due today. {summary.total} tracked, next one {describeDue({ due: summary.nextDue })}.
              </>
            )}
            {summary.struggling > 0 && ` ${summary.struggling} you have now missed more than once.`}
          </p>
        </div>
        <div className="vault-header-actions">
          <Button variant="primary" onClick={() => onStartRevision()} disabled={!summary.due}>
            <Play size={16} aria-hidden="true" /> Drill {summary.due} due
          </Button>
          <Button variant="secondary" onClick={() => onStartRevision({ all: true })}>
            Drill all {summary.total}
          </Button>
          {!confirmClear && (
            <Button variant="tertiary" onClick={() => setConfirmClear(true)}>
              <Trash2 size={16} aria-hidden="true" /> Clear vault
            </Button>
          )}
        </div>
      </div>

      {confirmClear && (
        <div className="vault-confirm" role="alertdialog" aria-label="Clear the vault">
          <p>Clear all {summary.total} tracked questions? This cannot be undone.</p>
          <div className="vault-confirm-btns">
            <Button variant="danger" onClick={() => { onClearAll(); setConfirmClear(false); setActiveId(null); }}>
              Yes, clear the vault
            </Button>
            <Button variant="tertiary" onClick={() => setConfirmClear(false)}>Keep it</Button>
          </div>
        </div>
      )}

      <div className="vault-split-layout">
        <ul className="vault-list" aria-label="Questions in the vault">
          {rows.map(({ entry, question }) => {
            const due = isDue(entry);
            const isActive = activeId === entry.id;
            const cat = CATEGORIES[question.category];
            return (
              <li key={entry.id} className="vault-item" data-active={isActive} data-due={due}>
                <button
                  type="button"
                  className="vault-item-main"
                  aria-pressed={isActive}
                  onClick={() => pick({ entry, question })}
                >
                  <span className="vault-item-cat eyebrow">
                    <CategoryIcon id={question.category} size={14} aria-hidden="true" /> {cat?.short || cat?.name || 'General'}
                  </span>
                  <span className="vault-item-title">{question.question}</span>
                  <span className="vault-item-meta">
                    <Pill variant={due ? 'accent' : 'neutral'} icon="Clock">{describeDue(entry)}</Pill>
                    <span
                      className="stage-dots"
                      role="img"
                      aria-label={`Stage ${entry.box + 1} of ${GRADUATED_BOX}`}
                      title={`Stage ${entry.box + 1} of ${GRADUATED_BOX}`}
                    >
                      {Array.from({ length: GRADUATED_BOX }, (_, i) => (
                        <span key={i} className="stage-dot" data-on={i < entry.box} />
                      ))}
                    </span>
                    {entry.lapses >= 2 && (
                      <Pill variant="wrong" title={`Missed ${entry.lapses} times`}>
                        <AlertTriangle size={12} aria-hidden="true" /> {entry.lapses}
                        <span className="visually-hidden"> misses</span>
                      </Pill>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="vault-remove"
                  aria-label="Remove from vault"
                  title="Remove from vault"
                  onClick={() => {
                    onRemove(entry.id);
                    if (activeId === entry.id) setActiveId(null);
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="vault-practice-pane" ref={paneRef}>
          {active ? (
            <Card className="vault-practice">
              <div className="vault-practice-meta">
                <Pill>{capitalise(active.difficulty)}</Pill>
                <span className="vault-practice-stage">
                  Stage {active.entry.box + 1} of {GRADUATED_BOX}, back after{' '}
                  {INTERVALS[Math.min(active.entry.box, INTERVALS.length - 1)]} days
                </span>
              </div>
              <h3 className="question-text">{active.question}</h3>

              <QuizOptions
                options={active.options}
                correctIndex={active.correctIndex}
                selected={selected}
                answered={answered}
                onSelect={(idx) => { setSelected(idx); setAnswered(true); }}
              />

              {answered && (
                <div className="explain">
                  <span className="eyebrow">Why</span>
                  <p className="explain-text">{active.explanation}</p>
                  <p className="tip"><strong>Remember it:</strong> {active.hook}</p>
                  <p className="vault-practice-note">
                    Practising here does not advance the schedule. Only the drill rounds do, so
                    that the intervals keep meaning something.
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <div className="vault-prompt">
              <BookOpen size={40} strokeWidth={1.75} aria-hidden="true" />
              <h3>Pick a question to look at</h3>
              <p>Or run a drill round, which is what actually moves questions along the schedule.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
