import React, { useEffect, useMemo } from 'react';
import lookalikes from '../../data/flagLookalikes.json';
import countriesData from '../../data/countries.json';
import { buildRounds, eligiblePairs, ROUNDS } from './twinLogic';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { AnswerRow, Button, Flag, GameCard, GameResults, Pill, preloadFlags } from '../../components/ui';
import { Ask, GameSetup, NextBar, Option, OptionGrid, PlayHead, Prompt } from '../shared/Play';
import './twinflags.css';

const NAME_OF = Object.fromEntries(countriesData.countries.map((c) => [c.code, c.name]));
const PAIRS = eligiblePairs(lookalikes, NAME_OF);

/**
 * Twin flags: two near-identical flags side by side, "Which is X?". After
 * answering, both names and one sentence on how to tell them apart.
 */
export default function TwinFlags({ stats, onRoundComplete, onExit }) {
  const [game, setGame] = usePersistentState('twin-flags', null);
  // Both flags of every round, fetched as the round starts (see preloadFlags).
  const flagRounds = game?.rounds;
  useEffect(() => {
    if (flagRounds) preloadFlags(flagRounds.flatMap((r) => [r.left, r.right]));
  }, [flagRounds]);
  const entry = gameEntry(stats, 'twin-flags');
  const pairs = useMemo(() => PAIRS, []);

  const start = () => setGame({ rounds: buildRounds(pairs, { seed: `${Date.now()}` }), index: 0, results: [] });

  if (!game) {
    return (
      <GameSetup
        title="Twin flags"
        section="lab"
        onExit={onExit}
        record={
          <>
            Two flags that look almost the same. Which one is the country you are asked about? {ROUNDS} rounds, and
            you get a tip on telling them apart after each one.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS}.` : ''}
          </>
        }
      >
        <div className="setup-actions">
          <Button variant="primary" icon="Target" onClick={start}>Start</Button>
        </div>
      </GameSetup>
    );
  }

  const { rounds, index, results } = game;
  const score = results.filter((r) => r.correct).length;

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Twin flags"
        score={score}
        total={rounds.length}
        verdict={score >= 9 ? 'Sharp eyes. Hard to fool you.' : score >= 6 ? 'Good. A few twins got you.' : 'Tricky ones. The tips below help.'}
        squares={results.map((r) => r.correct)}
        onPlayAgain={start}
        playAgainLabel="Play again"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {rounds.map((r, i) => (
          <AnswerRow key={r.id} state={results[i].correct ? 'got' : 'missed'} trail={results[i].correct ? 'right' : 'missed'}>
            {NAME_OF[r.ask]}: {r.how}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const res = done ? results[index] : null;

  const pick = (code) => {
    if (done) return;
    const next = [...results, { picked: code, correct: code === r.ask }];
    setGame({ ...game, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('twin-flags', {
        score: next.filter((x) => x.correct).length,
        total: rounds.length,
        answers: next.map((x, i) => ({ key: rounds[i].id, correct: x.correct }))
      });
    }
  };

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Round ${index + 1} of ${rounds.length}`}>
        <Pill variant="accent">{score} right</Pill>
      </PlayHead>

      <Ask>Spot the difference</Ask>
      <Prompt>Which is {NAME_OF[r.ask]}?</Prompt>

      <OptionGrid flags>
        {[r.left, r.right].map((code) => {
          let state = 'idle';
          if (done) state = code === r.ask ? 'correct' : code === res.picked ? 'wrong' : 'dim';
          return (
            <Option
              key={code}
              state={state}
              disabled={done}
              aria-label={done ? NAME_OF[code] : `Flag ${code === r.left ? 'on the left' : 'on the right'}`}
              onClick={() => pick(code)}
            >
              <Flag code={code} size="md" decorative />
            </Option>
          );
        })}
      </OptionGrid>

      {done && (
        <>
          <div className="tf-reveal">
            {[r.left, r.right].map((code) => (
              <p key={code} className="tf-name" data-ask={code === r.ask ? 'true' : undefined}>{NAME_OF[code]}</p>
            ))}
          </div>
          <p className="tf-how">{r.how}</p>
          <NextBar onClick={() => setGame({ ...game, index: index + 1 })}>
            {index < rounds.length - 1 ? 'Next round' : 'Results'}
          </NextBar>
        </>
      )}
    </GameCard>
  );
}
