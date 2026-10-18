// Billboard Hot 100 top-ten singles, read from the English Wikipedia pages
// "List of Billboard Hot 100 top-ten singles in YYYY". Obscure-est uses them
// for songs that made the top ten but missed the year-end Hot 100 (Purple
// Rain, Gin and Juice, Where Is the Love?): a song that peaks in December or
// spans two years can miss both year-end lists.
//
// The raw wikitext is saved per year in data-raw/charts/billboard-top10/ by
// scripts/fetch-top-tens.mjs; this module only parses it.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tableRows, tableStarts, plain, links } from './wikitable.mjs';
import { fromRoot } from './output.mjs';

export const TOP10_RAW = fromRoot('data-raw/charts/billboard-top10');
export const TOP10_PAGE = (year) => `List of Billboard Hot 100 top-ten singles in ${year}`;

/**
 * Every top-ten single on one year's page: { title, titles, artists, peak }.
 * The single is the cell that opens with a quote; artist and peak follow it,
 * whether or not the row carries its own entry-date cell. (The weeks column
 * is not read: its position varies across the years' pages.)
 */
export function parseTopTens(raw) {
  // '{{sort|Final Countdown|[[The Final Countdown (song)|The Final Countdown]]}}'
  // sorts without "The"; keep only what it shows.
  const text = raw.replace(/\{\{sort\|[^|{}]*\|(\[\[[^\]]*\]\])\}\}/gi, '$1');
  const out = [];
  for (const start of tableStarts(text)) {
    for (const cells of tableRows(text, start)) {
      const i = cells.findIndex((c) => /^\s*"/.test(plain(c)));
      if (i < 0 || cells.length < i + 3) continue;
      const peak = Number(plain(cells[i + 2]).replace(/[^0-9]/g, ''));
      if (!(peak >= 1 && peak <= 10)) continue;
      // '"Song A" / "Song B"' double A-sides, and '99 Luftballons/99 Red Balloons'.
      const titles = plain(cells[i])
        .replace(/\(#\d+\)/g, '')
        .split(/"\s*\/\s*"/)
        // A dagger after the title marks a footnote: 'Hey Jude" †'.
        .map((t) => t.replace(/[\s"]*[†‡*]+\s*$/, '').replace(/^\s*"|"\s*$/g, '').trim())
        .filter(Boolean);
      if (!titles.length) continue;
      const linked = links(cells[i + 1]).map((l) => l.text);
      // An unlinked cell can still hold a broken link's 'Page|Name': keep the name.
      const artists = linked.length ? [...new Set(linked)] : [plain(cells[i + 1]).split('|').pop().trim()];
      if (!artists[0]) continue;
      out.push({ title: titles[0], titles, artists, peak });
    }
  }
  return out;
}

/** All saved years, parsed; one entry per song and artist, with its best peak. */
export function loadTopTens() {
  if (!existsSync(TOP10_RAW)) return [];
  const best = new Map();
  for (const f of readdirSync(TOP10_RAW).filter((f) => /^\d{4}\.txt$/.test(f)).sort()) {
    for (const s of parseTopTens(readFileSync(join(TOP10_RAW, f), 'utf8'))) {
      const key = `${s.title.toLowerCase()}|${s.artists.join('|')}`;
      const cur = best.get(key);
      if (!cur) best.set(key, { ...s, year: Number(f.slice(0, 4)) });
      else cur.peak = Math.min(cur.peak, s.peak);
    }
  }
  return [...best.values()];
}
