#!/usr/bin/env node
// Builds src/data/charts/music.json: the Billboard Year-End Hot 100 for every
// year from 1959 (the first full year of the Hot 100). Run with
// `npm run data:music`.
//
// Source: the English Wikipedia pages "Billboard Year-End Hot 100 singles of
// YYYY", read as wikitext through the MediaWiki API. The year-end chart blends
// sales, airplay and (since 2012) streaming, which is what "biggest song of the
// year" means in a quiz.
//
// Artists are taken from the wikilinks in the artist cell, not by splitting the
// text, because splitting on "and" breaks "Sam the Sham and the Pharaohs" and
// "Hootie & the Blowfish" while the links name each act exactly once.
//
// Raw wikitext is cached per year in data-raw/charts/, so a parser change
// re-runs in a second without touching the network.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';
const RAW = 'data-raw/charts/billboard';
const FIRST = 1959;
const LAST = new Date().getFullYear() - (new Date().getMonth() < 11 ? 1 : 0); // year-end lands in December

mkdirSync(RAW, { recursive: true });
mkdirSync('src/data/charts', { recursive: true });

async function wikitext(page) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&page=${encodeURIComponent(page)}`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const j = await res.json();
      if (j.error) throw new Error(`${page}: ${j.error.info}`);
      return j.parse.wikitext;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`${page}: failed after retries`);
}

// ------------------------------------------------------------ wikitext helpers
const stripRefs = (s) => s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
const stripTemplates = (s) => {
  let prev;
  do {
    prev = s;
    s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => {
      const parts = inner.split('|');
      const name = parts[0].trim().toLowerCase();
      // {{sort|key|shown}} and {{nowrap|shown}} carry display text; others do not.
      if (name === 'sort' || name === 'sortname') return parts.slice(-1)[0];
      if (name === 'nowrap' || name === 'nobr') return parts.slice(1).join('|');
      return '';
    });
  } while (s !== prev);
  return s;
};
const linkText = (s) => s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2');
const plain = (s) =>
  linkText(stripTemplates(stripRefs(s)))
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Cells of a table row, whether written "| a || b || c" or one per line, as { content, rowspan }. */
function rowCells(row) {
  const cells = [];
  for (const line of row.split('\n')) {
    const t = line.trim();
    if (!/^[|!]/.test(t) || t.startsWith('|-') || t.startsWith('|}') || t.startsWith('|+')) continue;
    for (let cell of t.slice(1).split(/\|\||!!/)) {
      // Drop attributes: `scope="row" | 1` -> `1`. Only a single pipe outside
      // links and templates separates attributes from content.
      const m = cell.match(/^([^[{|]*=[^[{|]*)\|(?!\|)([\s\S]*)$/);
      const span = m ? Number(m[1].match(/rowspan\s*=\s*"?(\d+)/)?.[1] || 1) : 1;
      if (m) cell = m[2];
      cells.push({ content: cell.trim(), rowspan: span });
    }
  }
  return cells;
}

function parseYear(text, year) {
  const start = text.indexOf('{|');
  const end = text.indexOf('|}', start);
  if (start < 0 || end < 0) throw new Error(`${year}: no table`);
  const rows = text.slice(start, end).split(/\n\|-[^\n]*/).slice(1);
  const entries = [];
  // A cell with rowspan="2" (one artist, two consecutive songs) is written once
  // and covers the next row too. Without carrying it down, that next row has no
  // artist and was dropped: rank 10 went missing in 1994, 2008 and 2015.
  const carry = []; // column -> { content, left }
  for (const row of rows) {
    const own = rowCells(row);
    const cells = [];
    for (let col = 0; own.length || carry[col]?.left > 0; col++) {
      if (carry[col]?.left > 0) {
        cells.push(carry[col].content);
        carry[col].left--;
        continue;
      }
      const c = own.shift();
      if (c.rowspan > 1) carry[col] = { content: c.content, left: c.rowspan - 1 };
      cells.push(c.content);
    }
    if (cells.length < 3) continue;
    const rank = Number(plain(cells[0]).replace(/[^0-9]/g, ''));
    if (!rank) continue;
    const titleRaw = cells[1];
    const artistRaw = cells[2];
    // Double A-sides are written "Song A" / "Song B": keep both as answers.
    const titles = plain(titleRaw).split(/"\s*\/\s*"/).map((t) => t.replace(/^"|"$/g, '').trim()).filter(Boolean);
    const linked = [...stripTemplates(stripRefs(artistRaw)).matchAll(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g)].map((m) => m[2].trim());
    const artistLine = plain(artistRaw);
    const artists = linked.length ? [...new Set(linked)] : [artistLine];
    // `titles` and `artists` are written only when they add something, which
    // keeps the file about a third smaller; readers default them from
    // `title` and `artist`.
    entries.push({
      rank,
      title: titles.join(' / '),
      ...(titles.length > 1 ? { titles } : {}),
      artist: artistLine,
      ...(artists.length === 1 && artists[0] === artistLine ? {} : { artists })
    });
  }
  return entries;
}

// ------------------------------------------------------------------ build
const years = {};
const problems = [];
for (let y = FIRST; y <= LAST; y++) {
  const path = `${RAW}/${y}.txt`;
  let text;
  if (existsSync(path)) text = readFileSync(path, 'utf8');
  else {
    text = await wikitext(`Billboard Year-End Hot 100 singles of ${y}`);
    writeFileSync(path, text);
  }
  const entries = parseYear(text, y);
  const ranks = new Set(entries.map((e) => e.rank));
  // Some years list ties or fewer than 100 rows; flag anything that looks
  // like a parsing failure rather than a real quirk.
  if (entries.length < 95 || !ranks.has(1) || !ranks.has(10)) problems.push(`${y}: ${entries.length} rows`);
  const badArtist = entries.filter((e) => !e.artist || !e.title).length;
  if (badArtist) problems.push(`${y}: ${badArtist} rows missing title or artist`);
  years[y] = entries.sort((a, b) => a.rank - b.rank);
}

const n = Object.keys(years).length;
console.log(`${n} years (${FIRST}-${LAST}), ${Object.values(years).reduce((s, e) => s + e.length, 0)} chart rows`);
for (const y of [1965, 1985, 1997, 2012, LAST]) {
  console.log(`${y}: ${years[y].slice(0, 3).map((e) => `${e.title} — ${(e.artists || [e.artist]).join(' + ')}`).join(' | ')}`);
}
console.log(problems.length ? `problems:\n  ${problems.join('\n  ')}` : 'no parsing problems');
if (problems.length > 3) throw new Error(`${problems.length} years look mis-parsed`);

writeFileSync(
  'src/data/charts/music.json',
  JSON.stringify({
    builtAt: new Date().toISOString().slice(0, 10),
    source: 'Billboard Year-End Hot 100, via English Wikipedia',
    years
  })
);
console.log('wrote src/data/charts/music.json');
