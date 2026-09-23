import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Flag as GiveUp, RotateCcw, Shuffle } from 'lucide-react';
import data from '../../data/famous.json';
import { matchGuess } from './nameMatch';
import { gameEntry } from '../../lib/gameStats';
import { Chip, SetupRow } from '../geo/CountryQuiz';

const BOARD_SIZE = 15;
const TIMERS = [60, 120, 0]; // 0 = untimed
const ERAS = {
  all: { label: 'Any era', test: () => true },
  modern: { label: 'Born 1950 or later', test: (p) => p.born == null || p.born >= 1950 }
};

/**
 * Famous first names. Given "Tom", fill a board of the fifteen most famous
 * Toms by typing surnames. Easy mode shows what each hidden person is known
 * for and their initial; hard mode shows only the blank slots.
 *
 * Anyone further down the fame list still counts as a bonus find, so knowing
 * an obscure Tom is rewarded rather than silently rejected.
 */
export default function FirstNames({ stats, answerMode, onAnswerModeChange, onRoundComplete, onExit }) {
  const [era, setEra] = useState('all');
  const [timer, setTimer] = useState(120);
  const [picked, setPicked] = useState(null); // null = random
  const [game, setGame] = useState(null);
  const entry = gameEntry(stats, 'first-names');

  const names = useMemo(
    () =>
      data.names
        .map((n) => ({ ...n, people: n.people.filter(ERAS[era].test) }))
        .filter((n) => n.people.length >= BOARD_SIZE),
    [era]
  );

  // A picked name the era filter has since removed falls back to random, and
  // the chip row shows Random as selected, so what you see is what you get.
  const pickedName = names.some((n) => n.first === picked) ? picked : null;
  const roundId = useRef(0);

  const start = () => {
    if (!names.length) return;
    const pool = pickedName ? names.filter((n) => n.first === pickedName) : names;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    roundId.current += 1;
    setGame({
      id: roundId.current,
      first: chosen.first,
      board: chosen.people.slice(0, BOARD_SIZE),
      bonusPool: chosen.people.slice(BOARD_SIZE),
      found: [], // ids, in the order found
      endsAt: timer ? Date.now() + timer * 1000 : null,
      over: false,
      message: null
    });
  };

  if (!game) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Famous first names</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          {entry.plays
            ? `${entry.plays} played · best board ${entry.best} of ${BOARD_SIZE}`
            : `Name the fifteen most famous people with a given first name. Type surnames.`}
        </p>
        <SetupRow label="Name">
          <Chip active={pickedName === null} onClick={() => setPicked(null)}><Shuffle size={14} /> Random</Chip>
          {names.slice(0, 24).map((n) => (
            <Chip key={n.first} active={pickedName === n.first} onClick={() => setPicked(n.first)}>{n.first}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Era">
          {Object.entries(ERAS).map(([k, e]) => (
            <Chip key={k} active={era === k} onClick={() => setEra(k)}>{e.label}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Clock">
          {TIMERS.map((t) => (
            <Chip key={t} active={timer === t} onClick={() => setTimer(t)}>{t ? `${t / 60} min` : 'No clock'}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Hints">
          <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Easy: show what they do + initial</Chip>
          <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: blank board</Chip>
        </SetupRow>
        <button className="btn btn-primary game-start" onClick={start} disabled={!names.length}>
          {names.length ? 'Start' : 'No names have fifteen people in this era'}
        </button>
        <p className="game-record small">Fame = English Wikipedia readership, {data.source.replace(/^.*pageviews /, '')}.</p>
      </div>
    );
  }

  return (
    <Board
      // One Board per round. Keying on the name would reuse the Board, and its
      // finished-guard, when the same name comes up twice with no clock.
      key={game.id}
      game={game}
      setGame={setGame}
      easy={answerMode === 'choice'}
      onFinish={(g) => {
        const boardIds = new Set(g.board.map((p) => p.id));
        const onBoard = g.found.filter((id) => boardIds.has(id)).length;
        onRoundComplete('first-names', {
          score: onBoard,
          total: BOARD_SIZE,
          run: g.found.length,
          answers: g.board.map((p) => ({ key: p.id, correct: g.found.includes(p.id) }))
        });
      }}
      onAgain={start}
      onSettings={() => setGame(null)}
    />
  );
}

function Board({ game, setGame, easy, onFinish, onAgain, onSettings }) {
  const [guess, setGuess] = useState('');
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);
  const inputRef = useRef(null);

  const { first, board, bonusPool, found, endsAt, over, message } = game;
  const everyone = useMemo(() => [...board, ...bonusPool], [board, bonusPool]);
  const foundSet = new Set(found);
  const bonus = found.filter((id) => !board.some((p) => p.id === id)).map((id) => bonusPool.find((p) => p.id === id));
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    // Recorded from the rendered state, not inside a setState updater: React
    // runs updaters twice in StrictMode, which would record the round twice.
    const done = { ...game, over: true };
    setGame(done);
    onFinish(done);
  };

  useEffect(() => {
    if (over || !endsAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [over, endsAt]);

  useEffect(() => {
    if (secondsLeft === 0 && !over) finish();
  });

  useEffect(() => {
    // The round ends when the board is full; bonus finds are extra credit.
    if (!over && board.every((p) => foundSet.has(p.id))) finish();
  });

  const submit = (e) => {
    e.preventDefault();
    if (over || !guess.trim()) return;
    const m = matchGuess(guess, first, everyone, foundSet);
    let msg;
    if (!m) msg = { tone: 'bad', text: `No famous ${first} ${guess.trim()} on the list` };
    else if (m.alreadyFound) msg = { tone: 'meh', text: `Already got ${m.person.name}` };
    else {
      const onBoard = board.some((p) => p.id === m.person.id);
      msg = { tone: 'good', text: onBoard ? `${m.person.name} ✓` : `${m.person.name} — bonus!` };
      setGame((g) => ({ ...g, found: [...g.found, m.person.id] }));
    }
    setGame((g) => ({ ...g, message: msg }));
    setGuess('');
    inputRef.current?.focus();
  };

  const onBoardCount = board.filter((p) => foundSet.has(p.id)).length;

  return (
    <div className="card names-game">
      <div className="progress-text">
        <span className="names-title">Famous <strong>{first}</strong>s</span>
        <span className="score-pill">
          {onBoardCount}/{board.length}{bonus.length ? ` +${bonus.length}` : ''}
          {secondsLeft !== null && !over && <> · <Clock size={14} /> {secondsLeft}s</>}
        </span>
      </div>

      {!over && (
        <form className="names-input-row" onSubmit={submit}>
          <span className="names-prefix">{first}</span>
          <input
            ref={inputRef}
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="surname…"
            aria-label={`Surname of a famous ${first}`}
            autoComplete="off"
            spellCheck="false"
          />
          <button className="btn btn-primary" type="submit">Enter</button>
          <button className="btn btn-ghost" type="button" onClick={finish} title="End and show the answers">
            <GiveUp size={16} /> Give up
          </button>
        </form>
      )}
      {message && !over && <p className={`names-msg ${message.tone}`}>{message.text}</p>}

      <ol className="names-board">
        {board.map((p, i) => {
          const got = foundSet.has(p.id);
          const show = got || over;
          return (
            <li key={p.id} className={`names-slot ${got ? 'got' : over ? 'missed' : ''}`}>
              <span className="names-rank">{i + 1}</span>
              {show ? (
                <span className="names-person">
                  <strong>{p.name}</strong>
                  <span>{p.description}</span>
                </span>
              ) : (
                <span className="names-hidden">
                  {easy ? `${p.description || 'famous person'} · ${p.rest[0]}…` : ' '}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {bonus.length > 0 && (
        <p className="game-record">Bonus: {bonus.map((p) => p.name).join(', ')}</p>
      )}

      {over && (
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={onAgain} autoFocus><RotateCcw size={18} /> Another name</button>
          <button className="btn btn-ghost" onClick={onSettings}>Settings</button>
        </div>
      )}
    </div>
  );
}
