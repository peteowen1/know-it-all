import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import QuizSimulator from './components/QuizSimulator';
import FlashcardsDrill from './components/FlashcardsDrill';
import WeaknessVault from './components/WeaknessVault';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { ALL_QUESTIONS, getBalancedWeeklyQuiz, CATEGORIES } from './data/questionsData';

export default function App() {
  const [activeTab, setActiveTab] = useState('quiz'); // 'quiz', 'daily', 'flashcards', 'vault', 'analytics'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  
  // Active questions pool (regenerated on new quiz)
  const [quizQuestions, setQuizQuestions] = useState(() => getBalancedWeeklyQuiz(25));
  const [dailyQuestions, setDailyQuestions] = useState(() => getBalancedWeeklyQuiz(5));

  // Persistent State
  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('gw_quiz_stats');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      highScore: 0,
      totalQuizzes: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      streak: 1,
      lastPlayDate: new Date().toISOString().split('T')[0],
      overallAccuracy: 0,
      categoryStats: {}
    };
  });

  const [missedQuestions, setMissedQuestions] = useState(() => {
    const saved = localStorage.getItem('gw_quiz_missed');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map(savedQ => {
          const fresh = ALL_QUESTIONS.find(q => q.id === savedQ.id || q.question === savedQ.question);
          return fresh ? { ...savedQ, explanation: fresh.explanation, tip: fresh.tip } : savedQ;
        });
      } catch (e) {}
    }
    return [];
  });

  // Auto-purge old cached storage on version upgrade
  useEffect(() => {
    const CURRENT_VERSION = 'v3.0.0_clean';
    const savedVer = localStorage.getItem('gw_dataset_ver');
    if (savedVer !== CURRENT_VERSION) {
      localStorage.removeItem('gw_quiz_missed');
      localStorage.removeItem('gw_quiz_stats');
      localStorage.setItem('gw_dataset_ver', CURRENT_VERSION);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('gw_quiz_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('gw_quiz_missed', JSON.stringify(missedQuestions));
  }, [missedQuestions]);

  const handleStartNewQuiz = (categoryFilter = 'all') => {
    setSelectedCategoryFilter(categoryFilter);
    if (categoryFilter === 'all') {
      setQuizQuestions(getBalancedWeeklyQuiz(25));
    } else {
      const filtered = ALL_QUESTIONS.filter(q => q.category === categoryFilter);
      const uniqueMap = new Map();
      filtered.forEach(q => {
        if (!uniqueMap.has(q.question)) {
          uniqueMap.set(q.question, q);
        }
      });
      const shuffled = Array.from(uniqueMap.values()).sort(() => 0.5 - Math.random());
      setQuizQuestions(shuffled.slice(0, Math.min(25, shuffled.length)));
    }
  };

  const handleSaveMissedQuestion = (q) => {
    setMissedQuestions(prev => {
      if (prev.some(item => item.id === q.id)) return prev;
      return [...prev, q];
    });
  };

  const handleRemoveMissedQuestion = (qId) => {
    setMissedQuestions(prev => prev.filter(q => q.id !== qId));
  };

  const handleClearAllMissed = () => {
    setMissedQuestions([]);
  };

  const handleCompleteQuiz = (score, totalQs, userAnswers) => {
    setStats(prev => {
      const newTotalQuizzes = prev.totalQuizzes + 1;
      const newHighScore = Math.max(prev.highScore, score);
      const newTotalAnswered = prev.totalAnswered + totalQs;
      const newTotalCorrect = prev.totalCorrect + score;
      const newOverallAccuracy = Math.round((newTotalCorrect / newTotalAnswered) * 100);

      // Update category stats
      const updatedCatStats = { ...prev.categoryStats };
      Object.values(userAnswers).forEach(ans => {
        const cat = ans.category;
        if (!updatedCatStats[cat]) updatedCatStats[cat] = { total: 0, correct: 0 };
        updatedCatStats[cat].total += 1;
        if (ans.isCorrect) updatedCatStats[cat].correct += 1;
      });

      return {
        ...prev,
        highScore: newHighScore,
        totalQuizzes: newTotalQuizzes,
        totalAnswered: newTotalAnswered,
        totalCorrect: newTotalCorrect,
        overallAccuracy: newOverallAccuracy,
        categoryStats: updatedCatStats
      };
    });
  };

  return (
    <div className="app-layout">
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        totalBankCount={ALL_QUESTIONS.length}
        stats={{
          ...stats,
          weaknessCount: missedQuestions.length
        }}
      />

      <main className="main-content">
        {/* Category Drill Filter Toolbar */}
        {activeTab === 'quiz' && (
          <div className="category-filter-bar">
            <span className="filter-label">Practice Focus:</span>
            <button 
              className={`filter-chip ${selectedCategoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleStartNewQuiz('all')}
            >
              🌟 All 8 Categories (Balanced)
            </button>
            {Object.values(CATEGORIES).map(cat => (
              <button 
                key={cat.id}
                className={`filter-chip ${selectedCategoryFilter === cat.id ? 'active' : ''}`}
                onClick={() => handleStartNewQuiz(cat.id)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'quiz' && (
          <QuizSimulator 
            questions={quizQuestions}
            onCompleteQuiz={handleCompleteQuiz}
            onSaveMissedQuestion={handleSaveMissedQuestion}
            onGenerateNewQuiz={() => handleStartNewQuiz(selectedCategoryFilter)}
          />
        )}

        {activeTab === 'daily' && (
          <QuizSimulator 
            questions={dailyQuestions}
            isDailyMode={true}
            onCompleteQuiz={handleCompleteQuiz}
            onSaveMissedQuestion={handleSaveMissedQuestion}
            onGenerateNewQuiz={() => setDailyQuestions(getBalancedWeeklyQuiz(5))}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsDrill />
        )}

        {activeTab === 'vault' && (
          <WeaknessVault 
            missedQuestions={missedQuestions}
            onRemoveMissed={handleRemoveMissedQuestion}
            onClearAll={handleClearAllMissed}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard 
            stats={stats}
            totalBankCount={ALL_QUESTIONS.length}
          />
        )}
      </main>
    </div>
  );
}
