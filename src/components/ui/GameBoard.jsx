// GameBoard: the play screen shell. Header (title, score pill, timer), optional input row, a message
// line, the body, then footer actions. Used by the names, list, chart and word games.
// `tone` colours the message: good | bad | undefined. `input` and `footer` are nodes.
import React from 'react';
import GameCard from './GameCard';
import Pill from './Pill';

export default function GameBoard({
  title, subtitle, score, timer, headExtra, input, message, tone, children, footer, width, className = '', ...rest
}) {
  return (
    <GameCard width={width} className={className} {...rest}>
      <div className="game-board-head">
        <h2 className="game-board-title">
          {title}
          {subtitle && <small>{subtitle}</small>}
        </h2>
        <div className="game-board-meta">
          {score != null && <Pill variant="accent">{score}</Pill>}
          {timer != null && <Pill>{timer}</Pill>}
          {headExtra}
        </div>
      </div>
      {input && <div className="game-board-input">{input}</div>}
      {message != null && (
        <p className="game-board-msg" data-tone={tone} role="status" aria-live="polite">
          {message}
        </p>
      )}
      <div className="game-board-body">{children}</div>
      {footer && <div className="game-board-foot">{footer}</div>}
    </GameCard>
  );
}
