// QuizOptions: the four answer rows of a multiple-choice question.
// Used by QuizSimulator and the weakness vault practice pane, so both look and behave the same.
// State is exposed as data-state (idle | correct | wrong | dim | gone); the CSS in quiz.css does the rest.
// `eliminated` are the options removed by fifty-fifty; they stay in place so the layout does not shift.
import React from 'react';
import { Check, X } from 'lucide-react';

export default function QuizOptions({ options, correctIndex, selected, answered, eliminated = [], onSelect }) {
  return (
    <div className="options-grid" role="group" aria-label="Answer options">
      {options.map((opt, idx) => {
        const gone = eliminated.includes(idx);
        let state = 'idle';
        if (answered) {
          if (idx === correctIndex) state = 'correct';
          else if (idx === selected) state = 'wrong';
          else state = 'dim';
        } else if (gone) {
          state = 'gone';
        }
        return (
          <button
            key={idx}
            type="button"
            className="option-btn"
            data-state={state}
            onClick={() => onSelect(idx)}
            disabled={answered || gone}
          >
            <span className="option-key" aria-hidden="true">{String.fromCharCode(65 + idx)}</span>
            <span className="option-label">{opt}</span>
            {state === 'correct' && (
              <>
                <Check className="option-mark" size={20} strokeWidth={2} aria-hidden="true" />
                <span className="visually-hidden">Correct answer</span>
              </>
            )}
            {state === 'wrong' && (
              <>
                <X className="option-mark" size={20} strokeWidth={2} aria-hidden="true" />
                <span className="visually-hidden">Your answer, incorrect</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
