import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import GameHub from './components/GameHub';
import RouteFallback from './components/RouteFallback';
import { recordRound, recordItems } from './lib/gameStats';
import { loadLive, saveLive, usePersistentState } from './lib/persist';
import { getStored, setStored, clearAllStored } from './lib/storage.js';
import BANK_STATS from './data/bankStats.json';
import { localDateKey, previousDateKey } from './lib/dates';
import { normaliseVault, recordMiss, recordHit, dueEntries, vaultSummary } from './lib/scheduler';
import { readChallengeFromUrl, clearChallengeFromUrl } from './lib/transfer';

// Every screen is loaded on first open. The quiz screens share the question
// bank (about 900 kB) and the games carry their own datasets, so none of that
// is in the first page load.
const QuizSimulator = lazy(() => import('./components/QuizSimulator'));
const QuizSetup = lazy(() => import('./components/QuizSetup'));
const WeeklyPaper = lazy(() => import('./components/WeeklyPaper'));
const WeaknessVault = lazy(() => import('./components/WeaknessVault'));
const FlashcardsDrill = lazy(() => import('./components/FlashcardsDrill'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const CountryQuiz = lazy(() => import('./games/geo/CountryQuiz'));
const HigherLower = lazy(() => import('./games/geo/HigherLower'));
const FirstNames = lazy(() => import('./games/names/FirstNames'));
const MusicCharts = lazy(() => import('./games/charts/MusicCharts'));
const FilmCharts = lazy(() => import('./games/charts/FilmCharts'));
const TvCharts = lazy(() => import('./games/charts/TvCharts'));
const FourByFour = lazy(() => import('./games/fourbyfour/FourByFour'));
const ListGame = lazy(() => import('./games/lists/ListGame'));
const Timeline = lazy(() => import('./games/timeline/Timeline'));
const NameTheYear = lazy(() => import('./games/nameyear/NameTheYear'));
const Obscure = lazy(() => import('./games/obscure/Obscure'));
const MissingLink = lazy(() => import('./games/missinglink/MissingLink'));
const WordPlay = lazy(() => import('./games/vocab/WordPlay'));
const Settings = lazy(() => import('./components/Settings'));

// The quiz builder pulls in the whole question bank, so it is imported when a
// quiz is first needed rather than at startup. The promise is shared.
let builderPromise = null;
const loadBuilder = () =>
  (builderPromise ??= import('./lib/quizBuilder').catch((error) => {
    builderPromise = null; // let a retry fetch again rather than replay the failure
    throw error;
  }));

// Tabs that show a quiz built from the bank.
const QUIZ_TABS = new Set(['quiz', 'daily', 'revision', 'challenge']);

// Footer copy: "1,500+" is the total rounded down to the hundred.
const BANK_LABEL = `${(Math.floor(BANK_STATS.total / 100) * 100).toLocaleString('en-US')}+`;

// How many recent question ids to remember so quizzes don't repeat across
// sessions. Roughly a third of the bank — beyond that, repeats are unavoidable
// and useful anyway.
const RECENT_MEMORY = 350;

const isArray = (v) => Array.isArray(v);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const omit = (obj, key) => {
  if (!(key in obj)) return obj;
  const { [key]: _drop, ...rest } = obj;
  return rest;
};

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

const saveQuiz = (name, q) => saveLive(`quiz_${name}`, q ? { ids: q.questions.map((x) => x.id), seed: q.seed } : null);
const restoreQuiz = (name, builder) => {
  const s = loadLive(`quiz_${name}`);
  if (!s?.ids?.length) return null;
  const built = builder.buildChallengeQuiz(s.ids, s.seed);
  return built.questions.length ? built : null;
};

export default function App() {
  // Reopening the app (an iPhone home-screen app is often reloaded after
  // switching away) lands back on the same screen.
  const [activeTab, setActiveTab] = usePersistentState('tab', 'home');
  const goHome = useCallback(() => setActiveTab('home'), [setActiveTab]);

  // Progress for every game other than the weekend quiz, keyed by game id.
  const [gameStats, setGameStats] = useState(() => getStored('games', {}, isObject));
  // Multiple choice (easier) or reveal-and-self-mark (harder), shared across
  // games so the choice follows you from flags to capitals.
  const [answerMode, setAnswerMode] = useState(() =>
    getStored('answerMode', 'choice', (v) => v === 'choice' || v === 'reveal')
  );

  const [stats, setStats] = useState(() => ({ ...EMPTY_STATS, ...getStored('stats', {}, isObject) }));
  const [recentIds, setRecentIds] = useState(() => getStored('recent', [], isArray));
  // Vault entries carry only an id plus scheduling state — never question text.
  // Everything displayed is resolved from the live bank, so correcting a
  // question corrects it retrospectively everywhere it has been saved.
  //
  // normaliseVault also migrates the original `string[]` format in place rather
  // than through a storage version bump, which would have discarded a vault the
  // user had been accumulating.
  const [vault, setVault] = useState(() => normaliseVault(getStored('missed', [], isArray)));

  const [setup, setSetup] = useState(() => ({
    ...DEFAULT_SETUP,
    ...getStored('setup', {}, isObject)
  }));

  // The quizzes in play are saved as question ids plus seed and rebuilt on
  // load, which reproduces the same questions with the same option order, so
  // QuizSimulator can resume its saved progress through them.
  //
  // `undefined` means "not built yet" (the question bank loads on first need);
  // `null` means "built, and there is none". Saving waits for a built value so
  // a quiz still in storage is never overwritten by the empty starting state.
  // A failed bank load (offline, or a deploy replaced the chunk) is rethrown
  // during render so ErrorBoundary shows its retry screen instead of an
  // endless skeleton or a button that silently does nothing.
  const [loadError, setLoadError] = useState(null);
  if (loadError) throw loadError;
  const bank = useCallback(
    () =>
      loadBuilder().catch((error) => {
        setLoadError(error);
        return null;
      }),
    []
  );

  const [quiz, setQuiz] = useState();
  const [dailyQuiz, setDailyQuiz] = useState();
  const [revisionQuiz, setRevisionQuiz] = useState();
  const [challengeQuiz, setChallengeQuiz] = useState();
  useEffect(() => {
    if (quiz !== undefined) saveQuiz('quiz', quiz);
  }, [quiz]);
  useEffect(() => {
    if (revisionQuiz !== undefined) saveQuiz('revision', revisionQuiz);
  }, [revisionQuiz]);
  useEffect(() => {
    if (challengeQuiz !== undefined) saveQuiz('challenge', challengeQuiz);
  }, [challengeQuiz]);

  // Load the bank and fill in whichever quizzes are still unbuilt. Anything a
  // handler has already set is kept.
  useEffect(() => {
    if (!QUIZ_TABS.has(activeTab)) return;
    bank().then((builder) => {
      if (!builder) return;
      setQuiz((prev) =>
        prev !== undefined
          ? prev
          : restoreQuiz('quiz', builder) || builder.buildQuiz({ ...DEFAULT_SETUP, ...getStored('setup', {}, isObject) })
      );
      setDailyQuiz((prev) => (prev !== undefined ? prev : builder.buildDailyQuiz(5)));
      setRevisionQuiz((prev) => (prev !== undefined ? prev : restoreQuiz('revision', builder)));
      setChallengeQuiz((prev) => (prev !== undefined ? prev : restoreQuiz('challenge', builder)));
    });
  }, [activeTab, bank]);

  useEffect(() => setStored('stats', stats), [stats]);
  useEffect(() => setStored('recent', recentIds), [recentIds]);
  useEffect(() => setStored('missed', vault), [vault]);
  useEffect(() => setStored('setup', setup), [setup]);
  useEffect(() => setStored('games', gameStats), [gameStats]);
  useEffect(() => setStored('answerMode', answerMode), [answerMode]);

  // Rounds left part-way through, keyed by game id, so switching tabs or
  // reloading resumes where you were instead of throwing the round away.
  const [savedRounds, setSavedRounds] = useState(() => getStored('rounds', {}, isObject));
  useEffect(() => setStored('rounds', savedRounds), [savedRounds]);
  const handleRoundChange = useCallback((gameId, round) => {
    setSavedRounds((prev) => (round ? { ...prev, [gameId]: round } : omit(prev, gameId)));
  }, []);
  // First score on each week's paper, keyed by that Saturday's date. Replays
  // do not overwrite it.
  const [weeklyScores, setWeeklyScores] = useState(() => getStored('weekly', {}, isObject));
  useEffect(() => setStored('weekly', weeklyScores), [weeklyScores]);
  const handlePaperDone = useCallback((weekKey, result) => {
    setWeeklyScores((prev) => (prev[weekKey] ? prev : { ...prev, [weekKey]: { score: result.score, total: result.total } }));
  }, []);

  const handleGameAnswer = useCallback((gameId, key, correct) => {
    setGameStats((prev) => recordItems(prev, gameId, [{ key, correct }]));
  }, []);

  const handleGameRound = useCallback((gameId, result) => {
    setGameStats((prev) => recordRound(prev, gameId, { ...result, date: localDateKey() }));
  }, []);

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
    async (nextSetup) => {
      const merged = { ...setup, ...nextSetup };
      setSetup(merged);
      const builder = await bank();
      if (!builder) return;
      setQuiz(builder.buildQuiz({ ...merged, recentIds, seed: Date.now() }));
      setActiveTab('quiz');
    },
    [setup, recentIds, setActiveTab, bank]
  );

  /**
   * Drill the vault. Defaults to only what is actually due, which is the whole
   * point of the schedule; `all` overrides that for someone who wants to grind
   * the full list regardless.
   */
  const startRevision = useCallback(
    async ({ all = false } = {}) => {
      const pool = all ? vault : dueEntries(vault);
      if (!pool.length) return;
      const builder = await bank();
      if (!builder) return;
      setRevisionQuiz(builder.buildRevisionQuiz(pool.map((e) => e.id), Date.now()));
      setActiveTab('revision');
    },
    [vault, setActiveTab, bank]
  );

  const handleMissed = useCallback((question) => {
    setVault((prev) => recordMiss(prev, question.id));
  }, []);

  const handleCorrect = useCallback((id) => {
    setVault((prev) => recordHit(prev, id));
  }, []);

  /** Manual removal from the vault, from the vault UI's remove button. */
  const handleForget = useCallback((id) => {
    setVault((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /** Resolves true when the challenge could be built and opened. */
  const startChallenge = useCallback(async (challenge) => {
    const builder = await bank();
    if (!builder) return false;
    const built = builder.buildChallengeQuiz(challenge.ids, challenge.seed);
    if (!built.questions.length) return false;
    setChallengeQuiz(built);
    setActiveTab('challenge');
    return true;
  }, [setActiveTab, bank]);

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
    clearAllStored();
    setStats({ ...EMPTY_STATS });
    setRecentIds([]);
    setVault([]);
    setGameStats({});
    setSavedRounds({});
    setWeeklyScores({});
  };

  /** Replace local state wholesale after a progress import. */
  const applyImported = useCallback((merged) => {
    setStats({ ...EMPTY_STATS, ...merged.stats });
    setVault(normaliseVault(merged.vault));
    setRecentIds(merged.recentIds);
    setGameStats(merged.games || {});
  }, []);

  // A challenge link is read once on mount and then stripped from the address
  // bar, so refreshing or sharing the page later doesn't silently drop the
  // reader back into someone else's round.
  useEffect(() => {
    const challenge = readChallengeFromUrl();
    if (challenge) startChallenge(challenge).then((opened) => opened && clearChallengeFromUrl());
  }, [startChallenge]);

  const overallAccuracy = stats.totalAnswered
    ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
    : 0;
  const summary = vaultSummary(vault);
  const statsWithAccuracy = { ...stats, overallAccuracy };

  // Props shared by the games.
  const play = { stats: gameStats, onRoundComplete: handleGameRound, onExit: goHome };
  const mode = { answerMode, onAnswerModeChange: setAnswerMode };

  // A quiz screen waits here until the question bank has loaded.
  const waiting = <RouteFallback />;

  // Every screen, by tab id. This is the only list of tabs: a tab id that is
  // not a key here is unknown (see the effect below).
  const TABS = {
    home: () => (
      <GameHub
        onOpen={setActiveTab}
        gameStats={gameStats}
        quizStats={stats}
        vaultDue={summary.due}
        weeklyScores={weeklyScores}
      />
    ),
    flags: () => countryQuiz('flags'),
    capitals: () => countryQuiz('capitals'),
    population: () => <HigherLower {...play} />,
    'music-years': () => <MusicCharts {...play} {...mode} onAnswer={handleGameAnswer} />,
    'film-years': () => <FilmCharts {...play} {...mode} onAnswer={handleGameAnswer} />,
    'tv-years': () => <TvCharts {...play} {...mode} onAnswer={handleGameAnswer} />,
    lists: () => <ListGame {...play} {...mode} />,
    'missing-link': () => <MissingLink {...play} />,
    vocab: () => <WordPlay {...play} onAnswer={handleGameAnswer} />,
    pointless: () => <Obscure {...play} />,
    'year-guess': () => <NameTheYear {...play} {...mode} />,
    timeline: () => <Timeline {...play} />,
    connections: () => <FourByFour {...play} />,
    'first-names': () => <FirstNames {...play} {...mode} />,
    settings: () => <Settings />,
    quiz: () =>
      quiz ? (
        <>
          <QuizSetup setup={setup} onStart={startQuiz} bankStats={BANK_STATS} />
          <QuizSimulator
            key={`quiz-${quiz.seed}`}
            saveAs="quiz"
            questions={quiz.questions}
            seed={quiz.seed}
            onComplete={handleComplete}
            onMissed={handleMissed}
            onCorrect={handleCorrect}
            onNewQuiz={() => startQuiz({})}
          />
        </>
      ) : (
        waiting
      ),
    weekly: () => (
      <WeeklyPaper
        scores={weeklyScores}
        onPaperDone={handlePaperDone}
        onComplete={handleComplete}
        onMissed={handleMissed}
        onCorrect={handleCorrect}
      />
    ),
    daily: () =>
      dailyQuiz ? (
        <QuizSimulator
          key={`daily-${dailyQuiz.seed}`}
          saveAs="daily"
          questions={dailyQuiz.questions}
          seed={dailyQuiz.seed}
          title="Daily Five"
          subtitle="The same five questions for everyone today. Come back tomorrow for a new set."
          onComplete={handleComplete}
          onMissed={handleMissed}
          onCorrect={handleCorrect}
          onNewQuiz={async () => {
            const builder = await bank();
            if (builder) setDailyQuiz(builder.buildDailyQuiz(5));
          }}
        />
      ) : (
        waiting
      ),
    revision: () =>
      revisionQuiz ? (
        <QuizSimulator
          key={`rev-${revisionQuiz.seed}`}
          saveAs="revision"
          questions={revisionQuiz.questions}
          seed={revisionQuiz.seed}
          title="Revision round"
          subtitle="Questions you have missed before, back on schedule. Getting one right pushes it further away; getting it wrong brings it straight back."
          onComplete={handleComplete}
          onMissed={handleMissed}
          onCorrect={handleCorrect}
          onNewQuiz={() => startRevision()}
        />
      ) : (
        waiting
      ),
    challenge: () =>
      challengeQuiz ? (
        <QuizSimulator
          key={`chal-${challengeQuiz.seed}`}
          saveAs="challenge"
          questions={challengeQuiz.questions}
          seed={challengeQuiz.seed}
          title="Challenge round"
          subtitle={
            challengeQuiz.missing
              ? `Someone sent you this exact paper. ${challengeQuiz.missing} question(s) no longer exist in the bank and have been dropped.`
              : 'Someone sent you this exact paper: same questions, same order, same options. Compare scores honestly.'
          }
          onComplete={handleComplete}
          onMissed={handleMissed}
          onCorrect={handleCorrect}
          onNewQuiz={() => setActiveTab('quiz')}
        />
      ) : (
        waiting
      ),
    flashcards: () => <FlashcardsDrill />,
    vault: () => (
      <WeaknessVault
        vault={vault}
        summary={summary}
        onRemove={handleForget}
        onClearAll={() => setVault([])}
        onStartRevision={startRevision}
      />
    ),
    analytics: () => (
      <AnalyticsDashboard
        stats={statsWithAccuracy}
        bankStats={BANK_STATS}
        vaultSummary={summary}
        seenCount={recentIds.length}
        totalBank={BANK_STATS.total}
        profile={{ stats, vault, recentIds, games: gameStats }}
        onImport={applyImported}
      />
    )
  };

  // Flags and capitals share a screen; `key` gives each its own state.
  function countryQuiz(kind) {
    return (
      <CountryQuiz
        key={kind}
        kind={kind}
        {...play}
        {...mode}
        onAnswer={handleGameAnswer}
        savedRound={savedRounds[kind]}
        onRoundChange={handleRoundChange}
      />
    );
  }

  // A restored tab whose content no longer exists (a tab id from an older
  // version, or a revision or challenge round that could not be rebuilt) would
  // open onto an empty page. Send it home instead.
  const known = Object.hasOwn(TABS, activeTab);
  const emptyRound =
    (activeTab === 'revision' && revisionQuiz === null) || (activeTab === 'challenge' && challengeQuiz === null);
  useEffect(() => {
    if (!known || emptyRound) setActiveTab('home');
  }, [known, emptyRound, setActiveTab]);

  return (
    <div className="app-layout">
      <Header
        onHome={goHome}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        bankSize={BANK_STATS.total}
        stats={statsWithAccuracy}
        weaknessCount={summary.due}
        onReset={resetEverything}
      />

      <main className="main-content">
        <Suspense fallback={waiting}>{known ? TABS[activeTab]() : null}</Suspense>
      </main>

      <footer className="app-footer">
        <p>
          Know-It-All. {BANK_LABEL} weekend-quiz questions, {BANK_STATS.countryCount} countries.
          Signed out, progress stays in this browser. Signed in with Google, it is saved to this
          site's server so your other devices can pick it up; nothing else is collected.
        </p>
      </footer>
    </div>
  );
}
