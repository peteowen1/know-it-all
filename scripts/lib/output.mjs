// Shared output for the data builders: where files go, what is stamped on
// them, and which fields are worth shipping.
//
// Paths resolve from the repo root, not the current directory, so
// `node scripts/build-x.mjs` works from anywhere.
//
// SHIPPED lists, per data file, the fields something under src/ or scripts/
// reads. A builder passes its list to writeData and anything else is dropped
// on the way out, so the browser never downloads a field nobody uses
// (famous.json carried a gender and a death year that no screen shows).
// Adding a field back is one line here. `true` keeps a whole value; an object
// keeps those keys; arrays are filtered element by element.
//
// Proof a field is unread was a grep over all of src/ and scripts/ for
// 2026-10-17, noted next to each list. If you start reading a new field, add
// it here or the next build will drop it, and the shipped-fields test will
// say so.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const fromRoot = (...parts) => join(ROOT, ...parts);
export const dataFile = (rel) => join(ROOT, 'src', 'data', rel);
export const today = () => new Date().toISOString().slice(0, 10);

export const SHIPPED = {
  // Unread: names[].total, people[].sex, people[].died.
  'famous.json': {
    builtAt: true,
    source: true,
    names: { first: true, spellings: true, people: { id: true, name: true, rest: true, description: true, born: true, views: true, monthsInTop: true, first: true, known: true } }
  },
  // Unread: unMember, flag (the flag-icons SVG is used instead), demonym,
  // latlng, tld, cioc, status, unRegionalGroup, currencies[].code and .symbol.
  'countries.json': {
    builtAt: true,
    countries: {
      code: true, iso3: true, name: true, officialName: true, capitals: true, capitalsAlsoAccepted: true,
      region: true, subregion: true, sovereign: true, population: true, populationYear: true, gdp: true, gdpYear: true,
      area: true, altNames: true,
      landlocked: true, borders: true, languages: true, currencies: { name: true }
    }
  },
  // Unread: source (MusicCharts writes its own credit line).
  'charts/music.json': { builtAt: true, years: true },
  // Every field is read; listed so the shape is checked.
  'obscure.json': { builtAt: true, categories: { id: true, prompt: true, kind: true, answers: { text: true, accept: true, score: true } } }
  // flagLookalikes.json is { code: [[code, similarity], ...] } and all of it is read.
};

/** `value` with only the keys `spec` names. See SHIPPED for the spec shape. */
export function slim(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => slim(v, spec));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => k in spec).map(([k, v]) => [k, slim(v, spec[k])]));
}

/** Keys in `value` that `spec` does not name, as "path.key" strings. */
export function extraKeys(value, spec, path = '') {
  if (spec === true) return [];
  if (Array.isArray(value)) return [...new Set(value.flatMap((v) => extraKeys(v, spec, `${path}[]`)))];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => (k in spec ? extraKeys(v, spec[k], `${path}.${k}`) : [`${path}.${k}`]));
}

/**
 * Writes src/data/<rel> as compact JSON. Stamps `builtAt` (pass stamp: false
 * for a file that is a bare lookup table) and keeps only the SHIPPED fields
 * for that file, if it has a list.
 */
export function writeData(rel, payload, { stamp = true } = {}) {
  let out = SHIPPED[rel] ? slim(payload, SHIPPED[rel]) : payload;
  if (stamp) {
    const { builtAt: _old, ...rest } = out;
    out = { builtAt: today(), ...rest };
  }
  const text = JSON.stringify(out);
  mkdirSync(dirname(dataFile(rel)), { recursive: true });
  writeFileSync(dataFile(rel), text);
  console.log(`wrote src/data/${rel} (${text.length.toLocaleString('en-US')} bytes)`);
}
