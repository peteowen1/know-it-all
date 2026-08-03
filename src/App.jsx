import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import QuizSimulator from './components/QuizSimulator';
import FlashcardsDrill from './components/FlashcardsDrill';
import WeaknessVault from './components/WeaknessVault';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import QuizSetup from './components/QuizSetup';
import { ALL_QUESTIONS, BANK_STATS, getQuestion } from './data/questionBank';
import { buildQuiz, buildDailyQuiz, buildRevisionQuiz } from './lib/quizBuilder';
import { localDateKey, previousDateKey } from './lib/dates';

// Bump when the shape of anything in localStorage changes. This changes the key
// prefix, so old entries are orphaned — never read again — rather than being
// parsed into a shape the current code does not expect. Note they are not
// deleted: only the Reset button removes them.
const STORAGE_VERSION = 'v4';
const KEY = (name) => `sqt_${STORAGE_VERSION}_${name}`;

// How many recent question ids to remember so quizzes don't repeat across
// sessions. Roughly a third of the bank — beyond that, repeats are unavoidable
// and useful anyway.
const RECENT_MEMORY = 350;

/**
 * Read a persisted value.
 *
 * `isValid` is not optional in practice: a try/catch around JSON.parse only
 * catches *syntactically* bad data. `JSON.parse('null')` succeeds and returns
 * null, and the truthiness check below tests the raw string, not the result —
 * so without a shape check a stored "null" would be handed straight back and
 * blow up later at the call site, far from here, as a blank white page.
 */
function load(name, fallback, isValid = () => true) {
  try {
    const raw = localStorage.getItem(KEY(name));
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

const isArray = (v) => Array.isArray(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function save(name, value) {
  try {
    localStorage.setItem(KEY(name), JSON.stringify(value));
  } catch (err) {
    // Storage full, or blocked in private browsing. Carrying on unsaved beats
    // breaking the quiz, but this is silent data loss from the user's point of
    // view — they will only notice when their streak has vanished tomorrow —
    // so make it discoverable in the console rather than invisible.
    console.warn(`Could not save "${name}"; progress will not persist.`, err);
  }
}

const EMPTY_STATS = {
  highScore: 0,
  bestPercentage: 0,
  totalQuizzes: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  streak: 0,
  lastPlayDate: null,
  categoryStats: {},
  difficultyStats: {}
};

const DEFAULT_SETUP = { count: 25, categories: 'all', difficulty: 'all' };

export default function App() {
  const [activeTab, setActiveTab] = useState('quiz');

  const [stats, setStats] = useState(() => ({ ...EMPTY_STATS, ...load('stats', {}, isObject) }));
  const [recentIds, setRecentIds] = useState(() => load('recent', [], isArray));
  // Stored as ids only — question text and explanations always come from the
  // live bank, so fixing a question fixes it everywhere retrospectively.
  const [missedIds, setMissedIds] = useState(() => load('missed', [], isArray));

  const [setup, setSetup] = useState(() => ({
    ...DEFAULT_SETUP,
    ...load('setup', {}, isObject)
  }));

  const [quiz, setQuiz] = useState(() =>
    buildQuiz({ ...DEFAULT_SETUP, ...load('setup', {}, isObject) })
  );
  const [dailyQuiz, setDailyQuiz] = useState(() => buildDailyQuiz(5));
  const [revisionQuiz, setRevisionQuiz] = useState(null);

  useEffect(() => save('stats', stats), [stats]);
  useEffect(() => save('recent', recentIds), [recentIds]);
  useEffect(() => save('missed', missedIds), [missedIds]);
  useEffect(() => save('setup', setup), [setup]);

  // A streak is broken the moment you miss a day, so it has to be checked on
  // load rather than only on completion — otherwise a stale streak from three
  // weeks ago would still be showing in the header.
  //
  // lastPlayDate is advanced only by finishing a quiz, never by opening the
  // app, so browsing without playing does not extend the streak.
  useEffect(() => {
    const today = localDateKey();
    const yesterday = previousDateKey();
    setStats((prev) => {
      const stillLive = prev.lastPlayDate === today || prev.lastPlayDate === yesterday;
      if (stillLive || prev.streak === 0) return prev;
      return { ...prev, streak: 0 };
    });
  }, []);

  const startQuiz = useCallback(
    (nextSetup) => {
      const merged = { ...setup, ...nextSetup };
      setSetup(merged);
      setQuiz(buildQuiz({ ...merged, recentIds, seed: Date.now() }));
      setActiveTab('quiz');
    },
    [setup, recentIds]
  );

  const startRevision = useCallback(() => {
    if (!missedIds.length) return;
    setRevisionQuiz(buildRevisionQuiz(missedIds, Date.now()));
    setActiveTab('revision');
  }, [missedIds]);

  const handleMissed = useCallback((question) => {
    setMissedIds((prev) => (prev.includes(question.id) ? prev : [...prev, question.id]));
  }, []);

  const handleMastered = useCallback((id) => {
    setMissedIds((prev) => prev.filter((q) => q !== id));
  }, []);

  const handleComplete = useCallback((result) => {
    const { score, total, answers, questionIds } = result;

    setRecentIds((prev) => [...questionIds, ...prev.filter((id) => !questionIds.includes(id))].slice(0, RECENT_MEMORY));

    setStats((prev) => {
      const today = localDateKey();
      const yesterday = previousDateKey();
      let streak = prev.streak;
      if (prev.lastPlayDate !== today) {
        streak = prev.lastPlayDate === yesterday ? prev.streak + 1 : 1;
      }

      const categoryStats = { ...prev.categoryStats };
      const difficultyStats = { ...prev.difficultyStats };
      for (const a of answers) {
        const c = categoryStats[a.category] || { total: 0, correct: 0 };
        categoryStats[a.category] = { total: c.total + 1, correct: c.correct + (a.isCorrect ? 1 : 0) };
        const d = difficultyStats[a.difficulty] || { total: 0, correct: 0 };
        difficultyStats[a.difficulty] = { total: d.total + 1, correct: d.correct + (a.isCorrect ? 1 : 0) };
      }

      const percentage = total ? Math.round((score / total) * 100) : 0;
      return {
        ...prev,
        highScore: Math.max(prev.highScore, score),
        bestPercentage: Math.max(prev.bestPercentage || 0, percentage),
        totalQuizzes: prev.totalQuizzes + 1,
        totalAnswered: prev.totalAnswered + total,
        totalCorrect: prev.totalCorrect + score,
        streak,
        lastPlayDate: today,
        categoryStats,
        difficultyStats
      };
    });
  }, []);

  const resetEverything = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sqt_') || k.startsWith('gw_'))
      .forEach((k) => localStorage.removeItem(k));
    setStats({ ...EMPTY_STATS });
    setRecentIds([]);
    setMissedIds([]);
  };

  const missedQuestions = missedIds.map(getQuestion).filter(Boolean);
  const overallAccuracy = stats.totalAnswered
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;

  return (
    <div className="app-layout">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bankSize={BANK_STATS.total}
        stats={{ ...stats, overallAccuracy }}
        weaknessCount={missedIds.length}
        onReset={resetEverything}
      />

      <main className="main-content">
        {activeTab === 'quiz' && (
          <>
            <QuizSetup setup={setup} onStart={startQuiz} bankStats={BANK_STATS} />
            <QuizSimulator
              key={`quiz-${quiz.seed}`}
              questions={quiz.questions}
              onComplete={handleComplete}
              onMissed={handleMissed}
              onNewQuiz={() => startQuiz({})}
            />
          </>
        )}

        {activeTab === 'daily' && (
          <QuizSimulator
            key={`daily-${dailyQuiz.seed}`}
            questions={dailyQuiz.questions}
            title="Daily Five"
            subtitle="The same five questions for everyone today. Come back tomorrow for a new set."
            onComplete={handleComplete}
            onMissed={handleMissed}
            onNewQuiz={() => setDailyQuiz(buildDailyQuiz(5))}
          />
        )}

        {activeTab === 'revision' && revisionQuiz && (
          <QuizSimulator
            key={`rev-${revisionQuiz.seed}`}
            questions={revisionQuiz.questions}
            title="Revision Round"
            subtitle="Questions you have previously missed, in a fresh order."
            onComplete={handleComplete}
            onMissed={handleMissed}
            onCorrect={handleMastered}
            onNewQuiz={startRevision}
          />
        )}

        {activeTab === 'flashcards' && <FlashcardsDrill />}

        {activeTab === 'vault' && (
          <WeaknessVault
            missedQuestions={missedQuestions}
            onRemove={handleMastered}
            onClearAll={() => setMissedIds([])}
            onStartRevision={startRevision}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            stats={{ ...stats, overallAccuracy }}
            bankStats={BANK_STATS}
            weaknessCount={missedIds.length}
            seenCount={recentIds.length}
            totalBank={ALL_QUESTIONS.length}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          {BANK_STATS.total} questions across {Object.keys(BANK_STATS.byCategory).length} categories.
          Every answer comes with an explanation and a memory hook. Progress is stored in this
          browser only — nothing is sent anywhere.
        </p>
      </footer>
    </div>
  );
}
