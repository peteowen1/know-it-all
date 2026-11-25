#!/usr/bin/env node
// Builds src/data/map/<region>.json: the outlines Find it on the map draws,
// one file per region so the game loads only the one being played. Run with
// `npm run data:map` (not part of validate: the source never changes).
//
// Source: Natural Earth via the world-atlas package (public domain), keyed by
// ISO numeric code and matched to countries.json through
// data-raw/mledoze-countries.json. The 1:110m outlines are used where they
// exist; the 1:50m ones only for the small countries 110m leaves out.
//
// Each region is drawn with its own projection over a longitude/latitude box
// set by hand (fitting to the shapes fails: France's outline carries French
// Guiana and Réunion, and Oceania crosses the date line). Every country in the
// box is drawn and clipped to it, so a wrong tap can say which country it was.
//
// A country counts as playable when its shape is big enough to tap on a
// phone: at least MIN_TAP_PX on its shorter side at 360 px wide.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoPath, geoMercator, geoCentroid } from 'd3-geo';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export const MIN_TAP_PX = 8;
const PHONE_WIDTH = 360;
const WIDTH = 1000;

// Each view: the region whose countries it asks, a [west, south, east, north]
// box (east < west crosses the date line) and the outline detail. Zoomed views
// use 1:50m so small countries keep their shape; a country is asked in a view
// only if its centre is inside the box.
export const VIEWS = {
  europe: { label: 'Europe', region: 'Europe', box: [-25, 34, 45, 71], res: '110m' },
  africa: { label: 'Africa', region: 'Africa', box: [-20, -36, 55, 38], res: '110m' },
  'middle-east': { label: 'Middle East', region: 'Asia', box: [25, 11, 63, 43], res: '50m' },
  asia: { label: 'Asia', region: 'Asia', box: [25, -12, 150, 56], res: '110m' },
  'north-america': { label: 'North America', region: 'Americas', box: [-170, 12, -50, 72], res: '110m' },
  'central-america': { label: 'Central America and the Caribbean', region: 'Americas', box: [-93, 6, -59, 27], res: '50m' },
  'south-america': { label: 'South America', region: 'Americas', box: [-85, -57, -33, 13], res: '110m' },
  oceania: { label: 'Oceania', region: 'Oceania', box: [110, -50, -170, 10], res: '110m' }
};

const countries = read('src/data/countries.json').countries;
const byCode = new Map(countries.map((c) => [c.code, c]));
const numToCode = new Map(read('data-raw/mledoze-countries.json').map((c) => [c.ccn3, c.cca2]));
// Shapes Natural Earth gives no ISO number.
const BY_NAME = { Kosovo: 'XK' };
const codeOf = (f) => numToCode.get(f.id) || BY_NAME[f.properties.name] || null;

function shapes(res) {
  const topo = read(`node_modules/world-atlas/countries-${res}.json`);
  return feature(topo, topo.objects.countries).features;
}

/** One shape per code at `res`, filling gaps from 50m; unnamed shapes kept as background. */
export function worldShapes(res = '110m') {
  const main = shapes(res);
  if (res === '50m') return main;
  const have = new Set(main.map(codeOf).filter(Boolean));
  const fine = shapes('50m').filter((f) => codeOf(f) && !have.has(codeOf(f)));
  return [...main, ...fine];
}

// Asked in a view its centre is outside: Russia's centre is in Siberia.
const ALSO_ASKED = { europe: ['RU'] };

const inBox = ([lon, lat], [w, s, e, n]) => lat >= s && lat <= n && (e >= w ? lon >= w && lon <= e : lon >= w || lon <= e);

/** The projection for a view: Mercator centred on the box, fitted to WIDTH. */
function projectionFor([w, s, e, n]) {
  const span = e >= w ? e - w : e + 360 - w;
  const centre = w + span / 2;
  const box = { type: 'MultiPoint', coordinates: [] };
  for (let i = 0; i <= 20; i++) {
    const lon = w + (span * i) / 20;
    box.coordinates.push([lon, s], [lon, n]);
  }
  const p = geoMercator().rotate([-centre, 0]).fitWidth(WIDTH, box);
  const [[, y0], [, y1]] = geoPath(p).bounds(box);
  const height = Math.ceil(y1 - y0);
  p.translate([p.translate()[0], p.translate()[1] - y0]).clipExtent([[0, 0], [WIDTH, height]]);
  return { p, height };
}

export function buildView(id, all = worldShapes(VIEWS[id].res)) {
  const view = VIEWS[id];
  const { p, height } = projectionFor(view.box);
  // Whole pixels at 1000 wide are finer than any phone shows them.
  const path = geoPath(p).digits(0);
  const scale = PHONE_WIDTH / WIDTH;
  const out = [];
  for (const f of all) {
    const d = path(f);
    if (!d) continue;
    const code = codeOf(f);
    const c = code && byCode.get(code);
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds(f);
    const tapPx = Math.min(x1 - x0, y1 - y0) * scale;
    const asked = Boolean(c && c.sovereign && c.region === view.region && (inBox(geoCentroid(f), view.box) || ALSO_ASKED[id]?.includes(code)));
    const playable = asked && tapPx >= MIN_TAP_PX;
    out.push({ ...(c ? { code } : {}), ...(playable ? { playable: true } : {}), d });
  }
  // Background first, so answer shapes sit on top of their neighbours' edges.
  out.sort((a, b) => Number(Boolean(a.code)) - Number(Boolean(b.code)));
  return { id, label: view.label, width: WIDTH, height, shapes: out };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cache = {};
  mkdirSync(join(ROOT, 'src/data/map'), { recursive: true });
  const covered = new Set();
  for (const id of Object.keys(VIEWS)) {
    const view = buildView(id, (cache[VIEWS[id].res] ||= worldShapes(VIEWS[id].res)));
    const text = JSON.stringify(view);
    writeFileSync(join(ROOT, `src/data/map/${id}.json`), text);
    const playable = view.shapes.filter((s) => s.playable).map((s) => s.code);
    playable.forEach((c) => covered.add(c));
    console.log(`${id}: ${text.length.toLocaleString('en-US')} bytes, ${playable.length} playable`);
  }
  const left = countries.filter((c) => c.sovereign && c.region !== 'Antarctic' && !covered.has(c.code)).map((c) => c.name);
  console.log(`In no view: ${left.length}: ${left.join(', ')}`);
}
