import React, { useState } from 'react';
import { FLASHCARD_DECKS } from '../data/flashcardsData';
import { CheckCircle, ArrowLeft, ArrowRight } from 'lucide-react';

export default function FlashcardsDrill() {
  const [selectedDeckId, setSelectedDeckId] = useState(FLASHCARD_DECKS[0].id);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState({});

  const activeDeck = FLASHCARD_DECKS.find(d => d.id === selectedDeckId) || FLASHCARD_DECKS[0];
  const currentCard = activeDeck.cards[cardIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev + 1) % activeDeck.cards.length);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev - 1 + activeDeck.cards.length) % activeDeck.cards.length);
  };

  const toggleMastered = () => {
    const key = `${selectedDeckId}_${cardIndex}`;
    setMasteredCards(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const currentKey = `${selectedDeckId}_${cardIndex}`;
  const isCurrentMastered = !!masteredCards[currentKey];

  return (
    <div className="flashcards-container">
      {/* Deck Selector Header */}
      <div className="deck-selector-grid">
        {FLASHCARD_DECKS.map((deck) => {
          const isActive = deck.id === selectedDeckId;
          return (
            <button
              key={deck.id}
              className={`deck-card-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setSelectedDeckId(deck.id);
                setCardIndex(0);
                setIsFlipped(false);
              }}
            >
              <span className="deck-icon">{deck.icon}</span>
              <div className="deck-info">
                <h4>{deck.title}</h4>
                <p>{deck.cards.length} Flashcards</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Deck Overview */}
      <div className="active-deck-header">
        <div>
          <h2>{activeDeck.icon} {activeDeck.title}</h2>
          <p className="deck-desc">{activeDeck.description}</p>
        </div>
        <div className="card-counter-pill">
          Card {cardIndex + 1} of {activeDeck.cards.length}
        </div>
      </div>

      {/* Flip Card Container */}
      <div className="card-flip-wrapper" onClick={handleFlip}>
        <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
          {/* Card Front */}
          <div className="flip-card-front">
            <span className="card-category-badge">{activeDeck.category}</span>
            <h3 className="card-question-text">{currentCard?.front}</h3>
            <p className="flip-hint-text">👆 Click or Tap to Flip Answer</p>
          </div>

          {/* Card Back */}
          <div className="flip-card-back">
            <span className="card-category-badge answer-badge">Answer & Context</span>
            <p className="card-answer-text">{currentCard?.back}</p>
            <p className="flip-hint-text">👆 Click to Flip Back</p>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="card-controls-bar">
        <button className="btn btn-secondary" onClick={handlePrevCard}>
          <ArrowLeft size={18} /> Previous
        </button>

        <button 
          className={`btn ${isCurrentMastered ? 'btn-success' : 'btn-outline'}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleMastered();
          }}
        >
          <CheckCircle size={18} /> 
          {isCurrentMastered ? 'Mastered!' : 'Mark as Mastered'}
        </button>

        <button className="btn btn-secondary" onClick={handleNextCard}>
          Next <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
