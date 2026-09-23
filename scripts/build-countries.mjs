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
// Every field mledoze returns is kept except `translations` (the name in 25
// languages, ~40% of the file). Raw responses go to data-raw/ so a field that
// was dropped can be recovered without re-fetching.

import { writeFileSync, mkdirSync } from 'node:fs';

const COUNTRIES_URL = 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json';
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
  PS: ['East Jerusalem']
};

const EXTRA_SOVEREIGN = new Set(['VA', 'PS', 'XK', 'TW']);

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
};

const raw = await getJson(COUNTRIES_URL);
const [, popRows] = await getJson(POP_URL);

mkdirSync('data-raw', { recursive: true });
writeFileSync('data-raw/mledoze-countries.json', JSON.stringify(raw));
writeFileSync('data-raw/worldbank-population.json', JSON.stringify(popRows));

// Kosovo is UNK in mledoze and XKX at the World Bank; no other code differs.
const WB_ISO3 = { UNK: 'XKX' };

const pop = new Map(
  popRows.filter((r) => r.value != null).map((r) => [r.countryiso3code, { value: r.value, year: Number(r.date) }])
);

const countries = raw
  .map(({ translations: _translations, ...c }) => {
    const p = pop.get(WB_ISO3[c.cca3] || c.cca3);
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
      subregion: c.subregion || c.region,
      sovereign: c.unMember || EXTRA_SOVEREIGN.has(c.cca2),
      unMember: c.unMember,
      flag: c.flag,
      population: p?.value ?? null,
      populationYear: p?.year ?? null,
      area: c.area,
      altNames: c.altSpellings || [],
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

writeFileSync(
  'src/data/countries.json',
  JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), countries }, null, 0)
);
console.log('wrote src/data/countries.json');
