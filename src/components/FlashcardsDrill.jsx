import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bird, Check, Coins, Crown, Flag, FlaskConical, Gem, Ghost, Hash, Heart,
  Landmark, Languages, Layers, Map as MapIcon, Microscope, Orbit, Radio, RotateCw, Star, Zap
} from 'lucide-react';
import { FLASHCARD_DECKS as CORE_DECKS } from '../data/flashcardsData';
import { EXTRA_DECKS } from '../data/flashcardsExtra';
import { loadLive, saveLive } from '../lib/persist';
import { Button, Pill } from './ui';

// Core decks first, then the classic quiz lists (anniversaries, birthstones,
// phobias...). Two files so each can be rebuilt without touching the other.
const FLASHCARD_DECKS = [...CORE_DECKS, ...EXTRA_DECKS];

// The deck data carries emoji; the UI shows a lucide icon per deck id instead.
const DECK_ICONS = {
  aus_pms: Landmark,
  tricky_capitals: MapIcon,
  chemical_symbols: FlaskConical,
  gods_equivalents: Zap,
  collective_nouns: Bird,
  wedding_anniversaries: Heart,
  birthstones: Gem,
  star_signs: Star,
  phobias: Ghost,
  ologies: Microscope,
  nato_alphabet: Radio,
  roman_numerals: Hash,
  us_presidents: Flag,
  british_monarchs: Crown,
  greek_alphabet: Languages,
  planets_moons: Orbit,
  world_currencies: Coins
};
const DeckIcon = ({ id, size = 24 }) => {
  const Glyph = DECK_ICONS[id] || Layers;
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" />;
};

// Mastered cards are kept per deck, as the list of card positions in that deck,
// so closing the app does not forget them (and they sync with the rest of the
// progress). Positions past the end of the deck, from an older, longer deck, are dropped.
const masteredKey = (deckId) => `flashcards_${deckId}`;
const loadMastered = (deck) => {
  const raw = loadLive(masteredKey(deck.id));
  return Array.isArray(raw) ? raw.filter((i) => Number.isInteger(i) && i >= 0 && i < deck.cards.length) : [];
};

export default function FlashcardsDrill() {
  const [selectedDeckId, setSelectedDeckId] = useState(FLASHCARD_DECKS[0].id);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastered, setMastered] = useState(() =>
    Object.fromEntries(FLASHCARD_DECKS.map((d) => [d.id, loadMastered(d)]))
  );

  const activeDeck = FLASHCARD_DECKS.find((d) => d.id === selectedDeckId) || FLASHCARD_DECKS[0];
  const currentCard = activeDeck.cards[cardIndex];
  const deckMastered = mastered[activeDeck.id] || [];
  const isCurrentMastered = deckMastered.includes(cardIndex);

  const handleNextCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev + 1) % activeDeck.cards.length);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev - 1 + activeDeck.cards.length) % activeDeck.cards.length);
  };

  const toggleMastered = () => {
    const nextList = isCurrentMastered
      ? deckMastered.filter((i) => i !== cardIndex)
      : [...deckMastered, cardIndex].sort((a, b) => a - b);
    setMastered((prev) => ({ ...prev, [activeDeck.id]: nextList }));
    saveLive(masteredKey(activeDeck.id), nextList.length ? nextList : null);
  };

  return (
    <div className="flashcards quiz-screen" data-section="weekend">
      <div className="deck-picker" role="group" aria-label="Choose a deck">
        {FLASHCARD_DECKS.map((deck) => {
          const isActive = deck.id === selectedDeckId;
          const done = (mastered[deck.id] || []).length;
          return (
            <button
              key={deck.id}
              type="button"
              className="deck-tile"
              aria-pressed={isActive}
              onClick={() => {
                setSelectedDeckId(deck.id);
                setCardIndex(0);
                setIsFlipped(false);
              }}
            >
              <span className="deck-tile-icon"><DeckIcon id={deck.id} /></span>
              <span className="deck-tile-text">
                <span className="deck-tile-title">{deck.title}</span>
                <span className="deck-tile-count">
                  {done > 0 ? `${done} of ${deck.cards.length} mastered` : `${deck.cards.length} cards`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="deck-head">
        <div className="screen-head">
          <h2>{activeDeck.title}</h2>
          <p>{activeDeck.description}</p>
        </div>
        <Pill>Card {cardIndex + 1} of {activeDeck.cards.length}</Pill>
      </div>

      <button
        type="button"
        className="flip-card"
        data-flipped={isFlipped}
        onClick={() => setIsFlipped((f) => !f)}
      >
        <span className="flip-inner">
          <span className="flip-face flip-front" aria-hidden={isFlipped}>
            <span className="eyebrow">{activeDeck.category}</span>
            <span className="flip-text flip-question">{currentCard?.front}</span>
            <span className="flip-hint"><RotateCw size={14} aria-hidden="true" /> Tap to see the answer</span>
          </span>
          <span className="flip-face flip-back" aria-hidden={!isFlipped}>
            <span className="eyebrow">Answer and context</span>
            <span className="flip-text flip-answer">{currentCard?.back}</span>
            <span className="flip-hint"><RotateCw size={14} aria-hidden="true" /> Tap to flip back</span>
          </span>
        </span>
      </button>

      <div className="card-controls">
        <Button variant="secondary" onClick={handlePrevCard}>
          <ArrowLeft size={18} aria-hidden="true" /> Previous
        </Button>
        <Button
          variant={isCurrentMastered ? 'correct' : 'secondary'}
          className="card-controls-mid"
          aria-pressed={isCurrentMastered}
          onClick={toggleMastered}
        >
          <Check size={18} aria-hidden="true" />
          {isCurrentMastered ? 'Mastered' : 'Mark as mastered'}
        </Button>
        <Button variant="primary" onClick={handleNextCard}>
          Next <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
