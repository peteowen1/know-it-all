// What a famous person is known for, as a Who am I clue: "Starred in Titanic
// and Inception", "Played for Real Madrid and Manchester United". Built from
// the raw files scripts/fetch-famous-works.mjs saves. Pure: no network.

import { readdirSync, readFileSync, existsSync } from 'node:fs';

// Which kind of work to name, from the first job word in the person's short
// description ("American actor and singer" is an actor first). Each kind has
// its verb; notable works (P800) are the fallback for everyone.
// Band members count as musicians: Roger Taylor and Eddie Van Halen are a
// drummer and a guitarist (2026-10-24).
export const MUSICIAN = /\b(singer|rapper|musician|songwriter|vocalist|singer-songwriter|DJ|guitarist|drummer|bassist|keyboardist|frontman)\b/;
const KINDS = [
  { prop: 'P161', verb: 'Starred in', words: /\b(actor|actress|comedian|entertainer)\b/ },
  { prop: 'P175', verb: 'Recorded', words: MUSICIAN },
  { prop: 'P54', verb: 'Played for', words: /\b(footballer|player|cricketer|goalkeeper|striker|midfielder|defender|forward|pitcher|quarterback)\b/ },
  { prop: 'P57', verb: 'Directed', words: /\b(director|filmmaker)\b/ },
  { prop: 'P50', verb: 'Wrote', words: /\b(writer|novelist|author|poet|playwright)\b/ },
  { prop: 'P170', verb: 'Created', words: /\b(painter|artist|cartoonist|illustrator|animator|creator)\b/ }
];
const NOTABLE = { prop: 'P800', verb: 'Known for' };

// Works that say nothing about why the person is famous: films about them,
// national and youth sides (the description already says the nationality).
// College sides too ("Davidson Wildcats men's basketball"). A national side
// is matched on its name only: the description "National Basketball
// Association team" dropped the Golden State Warriors, leaving Stephen Curry
// "Played for Davidson".
const DULL = /\b(documentary|concert film|under-\d+|U-?\d\d|youth|reserves?|academy|men's basketball|college|university)\b/i;
// Never a slur on screen, title or not: Dick Gregory's autobiography, Bobby
// Shmurda's "Hot Nigga" (2026-10-23).
const SLUR = /\bnigg/i;
// Tennis sides are national too: "Czechoslovakia Davis Cup team" for Ivan Lendl.
const NATIONAL_SIDE = /\bnational\b.*\bteam\b|\b(Davis Cup|Billie Jean King Cup|Fed Cup|Hopman Cup)\b/i;
// Article titles stand in for some labels (see worksClue), and an opening can
// link a season or a franchise page: "Squid Game, season 2", "Spider-Man in film".
// Band works can be events: "59th Annual Grammy Awards" for Megadeth,
// "Italy in the Eurovision Song Contest 2021" for Måneskin.
const NOT_A_WORK = /\bseason \d+\b|\bin film$|\bAwards$|\bEurovision Song Contest\b/i;

// Works Wikidata credits wrongly, by person id, each checked by hand. Kyle
// Kuzma never played for Guangdong (his teams are the Lakers, Wizards and
// Bucks, none of which Wikidata lists); playtest 2026-10-20.
const WRONG = { Q30063347: ['Q2629395'] };

/** Raw rows and labels from data-raw/famous/works*. */
export function loadWorks(root) {
  const rows = new Map(); // person id -> [{prop, work, links}]
  const labels = new Map(); // work id -> {label, description}
  // works-v2 has every statement (see scripts/fetch-famous-works.mjs).
  const dir = `${root}/works-v2`;
  if (!existsSync(dir)) return { rows, labels };
  for (const f of readdirSync(dir).sort()) {
    for (const b of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).results.bindings) {
      const person = b.person.value.split('/').pop();
      if (!rows.has(person)) rows.set(person, []);
      rows.get(person).push({ prop: b.prop.value, work: b.work.value.split('/').pop(), links: +b.links.value });
    }
  }
  for (const f of readdirSync(`${root}/works-labels`).sort()) {
    for (const [id, e] of Object.entries(JSON.parse(readFileSync(`${root}/works-labels/${f}`, 'utf8')).entities || {})) {
      if (e.labels?.en) labels.set(id, { label: e.labels.en.value, description: e.descriptions?.en?.value || '' });
    }
  }
  loadBands(root, rows);
  return { rows, labels, awards: loadAwards(root), ...loadLeads(root) };
}

// An award counts as major from this many Wikipedia sitelinks: the Oscars
// have 64, a Golden Globe 24; the Bram Stoker Award that gave Stephen King
// "On Writing" has 3 (2026-10-24).
const MAJOR_AWARD = 15;
// Awards for the worst, and fan votes: MTV gave Jim Carrey "Dumb and Dumber"
// over Eternal Sunshine of the Spotless Mind.
const NOT_AN_HONOUR = /\b(Golden Raspberry|Razzie|MTV|Kids' Choice|People's Choice|Teen Choice|Nickelodeon)\b/i;

/** Person id -> Set of work ids they won a major award for, from data-raw/famous/awards. */
function loadAwards(root) {
  const awards = new Map();
  const dir = `${root}/awards`;
  if (!existsSync(dir)) return awards;
  for (const f of readdirSync(dir).sort()) {
    for (const b of JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).results.bindings) {
      if (+b.awardLinks.value < MAJOR_AWARD || NOT_AN_HONOUR.test(b.awardLabel?.value || '')) continue;
      const person = b.person.value.split('/').pop();
      if (!awards.has(person)) awards.set(person, new Set());
      awards.get(person).add(b.work.value.split('/').pop());
    }
  }
  return awards;
}

const year = (v) => (v ? +v.slice(0, 4) : null);

/**
 * Adds each musician's band works, from the raw files
 * scripts/fetch-famous-bands.mjs saves, as P175 rows carrying the band's id:
 * Wikidata credits T. Rex's hits to T. Rex, not to Marc Bolan. A dated work
 * counts only if a release year falls in one of their spells in the band
 * (Brian Johnson joined AC/DC in 1980); an undated work, or a spell with no
 * dates, is not ruled out. A work first out before the band was formed is a
 * cover and dropped (White Christmas for the Beach Boys). A work they are
 * credited with themselves keeps that row.
 */
function loadBands(root, rows) {
  const dir = `${root}/bands`;
  if (!existsSync(dir)) return;
  addBandRows(rows, readdirSync(dir).sort().flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).results.bindings));
}

/** loadBands on the SPARQL rows themselves; exported for the tests. */
export function addBandRows(rows, bindings) {
  const spells = new Map(); // person|band -> Set of "start-end"
  const works = new Map(); // person|band -> Map(work -> {links, years})
  const formed = new Map(); // band -> earliest formation year
  for (const b of bindings) {
    const bandId = b.band.value.split('/').pop();
    const key = `${b.person.value.split('/').pop()}|${bandId}`;
    if (b.formed?.value) formed.set(bandId, Math.min(formed.get(bandId) ?? Infinity, year(b.formed.value)));
    if (!spells.has(key)) spells.set(key, new Set());
    spells.get(key).add(`${year(b.start?.value) ?? ''}-${year(b.end?.value) ?? ''}`);
    if (!works.has(key)) works.set(key, new Map());
    const w = b.work.value.split('/').pop();
    if (!works.get(key).has(w)) works.get(key).set(w, { links: +b.links.value, years: new Set() });
    if (b.date?.value) works.get(key).get(w).years.add(year(b.date.value));
  }
  for (const [key, ws] of works) {
    const [person, band] = key.split('|');
    const ranges = [...spells.get(key)].map((s) => s.split('-').map((x) => (x === '' ? null : +x)));
    const inBand = (y) => ranges.some(([s, e]) => (s == null || y >= s) && (e == null || y <= e));
    const own = rows.get(person) || [];
    const credited = new Set(own.filter((r) => r.prop === 'P175').map((r) => r.work));
    const cover = (years) => formed.has(band) && Math.min(...years) < formed.get(band);
    for (const [work, { links, years }] of ws) {
      if (credited.has(work) || (years.size && (cover(years) || ![...years].some(inBand)))) continue;
      own.push({ prop: 'P175', work, links, band });
    }
    rows.set(person, own);
  }
}

/**
 * What each person's Wikipedia opening links to, as Wikidata ids, from the raw
 * files scripts/fetch-famous-leads.mjs saves: lead (person id -> Set of work
 * ids) and titles (work id -> article title, the label for a work whose
 * Wikidata label was never fetched). Empty when the files are missing.
 */
function loadLeads(root) {
  const lead = new Map();
  const titles = new Map();
  if (!existsSync(`${root}/leads`) || !existsSync(`${root}/leads-qids`)) return { lead, titles };
  // Asked title -> the article it lands on, then article -> Wikidata id.
  const to = new Map();
  const qid = new Map();
  for (const f of readdirSync(`${root}/leads-qids`).sort()) {
    const q = JSON.parse(readFileSync(`${root}/leads-qids/${f}`, 'utf8')).response.query || {};
    for (const r of [...(q.normalized || []), ...(q.redirects || [])]) to.set(r.from, r.to);
    for (const p of q.pages || []) if (p.pageprops?.wikibase_item) qid.set(p.title, p.pageprops.wikibase_item);
  }
  const idOf = (t) => {
    for (let i = 0; i < 3 && to.has(t); i++) t = to.get(t);
    return qid.get(t);
  };
  for (const [t, id] of qid) titles.set(id, t);
  for (const f of readdirSync(`${root}/leads`)) {
    const links = JSON.parse(readFileSync(`${root}/leads/${f}`, 'utf8')).parse?.links || [];
    lead.set(f.replace(/\.json$/, ''), new Set(links.filter((l) => l.ns === 0).map((l) => idOf(l.title)).filter(Boolean)));
  }
  return { lead, titles };
}

const words = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/**
 * Does a title give the name away? A whole word of it, or a longer name word
 * with an ending added: "Cleveland Browns" for Jim Brown, "Keeping Up with
 * the Kardashians" for Rob Kardashian.
 */
export const leaksName = (title, nameWords) =>
  words(title).some((x) => nameWords.has(x) || [...nameWords].some((n) => n.length >= 4 && x.startsWith(n)));

/**
 * "Starred in Titanic and Inception", or null when nothing fits. The two
 * best-known works of the kind the description points to, else of the
 * person's notable works. Works their Wikipedia opening names come first,
 * then the rest by Wikipedia sitelinks: by sitelinks alone Laura Prepon
 * "Starred in House M.D. and How I Met Your Mother", guest spots in shows
 * more famous than That '70s Show (373 of 2,960 clues on 2026-10-22). A work
 * whose title holds any word of the person's name ("Taylor Swift", the album)
 * is skipped: it would give the answer away.
 */
export function worksClue(person, { rows, labels, lead = new Map(), titles = new Map(), awards = new Map() }) {
  const own = rows.get(person.id) || [];
  const inLead = lead.get(person.id) || new Set();
  // A work the opening names may have no fetched label (only each person's
  // four most famous per kind were): its article title stands in, without
  // the "(2016 film)" part.
  // The full title is checked before its "(…)" goes. A franchise stays: "Back
  // to the Future (franchise)" is the clue Michael J. Fox needs.
  const label = (id) => {
    if (labels.has(id)) return labels.get(id);
    const t = inLead.has(id) && titles.get(id);
    if (!t || NOT_A_WORK.test(t)) return null;
    return { label: t.replace(/\s+\([^)]*\)$/, ''), description: '' };
  };
  const nameWords = new Set(words(person.name));
  const desc = person.description || '';
  const kinds = KINDS.map((k) => ({ k, at: desc.search(k.words) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.k);
  // With the opening fetched, a kind whose works it names none of is passed
  // over: by sitelinks alone Karen Carpenter "Recorded Looking for Love" and
  // Francis Crick was "Known for Life Itself" (330 of 2,960 clues, 2026-10-23).
  const checked = lead.has(person.id);
  // A work Wikidata lists among the person's notable works backs a kind's
  // clue too: Jacques Brel's opening links Sinatra and Nina Simone but none
  // of his songs, so he "Starred in Far West" until Ne me quitte pas counted
  // (2026-10-24). Not for the notable-works clue itself: Francis Crick's
  // notable works include Life Itself.
  const notable = new Set(own.filter((r) => r.prop === NOTABLE.prop).map((r) => r.work));
  // A band's works are backed when the opening links the band itself (Marc
  // Bolan's names T. Rex, not Get It On), but rank below the person's own
  // backed works: Harry Styles is Fine Line, not One Direction's Up All Night.
  const backed = (r, kind) =>
    inLead.has(r.work) || (kind !== NOTABLE && notable.has(r.work)) ? 2 : r.band && inLead.has(r.band) ? 1 : 0;
  for (const kind of [...kinds, NOTABLE]) {
    const seen = new Set();
    const fits = own
      // A band's work only with the band in the opening: a band they once
      // passed through says nothing.
      .filter((r) => r.prop === kind.prop && label(r.work) && !WRONG[person.id]?.includes(r.work) && (!r.band || backed(r, kind)))
      .filter((r) => {
        const w = label(r.work);
        return !DULL.test(`${w.label} ${w.description}`) && !SLUR.test(w.label) && !NOT_A_WORK.test(w.label) && !NATIONAL_SIDE.test(w.label) && !leaksName(w.label, nameWords);
      })
      .sort((a, b) => backed(b, kind) - backed(a, kind) || b.links - a.links);
    if (checked && !fits.some((r) => backed(r, kind))) continue;
    // The best-known work stays first; second goes to one they won a major
    // award for, if any is as well backed: Diane Keaton "Starred in The
    // Godfather and Annie Hall", not The Godfather Part II.
    const won = awards.get(person.id);
    const prize = won && fits.slice(1).find((r) => won.has(r.work) && backed(r, kind) === backed(fits[0], kind));
    if (prize) fits.splice(1, 0, ...fits.splice(fits.indexOf(prize), 1));
    const titles = fits
      .map((r) => label(r.work))
      // "Fulham F.C." reads as "Fulham" in a clue, "FC Barcelona" as "Barcelona",
      // "Arsenal W.F.C." and "Chelsea F.C. Women" as "Arsenal Women", "Chelsea Women".
      .map((w) =>
        w.label
          .replace(/\s+(W\.?F\.?C\.?|F\.?C\.?\s+Women)$/, ' Women')
          .replace(/\s+(A\.?F\.?C\.?|F\.?C\.?|C\.?F\.?|S\.?C\.?)$/, '')
          .replace(/^F\.?C\.?\s+/, '')
      )
      .filter((t) => !seen.has(t) && seen.add(t))
      .slice(0, 2);
    if (titles.length) return `${kind.verb} ${titles.join(' and ')}`;
  }
  return null;
}
