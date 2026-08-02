import React, { useState, useEffect } from 'react';
import { CATEGORIES, ALL_QUESTIONS } from '../data/questionsData';
import { HelpCircle, CheckCircle2, XCircle, Lightbulb, ArrowRight, RotateCcw, Award, Clock, Eye, Check, X, ChevronDown, ChevronUp, List, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function QuizSimulator({ questions, isDailyMode = false, onCompleteQuiz, onSaveMissedQuestion }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [userAnswers, setUserAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [quizMode, setQuizMode] = useState('multiple_choice'); // 'multiple_choice' or 'newspaper_reveal'
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Finish Screen Review State
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all', 'missed', 'correct'
  const [viewStyle, setViewStyle] = useState('compact'); // 'compact' or 'detailed'
  const [expandedItems, setExpandedItems] = useState({});

  // Timer state
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(true);

  useEffect(() => {
    let interval = null;
    if (timerActive && !isFinished) {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, isFinished]);

  const rawQ = questions[currentIndex];
  const currentQ = ALL_QUESTIONS.find(q => q.id === rawQ?.id || q.question === rawQ?.question) || rawQ;
  const catObj = CATEGORIES[currentQ?.category?.toUpperCase()] || { name: 'General', icon: '❓', color: '#6b7280' };

  const handleSelectOption = (idx) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);
    
    const isCorrect = idx === currentQ.answer;
    if (isCorrect) {
      setScore(prev => prev + 1);
    } else {
      onSaveMissedQuestion(currentQ);
    }

    setUserAnswers(prev => ({
      ...prev,
      [currentIndex]: {
        questionId: currentQ.id,
        category: currentQ.category,
        userSelect: idx,
        correctOption: currentQ.answer,
        isCorrect
      }
    }));
  };

  const handleNewspaperReveal = (markedCorrect) => {
    setIsRevealed(true);
    setIsAnswered(true);
    if (markedCorrect) {
      setScore(prev => prev + 1);
    } else {
      onSaveMissedQuestion(currentQ);
    }

    setUserAnswers(prev => ({
      ...prev,
      [currentIndex]: {
        questionId: currentQ.id,
        category: currentQ.category,
        userSelect: markedCorrect ? currentQ.answer : -1,
        correctOption: currentQ.answer,
        isCorrect: markedCorrect
      }
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setShowHint(false);
      setIsRevealed(false);
    } else {
      setIsFinished(true);
      setTimerActive(false);
      
      const finalScore = score + (selectedOption === currentQ.answer ? 1 : 0);
      onCompleteQuiz(finalScore, questions.length, userAnswers);

      if (finalScore >= (questions.length * 0.75)) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setShowHint(false);
    setIsRevealed(false);
    setUserAnswers({});
    setScore(0);
    setIsFinished(false);
    setSecondsElapsed(0);
    setTimerActive(true);
    setReviewFilter('all');
    setExpandedItems({});
  };

  const toggleExpandItem = (idx) => {
    setExpandedItems(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const toggleExpandAll = () => {
    const allExpanded = Object.keys(expandedItems).length === questions.length && Object.values(expandedItems).every(Boolean);
    const nextState = {};
    questions.forEach((_, i) => {
      nextState[i] = !allExpanded;
    });
    setExpandedItems(nextState);
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins}:${remainderSecs < 10 ? '0' : ''}${remainderSecs}`;
  };

  if (!questions || questions.length === 0) {
    return <div className="card">No questions available.</div>;
  }

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    let gradeTitle = 'Beginner Solver';
    let gradeBadge = '🥉';
    if (percentage >= 90) { gradeTitle = 'Saturday Master Mind'; gradeBadge = '🏆'; }
    else if (percentage >= 75) { gradeTitle = 'Good Weekend Scholar'; gradeBadge = '🥇'; }
    else if (percentage >= 60) { gradeTitle = 'Coffee & Paper Regular'; gradeBadge = '🥈'; }

    const missedCount = questions.length - score;

    const filteredReviewQuestions = questions.map((q, idx) => {
      const ansInfo = userAnswers[idx] || {};
      return { q, idx, ansInfo };
    }).filter(({ ansInfo }) => {
      if (reviewFilter === 'missed') return !ansInfo.isCorrect;
      if (reviewFilter === 'correct') return ansInfo.isCorrect;
      return true;
    });

    const isAllExpanded = Object.keys(expandedItems).length === questions.length && Object.values(expandedItems).every(Boolean);

    return (
      <div className="quiz-finished-card">
        <div className="finish-header">
          <span className="badge-icon">{gradeBadge}</span>
          <h2>Quiz Completed!</h2>
          <p className="finish-subtitle">{gradeTitle}</p>
        </div>

        <div className="score-summary-grid">
          <div className="summary-box">
            <span className="box-val">{score} / {questions.length}</span>
            <span className="box-label">Final Score</span>
          </div>

          <div className="summary-box">
            <span className="box-val">{percentage}%</span>
            <span className="box-label">Accuracy Rate</span>
          </div>

          <div className="summary-box">
            <span className="box-val">{formatTime(secondsElapsed)}</span>
            <span className="box-label">Time Taken</span>
          </div>
        </div>

        <div className="actions-bar" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
          <button className="btn btn-primary" onClick={handleRestart}>
            <RotateCcw size={18} /> Retake Quiz
          </button>
        </div>

        {/* Detailed End-of-Quiz Review Section */}
        <div className="review-section">
          <div className="review-header">
            <div className="review-title-row">
              <div>
                <h3><HelpCircle size={20} /> Official Saturday Answer Key</h3>
                <p className="review-subtitle">Review questions, answers, and explanations at a glance</p>
              </div>

              <div className="view-style-toggle">
                <button 
                  className={`view-btn ${viewStyle === 'compact' ? 'active' : ''}`}
                  onClick={() => setViewStyle('compact')}
                  title="Compact 1-Page Answer Sheet"
                >
                  <List size={16} /> Compact
                </button>
                <button 
                  className={`view-btn ${viewStyle === 'detailed' ? 'active' : ''}`}
                  onClick={() => setViewStyle('detailed')}
                  title="Detailed 4-Option View"
                >
                  <Layers size={16} /> Detailed
                </button>
              </div>
            </div>
            
            <div className="review-controls-bar">
              <div className="review-filter-bar">
                <button 
                  className={`filter-chip ${reviewFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('all')}
                >
                  All ({questions.length})
                </button>
                <button 
                  className={`filter-chip ${reviewFilter === 'missed' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('missed')}
                  style={{ borderColor: missedCount > 0 ? 'var(--accent-rose)' : '' }}
                >
                  Missed ({missedCount})
                </button>
                <button 
                  className={`filter-chip ${reviewFilter === 'correct' ? 'active' : ''}`}
                  onClick={() => setReviewFilter('correct')}
                >
                  Correct ({score})
                </button>
              </div>

              <button className="btn-text-toggle" onClick={toggleExpandAll}>
                {isAllExpanded ? 'Collapse All Explanations' : 'Expand All Explanations'}
              </button>
            </div>
          </div>

          <div className={`review-list ${viewStyle}`}>
            {filteredReviewQuestions.length === 0 ? (
              <div className="empty-review-msg">No questions match the selected filter.</div>
            ) : (
              filteredReviewQuestions.map(({ q, idx, ansInfo }) => {
                const cObj = CATEGORIES[q.category.toUpperCase()] || { name: 'General', icon: '❓', color: '#6b7280' };
                const isUserCorrect = ansInfo.isCorrect;
                const userChoiceIdx = ansInfo.userSelect;
                const correctIdx = q.answer;
                const isExpanded = !!expandedItems[idx];

                // Compact Row Render
                if (viewStyle === 'compact') {
                  return (
                    <div key={q.id || idx} className={`compact-review-row ${isUserCorrect ? 'row-correct' : 'row-incorrect'}`}>
                      <div className="compact-row-main" onClick={() => toggleExpandItem(idx)}>
                        <div className="compact-left">
                          <span className="q-badge-sm">Q{idx + 1}</span>
                          <span className="cat-icon-sm" title={cObj.name}>{cObj.icon}</span>
                          <span className="compact-q-text">{q.question}</span>
                        </div>

                        <div className="compact-right">
                          {quizMode === 'multiple_choice' ? (
                            isUserCorrect ? (
                              <span className="ans-pill-compact pill-right">
                                <Check size={14} /> {q.options[correctIdx]}
                              </span>
                            ) : (
                              <div className="wrong-right-pair">
                                <span className="ans-pill-compact pill-wrong" title="Your Choice">
                                  <X size={14} /> {userChoiceIdx >= 0 ? q.options[userChoiceIdx] : 'None'}
                                </span>
                                <span className="ans-pill-compact pill-right" title="Correct Answer">
                                  <Check size={14} /> {q.options[correctIdx]}
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="wrong-right-pair">
                              <span className={`ans-pill-compact ${isUserCorrect ? 'pill-right' : 'pill-wrong'}`}>
                                {isUserCorrect ? <Check size={14} /> : <X size={14} />} {isUserCorrect ? 'Got It' : 'Missed'}
                              </span>
                              <span className="ans-pill-compact pill-gold">
                                Answer: {q.options[correctIdx]}
                              </span>
                            </div>
                          )}

                          <button className="expand-chevron-btn">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Explanation Drawer */}
                      {isExpanded && (
                        <div className="compact-exp-drawer">
                          <p className="exp-text"><strong>Quizmaster Explanation:</strong> {q.explanation}</p>
                          {q.tip && (
                            <div className="tip-box-sm">
                              <strong>💡 Memory Trick:</strong> {q.tip}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // Detailed Card Render
                return (
                  <div key={q.id || idx} className={`review-card ${isUserCorrect ? 'correct-card' : 'incorrect-card'}`}>
                    <div className="review-card-top">
                      <div className="review-card-meta">
                        <span className="q-num-badge">Q{idx + 1}</span>
                        <span className="category-pill" style={{ backgroundColor: `${cObj.color}22`, color: cObj.color, borderColor: `${cObj.color}44` }}>
                          <span>{cObj.icon}</span> {cObj.name}
                        </span>
                      </div>
                      
                      <span className={`status-tag ${isUserCorrect ? 'tag-correct' : 'tag-incorrect'}`}>
                        {isUserCorrect ? (
                          <><Check size={14} /> Correct</>
                        ) : (
                          <><X size={14} /> Incorrect</>
                        )}
                      </span>
                    </div>

                    <h4 className="review-question-text">{q.question}</h4>

                    {/* Multiple Choice Mode Review */}
                    {quizMode === 'multiple_choice' && (
                      <div className="review-answers-grid">
                        {q.options.map((optStr, optIdx) => {
                          let optClass = 'review-opt-normal';
                          if (optIdx === correctIdx) {
                            optClass = 'review-opt-correct';
                          } else if (optIdx === userChoiceIdx && !isUserCorrect) {
                            optClass = 'review-opt-wrong';
                          }

                          return (
                            <div key={optIdx} className={`review-opt-pill ${optClass}`}>
                              <span className="opt-letter">{String.fromCharCode(65 + optIdx)}</span>
                              <span className="opt-text">{optStr}</span>
                              {optIdx === correctIdx && <CheckCircle2 size={16} className="icon-right" />}
                              {optIdx === userChoiceIdx && !isUserCorrect && <XCircle size={16} className="icon-wrong" />}
                              {optIdx === userChoiceIdx && isUserCorrect && (
                                <span className="your-badge">Your Answer</span>
                              )}
                              {optIdx === userChoiceIdx && !isUserCorrect && (
                                <span className="your-wrong-badge">Your Answer</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Newspaper Reveal Mode Review */}
                    {quizMode === 'newspaper_reveal' && (
                      <div className="newspaper-review-ans">
                        <div className="official-ans-banner">
                          <span className="ans-tag-label">Official Answer:</span>
                          <span className="ans-tag-val">{q.options[correctIdx]}</span>
                        </div>
                        <div className={`user-self-grade ${isUserCorrect ? 'grade-yes' : 'grade-no'}`}>
                          {isUserCorrect ? '✓ Self-graded as Correct' : '✕ Self-graded as Missed'}
                        </div>
                      </div>
                    )}

                    {/* Explanation & Memory Tip */}
                    <div className="review-explanation-box">
                      <p className="exp-text"><strong>Explanation:</strong> {q.explanation}</p>
                      {q.tip && (
                        <div className="tip-box" style={{ marginTop: '0.5rem' }}>
                          <strong>💡 Memory Trick:</strong> {q.tip}
                        </div>
                      )}
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

  return (
    <div className="quiz-simulator">
      {/* Top Controller Bar */}
      <div className="quiz-top-bar">
        <div className="progress-container">
          <div className="progress-text">
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span className="score-pill">Score: {score}</span>
          </div>
          <div className="progress-bar-track">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} 
            />
          </div>
        </div>

        <div className="mode-toggle">
          <button 
            className={`mode-btn ${quizMode === 'multiple_choice' ? 'active' : ''}`}
            onClick={() => setQuizMode('multiple_choice')}
            title="Training Mode with 4 Options"
          >
            Multiple Choice
          </button>
          <button 
            className={`mode-btn ${quizMode === 'newspaper_reveal' ? 'active' : ''}`}
            onClick={() => setQuizMode('newspaper_reveal')}
            title="Real Newspaper Mode (Recall first, then reveal)"
          >
            Newspaper Reveal
          </button>
          <div className="timer-badge">
            <Clock size={16} />
            <span>{formatTime(secondsElapsed)}</span>
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="question-card">
        <div className="question-header">
          <span className="category-pill" style={{ backgroundColor: `${catObj.color}22`, color: catObj.color, borderColor: `${catObj.color}44` }}>
            <span className="cat-icon">{catObj.icon}</span> {catObj.name}
          </span>
          <span className={`diff-pill ${currentQ.difficulty.toLowerCase()}`}>
            {currentQ.difficulty}
          </span>
        </div>

        <h2 className="question-text">{currentQ.question}</h2>

        {/* Mode 1: Multiple Choice Options */}
        {quizMode === 'multiple_choice' && (
          <div className="options-grid">
            {currentQ.options.map((opt, idx) => {
              let optState = '';
              if (isAnswered) {
                if (idx === currentQ.answer) optState = 'correct';
                else if (idx === selectedOption) optState = 'incorrect';
                else optState = 'disabled';
              }

              return (
                <button
                  key={idx}
                  className={`option-btn ${optState} ${selectedOption === idx ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(idx)}
                  disabled={isAnswered}
                >
                  <span className="option-prefix">{String.fromCharCode(65 + idx)}</span>
                  <span className="option-label">{opt}</span>
                  {isAnswered && idx === currentQ.answer && <CheckCircle2 className="icon-right" size={20} />}
                  {isAnswered && idx === selectedOption && idx !== currentQ.answer && <XCircle className="icon-wrong" size={20} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Mode 2: Newspaper Reveal Mode */}
        {quizMode === 'newspaper_reveal' && (
          <div className="newspaper-reveal-box">
            {!isRevealed ? (
              <div className="reveal-prompt">
                <p>Think of your answer in your head as if reading the Saturday paper!</p>
                <button className="btn btn-secondary" onClick={() => setIsRevealed(true)}>
                  <Eye size={18} /> Reveal Answer
                </button>
              </div>
            ) : (
              <div className="revealed-content">
                <div className="answer-highlight">
                  <span className="ans-label">Correct Answer:</span>
                  <span className="ans-val">{currentQ.options[currentQ.answer]}</span>
                </div>

                {!isAnswered && (
                  <div className="self-grading-buttons">
                    <p>Did you get it right?</p>
                    <div className="grade-btns">
                      <button className="btn btn-success" onClick={() => handleNewspaperReveal(true)}>
                        <CheckCircle2 size={18} /> Yes, Got It!
                      </button>
                      <button className="btn btn-danger" onClick={() => handleNewspaperReveal(false)}>
                        <XCircle size={18} /> Missed It
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hint Box */}
        {!isAnswered && (
          <div className="hint-section">
            <button className="hint-btn" onClick={() => setShowHint(!showHint)}>
              <Lightbulb size={16} /> {showHint ? 'Hide Quizmaster Hint' : 'Need a Hint?'}
            </button>
            {showHint && (
              <div className="hint-card">
                <p>💡 {currentQ.tip}</p>
              </div>
            )}
          </div>
        )}

        {/* Post-Answer Explanation Box */}
        {isAnswered && (
          <div className="explanation-card">
            <h3><HelpCircle size={18} /> Quizmaster's Deep Dive & Explanation</h3>
            <p className="explanation-text">{currentQ.explanation}</p>
            {currentQ.tip && (
              <div className="tip-box">
                <strong>🧠 Memory Trick:</strong> {currentQ.tip}
              </div>
            )}
          </div>
        )}

        {/* Next Button */}
        {isAnswered && (
          <div className="next-action-bar">
            <button className="btn btn-primary next-btn" onClick={handleNext}>
              <span>{currentIndex < questions.length - 1 ? 'Next Question' : 'Complete & View Results'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
