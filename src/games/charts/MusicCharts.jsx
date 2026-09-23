import React from 'react';
import ChartGame from './ChartGame';
import music from '../../data/charts/music.json';

// The music instance of the chart engine. Films and TV get a file like this
// one each, with their own data.
const DOMAIN = {
  id: 'music-years',
  title: 'Chart toppers by year',
  intro: 'Billboard year-end charts from 1959. Fill a year\'s top 10 or a decade\'s top 20, or take the quiz.',
  source: 'Billboard Year-End Hot 100, 1959 to 2025, via Wikipedia',
  years: music.years
};

export default function MusicCharts(props) {
  return <ChartGame domain={DOMAIN} {...props} />;
}
