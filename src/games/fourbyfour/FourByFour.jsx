import React, { useMemo } from 'react';
import data from '../../data/fourbyfour.json';
import { localDateKey } from '../../lib/dates';
import { makeRng, hashString, shuffle } from '../../lib/rng';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, GameCard, GameResults } from '../../components/ui';
import { GameSetup } from '../shared/Play';
import { HowButton, HowPanel } from '../shared/HowItWorks';

const MISTAKES = 4;

/**
 * The day's puzzle is the same for everyone: its index comes from the local
 * date, so it changes at local midnight rather than at UTC midnight (10am in
 * Sydney), the same rule the Daily Five uses.
 */
function dailyIndex(n) {
  return hashString(`fourbyfour:${localDateKey()}`) % n;
}

/**
 * Four by four: sixteen tiles, four hidden groups of four, four mistakes.
 * Puzzles are pre-built by scripts/build-fourbyfour.mjs, which guarantees
 * every tile belongs to exactly one group.
 */
export default function FourByFour({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('fourbyfour', null);
  // The day the daily puzzle was last finished: playing it again that day is
  // allowed, but only the first finish counts as a play.
  const [dailyDone, setDailyDone] = usePersistentState('fourbyfour-daily', null);
  const entry = gameEntry(stats, 'connections');

  const start = (daily) => {
    const index = daily ? dailyIndex(data.puzzles.length) : Math.floor(Math.random() * data.puzzles.length);
    const puzzle = data.puzzles[index];
    const tiles = shuffle(
      puzzle.groups.flatMap((g, gi) => g.items.map((text) => ({ text, group: gi }))),
      makeRng(hashString(`${index}:${Date.now()}`))
    );
    setGame({ daily, date: localDateKey(), index, puzzle, tiles, selected: [], solved: [], mistakes: 0, message: null, over: false, guesses: [] });
  };

  if (!game) {
    return (
      <GameSetup
        title="Four by four"
        section="lab"
        onExit={onExit}
        record={
          <>
            Sixteen answers, four hidden groups. Pick four that belong together. Four mistakes and you are out.
            {entry.plays ? ` ${entry.plays} played.` : ''}
          </>
        }
        note={`${data.puzzles.length} puzzles built from the flags, capitals, charts, films, TV and famous-names data.`}
      >
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>Today's puzzle</Button>
          <Button variant="secondary" icon="Shuffle" onClick={() => start(false)}>Random puzzle</Button>
        </div>
      </GameSetup>
    );
  }

  return (
    <Board
      key={`${game.index}-${game.daily}`}
      game={game}
      setGame={setGame}
      onFinish={(g, won) => {
        if (g.daily) {
          const today = localDateKey();
          if (dailyDone === today) return;
          setDailyDone(today);
        }
        onRoundComplete('connections', {
          // A win is a win whatever the mistakes; `run` is groups the player
          // actually found, not the ones revealed after a loss.
          score: won ? 1 : 0,
          total: 1,
          run: g.found,
          answers: []
        });
      }}
      onAgain={() => start(false)}
      onSetup={() => setGame(null)}
    />
  );
}

function Board({ game, setGame, onFinish, onAgain, onSetup }) {
  const { puzzle, tiles, selected, solved, mistakes, message, over } = game;
  const remaining = useMemo(() => tiles.filter((t) => !solved.includes(t.group)), [tiles, solved]);

  const toggle = (text) => {
    if (over) return;
    const has = selected.includes(text);
    if (!has && selected.length === 4) return;
    setGame({ ...game, selected: has ? selected.filter((s) => s !== text) : [...selected, text], message: null });
  };

  const submit = () => {
    if (selected.length !== 4 || over) return;
    const key = [...selected].sort().join('|');
    if (game.guesses.includes(key)) {
      setGame({ ...game, message: { tone: 'meh', text: 'Already tried that four.' } });
      return;
    }
    const groupsHit = selected.map((s) => tiles.find((t) => t.text === s).group);
    const counts = groupsHit.reduce((m, g) => ((m[g] = (m[g] || 0) + 1), m), {});
    const best = Math.max(...Object.values(counts));
    const guesses = [...game.guesses, key];
    if (best === 4) {
      const nextSolved = [...solved, groupsHit[0]];
      const won = nextSolved.length === 4;
      const next = { ...game, solved: nextSolved, found: nextSolved.length, selected: [], guesses, message: null, over: won };
      setGame(next);
      if (won) onFinish(next, true);
      return;
    }
    const nextMistakes = mistakes + 1;
    const lost = nextMistakes >= MISTAKES;
    const next = {
      ...game,
      mistakes: nextMistakes,
      guesses,
      over: lost,
      found: solved.length,
      // Losing reveals every group, easiest first, so the answers are there to
      // learn from. Groups are stored easiest-first, so index order is level
      // order, including any the player had already solved.
      solved: lost ? puzzle.groups.map((_, i) => i) : solved,
      selected: lost ? [] : selected,
      message: lost ? null : { tone: 'bad', text: best === 3 ? 'One away…' : 'Not a group.' }
    };
    setGame(next);
    if (lost) onFinish(next, false);
  };

  const won = over && mistakes < MISTAKES;
  const left = MISTAKES - mistakes;

  if (over) {
    return (
      <GameResults
        data-section="lab"
        eyebrow={game.daily ? "Today's four by four" : 'Four by four'}
        hero={won ? (mistakes === 0 ? 'Perfect' : 'Solved') : 'Out of guesses'}
        verdict={won ? (mistakes === 0 ? 'Four groups, no mistakes.' : `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`) : 'Here are the four groups.'}
        celebrate={won && mistakes === 0}
        // One square per guess, in order: a whole group, or a mistake. The
        // shared result then shows how the puzzle went, as NYT's does.
        squares={game.guesses.map((key) => new Set(key.split('|').map((t) => tiles.find((x) => x.text === t)?.group)).size === 1)}
        onPlayAgain={onAgain}
        share={game.daily ? dailyShare('Four by four', 'connections', game.date) : undefined}
        playAgainLabel="Another puzzle"
        onChangeSettings={onSetup}
        settingsLabel="Back"
      >
        {solved.map((gi) => {
          const g = puzzle.groups[gi];
          return (
            <div key={gi} className="fbf-solved" data-level={g.level}>
              <strong>{g.label}</strong>
              <span>{g.items.join(', ')}</span>
            </div>
          );
        })}
      </GameResults>
    );
  }

  return (
    <GameCard data-section="lab" width="sm">
      <div className="play-head">
        <p className="play-progress">{game.daily ? "Today's four by four" : 'Four by four'}</p>
        <span className="fbf-mistakes" role="img" aria-label={`${left} mistake${left === 1 ? '' : 's'} left`}>
          {Array.from({ length: MISTAKES }, (_, i) => (
            <span key={i} className="fbf-dot" data-on={i < left ? 'true' : 'false'} />
          ))}
        </span>
        <HowButton />
      </div>
      <HowPanel />

      {solved.map((gi) => {
        const g = puzzle.groups[gi];
        return (
          <div key={gi} className="fbf-solved" data-level={g.level}>
            <strong>{g.label}</strong>
            <span>{g.items.join(', ')}</span>
          </div>
        );
      })}

      <div className="fbf-grid">
        {remaining.map((t) => (
          <AnswerRow
            key={t.text}
            as="button"
            type="button"
            className="fbf-tile"
            aria-pressed={selected.includes(t.text)}
            onClick={() => toggle(t.text)}
          >
            {t.text}
          </AnswerRow>
        ))}
      </div>

      <p className="game-board-msg" data-tone={message?.tone === 'bad' ? 'bad' : undefined} role="status" aria-live="polite">
        {message?.text ?? ''}
      </p>

      <div className="fbf-actions">
        <Button variant="tertiary" icon="Shuffle" onClick={() => setGame({ ...game, tiles: shuffle(tiles), message: null })}>
          Shuffle
        </Button>
        <Button variant="secondary" onClick={() => setGame({ ...game, selected: [] })} disabled={!selected.length}>
          Deselect
        </Button>
        <Button variant="primary" onClick={submit} disabled={selected.length !== 4}>Submit</Button>
      </div>
    </GameCard>
  );
}
