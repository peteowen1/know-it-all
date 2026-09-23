// The only place the app imports the country JSON. Built by
// scripts/build-countries.mjs; see there for sources and field meanings.
import data from '../../data/countries.json';

export const COUNTRIES = data.countries;
export const COUNTRIES_BUILT_AT = data.builtAt;
export const POPULATION_YEAR = Math.max(...data.countries.map((c) => c.populationYear || 0));
