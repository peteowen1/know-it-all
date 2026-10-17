import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import data from '../../data/lists.json';
import { rowMatches } from './listMatch';
import { gameEntry } from '../../lib/gameStats';
import { AnswerRow, Button, Chip, GameBoard, GameResults, SetupRow, TextInput } from '../../components/ui';
import { GameSetup } from '../shared/Play';
import { verdictFor } from '../shared/verdict';
import { loadLive, saveLive, usePersistentState } from '../../lib/persist';

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
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [round, setRound] = usePersistentState('lists', null);
  const entry = gameEntry(stats, 'lists');

  const start = () => {
    const terms = RANGES[range].pick(data.lists[listKey].terms);
    setRound({ id: Date.now(), listKey, title: data.lists[listKey].title, rangeLabel: RANGES[range].label, rows: terms });
  };

  if (!round) {
    return (
      <GameSetup
        title="Fill the list"
        section="weekend"
        onExit={onExit}
        record={
          <>
            Every term in order, with its years as the clue. Type into any box; right answers lock in as you type.
            {entry.plays ? ` ${entry.plays} lists played · best ${entry.bestPct}%.` : ''}
          </>
        }
        note="From Wikidata, rebuilt with the site, so a new leader appears without anyone editing a list. Returning leaders appear once per term."
      >
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
        <SetupRow
          label="Hints"
          caption={answerMode === 'choice' ? 'Each empty box shows the initials of the name.' : 'Each row shows only its years.'}
        >
          <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Easy: show initials</Chip>
          <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: years only</Chip>
        </SetupRow>
        <Button variant="primary" className="game-start" onClick={start}>Start</Button>
      </GameSetup>
    );
  }

  return (
    <ListBoard
      key={round.id}
      round={round}
      easy={answerMode === 'choice'}
      onFinish={(done, skip = [], partial = false) =>
        onRoundComplete('lists', {
          score: done.filter(Boolean).length,
          total: round.rows.length,
          // Rows already recorded on an earlier leave are not counted again; a
          // leave records only the rows actually filled in.
          answers: round.rows
            .map((r, i) => ({ i, key: `${round.listKey}:${r.name}:${r.from}`, correct: Boolean(done[i]) }))
            .filter((a) => !skip[a.i] && (!partial || a.correct))
            .map(({ key, correct }) => ({ key, correct }))
        })
      }
      onAgain={start}
      onSettings={() => setRound(null)}
    />
  );
}

function ListBoard({ round, easy, onFinish, onAgain, onSettings }) {
  const { rows } = round;
  // What has been typed and locked in, saved against this round's id.
  const [saved] = useState(() => {
    const s = loadLive('lists_board');
    return s && s.id === round.id && s.listKey === round.listKey && s.done?.length === rows.length ? s : null;
  });
  const [done, setDone] = useState(() => saved?.done ?? rows.map(() => false));
  const [values, setValues] = useState(() => saved?.values ?? rows.map(() => ''));
  const [wrong, setWrong] = useState(null);
  const [hint, setHint] = useState(null);
  const [over, setOver] = useState(saved?.over ?? false);
  // Rows already counted in the stats (by an earlier leave), saved with the board
  // so reopening and leaving again does not record them twice.
  const recorded = useRef(saved?.recorded ?? rows.map(() => false));
  useEffect(() => saveLive('lists_board', { id: round.id, listKey: round.listKey, done, values, over, recorded: recorded.current }), [round.id, round.listKey, done, values, over]);
  const inputs = useRef([]);
  const finished = useRef(Boolean(saved?.over));
  // Rows already locked, kept in a ref as well as state. Moving focus after a
  // right answer blurs the old box, and its onBlur runs with the pre-update
  // state; the ref lets that second check see the row is already done.
  const locked = useRef(saved?.done ? saved.done.slice() : rows.map(() => false));
  const doneCount = done.filter(Boolean).length;
  const initials = useMemo(() => rows.map((r) => r.name.split(' ').map((w) => w[0]).join('. ') + '.'), [rows]);

  const finish = (d) => {
    if (finished.current) return;
    finished.current = true;
    setOver(true);
    onFinish(d, recorded.current);
    recorded.current = rows.map(() => true);
  };

  // Leaving part-way still records what was filled in.
  const latest = useRef(done);
  latest.current = done;
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const idsRef = useRef({ id: round.id, listKey: round.listKey });
  useEffect(
    () => () => {
      if (!finished.current && latest.current.some((d, i) => d && !recorded.current[i])) {
        finished.current = true;
        onFinishRef.current(latest.current, recorded.current, true);
        recorded.current = latest.current.slice();
        // Written directly: the component is unmounting, so no further render
        // would save the updated record.
        saveLive('lists_board', { ...idsRef.current, done: latest.current, values: valuesRef.current, over: false, recorded: recorded.current });
      }
    },
    []
  );

  // `exact` is the as-you-type check: only an exact accepted name locks, so a
  // half-typed name never locks a near neighbour through typo tolerance.
  const check = (i, value = values[i], { exact = false } = {}) => {
    if (locked.current[i] || over || !value.trim()) return;
    if (!rowMatches(value, rows[i], { exact })) {
      if (exact) return;
      setWrong(i);
      // A right name in the wrong row: say only that it belongs elsewhere, so the
      // hint never gives away another row's answer or dates.
      const elsewhere = rows.findIndex((r, j) => j !== i && !locked.current[j] && rowMatches(value, r));
      setHint(elsewhere >= 0 ? { row: i, text: 'That name belongs in a different row.' } : null);
      return;
    }
    setHint(null);
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

  const clueOf = (r) => (
    <span className="list-clue">
      {r.number ? <strong>{ordinal(r.number)}</strong> : null}
      <span>{r.from}–{r.to ?? 'now'}</span>
    </span>
  );

  if (over) {
    return (
      <GameResults
        data-section="weekend"
        eyebrow={`${round.title} · ${round.rangeLabel}`}
        score={doneCount}
        total={rows.length}
        verdict={verdictFor(doneCount, rows.length)}
        squares={done}
        onPlayAgain={onAgain}
        playAgainLabel="Play again"
        onChangeSettings={onSettings}
        settingsLabel="Another list"
      >
        <ol className="list-rows">
          {rows.map((r, i) => (
            <AnswerRow key={`${r.name}-${r.from}-${i}`} as="li" state={done[i] ? 'got' : 'missed'} lead={clueOf(r)}>
              <span className="list-answer">{done[i] ? <Check size={16} aria-hidden="true" /> : null} {r.name}</span>
            </AnswerRow>
          ))}
        </ol>
      </GameResults>
    );
  }

  return (
    <GameBoard
      data-section="weekend"
      title={round.title}
      subtitle={round.rangeLabel}
      score={`${doneCount}/${rows.length}`}
      footer={<Button variant="tertiary" icon="Flag" onClick={() => finish(done)}>Give up and reveal</Button>}
    >
      <ol className="list-rows">
        {rows.map((r, i) => (
          <AnswerRow
            key={`${r.name}-${r.from}-${i}`}
            as="li"
            state={done[i] ? 'got' : wrong === i ? 'wrong' : 'pending'}
            lead={clueOf(r)}
          >
            {done[i] ? (
              <span className="list-answer"><Check size={16} aria-hidden="true" /> {r.name}</span>
            ) : (
              <TextInput
                ref={(el) => (inputs.current[i] = el)}
                className="list-input"
                value={values[i]}
                placeholder={easy ? initials[i] : ''}
                label={`${r.number ? ordinal(r.number) + ', ' : ''}${r.from} to ${r.to ?? 'now'}`}
                autoFocus={i === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  setValues((vs) => vs.map((x, j) => (j === i ? v : x)));
                  if (wrong === i) setWrong(null);
                  if (hint?.row === i) setHint(null);
                  check(i, v, { exact: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') check(i);
                }}
                onBlur={() => values[i].trim() && check(i)}
              />
            )}
            {hint?.row === i && <span className="list-hint" role="status">{hint.text}</span>}
          </AnswerRow>
        ))}
      </ol>
    </GameBoard>
  );
}
