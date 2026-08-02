import React, { useState } from 'react';
import { CATEGORIES } from '../data/questionsData';
import { Trash2, RotateCcw, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';

export default function WeaknessVault({ missedQuestions, onRemoveMissed, onClearAll }) {
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);

  if (!missedQuestions || missedQuestions.length === 0) {
    return (
      <div className="empty-vault-card">
        <span className="empty-icon">🎉</span>
        <h2>Weakness Vault is Empty!</h2>
        <p>You haven't missed any questions yet, or all previously missed questions have been cleared!</p>
        <p className="empty-sub">Take a 25-question quiz to automatically populate your revision list with any questions you miss.</p>
      </div>
    );
  }

  const handleSelectQuestion = (q) => {
    setActiveQuestion(q);
    setSelectedOpt(null);
    setIsAnswered(false);
  };

  const handleAttemptAnswer = (idx) => {
    setSelectedOpt(idx);
    setIsAnswered(true);
  };

  return (
    <div className="weakness-vault-container">
      <div className="vault-header">
        <div>
          <h2>🎯 Weakness Vault & Revision Hub</h2>
          <p>Master questions you previously got wrong until you score 100%.</p>
        </div>
        <button className="btn btn-outline-danger" onClick={onClearAll}>
          <Trash2 size={16} /> Clear Vault ({missedQuestions.length})
        </button>
      </div>

      <div className="vault-split-layout">
        {/* Left List of Missed Questions */}
        <div className="missed-questions-list">
          {missedQuestions.map((q, idx) => {
            const catObj = CATEGORIES[q.category?.toUpperCase()] || { name: 'General', icon: '❓' };
            const isActive = activeQuestion?.id === q.id;

            return (
              <div 
                key={q.id || idx}
                className={`missed-q-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectQuestion(q)}
              >
                <div className="missed-q-top">
                  <span className="cat-badge">{catObj.icon} {catObj.name}</span>
                  <button 
                    className="remove-q-btn" 
                    title="Remove from vault"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMissed(q.id);
                      if (activeQuestion?.id === q.id) setActiveQuestion(null);
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

        {/* Right Detail / Practice Pane */}
        <div className="vault-practice-pane">
          {activeQuestion ? (
            <div className="vault-practice-card">
              <span className="cat-pill-sm">{activeQuestion.category}</span>
              <h3>{activeQuestion.question}</h3>

              <div className="options-grid">
                {activeQuestion.options.map((opt, idx) => {
                  let optState = '';
                  if (isAnswered) {
                    if (idx === activeQuestion.answer) optState = 'correct';
                    else if (idx === selectedOpt) optState = 'incorrect';
                    else optState = 'disabled';
                  }

                  return (
                    <button
                      key={idx}
                      className={`option-btn ${optState}`}
                      onClick={() => handleAttemptAnswer(idx)}
                      disabled={isAnswered}
                    >
                      <span className="option-prefix">{String.fromCharCode(65 + idx)}</span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className="vault-explanation-box">
                  <h4>Explanatory Context:</h4>
                  <p>{activeQuestion.explanation}</p>
                  {activeQuestion.tip && (
                    <p className="tip-text"><strong>Memory Trick:</strong> {activeQuestion.tip}</p>
                  )}
                  {selectedOpt === activeQuestion.answer && (
                    <div className="mastered-action">
                      <p className="success-msg">🎉 Correct! You've mastered this question.</p>
                      <button 
                        className="btn btn-success"
                        onClick={() => {
                          onRemoveMissed(activeQuestion.id);
                          setActiveQuestion(null);
                        }}
                      >
                        Remove from Revision Vault
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="select-prompt-card">
              <BookOpen size={40} className="icon-muted" />
              <h3>Select a question from the left to practice</h3>
              <p>Test yourself on individual questions you missed during full quizzes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
