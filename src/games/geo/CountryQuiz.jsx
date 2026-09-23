import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, RotateCcw, XCircle, ArrowLeftRight } from 'lucide-react';
import { COUNTRIES } from './countries';
import { REGIONS, countryPool, buildGeoRound, identicalFlags } from './geoPool';
import LOOKALIKES from '../../data/flagLookalikes.json';
import { gameEntry, itemWeights, weakestItems } from '../../lib/gameStats';

const Flag = ({ code, size = 'lg' }) => (
  <span className={`fi fi-${code.toLowerCase()} flag-${size}`} role="img" aria-label="flag" />
);

// Each game asks one thing about a country, in either direction. `prompt` and
// `label` are the two sides; `forward` asks prompt -> label.
const KINDS = {
  flags: {
    title: 'Flags',
    needs: null,
    directions: {
      forward: { name: 'Flag → country', prompt: (c) => <Flag code={c.code} />, label: (c) => c.name, ask: 'Whose flag is this?' },
      reverse: { name: 'Country → flag', prompt: (c) => <h2 className="geo-prompt-text">{c.name}</h2>, label: (c) => c.code, render: (c) => <Flag code={c.code} size="md" />, ask: 'Which is its flag?' }
    }
  },
  capitals: {
    title: 'Capitals',
    needs: 'capitals',
    directions: {
      forward: { name: 'Country → capital', prompt: (c) => <h2 className="geo-prompt-text"><Flag code={c.code} size="sm" /> {c.name}</h2>, label: (c) => c.capitals[0], ask: 'What is the capital?' },
      reverse: { name: 'Capital → country', prompt: (c) => <h2 className="geo-prompt-text">{c.capitals[0]}</h2>, label: (c) => c.name, ask: 'Capital of which country?' }
    }
  }
};

const LENGTHS = [10, 20, 50];
const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

// An in-progress round is saved as country codes, not objects, so it is small
// enough for localStorage and survives a data rebuild that changes a country's
// other fields. A code that no longer exists voids the saved round.
function serialiseRound(r) {
  return {
    // The settings the round was started with, so resuming also restores the
    // setup screen and "Again" repeats the same kind of round.
    settings: r.settings,
    direction: r.direction,
    region: r.region,
    q: r.questions.map((q) => [q.target.code, q.options.map((o) => o.code)]),
    index: r.index,
    answers: r.answers,
    picked: r.picked,
    revealed: r.revealed
  };
}
function restoreRound(saved) {
  if (!saved || !Array.isArray(saved.q)) return null;
  const questions = [];
  for (const [t, opts] of saved.q) {
    const target = BY_CODE.get(t);
    const options = (opts || []).map((c) => BY_CODE.get(c));
    if (!target || options.some((o) => !o)) return null;
    questions.push({ target, options, correctIndex: options.indexOf(target) });
  }
  if (!Array.isArray(saved.answers) || saved.index >= questions.length) return null;
  return { ...saved, questions };
}

/** What to show under the answer once it is revealed: the bits a quiz-setter would use next. */
function factLine(c) {
  const parts = [c.subregion];
  if (c.capitalsAlsoAccepted?.length || c.capitals.length > 1) {
    parts.push(`also accepted: ${[...c.capitals.slice(1), ...c.capitalsAlsoAccepted].join(', ')}`);
  }
  if (c.languages.length) parts.push(c.languages.slice(0, 2).join(' / '));
  if (c.currencies[0]) parts.push(c.currencies[0].name);
  return parts.join(' · ');
}

export default function CountryQuiz({
  kind, stats, answerMode, onAnswerModeChange, onAnswer, onRoundComplete, onExit, savedRound, onRoundChange
}) {
  const spec = KINDS[kind];
  const initial = { region: 'World', territories: false, count: 10, direction: 'forward', hard: false, ...savedRound?.settings };
  const [region, setRegion] = useState(initial.region);
  const [territories, setTerritories] = useState(initial.territories);
  // "All" is Infinity, which JSON cannot hold, so it is saved as 'all'.
  const [count, setCount] = useState(initial.count === 'all' ? Infinity : initial.count);
  const [direction, setDirection] = useState(initial.direction);
  const [hard, setHard] = useState(initial.hard);
  // Picks up a round left part-way through, from another tab or a reload.
  const [round, setRound] = useState(() => restoreRound(savedRound));
  useEffect(() => {
    const live = round && round.index < round.questions.length;
    onRoundChange(kind, live ? serialiseRound(round) : null);
  }, [round, kind, onRoundChange]);
  // Index of the last question answered. A ref, not state: two clicks landing
  // before React re-renders both see the old state, and on the last question
  // that recorded the whole round twice.
  const answeredUpTo = useRef((savedRound?.answers?.length ?? 0) - 1);

  const dir = spec.directions[round?.direction || direction];
  const pool = useMemo(
    () => countryPool(COUNTRIES, { region, territories, needs: spec.needs }),
    [region, territories, spec.needs]
  );
  const entry = gameEntry(stats, kind);
  const weak = weakestItems(stats, kind, 8)
    .map((w) => COUNTRIES.find((c) => c.code === w.key))
    .filter(Boolean);

  const start = () => {
    const questions = buildGeoRound(pool, {
      count,
      seed: Date.now(),
      labelOf: dir.label,
      weights: itemWeights(stats, kind, pool.map((c) => c.code)),
      lookalikes: kind === 'flags' ? LOOKALIKES : null,
      hard
    });
    answeredUpTo.current = -1;
    setRound({
      settings: { region, territories, count: Number.isFinite(count) ? count : 'all', direction, hard },
      direction,
      region,
      questions,
      index: 0,
      picked: null,
      revealed: false,
      answers: []
    });
  };

  if (!round) {
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>{spec.title}</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          {entry.plays
            ? `${entry.plays} rounds played · best ${entry.bestPct}% · ${Object.keys(entry.items).length} of ${pool.length} seen`
            : `${pool.length} to learn. Wrong answers come back more often.`}
        </p>

        <SetupRow label="Region">
          {REGIONS.map((r) => (
            <Chip key={r} active={region === r} onClick={() => setRegion(r)}>{r}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Direction">
          {Object.entries(spec.directions).map(([k, d]) => (
            <Chip key={k} active={direction === k} onClick={() => setDirection(k)}>{d.name}</Chip>
          ))}
        </SetupRow>
        <SetupRow label="Length">
          {LENGTHS.map((n) => (
            <Chip key={n} active={count === n} onClick={() => setCount(n)}>{n}</Chip>
          ))}
          <Chip active={count === Infinity} onClick={() => setCount(Infinity)}>All {pool.length}</Chip>
        </SetupRow>
        {kind === 'flags' && (
          <SetupRow label="Wrong answers">
            <Chip active={!hard} onClick={() => setHard(false)} title="Neighbouring countries">Normal: neighbours</Chip>
            <Chip active={hard} onClick={() => setHard(true)} title="Flags that look like the answer">Hard: look-alike flags</Chip>
          </SetupRow>
        )}
        <SetupRow label="Answer">
          <AnswerModeToggle mode={answerMode} onChange={onAnswerModeChange} />
        </SetupRow>
        <SetupRow label="Include">
          <Chip active={territories} onClick={() => setTerritories((t) => !t)}>
            Territories (Greenland, Guam, Bermuda…)
          </Chip>
        </SetupRow>

        <button className="btn btn-primary game-start" onClick={start} disabled={pool.length < 4}>
          Start {Math.min(count, pool.length)} questions
        </button>

        {weak.length > 0 && (
          <div className="weak-list">
            <span className="setup-group-label">Your most-missed</span>
            <div className="chip-row wrap">
              {weak.map((c) => (
                <span key={c.code} className="weak-chip"><Flag code={c.code} size="sm" /> {c.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { questions, index, picked, revealed, answers } = round;

  if (index >= questions.length) {
    const score = answers.filter((a) => a.correct).length;
    const missed = questions.filter((q, i) => !answers[i].correct);
    return (
      <div className="card game-results">
        <h2>{score} / {questions.length}</h2>
        <p className="game-record">{Math.round((score / questions.length) * 100)}% · {spec.title} · {round.region}</p>
        {missed.length > 0 && (
          <div className="missed-grid">
            {missed.map(({ target: c }) => (
              <div key={c.code} className="missed-item">
                <Flag code={c.code} size="md" />
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.capitals[0]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={start}><RotateCcw size={18} /> Again</button>
          <button className="btn btn-ghost" onClick={() => setRound(null)}>Change settings</button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const answered = answers.length > index;

  const answer = (correct, pickedIndex = null) => {
    if (answeredUpTo.current >= index) return;
    answeredUpTo.current = index;
    const nextAnswers = [...answers, { key: q.target.code, correct }];
    setRound({ ...round, picked: pickedIndex, revealed: true, answers: nextAnswers });
    // Saved per answer, so leaving mid-round never loses what was learned.
    // The round record (plays, best score) is only written when it finishes.
    onAnswer(kind, q.target.code, correct);
    if (index === questions.length - 1) {
      const score = nextAnswers.filter((a) => a.correct).length;
      onRoundComplete(kind, { score, total: questions.length, answers: [] });
    }
  };
  const next = () => setRound({ ...round, index: index + 1, picked: null, revealed: false });

  return (
    <div className="card geo-question">
      <div className="progress-text">
        <span>{index + 1} / {questions.length}</span>
        <span className="score-pill">Score {answers.filter((a) => a.correct).length}</span>
        <button className="btn-text-toggle" onClick={() => setRound(null)} title="Abandon this round">End round</button>
      </div>
      <p className="geo-ask">{dir.ask}</p>
      <div className="geo-prompt">{dir.prompt(q.target)}</div>

      {answerMode === 'choice' ? (
        <div className={`options-grid ${dir.render ? 'flag-options' : ''}`}>
          {q.options.map((opt, i) => {
            let state = '';
            if (answered) state = i === q.correctIndex ? 'correct' : i === picked ? 'incorrect' : 'disabled';
            return (
              <button
                key={opt.code}
                className={`option-btn ${state}`}
                disabled={answered}
                onClick={() => answer(i === q.correctIndex, i)}
              >
                <span className="option-label">{dir.render ? dir.render(opt) : dir.label(opt)}</span>
                {answered && i === q.correctIndex && <CheckCircle2 className="icon-right" size={20} />}
                {answered && i === picked && i !== q.correctIndex && <XCircle className="icon-wrong" size={20} />}
              </button>
            );
          })}
        </div>
      ) : !revealed ? (
        <div className="reveal-prompt">
          <button className="btn btn-secondary" onClick={() => setRound({ ...round, revealed: true })}>
            <Eye size={18} /> Reveal
          </button>
        </div>
      ) : (
        <div className="revealed-content">
          <div className="answer-highlight">
            <span className="ans-val">{dir.render ? dir.render(q.target) : dir.label(q.target)}</span>
          </div>
          {!answered && (
            <div className="grade-btns">
              <button className="btn btn-success" onClick={() => answer(true)}><CheckCircle2 size={18} /> Got it</button>
              <button className="btn btn-danger" onClick={() => answer(false)}><XCircle size={18} /> Missed it</button>
            </div>
          )}
        </div>
      )}

      {answered && (
        <>
          <p className="geo-fact">
            <strong>{q.target.name}</strong> — capital {q.target.capitals[0]} · {factLine(q.target)}
            {kind === 'flags' && identicalFlags(q.target, LOOKALIKES, BY_CODE).length > 0 && (
              <><br />Same flag as {identicalFlags(q.target, LOOKALIKES, BY_CODE).join(', ')} apart from its proportions.</>
            )}
          </p>
          <div className="next-action-bar">
            <button className="btn btn-primary next-btn" onClick={next} autoFocus>
              {index < questions.length - 1 ? 'Next' : 'Results'} <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AnswerModeToggle({ mode, onChange }) {
  return (
    <div className="chip-row">
      <Chip active={mode === 'choice'} onClick={() => onChange('choice')} title="Four options — easier">
        Multiple choice
      </Chip>
      <Chip active={mode === 'reveal'} onClick={() => onChange('reveal')} title="Answer in your head, reveal, then mark yourself — harder">
        <ArrowLeftRight size={14} /> Reveal &amp; self-mark
      </Chip>
    </div>
  );
}

export const Chip = ({ active, children, ...rest }) => (
  <button className={`filter-chip ${active ? 'active' : ''}`} {...rest}>{children}</button>
);

export const SetupRow = ({ label, children }) => (
  <div className="setup-group">
    <span className="setup-group-label">{label}</span>
    <div className="chip-row wrap">{children}</div>
  </div>
);
