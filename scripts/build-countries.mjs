#!/usr/bin/env node
// Builds src/data/countries.json for the geography games. Run with
// `npm run data:countries`; the output is committed, so the app never fetches
// at runtime and a source going away cannot break the site.
//
// Two sources, joined on ISO3:
//   - mledoze/countries: names, capitals, region, flags, borders, languages.
//     Human-curated, proper accents, current names (Kyiv, Türkiye, Czechia).
//   - World Bank SP.POP.TOTL, most recent non-empty year per country.
//
// The World Bank country list is NOT used for names or capitals: it has
// "Egypt, Arab Rep.", "Naoero" and "Kiev", which are wrong answers in a quiz.
//
// Raw responses go to data-raw/ in full, so a field can be recovered without
// re-fetching. What ships is slimmer: lib/output.mjs lists the fields something
// reads (the name in 25 languages, ~40% of the raw file, never ships).

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fromRoot, writeData } from './lib/output.mjs';
import { unSubregions } from './lib/unRegions.mjs';

const COUNTRIES_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
const GDP_URL = 'https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&per_page=20000';
const POP_URL =
  'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400';

// Sovereign states that are not UN members but belong in any capitals or flags
// quiz. Everything else non-UN (Guam, Aruba, Greenland...) is a territory and
// only appears when the player turns territories on.
// Extra answers marked correct alongside mledoze's capital. Only cases where a
// quiz-setter would genuinely accept either; Abidjan (Ivory Coast) and The Hague
// (Netherlands) are deliberately absent — they are the classic trap answers.
const ACCEPT_ALSO = {
  BO: ['La Paz'],
  SZ: ['Mbabane'],
  LK: ['Sri Jayawardenepura Kotte'],
  MY: ['Putrajaya'],
  BJ: ['Cotonou'],
  PS: ['East Jerusalem'],
  // Other spellings people type (a 2026-10-18 playtest of Scramble).
  UA: ['Kiev'],
  MN: ['Ulaanbaatar'],
  MM: ['Nay Pyi Taw'],
  AG: ["St John's"]
};

// Subregions follow the UN geoscheme (M49), not REST Countries' own grouping
// (see lib/unRegions.mjs). The UN table is saved raw in data-raw/un-m49/.
// Kosovo and Taiwan are not in it: Kosovo goes with its neighbours in Southern
// Europe (M49 counts it under Serbia), Taiwan keeps REST Countries' Eastern Asia.
const UN_M49_URL = 'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.csv';
const UN_M49_FILE = fromRoot('data-raw/un-m49/all.csv');
if (!existsSync(UN_M49_FILE)) {
  const res = await fetch(UN_M49_URL);
  if (!res.ok) throw new Error(`UN M49 table: ${res.status}`);
  mkdirSync(fromRoot('data-raw/un-m49'), { recursive: true });
  writeFileSync(UN_M49_FILE, await res.text());
}
const UN_SUBREGION = unSubregions(UN_M49_FILE);
UN_SUBREGION.set('XK', 'Southern Europe');

// Country names people type that REST Countries does not list.
const NAMES_ALSO = {
  TR: ['Turkey'],
  GB: ['Britain'],
  DE: ['Deutschland']
};

const EXTRA_SOVEREIGN = new Set(['VA', 'PS', 'XK', 'TW']);

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
};

const raw = await getJson(COUNTRIES_URL);
const [, popRows] = await getJson(POP_URL);
// GDP in current US dollars, every year for every country (the most-recent
// filter is ignored for this indicator), saved whole; each country's latest
// reported year is used.
const gdpResponse = await getJson(GDP_URL);
const [gdpMeta, gdpRows] = gdpResponse;
if (gdpMeta.pages > 1) throw new Error(`World Bank GDP came in ${gdpMeta.pages} pages; raise per_page in GDP_URL`);

mkdirSync(fromRoot('data-raw'), { recursive: true });
writeFileSync(fromRoot('data-raw/mledoze-countries.json'), JSON.stringify(raw));
writeFileSync(fromRoot('data-raw/worldbank-population.json'), JSON.stringify(popRows));
writeFileSync(fromRoot('data-raw/worldbank-gdp.json'), JSON.stringify(gdpResponse));

// Kosovo is UNK in mledoze and XKX at the World Bank; no other code differs.
const WB_ISO3 = { UNK: 'XKX' };

const pop = new Map(
  popRows.filter((r) => r.value != null).map((r) => [r.countryiso3code, { value: r.value, year: Number(r.date) }])
);

const gdp = new Map();
for (const r of gdpRows) {
  if (r.value == null || !r.countryiso3code) continue;
  const cur = gdp.get(r.countryiso3code);
  if (!cur || Number(r.date) > cur.year) gdp.set(r.countryiso3code, { value: r.value, year: Number(r.date) });
}

const countries = raw
  .map(({ translations: _translations, ...c }) => {
    const p = pop.get(WB_ISO3[c.cca3] || c.cca3);
    const g = gdp.get(WB_ISO3[c.cca3] || c.cca3);
    return {
      code: c.cca2,
      iso3: c.cca3,
      name: c.name.common,
      officialName: c.name.official,
      // Several countries have more than one: South Africa has three, Bolivia
      // splits constitutional (Sucre) from seat of government (La Paz). Any of
      // them is marked correct; the first is the one shown.
      capitals: c.capital || [],
      capitalsAlsoAccepted: ACCEPT_ALSO[c.cca2] || [],
      region: c.region,
      subregion: UN_SUBREGION.get(c.cca2) || c.subregion || c.region,
      sovereign: c.unMember || EXTRA_SOVEREIGN.has(c.cca2),
      unMember: c.unMember,
      flag: c.flag,
      population: p?.value ?? null,
      populationYear: p?.year ?? null,
      gdp: g ? Math.round(g.value) : null,
      gdpYear: g?.year ?? null,
      area: c.area,
      altNames: [...(c.altSpellings || []), ...(NAMES_ALSO[c.cca2] || [])],
      landlocked: c.landlocked,
      borders: c.borders || [],
      languages: Object.values(c.languages || {}),
      currencies: Object.entries(c.currencies || {}).map(([code, v]) => ({ code, ...v })),
      demonym: c.demonyms?.eng?.m || null,
      latlng: c.latlng,
      tld: c.tld || [],
      cioc: c.cioc || null,
      status: c.status,
      unRegionalGroup: c.unRegionalGroup || null
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// Coverage, not presence: say exactly which rows are missing what.
const sovereign = countries.filter((c) => c.sovereign);
const noCapital = sovereign.filter((c) => !c.capitals.length).map((c) => c.name);
const noPop = sovereign.filter((c) => c.population == null).map((c) => c.name);
const years = [...new Set(sovereign.map((c) => c.populationYear).filter(Boolean))].sort();

console.log(`${countries.length} entries, ${sovereign.length} sovereign`);
console.log(`population years: ${years.join(', ')}`);
console.log(`sovereign without capital (${noCapital.length}): ${noCapital.join('; ') || 'none'}`);
console.log(`sovereign without population (${noPop.length}): ${noPop.join('; ') || 'none'}`);

if (sovereign.length < 195) throw new Error(`only ${sovereign.length} sovereign states — join or filter broken`);
if (noPop.length > 5) throw new Error(`${noPop.length} sovereign states lack population — World Bank join broken`);

writeData('countries.json', { countries });
