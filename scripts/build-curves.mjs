#!/usr/bin/env node
// Builds src/data/curves.json for Match the curve: famous people whose monthly
// English Wikipedia readership has one clear peak, each curve scaled to its
// own highest month (shape, not size, is the clue: Elizabeth II in September
// 2022, Matthew Perry in October 2023). Idea from Daily Orbs' word-popularity
// puzzle (2026-10-24).
//
// Reads the raw pageview files scripts/build-famous.mjs saves
// (data-raw/famous/pageviews/, one per article) and the article titles in its
// entity files. Pure: no network.
//
//   npm run data:famous    # fetches the pageviews
//   npm run data:curves    # then this

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const RAW = 'data-raw/famous';
// Fame floor: total reads since 2016. A clear peak: the top month at least
// PEAK times the middle month. 10 million let in names few would place
// (Sam Claflin, James Wan); 20 million leaves 281 household names
// (2026-10-24).
const MIN_VIEWS = 20_000_000;
const PEAK = 5;
const MIN_MONTHS = 100;

// Why each person peaked, one short line, checked by hand from Wikipedia's
// weekly Top 25 Report (scripts/fetch-top25.mjs). Kept only while the peak
// month still matches: a new peak needs a new reason.
const REASONS = 'scripts/curve-reasons.json';
const why = new Map(existsSync(REASONS) ? JSON.parse(readFileSync(REASONS, 'utf8')).map((r) => [r.id, r]) : []);

const fileSafe = (title) => encodeURIComponent(title).replace(/[%*]/g, '~');
const famous = JSON.parse(readFileSync('src/data/famous.json', 'utf8'));
const people = new Map();
for (const b of famous.names) for (const p of b.people) if (p.views >= MIN_VIEWS) people.set(p.id, p);

// Article titles, as scripts/fetch-famous-leads.mjs reads them.
const titles = new Map();
for (const dir of ['entities', 'entities-prefix', 'entities-vital']) {
  for (const f of readdirSync(`${RAW}/${dir}`)) {
    const buf = readFileSync(`${RAW}/${dir}/${f}`);
    const j = JSON.parse((f.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));
    for (const [id, e] of Object.entries(j.entities || j)) {
      const title = e.title || e.sitelinks?.enwiki?.title;
      if (people.has(id) && title) titles.set(id, title);
    }
  }
}

const month = (ts) => `${ts.slice(0, 4)}-${ts.slice(4, 6)}`;
// The month every pageview file starts (scripts/build-famous.mjs FAME_FROM).
const from = process.env.FAME_FROM || '2016-01';
const out = [];
for (const [id, p] of people) {
  const file = `${RAW}/pageviews/${fileSafe(titles.get(id) || '')}.json.gz`;
  if (!titles.has(id) || !existsSync(file)) continue;
  const items = JSON.parse(gunzipSync(readFileSync(file))).items;
  if (items.length < MIN_MONTHS) continue;
  // Every curve starts in the same month: an article younger than the window
  // is padded with zeros at the front.
  const lead = (+items[0].timestamp.slice(0, 4) - +from.slice(0, 4)) * 12 + (+items[0].timestamp.slice(4, 6) - +from.slice(5, 7));
  if (lead < 0) throw new Error(`${titles.get(id)} starts ${month(items[0].timestamp)}, before ${from}`);
  const views = [...Array(lead).fill(0), ...items.map((i) => i.views)];
  const sorted = [...views].sort((a, b) => a - b);
  const top = sorted.at(-1);
  if (top < PEAK * Math.max(1, sorted[Math.floor(sorted.length / 2)])) continue;
  const peak = month(items[views.indexOf(top) - lead].timestamp);
  const reason = why.get(id)?.peak === peak ? why.get(id).why : null;
  const died = p.description.match(/\(\D*\d{3,4}\s*[–-]\s*(\d{3,4})\)/)?.[1];
  out.push({
    id,
    name: p.name,
    // "British monarch (1926–2022)" -> "British monarch"
    what: p.description.replace(/\s*\([^)]*\)\s*$/, ''),
    ...(died && { died: +died }),
    peak,
    ...(reason && { why: reason }),
    s: views.map((v) => Math.round((99 * v) / top))
  });
}
// A file fetched before the latest month ends early (2 of 283 on 2026-10-24);
// a curve that stops short would stand out, so those are left out.
const length = Math.max(...out.map((p) => p.s.length));
const full = out.filter((p) => p.s.length === length).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const text = JSON.stringify({ from, months: length, people: full });
writeFileSync('src/data/curves.json', text);
const withWhy = full.filter((p) => p.why).length;
console.log(`curves.json: ${full.length} people (${withWhy} with a reason for the peak) (${out.length - full.length} short curves left out) from ${people.size} with ${MIN_VIEWS.toLocaleString('en-US')}+ views, ${from} on, ${text.length.toLocaleString('en-US')} bytes`);
