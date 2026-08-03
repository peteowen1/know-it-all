import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  HelpCircle, CheckCircle2, XCircle, ArrowRight, RotateCcw, Clock, Eye,
  Check, X, ChevronDown, ChevronUp, List, Layers, Scissors, Brain
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES } from '../data/categories';

const GRADES = [
  { min: 92, title: 'Quizmaster', badge: '🏆', note: 'You would win the pub.' },
  { min: 76, title: 'Saturday Scholar', badge: '🥇', note: 'Comfortably above the room.' },
  { min: 60, title: 'Coffee & Paper Regular', badge: '🥈', note: 'Respectable. The hard ones are where the gap is.' },
  { min: 40, title: 'Getting There', badge: '🥉', note: 'Work the weak categories and this moves fast.' },
  { min: 0, title: 'Warming Up', badge: '📖', note: 'Read the explanations — that is where the gains are.' }
];

const gradeFor = (pct) => GRADES.find((g) => pct >= g.min);

const catOf = (q) =>
  CATEGORIES[q?.category] || { name: 'General', icon: '❓', color: '#6b7280', short: 'General' };

export default function QuizSimulator({
  questions,
  title = null,
  subtitle = null,
  onComplete,
  onMissed,
  onCorrect,
  onNewQuiz
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const [mode, setMode] = useState('multiple_choice');
  const [revealed, setRevealed] = useState(false);
  const [eliminated, setEliminated] = useState([]);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(false);

  const [reviewFilter, setReviewFilter] = useState('all');
  const [viewStyle, setViewStyle] = useState('compact');
  const [expanded, setExpanded] = useState({});

  const [seconds, setSeconds] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (finished) return undefined;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [finished]);

  const current = questions[index];
  const category = catOf(current);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const recordAnswer = (question, chosenIndex, isCorrect) => {
    setAnswers((prev) => [
      ...prev,
      {
        id: question.id,
        category: question.category,
        difficulty: question.difficulty,
        chosenIndex,
        correctIndex: question.correctIndex,
        isCorrect
      }
    ]);
    if (isCorrect) {
      setScore((s) => s + 1);
      onCorrect?.(question.id);
    } else {
      onMissed?.(question);
    }
  };

  const handleSelect = (idx) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    recordAnswer(current, idx, idx === current.correctIndex);
  };

  const handleSelfGrade = (gotIt) => {
    setRevealed(true);
    setAnswered(true);
    recordAnswer(current, gotIt ? current.correctIndex : -1, gotIt);
  };

  // A real aid rather than a spoiler: removes two wrong options. The old build
  // showed the memory hook as a "hint", which usually contains the answer.
  const useFiftyFifty = () => {
    if (usedFiftyFifty || answered) return;
    const wrong = current.options
      .map((_, i) => i)
      .filter((i) => i !== current.correctIndex)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    setEliminated(wrong);
    setUsedFiftyFifty(true);
  };

  const next = () => {
    if (index < questions.length - 1) {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      setRevealed(false);
      setEliminated([]);
      setUsedFiftyFifty(false);
      return;
    }
    setFinished(true);
  };

  // Report once, after the final answer is in state.
  useEffect(() => {
    if (!finished || completedRef.current) return;
    completedRef.current = true;
    onComplete?.({
      score,
      total: questions.length,
      answers,
      questionIds: questions.map((q) => q.id)
    });
    if (score / questions.length >= 0.75) {
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
    }
  }, [finished, score, answers, questions, onComplete]);

  const reviewRows = useMemo(
    () =>
      questions
        .map((q, i) => ({ q, i, a: answers.find((x) => x.id === q.id) || {} }))
        .filter(({ a }) => {
          if (reviewFilter === 'missed') return a.isCorrect === false;
          if (reviewFilter === 'correct') return a.isCorrect === true;
          return true;
        }),
    [questions, answers, reviewFilter]
  );

  if (!questions?.length) {
    return (
      <div className="card empty-state">
        <h3>No questions match those filters</h3>
        <p>Widen the category or difficulty selection and start again.</p>
      </div>
    );
  }

  // ------------------------------------------------------------- results
  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const grade = gradeFor(pct);
    const missedCount = questions.length - score;

    const perCategory = {};
    for (const a of answers) {
      const c = (perCategory[a.category] ||= { total: 0, correct: 0 });
      c.total++;
      if (a.isCorrect) c.correct++;
    }
    const weakest = Object.entries(perCategory)
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0];

    const allExpanded =
      Object.keys(expanded).length === questions.length && Object.values(expanded).every(Boolean);

    return (
      <div className="quiz-finished-card">
        <div className="finish-header">
          <span className="badge-icon">{grade.badge}</span>
          <h2>{score} out of {questions.length}</h2>
          <p className="finish-subtitle">{grade.title} — {grade.note}</p>
        </div>

        <div className="score-summary-grid">
          <div className="summary-box">
            <span className="box-val">{pct}%</span>
            <span className="box-label">Accuracy</span>
          </div>
          <div className="summary-box">
            <span className="box-val">{formatTime(seconds)}</span>
            <span className="box-label">Time taken</span>
          </div>
          <div className="summary-box">
            <span className="box-val">{formatTime(Math.round(seconds / questions.length))}</span>
            <span className="box-label">Per question</span>
          </div>
          <div className="summary-box">
            <span className="box-val">{missedCount}</span>
            <span className="box-label">Added to vault</span>
          </div>
        </div>

        {weakest && (
          <div className="recommendation-banner">
            <Brain size={20} className="rec-icon" />
            <div>
              <h4>Weakest category this round: {catOf({ category: weakest[0] }).name}</h4>
              <p>
                {weakest[1].correct} of {weakest[1].total} correct. Run a focused round on that
                category — it is the fastest way to move the total.
              </p>
            </div>
          </div>
        )}

        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={onNewQuiz}>
            <RotateCcw size={18} /> New quiz
          </button>
        </div>

        <div className="review-section">
          <div className="review-header">
            <div className="review-title-row">
              <div>
                <h3><HelpCircle size={20} /> Answer sheet</h3>
                <p className="review-subtitle">
                  Every question with its explanation and memory hook. This is the part that
                  actually improves your score.
                </p>
              </div>
              <div className="view-style-toggle">
                <button
                  className={`view-btn ${viewStyle === 'compact' ? 'active' : ''}`}
                  onClick={() => setViewStyle('compact')}
                >
                  <List size={16} /> Compact
                </button>
                <button
                  className={`view-btn ${viewStyle === 'detailed' ? 'active' : ''}`}
                  onClick={() => setViewStyle('detailed')}
                >
                  <Layers size={16} /> Detailed
                </button>
              </div>
            </div>

            <div className="review-controls-bar">
              <div className="review-filter-bar">
                {[
                  ['all', `All (${questions.length})`],
                  ['missed', `Missed (${missedCount})`],
                  ['correct', `Correct (${score})`]
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`filter-chip ${reviewFilter === key ? 'active' : ''}`}
                    onClick={() => setReviewFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="btn-text-toggle"
                onClick={() => {
                  const nextState = {};
                  questions.forEach((_, i) => { nextState[i] = !allExpanded; });
                  setExpanded(nextState);
                }}
              >
                {allExpanded ? 'Collapse all' : 'Expand all'}
              </button>
            </div>
          </div>

          <div className={`review-list ${viewStyle}`}>
            {reviewRows.length === 0 ? (
              <div className="empty-review-msg">Nothing matches that filter.</div>
            ) : (
              reviewRows.map(({ q, i, a }) => {
                const c = catOf(q);
                const correct = a.isCorrect === true;
                const isOpen = !!expanded[i];

                if (viewStyle === 'compact') {
                  return (
                    <div key={q.id} className={`compact-review-row ${correct ? 'row-correct' : 'row-incorrect'}`}>
                      <div className="compact-row-main" onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}>
                        <div className="compact-left">
                          <span className="q-badge-sm">Q{i + 1}</span>
                          <span className="cat-icon-sm" title={c.name}>{c.icon}</span>
                          <span className="compact-q-text">{q.question}</span>
                        </div>
                        <div className="compact-right">
                          {!correct && a.chosenIndex >= 0 && (
                            <span className="ans-pill-compact pill-wrong" title="Your answer">
                              <X size={14} /> {q.options[a.chosenIndex]}
                            </span>
                          )}
                          <span className="ans-pill-compact pill-right" title="Correct answer">
                            <Check size={14} /> {q.answer}
                          </span>
                          <button className="expand-chevron-btn" aria-label="Toggle explanation">
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="compact-exp-drawer">
                          <p className="exp-text">{q.explanation}</p>
                          <div className="tip-box-sm"><strong>Remember it:</strong> {q.hook}</div>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={q.id} className={`review-card ${correct ? 'correct-card' : 'incorrect-card'}`}>
                    <div className="review-card-top">
                      <div className="review-card-meta">
                        <span className="q-num-badge">Q{i + 1}</span>
                        <span
                          className="category-pill"
                          style={{ backgroundColor: `${c.color}22`, color: c.color, borderColor: `${c.color}44` }}
                        >
                          <span>{c.icon}</span> {c.name}
                        </span>
                        <span className={`diff-pill ${q.difficulty}`}>{q.difficulty}</span>
                      </div>
                      <span className={`status-tag ${correct ? 'tag-correct' : 'tag-incorrect'}`}>
                        {correct ? <><Check size={14} /> Correct</> : <><X size={14} /> Missed</>}
                      </span>
                    </div>

                    <h4 className="review-question-text">{q.question}</h4>

                    <div className="review-answers-grid">
                      {q.options.map((opt, oi) => {
                        let cls = 'review-opt-normal';
                        if (oi === q.correctIndex) cls = 'review-opt-correct';
                        else if (oi === a.chosenIndex && !correct) cls = 'review-opt-wrong';
                        return (
                          <div key={oi} className={`review-opt-pill ${cls}`}>
                            <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
                            <span className="opt-text">{opt}</span>
                            {oi === q.correctIndex && <CheckCircle2 size={16} className="icon-right" />}
                            {oi === a.chosenIndex && !correct && <XCircle size={16} className="icon-wrong" />}
                          </div>
                        );
                      })}
                    </div>

                    <div className="review-explanation-box">
                      <p className="exp-text">{q.explanation}</p>
                      <div className="tip-box"><strong>Remember it:</strong> {q.hook}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- question
  return (
    <div className="quiz-simulator">
      {title && (
        <div className="quiz-intro">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}

      <div className="quiz-top-bar">
        <div className="progress-container">
          <div className="progress-text">
            <span>Question {index + 1} of {questions.length}</span>
            <span className="score-pill">Score {score}</span>
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'multiple_choice' ? 'active' : ''}`}
            onClick={() => setMode('multiple_choice')}
            title="Four options, pick one"
          >
            Multiple choice
          </button>
          <button
            className={`mode-btn ${mode === 'recall' ? 'active' : ''}`}
            onClick={() => setMode('recall')}
            title="No options — answer in your head, then reveal"
          >
            Recall
          </button>
          <div className="timer-badge">
            <Clock size={16} />
            <span>{formatTime(seconds)}</span>
          </div>
        </div>
      </div>

      <div className="question-card">
        <div className="question-header">
          <span
            className="category-pill"
            style={{ backgroundColor: `${category.color}22`, color: category.color, borderColor: `${category.color}44` }}
          >
            <span className="cat-icon">{category.icon}</span> {category.name}
          </span>
          <span className={`diff-pill ${current.difficulty}`}>{current.difficulty}</span>
        </div>

        <h2 className="question-text">{current.question}</h2>

        {mode === 'multiple_choice' && (
          <>
            <div className="options-grid">
              {current.options.map((opt, idx) => {
                const isGone = eliminated.includes(idx);
                let state = '';
                if (answered) {
                  if (idx === current.correctIndex) state = 'correct';
                  else if (idx === selected) state = 'incorrect';
                  else state = 'disabled';
                } else if (isGone) {
                  state = 'eliminated';
                }
                return (
                  <button
                    key={idx}
                    className={`option-btn ${state} ${selected === idx ? 'selected' : ''}`}
                    onClick={() => handleSelect(idx)}
                    disabled={answered || isGone}
                  >
                    <span className="option-prefix">{String.fromCharCode(65 + idx)}</span>
                    <span className="option-label">{opt}</span>
                    {answered && idx === current.correctIndex && <CheckCircle2 className="icon-right" size={20} />}
                    {answered && idx === selected && idx !== current.correctIndex && (
                      <XCircle className="icon-wrong" size={20} />
                    )}
                  </button>
                );
              })}
            </div>

            {!answered && (
              <div className="hint-section">
                <button className="hint-btn" onClick={useFiftyFifty} disabled={usedFiftyFifty}>
                  <Scissors size={16} />
                  {usedFiftyFifty ? 'Two options removed' : 'Fifty-fifty (remove two wrong answers)'}
                </button>
              </div>
            )}
          </>
        )}

        {mode === 'recall' && (
          <div className="newspaper-reveal-box">
            {!revealed ? (
              <div className="reveal-prompt">
                <p>Answer it in your head first, the way you would reading the paper. No options.</p>
                <button className="btn btn-secondary" onClick={() => setRevealed(true)}>
                  <Eye size={18} /> Reveal answer
                </button>
              </div>
            ) : (
              <div className="revealed-content">
                <div className="answer-highlight">
                  <span className="ans-label">Answer</span>
                  <span className="ans-val">{current.answer}</span>
                </div>
                {!answered && (
                  <div className="self-grading-buttons">
                    <p>Did you get it?</p>
                    <div className="grade-btns">
                      <button className="btn btn-success" onClick={() => handleSelfGrade(true)}>
                        <CheckCircle2 size={18} /> Got it
                      </button>
                      <button className="btn btn-danger" onClick={() => handleSelfGrade(false)}>
                        <XCircle size={18} /> Missed it
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {answered && (
          <div className="explanation-card">
            <h3><HelpCircle size={18} /> Why</h3>
            <p className="explanation-text">{current.explanation}</p>
            <div className="tip-box"><strong>Remember it:</strong> {current.hook}</div>
          </div>
        )}

        {answered && (
          <div className="next-action-bar">
            <button className="btn btn-primary next-btn" onClick={next}>
              <span>{index < questions.length - 1 ? 'Next question' : 'See results'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
