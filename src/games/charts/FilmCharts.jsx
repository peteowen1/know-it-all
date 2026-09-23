import React from 'react';
import ChartGame from './ChartGame';
import films from '../../data/charts/films.json';

// Films by year: box office and Best Picture, through the same chart engine as
// music. Each film's credit is its director, so typing "Spielberg" finds his.
const DOMAIN = {
  id: 'film-years',
  title: 'Films by year',
  intro: "Each year's box-office top 10 since 1970, and every Best Picture winner and nominee since 1927.",
  charts: {
    boxOffice: {
      label: 'Box office',
      years: films.boxOffice,
      source:
        'Top 10 films released each year, from the Wikipedia "YYYY in film" pages: worldwide gross from the 1980s, North American rentals in the 1970s. Decade boards add up each film\'s points.',
      noun: 'film',
      creditNoun: 'director',
      boardLabel: 'Films board',
      creditsLabel: 'Directors board',
      boardTitle: (label) => `Biggest films of ${label}`,
      yearSize: 10,
      decadeSize: 20,
      yearSpanLabel: 'One year (top 10)',
      decadeSpanLabel: 'Whole decade (top 20)',
      decadeBoard: 'aggregate',
      quizWords: {
        best: (y) => `Biggest film of ${y} at the box office?`,
        whichYear: (label) => `${label} was the biggest film of which year?`,
        winner: (label, y) => `${label} was the top-grossing film released in ${y}.`,
        runnerUp: 'Second'
      }
    },
    bestPicture: {
      label: 'Best Picture',
      years: films.bestPicture,
      source: 'Academy Award for Best Picture, winners and nominees by film year, via Wikipedia.',
      noun: 'film',
      creditNoun: 'director',
      boardLabel: 'Nominees board',
      creditsLabel: null,
      boardTitle: (label, single) => (single ? `Best Picture nominees, ${label}` : `Best Picture winners of ${label}`),
      yearSize: null,
      decadeSize: 10,
      yearSpanLabel: "One year's nominees",
      decadeSpanLabel: "A decade's winners",
      decadeBoard: 'winners',
      sameYearDistractors: true,
      quizWords: {
        best: (y) => `Which film won Best Picture for ${y}?`,
        whichYear: (label) => `${label} won Best Picture for which year?`,
        winner: (label, y) => `${label} won Best Picture for ${y}.`,
        runnerUp: 'Also nominated'
      }
    }
  }
};

export default function FilmCharts(props) {
  return <ChartGame domain={DOMAIN} {...props} />;
}
