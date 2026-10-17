// The accepted answers for Fill the list rows, finished after Wikidata has
// supplied each person's name and label. Shared by scripts/build-lists.mjs and
// the tests, and safe to run on lists.json again: it only ever adds the forms
// below and removes ambiguous ones.
//
// Two jobs:
//   1. Add forms players actually type that Wikidata does not carry
//      ("Lloyd George", "Home" for Douglas-Home, "FDR").
//   2. Stop one answer fitting two different people. A bare surname shared by
//      two presidents (Johnson, Adams, Harrison, Bush, Roosevelt) belongs to
//      the earlier one only; the later one needs a first name. Otherwise
//      typing "Bush" fills whichever row happens to be checked first.

import { normalise } from '../../src/games/names/nameMatch.js';

// Additions by the name as it appears in the list. Each one is a form of a
// name that is certain: a double-barrelled surname written in full or in part,
// a nickname used by the person's own country, or a standard abbreviation.
export const EXTRA_ACCEPT = {
  'Alec Douglas-Home': ['Home', 'Douglas-Home', 'Alec Douglas-Home', 'Lord Home'],
  'David Lloyd George': ['Lloyd George', 'Lloyd-George'],
  'Henry Campbell-Bannerman': ['Bannerman', 'Campbell-Bannerman'],
  'H. H. Asquith': ['Herbert Asquith', 'Herbert Henry Asquith'],
  'Edward Heath': ['Ted Heath'],
  'James Callaghan': ['Jim Callaghan'],
  'Martin Van Buren': ['Van Buren'],
  'John Quincy Adams': ['Quincy Adams', 'J. Q. Adams'],
  'Franklin D. Roosevelt': ['FDR', 'Franklin Roosevelt'],
  'Lyndon B. Johnson': ['LBJ', 'Lyndon Johnson'],
  'John F. Kennedy': ['JFK'],
  'George W. Bush': ['W. Bush', 'George W Bush'],
  'George H. W. Bush': ['H. W. Bush']
};

const words = (s) => normalise(s).split(' ').filter(Boolean);

/**
 * `first last` for a name with a middle name or initial ("Franklin Roosevelt"
 * from "Franklin D. Roosevelt"). Skipped for titled names, which carry a comma.
 */
function firstLast(name) {
  if (name.includes(',')) return null;
  const w = name.split(' ');
  return w.length > 2 ? `${w[0]} ${w.at(-1)}` : null;
}

/**
 * Returns the terms with accept lists finished. Rows of one person (Baldwin
 * three times) keep identical lists. Forms are compared normalised, so
 * "Douglas-Home" and "douglas home" are the same form.
 */
export function finishAccepts(terms) {
  // Candidate forms per person, in the order they should be kept.
  const forms = new Map();
  for (const t of terms) {
    if (forms.has(t.name)) continue;
    // Names with hand-picked additions skip the automatic first-and-last form
    // (it would make "David George" out of David Lloyd George).
    const auto = EXTRA_ACCEPT[t.name] ? null : firstLast(t.name);
    const candidates = [...t.accept, ...(EXTRA_ACCEPT[t.name] || []), auto].filter(Boolean);
    const seen = new Set();
    forms.set(t.name, candidates.filter((f) => !seen.has(normalise(f)) && seen.add(normalise(f))));
  }

  // Who claims each form? People are in order of first appearance.
  const claimants = new Map();
  for (const [name, list] of forms) {
    for (const f of list) {
      const k = normalise(f);
      if (!claimants.has(k)) claimants.set(k, []);
      claimants.get(k).push(name);
    }
  }
  const drop = new Map(); // person -> Set of normalised forms they lose
  for (const [k, people] of claimants) {
    if (people.length < 2) continue;
    // A single word is a surname: the earliest holder keeps it. Anything
    // longer is a first-and-last form: it stays with the person it is the
    // whole name of ("John Adams" is not also John Quincy Adams), and if it is
    // nobody's whole name ("George Bush") neither keeps it, so each must use
    // the full name with initials.
    const owner = people.filter((p) => normalise(p) === k);
    const losers = words(k).length === 1 ? people.slice(1) : people.filter((p) => !owner.includes(p));
    for (const p of losers) drop.set(p, (drop.get(p) || new Set()).add(k));
  }

  return terms.map((t) => ({
    ...t,
    accept: forms.get(t.name).filter((f) => !drop.get(t.name)?.has(normalise(f)))
  }));
}

/**
 * Forms shared by different people in one list, as { form, people }. Empty
 * once finishAccepts has run; the test calls this on the shipped file.
 */
export function sharedForms(terms) {
  const owners = new Map();
  for (const t of terms) {
    for (const f of t.accept) {
      const k = normalise(f);
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k).add(t.name);
    }
  }
  return [...owners].filter(([, p]) => p.size > 1).map(([form, p]) => ({ form, people: [...p] }));
}
