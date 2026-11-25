// Pure logic for Find it on the map: which countries a round asks.
// No React; scripts/test-logic.mjs covers it.

export const ROUND = 10;

/** The codes a view can ask: shapes marked playable (big enough to tap on a phone). */
export const playableCodes = (view) => [...new Set(view.shapes.filter((s) => s.playable).map((s) => s.code))];

/**
 * `n` different codes, drawn by weight without replacement: countries you
 * miss come up more often (gameStats.js itemWeights).
 */
export function pickTargets(codes, weights, rand, n = ROUND) {
  const left = [...codes];
  const out = [];
  while (out.length < n && left.length) {
    const total = left.reduce((s, c) => s + (weights[c] ?? 1), 0);
    let r = rand() * total;
    let i = 0;
    for (; i < left.length - 1; i++) {
      r -= weights[left[i]] ?? 1;
      if (r < 0) break;
    }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}
