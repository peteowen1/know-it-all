// Setup: the shared pieces of a game's setup screen: Chip, SetupRow, AnswerModeToggle and EarlierDays.
// Copied here from geo/CountryQuiz.jsx so games can import them from one neutral place.
// The originals stay in CountryQuiz until the geo package switches its imports and deletes them.
import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { dayLabel, openDay, pastDays } from '../../lib/day';

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

/**
 * Today's round or one of the last week's, on a daily game's setup screen.
 * The choice lives in the address (?day=2026-10-17, see src/lib/day.js), so
 * an earlier day's board can be bookmarked or sent to someone.
 */
export function EarlierDays({ day }) {
  return (
    <SetupRow label="Day" caption={day ? `The board everyone got on ${dayLabel(day)}. It does not count towards your streak.` : null}>
      <Chip active={!day} onClick={() => openDay(null)}>Today</Chip>
      {pastDays(7).map((d) => (
        <Chip key={d} active={day === d} onClick={() => openDay(d)}>{dayLabel(d)}</Chip>
      ))}
    </SetupRow>
  );
}
