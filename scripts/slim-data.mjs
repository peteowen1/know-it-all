#!/usr/bin/env node
// Drops fields nothing reads from the shipped data files, in place, without a
// network rebuild: applies the SHIPPED lists in lib/output.mjs to the JSON
// already in src/data. The builders apply the same lists when they write, so
// this is only needed after a SHIPPED list changes, or to bring files built
// before it existed in line. Safe to run twice. Values are never changed and
// builtAt is kept as it was.
//
//   node scripts/slim-data.mjs          slim every file with a SHIPPED list
//   node scripts/slim-data.mjs --check  report what would go, change nothing

import { readFileSync, writeFileSync } from 'node:fs';
import { SHIPPED, dataFile, slim, extraKeys } from './lib/output.mjs';

const check = process.argv.includes('--check');
let before = 0;
let after = 0;
for (const rel of Object.keys(SHIPPED)) {
  const text = readFileSync(dataFile(rel), 'utf8');
  const data = JSON.parse(text);
  const extra = extraKeys(data, SHIPPED[rel]);
  const out = JSON.stringify(slim(data, SHIPPED[rel]));
  before += Buffer.byteLength(text);
  after += Buffer.byteLength(out);
  console.log(`${rel}: ${Buffer.byteLength(text).toLocaleString('en-US')} -> ${Buffer.byteLength(out).toLocaleString('en-US')} bytes; dropping ${extra.length ? extra.join(', ') : 'nothing'}`);
  if (!check) writeFileSync(dataFile(rel), out);
}
console.log(`total ${before.toLocaleString('en-US')} -> ${after.toLocaleString('en-US')} bytes${check ? ' (not written)' : ''}`);
