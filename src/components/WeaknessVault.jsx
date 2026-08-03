import React, { useMemo, useState } from 'react';
import { Trash2, BookOpen, Play } from 'lucide-react';
import { CATEGORIES } from '../data/categories';
import { materialise } from '../lib/quizBuilder';

export default function WeaknessVault({ missedQuestions, onRemove, onClearAll, onStartRevision }) {
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);

  // Options are re-shuffled with a fresh seed each visit, so drilling the vault
  // can't be passed by memorising "it was the third one".
  const active = useMemo(() => {
    const q = missedQuestions.find((m) => m.id === activeId);
    return q ? materialise(q, activeId?.length ?? 1) : null;
  }, [activeId, missedQuestions]);

  if (!missedQuestions?.length) {
    return (
      <div className="empty-vault-card">
        <span className="empty-icon">🎉</span>
        <h2>Nothing in the vault</h2>
        <p>Questions you get wrong land here automatically, with their explanations.</p>
        <p className="empty-sub">Play a round and anything you miss will be waiting to be drilled.</p>
      </div>
    );
  }

  const byCategory = missedQuestions.reduce((acc, q) => {
    acc[q.category] = (acc[q.category] || 0) + 1;
    return acc;
  }, {});
  const worst = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

  const pick = (q) => {
    setActiveId(q.id);
    setSelected(null);
    setAnswered(false);
  };

  return (
    <div className="weakness-vault-container">
      <div className="vault-header">
        <div>
          <h2>Weakness vault</h2>
          <p>
            {missedQuestions.length} question{missedQuestions.length === 1 ? '' : 's'} you have
            missed
            {worst && ` — most of them in ${CATEGORIES[worst[0]]?.name ?? worst[0]}`}. Get one right
            here and it leaves the list.
          </p>
        </div>
        <div className="vault-header-actions">
          <button className="btn btn-primary" onClick={onStartRevision}>
            <Play size={16} /> Drill all {missedQuestions.length}
          </button>
          <button className="btn btn-outline-danger" onClick={onClearAll}>
            <Trash2 size={16} /> Clear
          </button>
        </div>
      </div>

      <div className="vault-split-layout">
        <div className="missed-questions-list">
          {missedQuestions.map((q) => {
            const cat = CATEGORIES[q.category] || { name: 'General', icon: '❓' };
            return (
              <div
                key={q.id}
                className={`missed-q-item ${activeId === q.id ? 'active' : ''}`}
                onClick={() => pick(q)}
              >
                <div className="missed-q-top">
                  <span className="cat-badge">{cat.icon} {cat.short || cat.name}</span>
                  <button
                    className="remove-q-btn"
                    title="Remove from vault"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(q.id);
                      if (activeId === q.id) setActiveId(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <p className="missed-q-title">{q.question}</p>
              </div>
            );
          })}
        </div>

        <div className="vault-practice-pane">
          {active ? (
            <div className="vault-practice-card">
              <span className={`diff-pill ${active.difficulty}`}>{active.difficulty}</span>
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
                  {selected === active.correctIndex && (
                    <div className="mastered-action">
                      <p className="success-msg">Correct — that one is done.</p>
                      <button
                        className="btn btn-success"
                        onClick={() => { onRemove(active.id); setActiveId(null); }}
                      >
                        Remove from vault
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="select-prompt-card">
              <BookOpen size={40} className="icon-muted" />
              <h3>Pick a question to drill</h3>
              <p>Or hit "Drill all" to run every missed question as a quiz.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
