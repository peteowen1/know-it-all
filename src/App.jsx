import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import QuizSimulator from './components/QuizSimulator';
import FlashcardsDrill from './components/FlashcardsDrill';
import WeaknessVault from './components/WeaknessVault';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import QuizSetup from './components/QuizSetup';
import { ALL_QUESTIONS, BANK_STATS, getQuestion } from './data/questionBank';
import { buildQuiz, buildDailyQuiz, buildRevisionQuiz } from './lib/quizBuilder';

// Bump when the shape of anything in localStorage changes, so old saves are
// dropped rather than crashing on a field that no longer exists.
const STORAGE_VERSION = 'v4';
const KEY = (name) => `sqt_${STORAGE_VERSION}_${name}`;

// How many recent question ids to remember so quizzes don't repeat across
// sessions. Roughly a third of the bank — beyond that, repeats are unavoidable
// and useful anyway.
const RECENT_MEMORY = 350;

function load(name, fallback) {
  try {
    const raw = localStorage.getItem(KEY(name));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(name, value) {
  try {
    localStorage.setItem(KEY(name), JSON.stringify(value));
  } catch {
    // Storage full or blocked (private browsing). Losing progress is
    // preferable to breaking the quiz, so this is deliberately silent.
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

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [activeTab, setActiveTab] = useState('quiz');

  const [stats, setStats] = useState(() => ({ ...EMPTY_STATS, ...load('stats', {}) }));
  const [recentIds, setRecentIds] = useState(() => load('recent', []));
  // Stored as ids only — question text and explanations always come from the
  // live bank, so fixing a question fixes it everywhere retrospectively.
  const [missedIds, setMissedIds] = useState(() => load('missed', []));

  const [setup, setSetup] = useState(() => load('setup', {
    count: 25,
    categories: 'all',
    difficulty: 'all'
  }));

  const [quiz, setQuiz] = useState(() => buildQuiz({ ...load('setup', { count: 25 }) }));
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
    const today = todayKey();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
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
      const today = todayKey();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
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
