import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, Flag as GiveUp, RotateCcw } from 'lucide-react';
import data from '../../data/lists.json';
import { rowMatches } from './listMatch';
import { gameEntry } from '../../lib/gameStats';
import { Chip, SetupRow } from '../geo/CountryQuiz';

const RANGES = {
  all: { label: 'All', pick: (terms) => terms },
  modern: { label: 'Since 1945', pick: (terms) => terms.filter((t) => (t.to ?? 9999) >= 1945) },
  recent: { label: 'Last 15', pick: (terms) => terms.slice(-15) }
};

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/**
 * Fill the list: one box per term, in order, each with its years (and the
 * official number where the country has one) as the clue. Type into any box in
 * any order; a right answer locks the row and moves to the next empty one.
 */
export default function ListGame({ stats, answerMode, onAnswerModeChange, onRoundComplete, onExit }) {
  const keys = Object.keys(data.lists);
  const [listKey, setListKey] = useState(keys[0]);
  const [range, setRange] = useState('all');
  const [round, setRound] = useState(null);
  const roundId = useRef(0);
  const entry = gameEntry(stats, 'lists');

  const start = () => {
    roundId.current += 1;
    const terms = RANGES[range].pick(data.lists[listKey].terms);
    setRound({ id: roundId.current, listKey, title: data.lists[listKey].title, rangeLabel: RANGES[range].label, rows: terms });
  };

  if (!round) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Fill the list</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          Every term in order, with its years as the clue. Type into any box; right answers lock in.
          {entry.plays ? ` ${entry.plays} lists played · best ${entry.bestPct}%.` : ''}
        </p>
        <SetupRow label="List">
          {keys.map((k) => (
            <Chip key={k} active={listKey === k} onClick={() => setListKey(k)}>{data.lists[k].title}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Range">
          {Object.entries(RANGES).map(([k, r]) => (
            <Chip key={k} active={range === k} onClick={() => setRange(k)}>{r.label}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Hints">
          <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Easy: show initials</Chip>
          <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: years only</Chip>
        </SetupRow>
        <button className="btn btn-primary game-start" onClick={start}>Start</button>
        <p className="game-record small">From Wikidata, rebuilt with the site, so a new leader appears without anyone editing a list. Returning leaders appear once per term.</p>
      </div>
    );
  }

  return (
    <ListBoard
      key={round.id}
      round={round}
      easy={answerMode === 'choice'}
      onFinish={(done) =>
        onRoundComplete('lists', {
          score: done.filter(Boolean).length,
          total: round.rows.length,
          answers: round.rows.map((r, i) => ({ key: `${round.listKey}:${r.name}:${r.from}`, correct: Boolean(done[i]) }))
        })
      }
      onAgain={start}
      onSettings={() => setRound(null)}
    />
  );
}

function ListBoard({ round, easy, onFinish, onAgain, onSettings }) {
  const { rows } = round;
  const [done, setDone] = useState(() => rows.map(() => false));
  const [values, setValues] = useState(() => rows.map(() => ''));
  const [wrong, setWrong] = useState(null);
  const [over, setOver] = useState(false);
  const inputs = useRef([]);
  const finished = useRef(false);
  // Rows already locked, kept in a ref as well as state. Moving focus after a
  // right answer blurs the old box, and its onBlur runs with the pre-update
  // state; the ref lets that second check see the row is already done.
  const locked = useRef(rows.map(() => false));
  const doneCount = done.filter(Boolean).length;
  const initials = useMemo(() => rows.map((r) => r.name.split(' ').map((w) => w[0]).join('. ') + '.'), [rows]);

  const finish = (d) => {
    if (finished.current) return;
    finished.current = true;
    setOver(true);
    onFinish(d);
  };

  // Leaving part-way still records what was filled in.
  const latest = useRef(done);
  latest.current = done;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  useEffect(
    () => () => {
      if (!finished.current && latest.current.some(Boolean)) {
        finished.current = true;
        onFinishRef.current(latest.current);
      }
    },
    []
  );

  const check = (i) => {
    if (locked.current[i] || over || !values[i].trim()) return;
    if (!rowMatches(values[i], rows[i])) {
      setWrong(i);
      return;
    }
    locked.current[i] = true;
    const next = locked.current.slice();
    setDone(next);
    setWrong(null);
    if (next.every(Boolean)) {
      finish(next);
      return;
    }
    // Jump to the next empty row after this one, wrapping to the top.
    const order = [...rows.keys()].slice(i + 1).concat([...rows.keys()].slice(0, i));
    const target = order.find((j) => !next[j]);
    if (target != null) inputs.current[target]?.focus();
  };

  return (
    <div className="card names-game">
      <div className="progress-text">
        <span className="names-title">{round.title} <small>({round.rangeLabel})</small></span>
        <span className="score-pill">{doneCount}/{rows.length}</span>
      </div>

      <ol className="list-rows">
        {rows.map((r, i) => {
          const show = done[i] || over;
          return (
            <li key={`${r.name}-${r.from}-${i}`} className={`list-row ${done[i] ? 'got' : over ? 'missed' : ''} ${wrong === i ? 'wrong' : ''}`}>
              <span className="list-clue">
                {r.number ? <strong>{ordinal(r.number)}</strong> : null}
                <span>{r.from}–{r.to ?? 'now'}</span>
              </span>
              {show ? (
                <span className="list-answer">{done[i] ? <Check size={16} /> : null} {r.name}</span>
              ) : (
                <input
                  ref={(el) => (inputs.current[i] = el)}
                  className="list-input"
                  value={values[i]}
                  placeholder={easy ? initials[i] : ''}
                  aria-label={`${r.number ? ordinal(r.number) + ', ' : ''}${r.from} to ${r.to ?? 'now'}`}
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus={i === 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValues((vs) => vs.map((x, j) => (j === i ? v : x)));
                    if (wrong === i) setWrong(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') check(i);
                  }}
                  onBlur={() => values[i].trim() && check(i)}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="actions-bar centered">
        {!over ? (
          <button className="btn btn-ghost" onClick={() => finish(done)}>
            <GiveUp size={16} /> Give up and reveal
          </button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={onAgain} autoFocus><RotateCcw size={18} /> Again</button>
            <button className="btn btn-ghost" onClick={onSettings}><Eye size={16} /> Another list</button>
          </>
        )}
      </div>
    </div>
  );
}
