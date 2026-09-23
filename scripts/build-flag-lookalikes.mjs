#!/usr/bin/env node
// Builds src/data/flagLookalikes.json: for every flag, the flags that look most
// like it. Hard-mode flag questions use these as the wrong answers, so Monaco
// comes with Indonesia, Poland and Singapore rather than with its neighbours.
// Run with `npm run data:flags`.
//
// Measured, not hand-listed: each flag SVG from flag-icons is rendered to a
// 48x36 bitmap and every pixel snapped to one of a dozen named flag colours.
// Two flags are compared on
//   - colour mix: how much of each colour they share (Monaco and Poland are
//     both half red, half white, so this is ~1.0 even though one is upside down)
//   - layout: the fraction of a 12x9 grid of cells whose dominant colour
//     matches (Monaco and Indonesia match cell for cell)
// and the score is the mean of the two. Hand-listing would miss pairs nobody
// thought of and never covers new flags.

import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const W = 48, GW = 12, GH = 9, KEEP = 20; // 20: territories that reuse a flag (France has five) crowd the top

// Named flag colours. Snapping to these makes "#CE1126" and "#E70013" the same
// red, which is how a person sees them. Several shades snap to one name
// (navy and royal blue are both "blue", maroon is "red"): Chad's blue is darker
// than Romania's and Qatar's red is darker than Bahrain's, and nobody tells
// those pairs apart by shade. Light blue stays separate — Argentina is not
// France.
const SHADES = [
  ['red', [206, 17, 38]], ['red', [128, 0, 32]], ['orange', [255, 130, 0]], ['yellow', [252, 209, 22]],
  ['green', [0, 135, 81]], ['green', [0, 80, 40]], ['lightblue', [110, 180, 230]], ['blue', [0, 56, 168]],
  ['blue', [0, 32, 91]], ['white', [255, 255, 255]], ['black', [0, 0, 0]], ['grey', [150, 150, 150]]
];
const NAMES = [...new Set(SHADES.map(([n]) => n))];
const PALETTE = SHADES.map(([n, rgb]) => [NAMES.indexOf(n), rgb]);
const nearest = (r, g, b) => {
  let best = 0, bestD = Infinity;
  for (const [i, [pr, pg, pb]] of PALETTE) {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
};

const { countries } = JSON.parse(readFileSync('src/data/countries.json', 'utf8'));

const features = {};
for (const c of countries) {
  const code = c.code.toLowerCase();
  let svg;
  try {
    svg = readFileSync(`node_modules/flag-icons/flags/4x3/${code}.svg`);
  } catch {
    console.warn(`no flag SVG for ${c.name} (${code})`);
    continue;
  }
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render();
  const px = img.pixels; // RGBA
  const h = img.height;
  const hist = new Array(NAMES.length).fill(0);
  const cells = Array.from({ length: GW * GH }, () => new Array(NAMES.length).fill(0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const k = nearest(px[i], px[i + 1], px[i + 2]);
      hist[k]++;
      cells[Math.floor((y / h) * GH) * GW + Math.floor((x / W) * GW)][k]++;
    }
  }
  const total = W * h;
  features[c.code] = {
    hist: hist.map((v) => v / total),
    layout: cells.map((cell) => cell.indexOf(Math.max(...cell)))
  };
}

// Grid cell index after flipping the flag top-to-bottom or mirroring it.
const flipV = (i) => (GH - 1 - Math.floor(i / GW)) * GW + (i % GW);
const flipH = (i) => Math.floor(i / GW) * GW + (GW - 1 - (i % GW));
const matchFrac = (a, b, map) => a.filter((v, i) => v === b[map(i)]).length / a.length;

// Layout also counts a flipped or mirrored match, slightly discounted: Poland is
// Monaco upside down and Ivory Coast is Ireland mirrored, and those are exactly
// the pairs people confuse. A straight match still wins a tie.
const similarity = (a, b) => {
  const mix = a.hist.reduce((s, v, i) => s + Math.min(v, b.hist[i]), 0);
  const layout = Math.max(
    matchFrac(a.layout, b.layout, (i) => i),
    0.9 * matchFrac(a.layout, b.layout, flipV),
    0.9 * matchFrac(a.layout, b.layout, flipH)
  );
  return (mix + layout) / 2;
};

const codes = Object.keys(features);
const out = {};
for (const a of codes) {
  out[a] = codes
    .filter((b) => b !== a)
    .map((b) => [b, Math.round(similarity(features[a], features[b]) * 100) / 100])
    .sort((x, y) => y[1] - x[1])
    .slice(0, KEEP);
}

const name = Object.fromEntries(countries.map((c) => [c.code, c.name]));
for (const probe of ['MC', 'TD', 'NL', 'IE', 'AU', 'SN', 'SI', 'QA', 'AR', 'FR']) {
  console.log(`${name[probe]}: ${out[probe].slice(0, 5).map(([b, s]) => `${name[b]} ${s}`).join(', ')}`);
}
if (codes.length < 240) throw new Error(`only ${codes.length} flags rendered`);
writeFileSync('src/data/flagLookalikes.json', JSON.stringify(out));
console.log(`wrote src/data/flagLookalikes.json (${codes.length} flags)`);
