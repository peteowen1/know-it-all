import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES } from './countries';
import { REGIONS, countryPool, buildGeoRound, identicalFlags, formatPopulation } from './geoPool';
import LOOKALIKES from '../../data/flagLookalikes.json';
import { gameEntry, itemWeights, weakestItems } from '../../lib/gameStats';
import {
  AnswerRow, Button, Chip, Flag, GameCard, GameResults, MostMissed, Pill, SetupRow, AnswerModeToggle, preloadFlags
} from '../../components/ui';
import { Ask, ChoiceQuestion, GameSetup, NextBar, PlayHead, Prompt } from '../shared/Play';
import { verdictFor } from '../shared/verdict';

// Each game asks one thing about a country, in either direction. `prompt` and
// `label` are the two sides; `forward` asks prompt -> label.
const KINDS = {
  flags: {
    title: 'Flags',
    needs: null,
    directions: {
      forward: { name: 'Flag → country', prompt: (c) => <Flag code={c.code} size="lg" label="A national flag" />, label: (c) => c.name, ask: 'Whose flag is this?' },
      reverse: { name: 'Country → flag', prompt: (c) => <Prompt>{c.name}</Prompt>, label: (c) => c.code, render: (c) => <Flag code={c.code} size="md" decorative />, ask: 'Which is its flag?' }
    }
  },
  capitals: {
    title: 'Capitals',
    needs: 'capitals',
    directions: {
      forward: { name: 'Country → capital', prompt: (c) => <Prompt><Flag code={c.code} size="sm" decorative /> {c.name}</Prompt>, label: (c) => c.capitals[0], ask: 'What is the capital?' },
      reverse: { name: 'Capital → country', prompt: (c) => <Prompt>{c.capitals[0]}</Prompt>, label: (c) => c.name, ask: 'Capital of which country?' }
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

/** "US$1.80 trillion", "US$57.3 million": World Bank GDP in US dollars. */
function formatMoney(n) {
  if (n >= 1e12) return `US$${(n / 1e12).toFixed(2)} trillion`;
  if (n >= 1e9) return `US$${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)} billion`;
  return `US$${(n / 1e6).toFixed(1)} million`;
}

/** The country in numbers: people, size and economy, each with its year. */
function statsLine(c) {
  const parts = [];
  if (c.population) parts.push(`population ${formatPopulation(c.population)}`);
  // Vatican City is 0.44 km²: small areas keep their decimals.
  if (c.area) parts.push(`${c.area < 10 ? c.area.toFixed(2) : Math.round(c.area).toLocaleString('en-AU')} km²`);
  if (c.gdp) {
    const perHead = c.population ? ` (US$${Math.round(c.gdp / c.population).toLocaleString('en-AU')} a person)` : '';
    parts.push(`GDP ${formatMoney(c.gdp)}${perHead}, ${c.gdpYear}`);
  }
  return parts.join(' · ');
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
  // Every flag the round can show (each question's country and its options),
  // fetched as the round starts rather than one by one as they appear.
  const roundQuestions = round?.questions;
  useEffect(() => {
    // Capitals shows only the question's own flag; Flags shows the options' too.
    if (roundQuestions) {
      preloadFlags(roundQuestions.flatMap((q) => (kind === 'flags' ? [q.target.code, ...q.options.map((o) => o.code)] : [q.target.code])));
    }
  }, [roundQuestions, kind]);
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
  // A length longer than the pool (a small region) counts as "All".
  const shownCount = Number.isFinite(count) && count > pool.length ? Infinity : count;
  const mostMissed = (n) =>
    weakestItems(stats, kind, n)
      .map((w) => {
        const c = BY_CODE.get(w.key);
        return c ? { ...w, label: <><Flag code={c.code} size="sm" decorative /> {c.name}</> } : null;
      })
      .filter(Boolean);

  const start = () => {
    const questions = buildGeoRound(pool, {
      count: shownCount,
      seed: Date.now(),
      labelOf: dir.label,
      weights: itemWeights(stats, kind, pool.map((c) => c.code)),
      lookalikes: kind === 'flags' ? LOOKALIKES : null,
      hard
    });
    answeredUpTo.current = -1;
    setRound({
      settings: { region, territories, count: Number.isFinite(shownCount) ? shownCount : 'all', direction, hard },
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
      <GameSetup
        title={spec.title}
        section="geo"
        onExit={onExit}
        record={
          entry.plays
            ? `${entry.plays} rounds played · best ${entry.bestPct}% · ${Object.keys(entry.items).length} of ${pool.length} seen`
            : `${pool.length} to learn. Wrong answers come back more often.`
        }
      >
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
        <SetupRow label="Length" caption={`${pool.length.toLocaleString('en-AU')} countries available`}>
          {LENGTHS.map((n) => (
            <Chip key={n} active={shownCount === n} disabled={n > pool.length} onClick={() => setCount(n)}>{n}</Chip>
          ))}
          <Chip active={shownCount === Infinity} onClick={() => setCount(Infinity)}>All {pool.length}</Chip>
        </SetupRow>
        {kind === 'flags' && (
          <SetupRow
            label="Wrong answers"
            caption={hard ? 'Wrong answers are flags that look like the right one.' : 'Wrong answers are neighbouring countries.'}
          >
            <Chip active={!hard} onClick={() => setHard(false)}>Normal: neighbours</Chip>
            <Chip active={hard} onClick={() => setHard(true)}>Hard: look-alike flags</Chip>
          </SetupRow>
        )}
        <SetupRow
          label="Answer"
          caption={answerMode === 'choice' ? 'Four options. Easier.' : 'Answer in your head, reveal, then mark yourself. Harder.'}
        >
          <AnswerModeToggle mode={answerMode} onChange={onAnswerModeChange} />
        </SetupRow>
        <SetupRow label="Include">
          <Chip active={territories} onClick={() => setTerritories((t) => !t)}>
            Territories (Greenland, Guam, Bermuda…)
          </Chip>
        </SetupRow>

        <Button variant="primary" className="game-start" onClick={start} disabled={pool.length < 4}>
          Start {Math.min(shownCount, pool.length)} questions
        </Button>

        <MostMissed items={mostMissed(8)} title="Your most missed" />
      </GameSetup>
    );
  }

  const { questions, index, picked, revealed, answers } = round;

  if (index >= questions.length) {
    const score = answers.filter((a) => a.correct).length;
    const missed = questions.filter((q, i) => !answers[i].correct);
    return (
      <GameResults
        data-section="geo"
        eyebrow={`${spec.title} · ${round.region}`}
        score={score}
        total={questions.length}
        verdict={verdictFor(score, questions.length)}
        squares={answers.map((a) => a.correct)}
        onPlayAgain={start}
        onChangeSettings={() => setRound(null)}
        mostMissed={<MostMissed items={mostMissed(6)} />}
      >
        {missed.length > 0 && <h3 className="eyebrow">Missed this round</h3>}
        {missed.map(({ target: c }) => (
          <AnswerRow key={c.code} state="missed" lead={<Flag code={c.code} size="sm" decorative />} trail={`capital ${c.capitals[0]}`}>
            <strong>{c.name}</strong>
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const q = questions[index];
  const answered = answers.length > index;
  const right = answers.filter((a) => a.correct).length;

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
  const lookalikes = kind === 'flags' ? identicalFlags(q.target, LOOKALIKES, BY_CODE) : [];

  return (
    <GameCard data-section="geo">
      <PlayHead left={`${index + 1} / ${questions.length}`}>
        <Pill variant="accent">Score {right}</Pill>
        <Button variant="tertiary" onClick={() => setRound(null)} title="Abandon this round">End round</Button>
      </PlayHead>
      <Ask>{dir.ask}</Ask>
      <div className="play-stage">{dir.prompt(q.target)}</div>

      <ChoiceQuestion
        options={q.options.map((o) => ({
          key: o.code,
          // Once answered, each named option shows its flag beside the name,
          // so a wrong pick can be compared with the right one.
          label: dir.render
            ? dir.render(o)
            : kind === 'flags' && answered
              ? <span className="option-flag"><Flag code={o.code} size="sm" decorative />{dir.label(o)}</span>
              : dir.label(o),
          name: dir.render ? o.name : undefined
        }))}
        correctIndex={q.correctIndex}
        picked={picked}
        answered={answered}
        reveal={answerMode !== 'choice'}
        revealed={revealed}
        flags={Boolean(dir.render)}
        answerNode={dir.render ? dir.render(q.target) : dir.label(q.target)}
        onPick={(i) => answer(i === q.correctIndex, i)}
        onReveal={() => setRound({ ...round, revealed: true })}
        onGrade={(ok) => answer(ok)}
      />

      {answered && (
        <>
          <p className="play-fact">
            <strong>{q.target.name}</strong>: capital {q.target.capitals[0]} · {factLine(q.target)}
            {statsLine(q.target) && <><br />{statsLine(q.target)}</>}
            {lookalikes.length > 0 && (
              <><br />Same flag as {lookalikes.join(', ')} apart from its proportions.</>
            )}
          </p>
          <NextBar onClick={next}>{index < questions.length - 1 ? 'Next' : 'Results'}</NextBar>
        </>
      )}
    </GameCard>
  );
}
