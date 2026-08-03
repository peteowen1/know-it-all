// Deterministic RNG helpers.
//
// Why seeded and not Math.random(): quiz options are shuffled at render time.
// With Math.random() every React re-render (timer tick, hint toggle) would
// reshuffle the options underneath the user's cursor. A seed derived from the
// question id + quiz session keeps a question's option order fixed for the
// whole quiz, while still differing between quizzes.

/** 32-bit string hash (FNV-1a). Stable across runs and platforms. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for shuffling quiz options. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates. Returns a new array; never mutates the input.
 *
 * The old code used `arr.sort(() => 0.5 - Math.random())`, which is not a
 * uniform shuffle — V8's sort makes the first element far likelier to stay put.
 * That mattered here because every correct answer was stored at index 0.
 */
export function shuffle(arr, rng = Math.random) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pick `n` items uniformly at random without replacement. */
export function sample(arr, n, rng = Math.random) {
  return shuffle(arr, rng).slice(0, n);
}
