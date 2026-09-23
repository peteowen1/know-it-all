import React from 'react';
import ChartGame from './ChartGame';
import tv from '../../data/charts/tv.json';

// TV by year: Emmy and Golden Globe series awards through the chart engine.
// A show's credit is its network, so "HBO" fills any HBO slot on a board.
const award = (label, years, source, prize) => ({
  label,
  years,
  source,
  noun: 'show',
  creditNoun: 'network',
  boardLabel: 'Nominees board',
  creditsLabel: null,
  boardTitle: (span, single) => {
    const Prize = prize[0].toUpperCase() + prize.slice(1); // titles start a sentence
    return single ? `${Prize} nominees, ${span}` : `${Prize} winners of ${span}`;
  },
  yearSize: null,
  decadeSize: 10,
  yearSpanLabel: "One year's nominees",
  decadeSpanLabel: "A decade's winners",
  decadeBoard: 'winners',
  sameYearDistractors: true,
  quizWords: {
    best: (y) => `${prize}, ${y}: which show won?`,
    whichYear: (l) => `${l} won ${prize} for which year?`,
    winner: (l, y) => `${l} won ${prize} for ${y}.`,
    runnerUp: 'Also nominated'
  }
});

const EMMY = 'Primetime Emmy Award, via Wikipedia. Years are the ceremony year.';
const GLOBE = 'Golden Globe Award, via Wikipedia. Years are the year of television honoured (2010 = the ceremony in January 2011).';

const DOMAIN = {
  id: 'tv-years',
  title: 'TV by year',
  intro: 'Emmy and Golden Globe winners and nominees for best drama and comedy series, back to the 1950s.',
  charts: {
    emmyDrama: award('Emmy: Drama', tv.emmyDrama, EMMY, 'the Emmy for Drama Series'),
    emmyComedy: award('Emmy: Comedy', tv.emmyComedy, EMMY, 'the Emmy for Comedy Series'),
    globeDrama: award('Globe: Drama', tv.globeDrama, GLOBE, 'the Golden Globe for Drama Series'),
    globeComedy: award('Globe: Comedy', tv.globeComedy, GLOBE, 'the Golden Globe for Musical or Comedy Series')
  }
};

export default function TvCharts(props) {
  return <ChartGame domain={DOMAIN} {...props} />;
}
