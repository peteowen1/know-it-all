// Play: the screen pieces every game shares and the ui kit does not cover: the setup shell,
// the play-screen header, the option row (quiz answers), the Next bar and the self-mark pair.
// Used by every file under src/games/. Styles are in src/games.css (play-*, setup-*).
import React from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { GameCard, Button } from '../../components/ui';

/** The setup screen shell: title, "All games", a record line, the controls, a footnote. */
export function GameSetup({ title, section, record, note, onExit, className = '', children }) {
  return (
    <GameCard data-section={section} className={`setup ${className}`.trim()}>
      <div className="setup-head">
        <h2 className="setup-title">{title}</h2>
        <Button variant="tertiary" icon="ArrowLeft" onClick={onExit}>All games</Button>
      </div>
      {record && <p className="setup-record">{record}</p>}
      {children}
      {note && <p className="setup-foot">{note}</p>}
    </GameCard>
  );
}

/** The play-screen header: progress on the left, pills and small buttons on the right. */
export function PlayHead({ left, children }) {
  return (
    <div className="play-head">
      <p className="play-progress">{left}</p>
      {children && <div className="play-meta">{children}</div>}
    </div>
  );
}

/** "Whose flag is this?": the small label above a question. */
export const Ask = ({ children }) => <p className="eyebrow play-ask">{children}</p>;

/** The question itself, in the serif. */
export const Prompt = ({ children, className = '' }) => <h2 className={`play-prompt ${className}`.trim()}>{children}</h2>;

/**
 * One answer option. `state` is idle | selected | correct | wrong | dim, exposed as data-state.
 * `letter` is the A-D key on the left; leave it out for flag tiles. `pressable` adds aria-pressed
 * for multi-pick questions.
 */
export function Option({ letter, state = 'idle', pressable = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`play-option ${className}`.trim()}
      data-state={state}
      {...(pressable ? { 'aria-pressed': state === 'selected' } : {})}
      {...rest}
    >
      {letter && <span className="play-option-key" aria-hidden="true">{letter}</span>}
      <span className="play-option-label">{children}</span>
      {state === 'correct' && (
        <span className="play-option-mark"><Check size={20} strokeWidth={1.75} aria-hidden="true" /><span className="visually-hidden">Correct</span></span>
      )}
      {state === 'wrong' && (
        <span className="play-option-mark"><X size={20} strokeWidth={1.75} aria-hidden="true" /><span className="visually-hidden">Your answer, wrong</span></span>
      )}
    </button>
  );
}

export const OptionGrid = ({ flags = false, children }) => (
  <div className="play-options" data-flags={flags ? 'true' : undefined}>{children}</div>
);

const LETTERS = 'ABCDEFGH';

/**
 * A multiple-choice question with a self-mark alternative. `options` is [{ key, label, name }]:
 * `label` is what to show, `name` the accessible name when the label is an image (a flag).
 * `reveal` switches to "reveal, then mark yourself". Used by the country and chart quizzes.
 */
export function ChoiceQuestion({
  options, correctIndex, picked, answered, reveal, revealed, flags = false, answerNode,
  onPick, onReveal, onGrade
}) {
  if (!reveal) {
    return (
      <OptionGrid flags={flags}>
        {options.map((o, i) => {
          let state = 'idle';
          if (answered) state = i === correctIndex ? 'correct' : i === picked ? 'wrong' : 'dim';
          return (
            <Option
              key={o.key}
              letter={flags ? undefined : LETTERS[i]}
              state={state}
              disabled={answered}
              aria-label={o.name}
              onClick={() => onPick(i)}
            >
              {o.label}
            </Option>
          );
        })}
      </OptionGrid>
    );
  }
  if (!revealed) {
    return (
      <div className="play-grade">
        <Button variant="secondary" icon="Eye" onClick={onReveal}>Reveal</Button>
      </div>
    );
  }
  return (
    <div className="play-reveal">
      <div className="play-reveal-answer">{answerNode}</div>
      {!answered && (
        <div className="play-grade">
          <Button variant="correct" icon="Check" onClick={() => onGrade(true)}>Got it</Button>
          <Button variant="wrong" icon="X" onClick={() => onGrade(false)}>Missed it</Button>
        </div>
      )}
    </div>
  );
}

/** The sticky Next / Results button under an answered question. */
export function NextBar({ onClick, children = 'Next' }) {
  return (
    <div className="next-action-bar">
      <Button variant="primary" className="next-btn" onClick={onClick} autoFocus>
        {children} <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </Button>
    </div>
  );
}
