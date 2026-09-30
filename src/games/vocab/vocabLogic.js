// Pure logic for Word play: synonym, opposite and meaning rounds built from
// word families (src/data/vocab.json). Every round type comes from the same
// structure, so one new family adds all three kinds of question.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

export const ROUNDS = 10;
export const TYPES = ['syn', 'ant', 'meaning'];
export const LEVELS = { easy: [1, 2], hard: [2, 3], all: [1, 2, 3] };
export const REVIEW_SHARE = 0.3;

/**
 * Index the vocab data ({ groups, clash }): families by id, each word's
 * family, `near` made symmetric so the data only lists a closeness once, and
 * the clash table decoded. Cached per data object, because the reveal screen
 * asks for it on every render.
 *
 * `clash` is a bit matrix over the families in file order, built from word
 * vectors by scripts/build-vocab.py: bit (i, j) set means i and j are close
 * enough in meaning (or opposite enough) that they must not share a question.
 */
const cache = new WeakMap();
export function indexGroups(vocab) {
  if (cache.has(vocab)) return cache.get(vocab);
  const { groups, clash } = vocab;
  const byId = new Map(groups.map((g, i) => [g.id, { ...g, index: i, near: new Set(g.near || []) }]));
  for (const g of byId.values()) for (const n of g.near) byId.get(n)?.near.add(g.id);
  const familyOf = new Map();
  for (const g of byId.values()) for (const [w] of g.words) familyOf.set(w, g.id);
  let bits = null;
  if (clash && clash.n === groups.length) {
    const raw = atob(clash.bits);
    bits = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bits[i] = raw.charCodeAt(i);
  }
  const n = groups.length;
  const clashes = (a, b) => {
    if (!bits) return false;
    const k = a.index * n + b.index;
    return (bits[k >> 3] >> (k & 7)) & 1;
  };
  const out = { byId, familyOf, clashes };
  cache.set(vocab, out);
  return out;
}

const defOf = (g, word) => g.words.find(([w]) => w === word)[1];

/**
 * Could these two families be confused for each other? Same family, listed as
 * near, opposites, or marked in the clash table. Decoys must be clear of all of these so exactly one
 * answer (or one set of answers) is right.
 */
const related = (a, b, clashes) =>
  a.id === b.id || a.near.has(b.id) || b.near.has(a.id) || a.ant === b.id || b.ant === a.id || clashes(a, b);

/**
 * Pick `n` families of `pos`, none related to `avoid` or to each other.
 * `ix` is the indexed data from indexGroups plus `all`, its families as a list.
 */
function pickDecoyGroups(ix, avoid, pos, n, rand) {
  const rel = (a, b) => related(a, b, ix.clashes);
  const chosen = [];
  for (const g of shuffle(ix.byPos.get(pos) || [], rand)) {
    if (chosen.length === n) break;
    if (avoid.some((a) => rel(a, g))) continue;
    if (chosen.some((c) => rel(c, g))) continue;
    chosen.push(g);
  }
  return chosen;
}

const oneWord = (g, rand, not = []) => shuffle(g.words.filter(([w]) => !not.includes(w)), rand)[0][0];

/** Weighted draw: higher weight, more likely. Weights come from gameStats.itemWeights. */
function weightedPick(items, weightOf, rand) {
  const total = items.reduce((s, x) => s + weightOf(x), 0);
  let r = rand() * total;
  for (const x of items) {
    r -= weightOf(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

/**
 * Synonyms: five words, 2 or 3 of them from one family. Harder families get
 * three right answers, which is the harder form of the question.
 */
function synRound(g, target, ix, rand) {
  const k = g.level >= 3 && g.words.length >= 3 ? 3 : 2;
  const right = [target, ...shuffle(g.words.map(([w]) => w).filter((w) => w !== target), rand).slice(0, k - 1)];
  const decoys = pickDecoyGroups(ix, [g], g.pos, 5 - k, rand);
  if (decoys.length < 5 - k) return null;
  const options = shuffle([...right, ...decoys.map((d) => oneWord(d, rand))], rand);
  return { type: 'syn', group: g.id, target, options, answer: right, pick: k };
}

/**
 * Opposites: one word, four options. One is from the opposite family, one is
 * a SYNONYM of the prompt (the classic trap, and worth seeing next to the
 * opposite), two are unrelated.
 */
function antRound(g, target, ix, rand) {
  const opp = ix.byId.get(g.ant);
  if (!opp) return null;
  const answer = oneWord(opp, rand);
  const trap = oneWord(g, rand, [target]);
  const decoys = pickDecoyGroups(ix, [g, opp], g.pos, 2, rand);
  if (decoys.length < 2) return null;
  const options = shuffle([answer, trap, ...decoys.map((d) => oneWord(d, rand))], rand);
  return { type: 'ant', group: g.id, target, options, answer: [answer], pick: 1 };
}

/** Meaning: a definition, four words. Only the defined word fits. */
function meaningRound(g, target, ix, rand) {
  const decoys = pickDecoyGroups(ix, [g], g.pos, 3, rand);
  if (decoys.length < 3) return null;
  const options = shuffle([target, ...decoys.map((d) => oneWord(d, rand))], rand);
  return { type: 'meaning', group: g.id, target, prompt: defOf(g, target), options, answer: [target], pick: 1 };
}

/** The indexed data plus its families as a list: what every round builder takes. */
export function roundContext(vocab) {
  const ix = indexGroups(vocab);
  const all = [...ix.byId.values()];
  const byPos = new Map();
  for (const g of all) byPos.set(g.pos, [...(byPos.get(g.pos) || []), g]);
  return { ...ix, all, byPos };
}

/** One round of `type` about word `target` from family `g`, or null if no fair round can be built. */
export function roundFor(type, g, target, ix, rand) {
  if (type === 'syn') return synRound(g, target, ix, rand);
  if (type === 'ant') return antRound(g, target, ix, rand);
  return meaningRound(g, target, ix, rand);
}

/**
 * A game of `count` rounds.
 *
 * `type` is one of TYPES or 'mixed'. `weights` maps word -> draw weight (from
 * itemWeights). `review` is the words the player has missed: about
 * REVIEW_SHARE of the rounds are drawn from them while any are left, because
 * with thousands of words a missed word's weight alone would bring it back
 * about once in a hundred games. No family appears twice in one game.
 */
export function buildVocabRounds(vocab, { seed = Date.now(), count = ROUNDS, type = 'mixed', level = 'all', weights = {}, review = new Set() } = {}) {
  const rand = makeRng(hashString(`vocab:${seed}`));
  const ix = roundContext(vocab);
  const { byId, all } = ix;
  const levels = LEVELS[level] || LEVELS.all;
  const types = type === 'mixed' ? TYPES : [type];
  const usedGroups = new Set();
  const rounds = [];

  // Candidate words per round type, built once per game rather than per round.
  const candidates = new Map(types.map((t) => [t, all
    .filter((g) => levels.includes(g.level) && (t !== 'ant' || byId.has(g.ant)))
    .flatMap((g) => g.words.map(([w]) => ({ w, g })))]));

  for (let tries = 0; rounds.length < count && tries < count * 20; tries++) {
    const t = types[rounds.length % types.length];
    const words = candidates.get(t).filter((x) => !usedGroups.has(x.g.id));
    if (!words.length) break;
    const missed = words.filter((x) => review.has(x.w));
    const from = missed.length && rand() < REVIEW_SHARE ? missed : words;
    const { w, g } = weightedPick(from, (x) => weights[x.w] ?? 1.5, rand);
    const round = roundFor(t, g, w, ix, rand);
    if (!round) continue;
    usedGroups.add(g.id);
    rounds.push({ ...round, id: `${t}:${g.id}:${w}` });
  }
  return type === 'mixed' ? shuffle(rounds, rand) : rounds;
}

/** Right only if exactly the answer set was picked. */
export function isCorrect(round, picked) {
  return picked.length === round.answer.length && round.answer.every((w) => picked.includes(w));
}

/**
 * Everything the reveal card needs: each option with its definition and what
 * it is relative to the prompt, plus the whole family and its opposites.
 */
export function explainRound(round, vocab) {
  const { byId, familyOf } = indexGroups(vocab);
  const g = byId.get(round.group);
  const opp = byId.get(g.ant);
  const options = round.options.map((word) => {
    const fg = byId.get(familyOf.get(word));
    let role = 'unrelated';
    if (fg.id === g.id) role = round.type === 'ant' ? 'trap' : 'same';
    else if (opp && fg.id === opp.id) role = 'opposite';
    return { word, def: defOf(fg, word), sense: fg.sense, role, right: round.answer.includes(word) };
  });
  return {
    sense: g.sense,
    family: g.words.map(([w, d]) => ({ word: w, def: d })),
    opposite: opp ? { sense: opp.sense, words: opp.words.map(([w, d]) => ({ word: w, def: d })) } : null,
    options
  };
}
