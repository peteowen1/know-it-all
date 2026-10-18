// Country subregions from the UN geoscheme (M49), the grouping most quiz books
// and school atlases use. REST Countries has its own ("Central Europe",
// "Southeast Europe"), so a player who said Austria for Western Europe was
// marked wrong (Pete chose the UN scheme, 2026-10-18).
//
// Source: data-raw/un-m49/all.csv, saved as downloaded from
// github.com/lukes/ISO-3166-Countries-with-Regional-Codes (the UN M49 table
// joined to ISO codes). Fetched with `npm run data:countries`.
import { existsSync, readFileSync } from 'node:fs';

const parseCsvLine = (line) => {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted && ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  return [...out, cur];
};

// Two UN subregions are umbrellas whose parts are what people name: Sub-Saharan
// Africa (Eastern, Middle, Southern, Western Africa) and Latin America and the
// Caribbean (Caribbean, Central America, South America).
const UMBRELLAS = new Set(['Sub-Saharan Africa', 'Latin America and the Caribbean']);

/** Map of ISO alpha-2 code -> UN subregion name, or null if the file is missing. */
export function unSubregions(path) {
  if (!existsSync(path)) return null;
  const [head, ...rows] = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(head);
  const at = (row, name) => row[cols.indexOf(name)];
  const map = new Map();
  for (const line of rows) {
    const row = parseCsvLine(line);
    const sub = at(row, 'sub-region');
    const inner = at(row, 'intermediate-region');
    if (!sub) continue; // Antarctica has none
    map.set(at(row, 'alpha-2'), UMBRELLAS.has(sub) && inner ? inner : sub);
  }
  return map;
}
