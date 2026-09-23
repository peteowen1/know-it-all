import React, { useMemo } from 'react';
import { Shuffle, RotateCcw, CalendarDays } from 'lucide-react';
import data from '../../data/fourbyfour.json';
import { localDateKey } from '../../lib/dates';
import { makeRng, hashString, shuffle } from '../../lib/rng';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';

const MISTAKES = 4;
const LEVEL_CLASS = { 1: 'lvl-1', 2: 'lvl-2', 3: 'lvl-3', 4: 'lvl-4' };

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
  const entry = gameEntry(stats, 'connections');

  const start = (daily) => {
    const index = daily ? dailyIndex(data.puzzles.length) : Math.floor(Math.random() * data.puzzles.length);
    const puzzle = data.puzzles[index];
    const tiles = shuffle(
      puzzle.groups.flatMap((g, gi) => g.items.map((text) => ({ text, group: gi }))),
      makeRng(hashString(`${index}:${Date.now()}`))
    );
    setGame({ daily, index, puzzle, tiles, selected: [], solved: [], mistakes: 0, message: null, over: false, guesses: [] });
  };

  if (!game) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Four by four</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          Sixteen answers, four hidden groups. Pick four that belong together. Four mistakes and you are out.
          {entry.plays ? ` ${entry.plays} played.` : ''}
        </p>
        <div className="actions-bar">
          <button className="btn btn-primary" onClick={() => start(true)}>
            <CalendarDays size={18} /> Today's puzzle
          </button>
          <button className="btn btn-ghost" onClick={() => start(false)}>
            <Shuffle size={18} /> Random puzzle
          </button>
        </div>
        <p className="game-record small">
          {data.puzzles.length} puzzles built from the flags, capitals, charts, films, TV and famous-names data.
        </p>
      </div>
    );
  }

  return (
    <Board
      key={`${game.index}-${game.daily}`}
      game={game}
      setGame={setGame}
      onFinish={(g, won) =>
        onRoundComplete('connections', {
          // A win is a win whatever the mistakes; `run` is groups the player
          // actually found, not the ones revealed after a loss.
          score: won ? 1 : 0,
          total: 1,
          run: g.found,
          answers: []
        })
      }
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

  return (
    <div className="card fbf-game">
      <div className="progress-text">
        <span className="names-title">{game.daily ? "Today's four by four" : 'Four by four'}</span>
        <span className="fbf-mistakes" aria-label={`${MISTAKES - mistakes} mistakes left`}>
          {Array.from({ length: MISTAKES }, (_, i) => (
            <span key={i} className={`fbf-dot ${i < MISTAKES - mistakes ? 'on' : ''}`} />
          ))}
        </span>
      </div>

      {solved.map((gi) => {
        const g = puzzle.groups[gi];
        return (
          <div key={gi} className={`fbf-solved ${LEVEL_CLASS[g.level]}`}>
            <strong>{g.label}</strong>
            <span>{g.items.join(', ')}</span>
          </div>
        );
      })}

      {!over && (
        <div className="fbf-grid">
          {remaining.map((t) => (
            <button
              key={t.text}
              className={`fbf-tile ${selected.includes(t.text) ? 'picked' : ''}`}
              onClick={() => toggle(t.text)}
            >
              {t.text}
            </button>
          ))}
        </div>
      )}

      {message && <p className={`names-msg ${message.tone}`}>{message.text}</p>}

      {!over ? (
        <div className="actions-bar centered">
          <button
            className="btn btn-ghost"
            onClick={() => setGame({ ...game, tiles: shuffle(tiles), message: null })}
          >
            <Shuffle size={16} /> Shuffle
          </button>
          <button className="btn btn-ghost" onClick={() => setGame({ ...game, selected: [] })} disabled={!selected.length}>
            Deselect
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={selected.length !== 4}>
            Submit
          </button>
        </div>
      ) : (
        <div className="fbf-over">
          <h3>{won ? (mistakes === 0 ? 'Perfect.' : `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`) : 'Out of guesses.'}</h3>
          <div className="actions-bar centered">
            <button className="btn btn-primary" onClick={onAgain} autoFocus><RotateCcw size={18} /> Another puzzle</button>
            <button className="btn btn-ghost" onClick={onSetup}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
