// What a famous person is known for, as a Who am I clue: "Starred in Titanic
// and Inception", "Played for Real Madrid and Manchester United". Built from
// the raw files scripts/fetch-famous-works.mjs saves. Pure: no network.

import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Which kind of work to name, from the first job word in the person's short
// description ("American actor and singer" is an actor first). Each kind has
// its verb; notable works (P800) are the fallback for everyone.
const KINDS = [
  { prop: 'P161', verb: 'Starred in', words: /\b(actor|actress|comedian|entertainer)\b/ },
  { prop: 'P175', verb: 'Recorded', words: /\b(singer|rapper|musician|songwriter|vocalist|singer-songwriter|DJ)\b/ },
  { prop: 'P54', verb: 'Played for', words: /\b(footballer|player|cricketer|goalkeeper|striker|midfielder|defender|forward|pitcher|quarterback)\b/ },
  { prop: 'P57', verb: 'Directed', words: /\b(director|filmmaker)\b/ },
  { prop: 'P50', verb: 'Wrote', words: /\b(writer|novelist|author|poet|playwright)\b/ },
  { prop: 'P170', verb: 'Created', words: /\b(painter|artist|cartoonist|illustrator|animator|creator)\b/ }
];
const NOTABLE = { prop: 'P800', verb: 'Known for' };

// Works that say nothing about why the person is famous: films about them,
// national and youth sides (the description already says the nationality).
// College sides too ("Davidson Wildcats men's basketball"). A national side
// is matched on its name only: the description "National Basketball
// Association team" dropped the Golden State Warriors, leaving Stephen Curry
// "Played for Davidson".
const DULL = /\b(documentary|concert film|under-\d+|U-?\d\d|youth|reserves?|academy|men's basketball|college|university)\b/i;
const NATIONAL_SIDE = /\bnational\b.*\bteam\b/i;

// Works Wikidata credits wrongly, by person id, each checked by hand. Kyle
// Kuzma never played for Guangdong (his teams are the Lakers, Wizards and
// Bucks, none of which Wikidata lists); playtest 2026-10-20.
const WRONG = { Q30063347: ['Q2629395'] };

/** Raw rows and labels from data-raw/famous/works*. */
export function loadWorks(root) {
  const rows = new Map(); // person id -> [{prop, work, links}]
  const labels = new Map(); // work id -> {label, description}
  // works-v2 has every statement (see scripts/fetch-famous-works.mjs).
  const dir = `${root}/works-v2`;
  if (!existsSync(dir)) return { rows, labels };
  for (const f of readdirSync(dir).sort()) {
    for (const b of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).results.bindings) {
      const person = b.person.value.split('/').pop();
      if (!rows.has(person)) rows.set(person, []);
      rows.get(person).push({ prop: b.prop.value, work: b.work.value.split('/').pop(), links: +b.links.value });
    }
  }
  for (const f of readdirSync(`${root}/works-labels`).sort()) {
    for (const [id, e] of Object.entries(JSON.parse(readFileSync(`${root}/works-labels/${f}`, 'utf8')).entities || {})) {
      if (e.labels?.en) labels.set(id, { label: e.labels.en.value, description: e.descriptions?.en?.value || '' });
    }
  }
  return { rows, labels };
}

const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/**
 * Does a title give the name away? A whole word of it, or a longer name word
 * with an ending added: "Cleveland Browns" for Jim Brown, "Keeping Up with
 * the Kardashians" for Rob Kardashian.
 */
export const leaksName = (title, nameWords) =>
  words(title).some((x) => nameWords.has(x) || [...nameWords].some((n) => n.length >= 4 && x.startsWith(n)));

/**
 * "Starred in Titanic and Inception", or null when nothing fits. The two
 * best-known works (by Wikipedia sitelinks) of the kind the description
 * points to, else of the person's notable works. A work whose title holds
 * any word of the person's name ("Taylor Swift", the album) is skipped: it
 * would give the answer away.
 */
export function worksClue(person, { rows, labels }) {
  const own = rows.get(person.id) || [];
  const nameWords = new Set(words(person.name));
  const desc = person.description || '';
  const kinds = KINDS.map((k) => ({ k, at: desc.search(k.words) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.k);
  for (const kind of [...kinds, NOTABLE]) {
    const seen = new Set();
    const titles = own
      .filter((r) => r.prop === kind.prop && labels.has(r.work) && !WRONG[person.id]?.includes(r.work))
      .sort((a, b) => b.links - a.links)
      .map((r) => labels.get(r.work))
      .filter((w) => !DULL.test(`${w.label} ${w.description}`) && !NATIONAL_SIDE.test(w.label) && !leaksName(w.label, nameWords))
      // "Fulham F.C." reads as "Fulham" in a clue, "FC Barcelona" as "Barcelona".
      .map((w) => w.label.replace(/\s+(A\.?F\.?C\.?|F\.?C\.?|C\.?F\.?|S\.?C\.?)$/, '').replace(/^F\.?C\.?\s+/, ''))
      .filter((t) => !seen.has(t) && seen.add(t))
      .slice(0, 2);
    if (titles.length) return `${kind.verb} ${titles.join(' and ')}`;
  }
  return null;
}
