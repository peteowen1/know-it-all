import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { topSongs, topArtists, buildChartQuiz, matchChartGuess, decadesOf } from './chartLogic';
import { gameEntry, weakestItems } from '../../lib/gameStats';
import {
  AnswerModeToggle, AnswerRow, Button, Chip, GameBoard, GameCard, GameResults, MostMissed, Pill, SetupRow, TextInput
} from '../../components/ui';
import { ChoiceQuestion, GameSetup, NextBar, PlayHead, Prompt } from '../shared/Play';
import { verdictFor } from '../shared/verdict';
import { usePersistentState } from '../../lib/persist';

/**
 * A "by year" chart game. `domain` holds one or more charts keyed by year,
 * each with its own wording, so one component runs music, films and TV:
 *
 *   domain = { id, title, intro, charts: { key: chart } }
 *   chart  = {
 *     label, years, source,
 *     noun, creditNoun,                  'song'/'artist', 'film'/'director'
 *     boardLabel, creditsLabel,          format chip names; creditsLabel null = no credits board
 *     boardTitle(label, singleYear),
 *     yearSize, decadeSize,              board sizes (null yearSize = the whole year's list)
 *     yearSpanLabel, decadeSpanLabel,
 *     decadeBoard: 'aggregate'|'winners',
 *     quizWords, sameYearDistractors
 *   }
 */
export default function ChartGame({ domain, stats, answerMode, onAnswerModeChange, onAnswer, onRoundComplete, onExit }) {
  const chartKeys = Object.keys(domain.charts);
  const [chartKey, setChartKey] = useState(chartKeys[0]);
  const chart = domain.charts[chartKey];
  const decades = useMemo(() => decadesOf(chart.years), [chart.years]);
  const [format, setFormat] = useState('board');
  const [span, setSpan] = useState('year'); // 'year' | 'decade'
  const [decade, setDecade] = useState(null); // null = any
  const [timed, setTimed] = useState(true);
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [round, setRound] = usePersistentState(`chart_${domain.id}`, null);
  const entry = gameEntry(stats, domain.id);
  // Saved answers are keyed by chart only when a game has several, so Box
  // office and Best Picture never collide. A one-chart game keeps plain keys;
  // prefixing music as well would strand every answer already saved for it.
  const itemKey = (k) => (chartKeys.length > 1 ? `${chartKey}:${k}` : k);

  const formats = {
    board: { label: chart.boardLabel, blurb: `Type ${chart.noun}s or ${chart.creditNoun}s to fill the board` },
    ...(chart.creditsLabel ? { credits: { label: chart.creditsLabel, blurb: `Name the biggest ${chart.creditNoun}s` } } : {}),
    quiz: { label: 'Quiz', blurb: 'Which year? Which one?' }
  };
  // Switching chart can leave a format or decade the new chart lacks (no
  // directors board for Best Picture; no 1930s box office). Fall back rather
  // than start an empty round.
  const activeFormat = formats[format] ? format : 'board';
  const activeDecade = decades.includes(decade) ? decade : null;

  const allYears = Object.keys(chart.years).map(Number);
  const pickRange = () => {
    const d = activeDecade ?? decades[Math.floor(Math.random() * decades.length)];
    if (span === 'decade' || activeFormat === 'quiz') return [d, d + 9];
    const inDecade = allYears.filter((y) => y >= d && y <= d + 9);
    const y = inDecade[Math.floor(Math.random() * inDecade.length)];
    return [y, y];
  };

  const start = () => {
    const [from, to] = pickRange();
    // A time-based id: a counter restarts at 0 after a reload and could reuse
    // the saved round's id, which would stop the next board remounting.
    const id = Date.now();
    const label = from === to ? String(from) : `the ${from}s`;
    if (activeFormat === 'quiz') {
      const whole = activeDecade == null;
      const questions = buildChartQuiz(chart.years, {
        from: whole ? Math.min(...allYears) : from,
        to: whole ? Math.max(...allYears) : to,
        count: 10,
        ...(chart.quizWords ? { words: chart.quizWords } : {}),
        sameYearDistractors: Boolean(chart.sameYearDistractors)
      });
      setRound({ id, type: 'quiz', label: `${chart.label} · ${whole ? 'all years' : label}`, questions, index: 0, answers: [], revealed: false, picked: null });
      return;
    }
    const single = from === to;
    const size = single ? chart.yearSize ?? chart.years[from].length : chart.decadeSize;
    const items =
      activeFormat === 'board'
        ? topSongs(chart.years, from, to, size, { decadeBoard: chart.decadeBoard })
        : topArtists(chart.years, from, to, size, { noun: chart.noun });
    setRound({
      id,
      type: 'board',
      title: activeFormat === 'board' ? chart.boardTitle(label, single) : `Top ${chart.creditNoun}s of ${label}`,
      placeholder: activeFormat === 'board' ? `${chart.noun} or ${chart.creditNoun}…` : `${chart.creditNoun}…`,
      items,
      found: [],
      endsAt: timed ? Date.now() + (items.length <= 10 ? 120 : 180) * 1000 : null,
      over: false,
      message: null
    });
  };

  if (!round) {
    return (
      <GameSetup
        title={domain.title}
        section="pop"
        onExit={onExit}
        record={entry.plays ? `${entry.plays} played · best ${entry.bestPct}%` : domain.intro}
        note={chart.source}
      >
        {chartKeys.length > 1 && (
          <SetupRow label="Chart">
            {chartKeys.map((k) => (
              <Chip key={k} active={chartKey === k} onClick={() => setChartKey(k)}>{domain.charts[k].label}</Chip>
            ))}
          </SetupRow>
        )}
        <SetupRow label="Format" caption={formats[activeFormat].blurb}>
          {Object.entries(formats).map(([k, f]) => (
            <Chip key={k} active={activeFormat === k} onClick={() => setFormat(k)}>{f.label}</Chip>
          ))}
        </SetupRow>
        {activeFormat !== 'quiz' && (
          <SetupRow label="Span">
            <Chip active={span === 'year'} onClick={() => setSpan('year')}>{chart.yearSpanLabel}</Chip>
            <Chip active={span === 'decade'} onClick={() => setSpan('decade')}>{chart.decadeSpanLabel}</Chip>
          </SetupRow>
        )}
        <SetupRow label="Decade">
          <Chip active={activeDecade === null} onClick={() => setDecade(null)}>Any</Chip>
          {decades.map((d) => (
            <Chip key={d} active={activeDecade === d} onClick={() => setDecade(d)}>{d}s</Chip>
          ))}
        </SetupRow>
        {activeFormat === 'quiz' ? (
          <SetupRow
            label="Answer"
            caption={answerMode === 'choice' ? 'Four options. Easier.' : 'Answer in your head, reveal, then mark yourself. Harder.'}
          >
            <AnswerModeToggle mode={answerMode} onChange={onAnswerModeChange} />
          </SetupRow>
        ) : (
          <>
            <SetupRow
              label="Hints"
              caption={
                answerMode === 'choice'
                  ? `Each empty slot shows the ${activeFormat === 'board' ? chart.creditNoun : `biggest ${chart.noun}`}.`
                  : 'Blank slots only.'
              }
            >
              <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>
                Easy: show the {activeFormat === 'board' ? chart.creditNoun : `biggest ${chart.noun}`}
              </Chip>
              <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: blank board</Chip>
            </SetupRow>
            <SetupRow label="Clock" caption={timed ? 'Two or three minutes, depending on the board size.' : 'Take as long as you like.'}>
              <Chip active={timed} onClick={() => setTimed(true)}>On</Chip>
              <Chip active={!timed} onClick={() => setTimed(false)}>Off</Chip>
            </SetupRow>
          </>
        )}
        <Button variant="primary" className="game-start" onClick={start}>Start</Button>
      </GameSetup>
    );
  }

  if (round.type === 'quiz') {
    return (
      <ChartQuiz
        key={round.id}
        round={round}
        setRound={setRound}
        reveal={answerMode === 'reveal'}
        onAnswer={(key, correct) => onAnswer(domain.id, itemKey(key), correct)}
        onFinish={(score, total) => onRoundComplete(domain.id, { score, total, answers: [] })}
        onAgain={start}
        onSettings={() => setRound(null)}
      />
    );
  }

  // Items on this board that have been missed before, from the saved per-item stats.
  const labels = new Map(round.items.map((it) => [itemKey(it.id), it.label]));
  const mostMissed = weakestItems(stats, domain.id, 300)
    .filter((w) => labels.has(w.key))
    .slice(0, 6)
    .map((w) => ({ ...w, label: labels.get(w.key) }));

  return (
    <ChartBoard
      key={round.id}
      round={round}
      setRound={setRound}
      mostMissed={mostMissed}
      easy={answerMode === 'choice'}
      onFinish={(r) =>
        onRoundComplete(domain.id, {
          score: r.found.length,
          total: r.items.length,
          answers: r.items.map((it) => ({ key: itemKey(it.id), correct: r.found.includes(it.id) }))
        })
      }
      onAgain={start}
      onSettings={() => setRound(null)}
    />
  );
}

function ChartBoard({ round, setRound, mostMissed, easy, onFinish, onAgain, onSettings }) {
  const [guess, setGuess] = useState('');
  const [now, setNow] = useState(Date.now());
  // A board restored already finished must not be recorded again on leaving.
  const finished = useRef(Boolean(round.over));
  const inputRef = useRef(null);
  const { items, found, endsAt, over, message, title, placeholder } = round;
  const foundSet = new Set(found);
  const secondsLeft = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;

  const finish = (r = round) => {
    if (finished.current) return;
    finished.current = true;
    const done = { ...r, over: true };
    setRound(done);
    onFinish(done);
  };

  // Leaving mid-board still records what was found.
  const latest = useRef(round);
  latest.current = round;
  const finishOnLeave = useRef(onFinish);
  finishOnLeave.current = onFinish;
  useEffect(
    () => () => {
      const r = latest.current;
      if (!finished.current && r.found.length) {
        finished.current = true;
        finishOnLeave.current(r);
      }
    },
    []
  );

  useEffect(() => {
    if (over || !endsAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [over, endsAt]);

  useEffect(() => {
    if (!over && ((secondsLeft === 0) || items.every((it) => foundSet.has(it.id)))) finish();
  });

  const submit = (e) => {
    e.preventDefault();
    if (over || !guess.trim()) return;
    const m = matchChartGuess(guess, items, foundSet);
    let msg;
    if (!m) msg = { tone: 'bad', text: `"${guess.trim()}" isn't on this chart` };
    else if (m.ambiguous) msg = { tone: 'meh', text: `${m.count} on this board start "${guess.trim()}". Be more specific.` };
    else if (m.alreadyFound) msg = { tone: 'meh', text: `Already got ${m.item.label}` };
    else msg = { tone: 'good', text: `#${m.item.rank} ${m.item.label}` };
    setRound((r) => ({ ...r, message: msg, found: m?.item && !m.alreadyFound ? [...r.found, m.item.id] : r.found }));
    setGuess('');
    inputRef.current?.focus();
  };

  if (over) {
    return (
      <GameResults
        data-section="pop"
        eyebrow={title}
        score={found.length}
        total={items.length}
        verdict={verdictFor(found.length, items.length)}
        squares={items.map((it) => foundSet.has(it.id))}
        onPlayAgain={onAgain}
        playAgainLabel="Another board"
        onChangeSettings={onSettings}
        mostMissed={<MostMissed items={mostMissed} />}
      >
        <ol className="board-grid">
          {items.map((it) => (
            <AnswerRow key={it.id} as="li" state={foundSet.has(it.id) ? 'got' : 'missed'} lead={it.rank}>
              <span className="board-person">
                <strong>{it.label}</strong>
                <span>{it.sub}</span>
              </span>
            </AnswerRow>
          ))}
        </ol>
      </GameResults>
    );
  }

  return (
    <GameBoard
      data-section="pop"
      title={title}
      score={`${found.length}/${items.length}`}
      timer={secondsLeft !== null ? <><Clock size={14} aria-hidden="true" /> {secondsLeft}s</> : undefined}
      message={message?.text ?? ''}
      tone={message?.tone === 'good' ? 'good' : message?.tone === 'bad' ? 'bad' : undefined}
      input={
        <form className="board-form" onSubmit={submit}>
          <TextInput
            ref={inputRef}
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={placeholder}
            label="Your answer"
          />
          <Button variant="primary" type="submit">Enter</Button>
          <Button variant="tertiary" icon="Flag" onClick={() => finish()}>Give up</Button>
        </form>
      }
    >
      <ol className="board-grid">
        {items.map((it) => {
          const got = foundSet.has(it.id);
          return (
            <AnswerRow key={it.id} as="li" state={got ? 'got' : 'pending'} lead={it.rank}>
              {got ? (
                <span className="board-person">
                  <strong>{it.label}</strong>
                  <span>{it.sub}</span>
                </span>
              ) : (
                <span className="board-hidden">{easy ? it.hint : ' '}</span>
              )}
            </AnswerRow>
          );
        })}
      </ol>
    </GameBoard>
  );
}

function ChartQuiz({ round, setRound, reveal, onAnswer, onFinish, onAgain, onSettings }) {
  const answeredUpTo = useRef(round.answers.length - 1);
  const { questions, index, answers, revealed, picked, label } = round;

  if (index >= questions.length) {
    const score = answers.filter(Boolean).length;
    const missed = questions.filter((_, i) => !answers[i]);
    return (
      <GameResults
        data-section="pop"
        eyebrow={`Chart quiz · ${label}`}
        score={score}
        total={questions.length}
        verdict={verdictFor(score, questions.length)}
        squares={answers}
        onPlayAgain={onAgain}
        onChangeSettings={onSettings}
      >
        {missed.length > 0 && <h3 className="eyebrow">Missed this round</h3>}
        {missed.map((q) => (
          <AnswerRow key={q.key} state="missed">
            <strong>{q.prompt}</strong>
            <span className="board-sub">{q.explain}</span>
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const q = questions[index];
  const answered = answers.length > index;
  const answer = (correct, i = null) => {
    if (answeredUpTo.current >= index) return;
    answeredUpTo.current = index;
    const next = [...answers, correct];
    setRound({ ...round, answers: next, picked: i, revealed: true });
    onAnswer(q.key, correct);
    if (index === questions.length - 1) onFinish(next.filter(Boolean).length, questions.length);
  };

  return (
    <GameCard data-section="pop">
      <PlayHead left={`${index + 1} / ${questions.length}`}>
        <Pill variant="accent">Score {answers.filter(Boolean).length}</Pill>
      </PlayHead>
      <Prompt className="chart-prompt">{q.prompt}</Prompt>

      <ChoiceQuestion
        options={q.options.map((opt) => ({ key: opt, label: opt }))}
        correctIndex={q.correctIndex}
        picked={picked}
        answered={answered}
        reveal={reveal}
        revealed={revealed}
        answerNode={q.options[q.correctIndex]}
        onPick={(i) => answer(i === q.correctIndex, i)}
        onReveal={() => setRound({ ...round, revealed: true })}
        onGrade={(ok) => answer(ok)}
      />

      {answered && (
        <>
          <p className="play-fact">{q.explain}</p>
          <NextBar onClick={() => setRound({ ...round, index: index + 1, revealed: false, picked: null })}>
            {index < questions.length - 1 ? 'Next' : 'Results'}
          </NextBar>
        </>
      )}
    </GameCard>
  );
}
