import React from 'react';
import ChartGame from './ChartGame';
import music from '../../data/charts/music.json';

// The music instance of the chart engine. FilmCharts.jsx is the same shape.
const DOMAIN = {
  id: 'music-years',
  title: 'Chart toppers by year',
  intro: "Billboard year-end charts from 1959. Fill a year's top 10 or a decade's top 20, or take the quiz.",
  charts: {
    hot100: {
      label: 'Billboard Hot 100',
      years: music.years,
      source:
        "Billboard Year-End Hot 100, 1959 to 2025, via Wikipedia. Decade boards add up each song's points across every year it charted.",
      noun: 'song',
      creditNoun: 'artist',
      boardLabel: 'Songs board',
      creditsLabel: 'Artists board',
      boardTitle: (label) => `Top songs of ${label}`,
      yearSize: 10,
      decadeSize: 20,
      yearSpanLabel: 'One year (top 10)',
      decadeSpanLabel: 'Whole decade (top 20)',
      decadeBoard: 'aggregate'
    }
  }
};

export default function MusicCharts(props) {
  return <ChartGame domain={DOMAIN} {...props} />;
}
