import React, { useEffect, useRef, useState } from 'react';
import { COUNTRIES } from '../geo/countries';
import { ROUND, playableCodes, pickTargets } from './mapLogic';
import { gameEntry, itemWeights } from '../../lib/gameStats';
import { AnswerRow, Button, Chip, GameCard, GameResults, Pill, SetupRow } from '../../components/ui';
import { GameSetup, PlayHead, NextBar } from '../shared/Play';
import { makeRng } from '../../lib/rng';
import { usePersistentState } from '../../lib/persist';
import './map.css';

const STAT_ID = 'map';
const NAME = new Map(COUNTRIES.map((c) => [c.code, c.name]));
// One small file per view (scripts/build-world-map.mjs), loaded when played.
const VIEW_FILES = import.meta.glob('../../data/map/*.json', { import: 'default' });
const VIEWS = [
  ['europe', 'Europe'], ['africa', 'Africa'], ['middle-east', 'Middle East'], ['asia', 'Asia'],
  ['north-america', 'North America'], ['central-america', 'Central America and Caribbean'],
  ['south-america', 'South America'], ['oceania', 'Oceania']
];
const KNOWN = new Set(VIEWS.map(([id]) => id));
const loadView = (id) => {
  const file = VIEW_FILES[`../../data/map/${id}.json`];
  return file ? file() : Promise.reject(new Error(`No map called ${id}`));
};
// A round saved by an older build (a view since renamed, or another shape)
// starts over rather than crash on every open.
const usable = (r) => r && KNOWN.has(r.view) && Array.isArray(r.targets) && Array.isArray(r.answers) ? r : null;

/**
 * Find it on the map: a country is named; tap it. Ten a round, one tap each.
 * A wrong tap says which country it was and shows the right one. Countries
 * you miss come back more often.
 */
export default function MapGame({ stats, onAnswer, onRoundComplete, onExit }) {
  const [savedViewId, setViewId] = usePersistentState('map_view', 'europe');
  const viewId = KNOWN.has(savedViewId) ? savedViewId : 'europe';
  // Saved so a round survives the app being closed (see src/lib/persist.js).
  const [savedRound, setRound] = usePersistentState('map_round', null);
  const round = usable(savedRound);
  const [loaded, setLoaded] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const rand = useRef(makeRng(Date.now() >>> 0));
  // The question last answered. Two taps landing before a re-render would
  // both see it unanswered and record it (and on the last one, the round)
  // twice; this ref is updated at once (as CountryQuiz's answeredUpTo).
  const answeredUpTo = useRef((round?.answers.length ?? 0) - 1);
  const entry = gameEntry(stats, STAT_ID);
  const shownId = round?.view || viewId;
  // The loaded view only counts once it is the one asked for: just after a
  // switch the previous one is still in state.
  const view = loaded?.id === shownId ? loaded : null;

  useEffect(() => {
    let live = true;
    loadView(shownId)
      .then((v) => live && setLoaded(v))
      .catch((err) => live && setLoadError(err));
    return () => {
      live = false;
    };
  }, [shownId]);
  if (loadError) throw loadError;

  const start = () => {
    if (!view) return;
    const codes = playableCodes(view);
    const targets = pickTargets(codes, itemWeights(stats, STAT_ID, codes), rand.current);
    answeredUpTo.current = -1;
    setRound({ view: view.id, targets, index: 0, answers: [], tapped: null });
  };

  if (!round) {
    const count = view ? playableCodes(view).length : null;
    return (
      <GameSetup
        title="Find it on the map"
        section="lab"
        onExit={onExit}
        record={
          <>
            {entry.plays ? `${entry.plays} played · best ${entry.best} of ${ROUND}. ` : ''}
            A country is named; tap it. {ROUND} a round. Misses come back more often.
          </>
        }
        note="Outlines from Natural Earth. Countries too small to tap on a phone (most islands, Malta, Luxembourg, Singapore) are left out for now."
      >
        <SetupRow label="Map" caption={count ? `${count} countries to find` : 'Loading…'}>
          {VIEWS.map(([id, label]) => (
            <Chip key={id} active={viewId === id} onClick={() => setViewId(id)}>{label}</Chip>
          ))}
        </SetupRow>
        <Button variant="primary" className="game-start" onClick={start} disabled={!view}>Start</Button>
      </GameSetup>
    );
  }

  const { targets, index, answers, tapped } = round;

  if (index >= targets.length) {
    const score = answers.filter((a) => a.correct).length;
    return (
      <GameResults
        data-section="lab"
        eyebrow={`Find it on the map · ${VIEWS.find(([id]) => id === round.view)?.[1] ?? ''}`}
        score={score}
        total={targets.length}
        verdict={score === targets.length ? 'Every one found.' : score >= targets.length * 0.7 ? 'You know your way around.' : 'The misses come back more often next time.'}
        squares={answers.map((a) => a.correct)}
        onPlayAgain={start}
        playAgainLabel="Another ten"
        onChangeSettings={() => setRound(null)}
      >
        {answers.filter((a) => !a.correct).map((a) => (
          <AnswerRow key={a.key} state="missed" trail={a.tapped ? `tapped ${NAME.get(a.tapped) ?? a.tapped}` : ''}>
            {NAME.get(a.key)}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const target = targets[index];
  const answered = tapped !== null;
  const right = answers.filter((a) => a.correct).length;

  const tap = (code) => {
    if (answered || !code || answeredUpTo.current >= index) return;
    answeredUpTo.current = index;
    const correct = code === target;
    const nextAnswers = [...answers, { key: target, correct, ...(correct ? {} : { tapped: code }) }];
    setRound({ ...round, answers: nextAnswers, tapped: code });
    onAnswer(STAT_ID, target, correct);
    if (index === targets.length - 1) {
      onRoundComplete(STAT_ID, { score: nextAnswers.filter((a) => a.correct).length, total: targets.length, answers: [] });
    }
  };

  const state = (code) => {
    if (!answered || !code) return undefined;
    if (code === target) return 'target';
    if (code === tapped) return 'wrong';
    return undefined;
  };

  return (
    <GameCard data-section="lab">
      <PlayHead left={`${index + 1} / ${targets.length}`}>
        <Pill variant="accent">Score {right}</Pill>
      </PlayHead>
      <p className="map-ask" role="status">
        {!answered && <>Tap <strong>{NAME.get(target)}</strong></>}
        {answered && tapped === target && <>Right: <strong>{NAME.get(target)}</strong></>}
        {answered && tapped !== target && <>That is {NAME.get(tapped) ?? 'not it'}. <strong>{NAME.get(target)}</strong> is in green.</>}
      </p>
      {view && view.id === round.view ? (
        <svg className="map-svg" viewBox={`0 0 ${view.width} ${view.height}`} role="img" aria-label={`Map of ${view.label}`}>
          {view.shapes.map((s, i) => (
            <path
              key={`${s.code ?? 'x'}-${i}`}
              d={s.d}
              data-code={s.code}
              data-state={state(s.code)}
              onClick={() => tap(s.code)}
            />
          ))}
        </svg>
      ) : (
        <p className="setup-caption">Loading the map…</p>
      )}
      {answered && <NextBar onClick={() => setRound({ ...round, index: index + 1, tapped: null })} />}
    </GameCard>
  );
}
