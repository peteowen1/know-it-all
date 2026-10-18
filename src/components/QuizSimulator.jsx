import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowRight, Check, X, ChevronDown, Eye, Scissors, Share2, Lightbulb } from 'lucide-react';
import { loadLive, saveLive } from '../lib/persist';
import { shuffle } from '../lib/rng';
import { CATEGORIES } from '../data/categories';
import { challengeUrl } from '../lib/transfer';
import { dailyShare } from '../lib/share';
import { localDateKey } from '../lib/dates';

// The rounds everyone gets the same: a result worth sharing.
const DAILY_SHARE = { daily: dailyShare('Daily five', 'daily'), weekly: dailyShare('Saturday paper', 'weekly') };
import { AnswerRow, Button, Chip, CategoryIcon, GameResults, MostMissed, Pill } from './ui';
import QuizOptions from './QuizOptions';
import { HowButton, HowPanel } from '../games/shared/HowItWorks';

const GRADES = [
  { min: 92, title: 'Quizmaster', note: 'You would win the pub.' },
  { min: 76, title: 'Saturday Scholar', note: 'Comfortably above the room.' },
  { min: 60, title: 'Coffee & Paper Regular', note: 'Respectable. The hard ones are where the gap is.' },
  { min: 40, title: 'Getting There', note: 'Work the weak categories and this moves fast.' },
  { min: 0, title: 'Warming Up', note: 'Read the explanations. That is where the gains are.' }
];

const gradeFor = (pct) => GRADES.find((g) => pct >= g.min);
const catName = (id) => CATEGORIES[id]?.name || 'General';
const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const capitalise = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// What the one primary button on the results card says, by kind of quiz.
const NEW_ROUND_LABEL = { weekly: 'Back to the papers', daily: 'New daily five' };

// The per-second clock lives in its own component so a tick re-renders only this
// pill, not the question card and its options. The latest value is handed up
// through onTick (kept in a ref by the parent) for saving and for the results.
function QuizTimer({ initial, onTick }) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    onTick(s);
  }, [s, onTick]);
  return (
    <Pill icon="Clock" title="Time so far">
      <span className="visually-hidden">Time so far </span>
      {formatTime(s)}
    </Pill>
  );
}

export default function QuizSimulator({
  questions,
  seed,
  title = null,
  subtitle = null,
  onComplete,
  onMissed,
  onCorrect,
  onNewQuiz,
  saveAs = null,
  saveId = null
}) {
  // Progress through this exact quiz, saved under one slot per kind of quiz
  // (`saveAs`: 'quiz', 'daily', 'weekly'...) and tagged with the quiz's seed,
  // so reopening the app resumes it and a different quiz starts fresh.
  const [saved] = useState(() => {
    if (!saveAs) return null;
    const s = loadLive(`sim_${saveAs}`);
    return s && s.id === String(saveId ?? seed) && s.count === questions.length ? s : null;
  });
  const [index, setIndex] = useState(saved?.index ?? 0);
  const [selected, setSelected] = useState(saved?.selected ?? null);
  const [answered, setAnswered] = useState(saved?.answered ?? false);
  const [answers, setAnswers] = useState(saved?.answers ?? []);
  const [score, setScore] = useState(saved?.score ?? 0);
  const [finished, setFinished] = useState(saved?.finished ?? false);

  const [mode, setMode] = useState(saved?.mode ?? 'multiple_choice');
  const [revealed, setRevealed] = useState(saved?.revealed ?? false);
  const [eliminated, setEliminated] = useState(saved?.eliminated ?? []);
  const [usedFiftyFifty, setUsedFiftyFifty] = useState(saved?.usedFiftyFifty ?? false);

  const [reviewFilter, setReviewFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  // Elapsed time is kept in a ref and ticked by <QuizTimer/>; `seconds` is only
  // set once, when the round ends, so the results can show it.
  const elapsedRef = useRef(saved?.seconds ?? 0);
  const [seconds, setSeconds] = useState(saved?.seconds ?? 0);
  const onTick = useCallback((s) => {
    elapsedRef.current = s;
  }, []);
  const [shareState, setShareState] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  // A quiz restored already finished was reported when it finished; reporting
  // it again would count it twice in the stats and streak.
  const completedRef = useRef(Boolean(saved?.finished));
  const restoredFinished = Boolean(saved?.finished);

  useEffect(() => {
    if (!saveAs) return;
    saveLive(`sim_${saveAs}`, {
      id: String(saveId ?? seed),
      count: questions.length,
      index, selected, answered, answers, score, finished, mode, revealed, eliminated, usedFiftyFifty,
      seconds: elapsedRef.current
    });
  }, [saveAs, saveId, seed, questions.length, index, selected, answered, answers, score, finished, mode, revealed, eliminated, usedFiftyFifty]);

  // Shares the paper, not the score: the recipient gets the same questions in
  // the same order with the same option positions, which is the only way two
  // scores are comparable.
  //
  // It must be THIS round's seed. Minting a fresh one here would re-shuffle the
  // recipient's options, so "the trap answer was C" would not survive the trip,
  // silently breaking the one thing the feature exists to do.
  const shareChallenge = async () => {
    const url = challengeUrl(questions, seed);
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState(null), 2500);
    } catch {
      // Clipboard is blocked without a user gesture in some browsers and over
      // plain http. Fall back to showing the link rather than failing silently.
      setShareState('failed');
    }
  };

  const current = questions[index];

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
  const removeTwoOptions = () => {
    if (usedFiftyFifty || answered) return;
    const wrong = current.options.map((_, i) => i).filter((i) => i !== current.correctIndex);
    setEliminated(shuffle(wrong).slice(0, 2));
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
    setSeconds(elapsedRef.current);
    setFinished(true);
  };

  // Report once, after the final answer is in state. (The confetti for a perfect
  // round is fired by GameResults, on demand and not under reduced motion.)
  useEffect(() => {
    if (!finished || completedRef.current) return;
    completedRef.current = true;
    onComplete?.({
      score,
      total: questions.length,
      answers,
      questionIds: questions.map((q) => q.id)
    });
  }, [finished, score, answers, questions, onComplete]);

  const answerById = useMemo(() => new Map(answers.map((a) => [a.id, a])), [answers]);

  const reviewRows = useMemo(
    () =>
      questions
        .map((q, i) => ({ q, i, a: answerById.get(q.id) || {} }))
        .filter(({ a }) => {
          if (reviewFilter === 'missed') return a.isCorrect === false;
          if (reviewFilter === 'correct') return a.isCorrect === true;
          return true;
        }),
    [questions, answerById, reviewFilter]
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
    const total = questions.length;
    const pct = Math.round((score / total) * 100);
    const grade = gradeFor(pct);
    const missedCount = total - score;

    const perCategory = {};
    for (const a of answers) {
      const c = (perCategory[a.category] ||= { total: 0, correct: 0 });
      c.total++;
      if (a.isCorrect) c.correct++;
    }
    const categoryEntries = Object.entries(perCategory);
    const weakest = categoryEntries
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0];
    const missedByCategory = categoryEntries
      .filter(([, v]) => v.correct < v.total)
      .sort((a, b) => b[1].total - b[1].correct - (a[1].total - a[1].correct))
      .slice(0, 3)
      .map(([key, v]) => ({ key, seen: v.total, correct: v.correct }));

    const allExpanded = Object.keys(expanded).length === total && Object.values(expanded).every(Boolean);
    const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    const eyebrow = `${title ?? 'Quiz round'}${saveAs === 'weekly' ? '' : ` · ${today}`}`;

    return (
      <GameResults
        data-section="weekend"
        className="quiz-results"
        eyebrow={eyebrow}
        score={score}
        total={total}
        verdict={`${grade.title}. ${grade.note}`}
        squares={questions.map((q) => answerById.get(q.id)?.isCorrect === true)}
        celebrate={score === total && !restoredFinished}
        onPlayAgain={onNewQuiz}
        playAgainLabel={NEW_ROUND_LABEL[saveAs] || 'Start new round'}
        // A Daily five saved yesterday is never restored (its seed is the date),
        // so the results on screen are always today's round.
        share={DAILY_SHARE[saveAs] && { ...DAILY_SHARE[saveAs], date: localDateKey() }}
        onChangeSettings={shareChallenge}
        settingsLabel={
          shareState === 'copied' ? (
            <><Check size={18} /> Link copied</>
          ) : (
            <><Share2 size={18} /> Challenge someone</>
          )
        }
        mostMissed={
          <MostMissed title="Missed most in" items={missedByCategory} labelOf={catName} />
        }
      >
        {shareState === 'failed' && (
          <div className="quiz-note" role="status">
            <p>Could not reach the clipboard. Here is the link to copy by hand.</p>
            <textarea className="transfer-box" readOnly rows={2} value={shareUrl} aria-label="Challenge link" onFocus={(e) => e.target.select()} />
          </div>
        )}

        <dl className="quiz-stats">
          <div><dt>Accuracy</dt><dd>{pct}%</dd></div>
          <div><dt>Time taken</dt><dd>{formatTime(seconds)}</dd></div>
          <div><dt>Per question</dt><dd>{formatTime(Math.round(seconds / total))}</dd></div>
          <div><dt>Added to vault</dt><dd>{missedCount}</dd></div>
        </dl>

        {weakest && (
          <p className="quiz-note">
            <Lightbulb size={18} aria-hidden="true" />
            <span>
              <strong>Weakest this round: {catName(weakest[0])}</strong>, {weakest[1].correct} of {weakest[1].total} right.
              A focused round on it is the fastest way to move your total.
            </span>
          </p>
        )}

        <section className="sheet" aria-labelledby="sheet-title">
          <h3 id="sheet-title" className="sheet-title">Answer sheet</h3>
          <p className="sheet-sub">
            Every question with its explanation and memory hook. This is the part that improves your score.
          </p>

          <div className="sheet-tools">
            <div className="chip-row" role="group" aria-label="Filter answers">
              {[
                ['all', `All (${total})`],
                ['missed', `Missed (${missedCount})`],
                ['correct', `Correct (${score})`]
              ].map(([key, label]) => (
                <Chip key={key} active={reviewFilter === key} onClick={() => setReviewFilter(key)}>
                  {label}
                </Chip>
              ))}
            </div>
            <button
              type="button"
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

          {reviewRows.length === 0 ? (
            <p className="sheet-empty">Nothing matches that filter.</p>
          ) : (
            <ul className="sheet-list">
              {reviewRows.map(({ q, i, a }) => {
                const correct = a.isCorrect === true;
                const isOpen = !!expanded[i];
                const drawerId = `sheet-${q.id}`;
                return (
                  <li key={q.id} className="sheet-item">
                    <AnswerRow
                      as="button"
                      type="button"
                      className="sheet-row"
                      state={correct ? 'got' : 'missed'}
                      lead={`Q${i + 1}`}
                      trail={<ChevronDown className="sheet-chevron" size={18} aria-hidden="true" data-open={isOpen} />}
                      aria-expanded={isOpen}
                      aria-controls={drawerId}
                      onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
                    >
                      <span className="sheet-q">
                        <CategoryIcon id={q.category} size={16} aria-hidden="true" />
                        <span className="sheet-q-text">{q.question}</span>
                      </span>
                      <span className="sheet-answers">
                        {!correct && a.chosenIndex >= 0 && (
                          <Pill variant="wrong" icon="X"><span className="visually-hidden">Your answer: </span>{q.options[a.chosenIndex]}</Pill>
                        )}
                        <Pill variant="correct" icon="Check"><span className="visually-hidden">Correct answer: </span>{q.answer}</Pill>
                      </span>
                    </AnswerRow>
                    {isOpen && (
                      <div className="sheet-drawer" id={drawerId}>
                        <ul className="sheet-opts">
                          {q.options.map((opt, oi) => {
                            const isRight = oi === q.correctIndex;
                            const isMine = oi === a.chosenIndex && !correct;
                            return (
                              <li key={oi} className="sheet-opt" data-state={isRight ? 'correct' : isMine ? 'wrong' : 'idle'}>
                                <span className="option-key" aria-hidden="true">{String.fromCharCode(65 + oi)}</span>
                                <span className="option-label">{opt}</span>
                                {isRight && <><Check size={16} aria-hidden="true" /><span className="visually-hidden">Correct answer</span></>}
                                {isMine && <><X size={16} aria-hidden="true" /><span className="visually-hidden">Your answer</span></>}
                              </li>
                            );
                          })}
                        </ul>
                        <p className="explain-text">{q.explanation}</p>
                        <p className="tip"><strong>Remember it:</strong> {q.hook}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </GameResults>
    );
  }

  // ------------------------------------------------------------- question
  return (
    <div className="quiz-simulator quiz-screen" data-section="weekend">
      {title && (
        <div className="screen-head">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}

      <div className="quiz-top-bar">
        <div className="quiz-progress">
          <div className="quiz-progress-text">
            <span>Question {index + 1} of {questions.length}</span>
            <Pill variant="accent">Score {score}</Pill>
          </div>
          <div
            className="meter"
            role="progressbar"
            aria-label="Quiz progress"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={index + 1}
          >
            <div className="meter-fill" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="quiz-modes">
          <Chip
            active={mode === 'multiple_choice'}
            onClick={() => setMode('multiple_choice')}
            title="Four options, pick one"
          >
            Multiple choice
          </Chip>
          <Chip
            active={mode === 'recall'}
            onClick={() => setMode('recall')}
            title="No options. Answer in your head, then reveal"
          >
            Recall
          </Chip>
          <QuizTimer initial={elapsedRef.current} onTick={onTick} />
          <HowButton />
        </div>
      </div>
      <HowPanel />

      <div className="card question-card">
        <div className="question-header">
          <Pill>
            <CategoryIcon id={current.category} size={14} aria-hidden="true" /> {catName(current.category)}
          </Pill>
          <Pill>{capitalise(current.difficulty)}</Pill>
        </div>

        <h2 className="question-text">{current.question}</h2>

        {mode === 'multiple_choice' && (
          <>
            <QuizOptions
              options={current.options}
              correctIndex={current.correctIndex}
              selected={selected}
              answered={answered}
              eliminated={eliminated}
              onSelect={handleSelect}
            />

            {!answered && (
              <div className="hint-section">
                <Button variant="tertiary" onClick={removeTwoOptions} disabled={usedFiftyFifty}>
                  <Scissors size={16} aria-hidden="true" />
                  {usedFiftyFifty ? 'Two options removed' : 'Fifty-fifty: remove two wrong answers'}
                </Button>
              </div>
            )}
          </>
        )}

        {mode === 'recall' && (
          <div className="recall-box">
            {!revealed ? (
              <>
                <p>Answer it in your head first, the way you would reading the paper. No options.</p>
                <Button variant="secondary" onClick={() => setRevealed(true)}>
                  <Eye size={18} aria-hidden="true" /> Reveal answer
                </Button>
              </>
            ) : (
              <>
                <div>
                  <span className="eyebrow">Answer</span>
                  <p className="recall-answer">{current.answer}</p>
                </div>
                {!answered && (
                  <div className="recall-grade">
                    <p>Did you get it?</p>
                    <div className="recall-grade-btns">
                      <Button variant="correct" onClick={() => handleSelfGrade(true)}>
                        <Check size={18} aria-hidden="true" /> Got it
                      </Button>
                      <Button variant="wrong" onClick={() => handleSelfGrade(false)}>
                        <X size={18} aria-hidden="true" /> Missed it
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Next before the explanation, and sticky, so it is reachable on a
            phone without scrolling past the whole explanation first. */}
        {answered && (
          <div className="next-action-bar">
            <Button variant="primary" className="next-btn" onClick={next}>
              <span>{index < questions.length - 1 ? 'Next question' : 'See results'}</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        )}

        {answered && (
          <div className="explain">
            <span className="eyebrow">Why</span>
            <p className="explain-text">{current.explanation}</p>
            <p className="tip"><strong>Remember it:</strong> {current.hook}</p>
          </div>
        )}
      </div>
    </div>
  );
}
