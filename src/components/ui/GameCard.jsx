// GameCard: the shell of every game screen (setup, play and results). Width md = 760px, sm = 640px.
// Used by GameBoard and GameResults, and directly by games that lay out their own body.
// Replaces the per-game ".card.game-setup / .names-game / .fbf-game" shells in games.css.
import React from 'react';
import Card from './Card';

export default function GameCard({ width = 'md', className = '', children, ...rest }) {
  return (
    <Card className={`game-card ${width === 'sm' ? 'game-card--sm' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Card>
  );
}
