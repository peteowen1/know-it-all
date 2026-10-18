// The "?" on every game: how to play, how it scores, where the answers come
// from (text in ../howItWorks.js). App wraps the open game in <HowProvider>,
// so both the start screen (GameSetup) and the play screen (PlayHead) show the
// same button without any game passing anything; one open/closed state is
// shared, so it stays open from the start screen into the round.
import React, { createContext, useContext, useId, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { HOW_IT_WORKS } from '../howItWorks';

const HowContext = createContext(null);

export function HowProvider({ gameId, children }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const how = HOW_IT_WORKS[gameId];
  const value = how ? { how, open, toggle: () => setOpen((o) => !o), panelId } : null;
  return <HowContext.Provider value={value}>{children}</HowContext.Provider>;
}

/** The round "?" button; renders nothing for a screen without an explainer. */
export function HowButton() {
  const ctx = useContext(HowContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      className="icon-btn how-btn"
      aria-expanded={ctx.open}
      aria-controls={ctx.panelId}
      aria-label="How it works"
      title="How it works"
      onClick={ctx.toggle}
    >
      <CircleHelp size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

/** The explainer itself, shown under the header row while open. */
export function HowPanel() {
  const ctx = useContext(HowContext);
  if (!ctx || !ctx.open) return null;
  const { how, panelId } = ctx;
  return (
    <dl className="how-panel" id={panelId}>
      <dt>How to play</dt>
      <dd>{how.play}</dd>
      <dt>Scoring</dt>
      <dd>{how.score}</dd>
      <dt>Where the answers come from</dt>
      <dd>{how.source}</dd>
    </dl>
  );
}
