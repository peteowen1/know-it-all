// verdictFor: the one-line Newsreader italic verdict on a results screen.
// Used by every game's GameResults.

/** One line in Newsreader italic for the results screen, from the share of the round got right. */
export function verdictFor(score, total) {
  if (!total) return '';
  const p = score / total;
  if (p === 1) return 'A clean sweep.';
  if (p >= 0.8) return 'Very strong. Only a few slipped through.';
  if (p >= 0.5) return 'A solid round, with plenty still to learn.';
  return 'A tough one. The misses are worth another look below.';
}
