// Shared helpers for the data builders that read Wikipedia tables: fetching
// wikitext with a cache, and turning a wikitable into rows of cells.
//
// Tables are read as wikitext rather than rendered HTML because the wikitext
// keeps link targets ("Titanic (1997 film)"), which is how a film or artist is
// resolved to Wikidata unambiguously.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

export const UA = 'know-it-all-builder/0.1 (https://github.com/peteowen1/know-it-all)';

/** Page wikitext, read from `cachePath` if present, otherwise fetched and cached. */
export async function wikitext(page, cachePath) {
  if (cachePath && existsSync(cachePath)) return readFileSync(cachePath, 'utf8');
  const url = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&redirects=1&page=${encodeURIComponent(page)}`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const j = await res.json();
      if (j.error) throw new Error(`${page}: ${j.error.info}`);
      if (cachePath) {
        mkdirSync(dirname(cachePath), { recursive: true });
        writeFileSync(cachePath, j.parse.wikitext);
      }
      return j.parse.wikitext;
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw new Error(`${page}: failed after retries`);
}

export const stripRefs = (s) => s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');

export const stripTemplates = (s) => {
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

const LINK = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g;

/** [{ target, text }] for every wikilink in a cell. */
export const links = (s) =>
  [...stripTemplates(stripRefs(s)).matchAll(LINK)].map((m) => ({ target: m[1].trim(), text: (m[2] ?? m[1]).trim() }));

export const plain = (s) =>
  stripTemplates(stripRefs(s))
    .replace(LINK, (_, target, text) => text ?? target)
    .replace(/'{2,}/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** True if the cell's content is bold ('''...'''), which is how winners are marked. */
export const isBold = (s) => /'''/.test(s);

/** Cells of one row, whether written "| a || b" or one per line, as { content, rowspan, header }. */
function rowCells(row) {
  const cells = [];
  for (const line of row.split('\n')) {
    const t = line.trim();
    if (!/^[|!]/.test(t) || t.startsWith('|-') || t.startsWith('|}') || t.startsWith('|+')) continue;
    const header = t.startsWith('!');
    for (let cell of t.slice(1).split(/\|\||!!/)) {
      // Drop attributes: `scope="row" | 1` -> `1`. Only a single pipe outside
      // links and templates separates attributes from content.
      const m = cell.match(/^([^[{|]*=[^[{|]*)\|(?!\|)([\s\S]*)$/);
      const span = m ? Number(m[1].match(/rowspan\s*=\s*"?(\d+)/)?.[1] || 1) : 1;
      if (m) cell = m[2];
      cells.push({ content: cell.trim(), rowspan: span, header });
    }
  }
  return cells;
}

/**
 * Rows of the wikitable starting at or after `from`, as arrays of raw cell
 * strings, with the header row dropped.
 *
 * A cell with rowspan="N" is written once and covers the next N-1 rows too
 * (one artist with two consecutive songs; one year with five nominees). It is
 * carried down so every row has every column: without that, rank 10 was
 * missing from three Billboard years.
 *
 * Header rows come back too; callers skip any row whose rank or year does not
 * parse as a number.
 */
export function tableRows(text, from = 0) {
  const start = text.indexOf('{|', from);
  const end = text.indexOf('\n|}', start);
  if (start < 0 || end < 0) return [];
  const rows = text.slice(start, end).split(/\n\|-[^\n]*/).slice(1);
  const out = [];
  const carry = [];
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
    if (cells.length) out.push(cells);
  }
  return out;
}

/** Every `{|` table start in a page, for pages that split one list across tables. */
export function tableStarts(text) {
  const out = [];
  for (let i = text.indexOf('{|'); i >= 0; i = text.indexOf('{|', i + 2)) out.push(i);
  return out;
}

/**
 * Resolve English Wikipedia article titles to Wikidata, 50 per request, with
 * the requested claim properties and English labels. Cached per batch.
 * Returns Map(title -> { id, label, claims: { P57: [ids] } }).
 */
export async function wikidataByTitle(titles, props, cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const out = new Map();
  const unique = [...new Set(titles)].sort();
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    // Named by content, not position: a position-named cache hands the wrong
    // batch back as soon as the title list changes (273 films lost their
    // director that way).
    const path = `${cacheDir}/${createHash('sha1').update(batch.join('|')).digest('hex').slice(0, 16)}.json`;
    let data;
    if (existsSync(path)) data = JSON.parse(readFileSync(path, 'utf8'));
    else {
      const url =
        'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&sites=enwiki&props=claims|sitelinks|labels&languages=en|mul&sitefilter=enwiki&titles=' +
        encodeURIComponent(batch.join('|'));
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await res.json();
      // Errors arrive as HTTP 200 with an `error` body. Never cache those.
      if (!res.ok || j.error) throw new Error(`wbgetentities: ${j.error?.info || res.status}`);
      data = {};
      for (const [id, e] of Object.entries(j.entities || {})) {
        if (e.missing !== undefined || !e.sitelinks?.enwiki) continue;
        data[e.sitelinks.enwiki.title] = {
          id,
          label: e.labels?.en?.value || e.labels?.mul?.value,
          claims: Object.fromEntries(props.map((p) => [p, (e.claims?.[p] || []).map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean)]))
        };
      }
      writeFileSync(path, JSON.stringify(data));
    }
    for (const [t, v] of Object.entries(data)) out.set(t, v);
  }
  return out;
}

/** English labels for Wikidata ids, 50 per request. */
export async function wikidataLabels(ids) {
  const out = new Map();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en|mul&ids=${batch.join('|')}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(`labels: ${j.error?.info || res.status}`);
    for (const [id, e] of Object.entries(j.entities || {})) {
      // Since 2024 many names are stored only as a language-neutral 'mul'
      // label (James Cameron's is), so English falls back to it.
      const label = e.labels?.en?.value || e.labels?.mul?.value || id;
      out.set(id, label);
      // A merged item comes back under its new id with `redirects.from` set to
      // the id that was asked for; without this, James Cameron (Q42574) came
      // back unnamed.
      if (e.redirects?.from) out.set(e.redirects.from, label);
    }
  }
  return out;
}
