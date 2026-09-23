#!/usr/bin/env node
// Builds src/data/lists.json: ordered lists of office holders for the "Fill
// the list" game. Run with `npm run data:lists`.
//
// Source: Wikidata. Each person who held the office carries a "position held"
// (P39) statement with start (P580), end (P582) and usually the official
// number (P1545) as qualifiers. That is more complete than the office's own
// "officeholder" list, which on 2026-09-23 named only 3 of 31 Australian PMs.
//
// One row per TERM, in date order, so returning leaders appear each time they
// held office (Deakin three times, Menzies twice, Rudd twice). The number shown
// follows each country's own convention, which Wikidata's qualifiers encode:
// Australia numbers a person once (Rudd is 26th both times), the US numbers
// each non-consecutive term (Cleveland 22nd and 24th, Trump 45th and 47th).
//
// Built at build time rather than hand-written, because the hand-written PM
// deck this replaces stopped at Gillard.

import { writeFileSync, mkdirSync } from 'node:fs';
import { UA } from './lib/wikitable.mjs';

const OFFICES = {
  // Australia numbers a person once, so a term missing its number can take
  // the person's number from another term. Not so for the US, which numbers
  // each non-consecutive term: a missing number there stays missing.
  auPM: { office: 'Q319145', title: 'Australian prime ministers', min: 31, numberPerPerson: true },
  // Every real president has an official number; entries without one are
  // fiction or vandalism (Quentin Trembley, a novel's president, was one).
  usPres: { office: 'Q11696', title: 'US presidents', min: 45, requireNumber: true },
  // From 1900: before that it is dukes and earls quizzes rarely ask about.
  // The UK has no official numbering (Wikidata numbers only recent PMs), so
  // numbers are left off rather than shown for some rows and not others.
  ukPM: { office: 'Q14211', title: 'UK prime ministers since 1900', min: 25, since: 1900, numbered: false }
};

const api = async (params) => {
  const url = `https://www.wikidata.org/w/api.php?format=json&${new URLSearchParams(params)}`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const j = await res.json();
      if (j.error) throw new Error(`${params.action}: ${j.error.info}`);
      return j;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`wikidata ${params.action} failed`);
};

const year = (t) => (t ? Number(t.slice(1, 5)) : null);
const qual = (claim, p) => (claim.qualifiers?.[p] || []).map((v) => v.datavalue?.value)[0];

const out = { builtAt: new Date().toISOString().slice(0, 10), lists: {} };
for (const [key, { office, title, min, requireNumber = false, since = 0, numbered = true, numberPerPerson = false }] of Object.entries(OFFICES)) {
  const found = await api({ action: 'query', list: 'search', srsearch: `haswbstatement:P39=${office}`, srlimit: 500, srprop: '' });
  const ids = found.query.search.map((r) => r.title);
  const rows = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await api({
      action: 'wbgetentities',
      ids: ids.slice(i, i + 50).join('|'),
      props: 'claims|labels|sitelinks',
      languages: 'en|mul',
      sitefilter: 'enwiki'
    });
    for (const e of Object.values(j.entities)) {
      // The Wikipedia title is the name people know ("Stanley Bruce", not
      // Wikidata's "S. M. Bruce"); the label is kept as an accepted answer.
      const wiki = e.sitelinks?.enwiki?.title?.replace(/\s*\([^)]*\)$/, '');
      const label = e.labels?.en?.value || e.labels?.mul?.value;
      const name = wiki || label;
      const terms = (e.claims.P39 || []).filter((c) => c.mainsnak.datavalue?.value.id === office && c.rank !== 'deprecated');
      const personNumber = terms.map((c) => qual(c, 'P1545')).find(Boolean);
      for (const c of terms) {
        const start = qual(c, 'P580')?.time;
        if (!start) continue;
        rows.push({
          start,
          number: Number(qual(c, 'P1545') || (numberPerPerson ? personNumber : null)) || null,
          from: year(start),
          to: year(qual(c, 'P582')?.time),
          name,
          accept: [...new Set([name, label, name.split(' ').at(-1)].filter(Boolean))],
          id: e.id
        });
      }
    }
  }
  rows.sort((a, b) => a.start.localeCompare(b.start));
  // Drop duplicate statements for the same term (same person, same start).
  const seen = new Set();
  const terms = rows.filter((r) => {
    if (requireNumber && !r.number) return false;
    // Keep a term still running at the cutoff: Salisbury was PM on 1 January
    // 1900 although his term began in 1895.
    if ((r.to ?? Infinity) < since) return false;
    const k = `${r.id}|${r.start.slice(0, 11)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const people = new Set(terms.map((t) => t.id)).size;
  if (!numbered) for (const t of terms) t.number = null;
  const unnumbered = numbered ? terms.filter((t) => !t.number).map((t) => t.name) : [];
  console.log(`${key}: ${people} people, ${terms.length} terms; last: ${terms.at(-1).name} (${terms.at(-1).from}-${terms.at(-1).to ?? 'now'})`);
  if (unnumbered.length) console.log(`  no official number: ${unnumbered.join(', ')}`);
  if (people < min) throw new Error(`${key}: only ${people} people, expected ${min}+`);
  out.lists[key] = { title, terms: terms.map(({ start: _start, id: _id, ...t }) => t) };
}

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/lists.json', JSON.stringify(out));
console.log('wrote src/data/lists.json');
