// Setup: the shared pieces of a game's setup screen: Chip, SetupRow and AnswerModeToggle.
// Copied here from geo/CountryQuiz.jsx so games can import them from one neutral place.
// The originals stay in CountryQuiz until the geo package switches its imports and deletes them.
import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

export const Chip = ({ active, children, className = '', ...rest }) => (
  <button type="button" className={`filter-chip ${active ? 'active' : ''} ${className}`.trim()} aria-pressed={!!active} {...rest}>
    {children}
  </button>
);

// `caption` is a visible one-line explanation under the chips (phones have no hover titles).
export const SetupRow = ({ label, caption, children }) => (
  <div className="setup-group">
    <span className="setup-group-label">{label}</span>
    <div className="chip-row wrap">{children}</div>
    {caption && <p className="setup-caption">{caption}</p>}
  </div>
);

export function AnswerModeToggle({ mode, onChange }) {
  return (
    <div className="chip-row">
      <Chip active={mode === 'choice'} onClick={() => onChange('choice')} title="Four options, easier">
        Multiple choice
      </Chip>
      <Chip active={mode === 'reveal'} onClick={() => onChange('reveal')} title="Answer in your head, reveal, then mark yourself: harder">
        <ArrowLeftRight size={14} /> Reveal &amp; self-mark
      </Chip>
    </div>
  );
}
