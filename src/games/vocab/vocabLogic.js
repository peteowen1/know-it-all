// Pure logic for Word power: synonym, opposite and meaning rounds built from
// word families (src/data/vocab.json). Every round type comes from the same
// structure, so one new family adds all three kinds of question.

import { makeRng, hashString, shuffle } from '../../lib/rng.js';

export const ROUNDS = 10;
export const TYPES = ['syn', 'ant', 'meaning'];
export const LEVELS = { easy: [1, 2], hard: [2, 3], all: [1, 2, 3] };

/**
 * Index the families: group by id, each word's family, and `near` made
 * symmetric so the data only has to list a closeness once.
 */
export function indexGroups(groups) {
  const byId = new Map(groups.map((g) => [g.id, { ...g, near: new Set(g.near || []) }]));
  for (const g of byId.values()) for (const n of g.near) byId.get(n)?.near.add(g.id);
  const familyOf = new Map();
  for (const g of byId.values()) for (const [w] of g.words) familyOf.set(w, g.id);
  return { byId, familyOf };
}

const defOf = (g, word) => g.words.find(([w]) => w === word)[1];

/**
 * Could these two families be confused for each other? Same family, listed as
 * near, or opposites. Decoys must be clear of all of these so exactly one
 * answer (or one set of answers) is right.
 */
const related = (a, b) => a.id === b.id || a.near.has(b.id) || b.near.has(a.id) || a.ant === b.id;

/** Pick `n` families of `pos`, none related to `avoid` or to each other. */
function pickDecoyGroups(all, avoid, pos, n, rand) {
  const chosen = [];
  for (const g of shuffle(all, rand)) {
    if (chosen.length === n) break;
    if (g.pos !== pos) continue;
    if (avoid.some((a) => related(a, g) || related(g, a))) continue;
    if (chosen.some((c) => related(c, g) || related(g, c))) continue;
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
function synRound(g, target, all, rand) {
  const k = g.level >= 3 && g.words.length >= 3 ? 3 : 2;
  const right = [target, ...shuffle(g.words.map(([w]) => w).filter((w) => w !== target), rand).slice(0, k - 1)];
  const decoys = pickDecoyGroups(all, [g], g.pos, 5 - k, rand);
  if (decoys.length < 5 - k) return null;
  const options = shuffle([...right, ...decoys.map((d) => oneWord(d, rand))], rand);
  return { type: 'syn', group: g.id, target, options, answer: right, pick: k };
}

/**
 * Opposites: one word, four options. One is from the opposite family, one is
 * a SYNONYM of the prompt (the classic trap, and worth seeing next to the
 * opposite), two are unrelated.
 */
function antRound(g, target, byId, all, rand) {
  const opp = byId.get(g.ant);
  if (!opp) return null;
  const answer = oneWord(opp, rand);
  const trap = oneWord(g, rand, [target]);
  const decoys = pickDecoyGroups(all, [g, opp], g.pos, 2, rand);
  if (decoys.length < 2) return null;
  const options = shuffle([answer, trap, ...decoys.map((d) => oneWord(d, rand))], rand);
  return { type: 'ant', group: g.id, target, options, answer: [answer], pick: 1 };
}

/** Meaning: a definition, four words. Only the defined word fits. */
function meaningRound(g, target, all, rand) {
  const decoys = pickDecoyGroups(all, [g], g.pos, 3, rand);
  if (decoys.length < 3) return null;
  const options = shuffle([target, ...decoys.map((d) => oneWord(d, rand))], rand);
  return { type: 'meaning', group: g.id, target, prompt: defOf(g, target), options, answer: [target], pick: 1 };
}

/** One round of `type` about word `target` from family `g`, or null if no fair round can be built. */
export function roundFor(type, g, target, byId, all, rand) {
  if (type === 'syn') return synRound(g, target, all, rand);
  if (type === 'ant') return antRound(g, target, byId, all, rand);
  return meaningRound(g, target, all, rand);
}

/**
 * A game of `count` rounds.
 *
 * `type` is one of TYPES or 'mixed'. `weights` maps word -> draw weight (from
 * itemWeights), so words you miss come round again sooner. No family appears
 * twice in one game.
 */
export function buildVocabRounds(groups, { seed = Date.now(), count = ROUNDS, type = 'mixed', level = 'all', weights = {} } = {}) {
  const rand = makeRng(hashString(`vocab:${seed}`));
  const { byId } = indexGroups(groups);
  const all = [...byId.values()];
  const levels = LEVELS[level] || LEVELS.all;
  const types = type === 'mixed' ? TYPES : [type];
  const usedGroups = new Set();
  const rounds = [];

  for (let tries = 0; rounds.length < count && tries < count * 20; tries++) {
    const t = types[rounds.length % types.length];
    const pool = all.filter((g) => levels.includes(g.level) && !usedGroups.has(g.id) && (t !== 'ant' || byId.has(g.ant)));
    if (!pool.length) break;
    const words = pool.flatMap((g) => g.words.map(([w]) => ({ w, g })));
    const { w, g } = weightedPick(words, (x) => weights[x.w] ?? 1.5, rand);
    const round = roundFor(t, g, w, byId, all, rand);
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
export function explainRound(round, groups) {
  const { byId, familyOf } = indexGroups(groups);
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
