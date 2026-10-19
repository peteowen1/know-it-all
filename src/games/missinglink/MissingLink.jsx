import React from 'react';
import data from '../../data/obscure.json';
import { buildLinkRounds, linkPoints, CLUES } from './linkLogic';
import { localDateKey } from '../../lib/dates';
import { useDaySave, daysOwn, clearDay } from '../../lib/day';
import { gameEntry } from '../../lib/gameStats';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, GameCard, GameResults, Pill, EarlierDays } from '../../components/ui';
import { Ask, GameSetup, NextBar, Option, OptionGrid, PlayHead } from '../shared/Play';

/**
 * Missing link: clues arrive one at a time, rarest first. Pick the link from
 * four options whenever you like: 4 points after one clue, down to 1 after
 * all four. A wrong pick scores nothing and shows the rest.
 */
export default function MissingLink({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame, day] = useDaySave('missing_link');
  const entry = gameEntry(stats, 'missing-link');

  const start = (daily) => {
    // A random round is not tied to a day, so it leaves the earlier day's address.
    if (!daily) clearDay();
    const date = daily ? day || localDateKey() : localDateKey();
    const seed = daily ? date : `${Date.now()}`;
    setGame({ daily, date, rounds: buildLinkRounds(data.categories, { seed }), index: 0, shown: 1, results: [] });
  };

  if (!game) {
    return (
      <GameSetup
        title="Missing link"
        section="lab"
        onExit={onExit}
        record={
          <>
            Four clues, rarest first. Name the link as early as you dare: 4 points after one clue, 1 after all four,
            nothing if wrong. Five rounds.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/20.` : ''}
          </>
        }
      >
        <EarlierDays day={day} />
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>{daysOwn(day)} five</Button>
          <Button variant="secondary" icon="Shuffle" onClick={() => start(false)}>Random</Button>
        </div>
      </GameSetup>
    );
  }

  const { rounds, index, shown, results } = game;
  const total = results.reduce((s, r) => s + r.points, 0);

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Missing link"
        hero={`${total} / ${rounds.length * CLUES} points`}
        score={total}
        total={rounds.length * CLUES}
        verdict={total >= rounds.length * 3 ? 'Sharp. You named the links early.' : total > 0 ? 'Some links landed. The rest are below.' : 'No links this time. They are all below.'}
        squares={results.map((x) => x.points > 0)}
        celebrate={total === rounds.length * CLUES}
        onPlayAgain={() => start(false)}
        share={game.daily ? dailyShare('Missing link', 'missing-link', game.date) : undefined}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {rounds.map((r, i) => (
          <AnswerRow key={r.id} state={results[i].points ? 'got' : 'missed'} trail={results[i].points ? `${results[i].points} point${results[i].points === 1 ? '' : 's'}` : 'missed'}>
            {r.link}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const res = done ? results[index] : null;
  const visible = done ? CLUES : shown;

  const pick = (i) => {
    if (done) return;
    const right = i === r.correctIndex;
    const next = [...results, { picked: i, points: right ? linkPoints(shown) : 0 }];
    setGame({ ...game, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('missing-link', { score: next.reduce((s, x) => s + x.points, 0), total: rounds.length * CLUES, answers: [] });
    }
  };

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Round ${index + 1} of ${rounds.length}`}>
        <Pill variant="accent">{total} pts</Pill>
      </PlayHead>

      <ol className="ml-clues">
        {r.clues.map((c, i) => (
          <li key={c.answer} className={i < visible ? 'on' : ''}>
            {i < visible ? c.text : '?'}
          </li>
        ))}
      </ol>

      {!done && shown < CLUES && (
        <div className="play-grade">
          <Button variant="secondary" icon="Eye" onClick={() => setGame({ ...game, shown: shown + 1 })}>
            Next clue (worth {linkPoints(shown + 1)} after)
          </Button>
        </div>
      )}

      <Ask>{done ? 'The link' : `What links them? Worth ${linkPoints(shown)} now`}</Ask>
      <OptionGrid>
        {r.options.map((opt, i) => {
          let state = 'idle';
          if (done) state = i === r.correctIndex ? 'correct' : i === res.picked ? 'wrong' : 'dim';
          return (
            <Option key={opt} letter={'ABCD'[i]} state={state} disabled={done} onClick={() => pick(i)}>
              {opt}
            </Option>
          );
        })}
      </OptionGrid>

      {done && (
        <NextBar onClick={() => setGame({ ...game, index: index + 1, shown: 1 })}>
          {index < rounds.length - 1 ? 'Next round' : 'Results'}
        </NextBar>
      )}
    </GameCard>
  );
}
