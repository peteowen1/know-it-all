// GameResults: the one results screen for every game and the quiz. Centred column: eyebrow, hero
// numeral, one-line verdict, round squares, ONE primary and ONE secondary button, then `mostMissed`
// (a <MostMissed/>) and `children` (the answer review as AnswerRows). Fires confetti on a perfect round.
import React, { useEffect } from 'react';
import GameCard from './GameCard';
import Button from './Button';

export default function GameResults({
  eyebrow, score, total, hero, verdict, squares, celebrate,
  onPlayAgain, playAgainLabel = 'Play again', onChangeSettings, settingsLabel = 'Change settings',
  mostMissed, children, width, className = '', ...rest
}) {
  const perfect = celebrate ?? (total > 0 && score === total);

  useEffect(() => {
    if (!perfect) return undefined;
    let cancelled = false;
    // Loaded on demand: the library is only needed for a perfect round.
    import('canvas-confetti')
      .then((m) => {
        if (!cancelled) m.default({ particleCount: 90, spread: 70, origin: { y: 0.6 }, disableForReducedMotion: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [perfect]);

  const right = squares ? squares.filter(Boolean).length : 0;

  return (
    <GameCard width={width} className={`results ${className}`.trim()} {...rest}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <p className="results-hero">{hero ?? `${score} / ${total}`}</p>
      {verdict && <p className="results-verdict">{verdict}</p>}
      {squares && squares.length > 0 && (
        <div className="results-squares" role="img" aria-label={`${right} right, ${squares.length - right} wrong`}>
          {squares.map((ok, i) => (
            <span key={i} className="results-square" data-right={ok ? 'true' : 'false'} />
          ))}
        </div>
      )}
      <div className="results-actions">
        {onPlayAgain && (
          <Button variant="primary" onClick={onPlayAgain}>{playAgainLabel}</Button>
        )}
        {onChangeSettings && (
          <Button variant="secondary" onClick={onChangeSettings}>{settingsLabel}</Button>
        )}
      </div>
      {mostMissed}
      {children && <div className="results-review">{children}</div>}
    </GameCard>
  );
}
