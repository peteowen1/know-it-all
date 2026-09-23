import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Eye, Flag as GiveUp, RotateCcw, XCircle } from 'lucide-react';
import { topSongs, topArtists, buildChartQuiz, matchChartGuess, decadesOf } from './chartLogic';
import { gameEntry } from '../../lib/gameStats';
import { Chip, SetupRow } from '../geo/CountryQuiz';

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
  const [round, setRound] = useState(null);
  const roundId = useRef(0);
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
    roundId.current += 1;
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
      setRound({ id: roundId.current, type: 'quiz', label: `${chart.label} · ${whole ? 'all years' : label}`, questions, index: 0, answers: [], revealed: false, picked: null });
      return;
    }
    const single = from === to;
    const size = single ? chart.yearSize ?? chart.years[from].length : chart.decadeSize;
    const items =
      activeFormat === 'board'
        ? topSongs(chart.years, from, to, size, { decadeBoard: chart.decadeBoard })
        : topArtists(chart.years, from, to, size, { noun: chart.noun });
    setRound({
      id: roundId.current,
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
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>{domain.title}</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <p className="game-record">
          {entry.plays ? `${entry.plays} played · best ${entry.bestPct}%` : domain.intro}
        </p>
        {chartKeys.length > 1 && (
          <SetupRow label="Chart">
            {chartKeys.map((k) => (
              <Chip key={k} active={chartKey === k} onClick={() => setChartKey(k)}>{domain.charts[k].label}</Chip>
            ))}
          </SetupRow>
        )}
        <SetupRow label="Format">
          {Object.entries(formats).map(([k, f]) => (
            <Chip key={k} active={activeFormat === k} onClick={() => setFormat(k)} title={f.blurb}>{f.label}</Chip>
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
          <SetupRow label="Answer">
            <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Multiple choice</Chip>
            <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Reveal &amp; self-mark</Chip>
          </SetupRow>
        ) : (
          <>
            <SetupRow label="Hints">
              <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>
                Easy: show the {activeFormat === 'board' ? chart.creditNoun : `biggest ${chart.noun}`}
              </Chip>
              <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Hard: blank board</Chip>
            </SetupRow>
            <SetupRow label="Clock">
              <Chip active={timed} onClick={() => setTimed(true)}>On</Chip>
              <Chip active={!timed} onClick={() => setTimed(false)}>Off</Chip>
            </SetupRow>
          </>
        )}
        <button className="btn btn-primary game-start" onClick={start}>Start</button>
        <p className="game-record small">{chart.source}</p>
      </div>
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

  return (
    <ChartBoard
      key={round.id}
      round={round}
      setRound={setRound}
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

function ChartBoard({ round, setRound, easy, onFinish, onAgain, onSettings }) {
  const [guess, setGuess] = useState('');
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);
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
    else if (m.alreadyFound) msg = { tone: 'meh', text: `Already got ${m.item.label}` };
    else msg = { tone: 'good', text: `#${m.item.rank} ${m.item.label} ✓` };
    setRound((r) => ({ ...r, message: msg, found: m && !m.alreadyFound ? [...r.found, m.item.id] : r.found }));
    setGuess('');
    inputRef.current?.focus();
  };

  return (
    <div className="card names-game">
      <div className="progress-text">
        <span className="names-title">{title}</span>
        <span className="score-pill">
          {found.length}/{items.length}
          {secondsLeft !== null && !over && <> · <Clock size={14} /> {secondsLeft}s</>}
        </span>
      </div>

      {!over && (
        <form className="names-input-row" onSubmit={submit}>
          <input
            ref={inputRef}
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={placeholder}
            aria-label="Your answer"
            autoComplete="off"
            spellCheck="false"
          />
          <button className="btn btn-primary" type="submit">Enter</button>
          <button className="btn btn-ghost" type="button" onClick={() => finish()}>
            <GiveUp size={16} /> Give up
          </button>
        </form>
      )}
      {message && !over && <p className={`names-msg ${message.tone}`}>{message.text}</p>}

      <ol className="names-board">
        {items.map((it) => {
          const got = foundSet.has(it.id);
          return (
            <li key={it.id} className={`names-slot ${got ? 'got' : over ? 'missed' : ''}`}>
              <span className="names-rank">{it.rank}</span>
              {got || over ? (
                <span className="names-person">
                  <strong>{it.label}</strong>
                  <span>{it.sub}</span>
                </span>
              ) : (
                <span className="names-hidden">{easy ? it.hint : ' '}</span>
              )}
            </li>
          );
        })}
      </ol>

      {over && (
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={onAgain} autoFocus><RotateCcw size={18} /> Another</button>
          <button className="btn btn-ghost" onClick={onSettings}>Settings</button>
        </div>
      )}
    </div>
  );
}

function ChartQuiz({ round, setRound, reveal, onAnswer, onFinish, onAgain, onSettings }) {
  const answeredUpTo = useRef(-1);
  const { questions, index, answers, revealed, picked, label } = round;

  if (index >= questions.length) {
    const score = answers.filter(Boolean).length;
    return (
      <div className="card game-results">
        <h2>{score} / {questions.length}</h2>
        <p className="game-record">Chart quiz · {label}</p>
        <div className="missed-grid">
          {questions.filter((_, i) => !answers[i]).map((q) => (
            <div key={q.key} className="missed-item"><div><strong>{q.prompt}</strong><span>{q.explain}</span></div></div>
          ))}
        </div>
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={onAgain}><RotateCcw size={18} /> Again</button>
          <button className="btn btn-ghost" onClick={onSettings}>Settings</button>
        </div>
      </div>
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
    <div className="card geo-question">
      <div className="progress-text">
        <span>{index + 1} / {questions.length}</span>
        <span className="score-pill">Score {answers.filter(Boolean).length}</span>
      </div>
      <h2 className="geo-prompt-text chart-prompt">{q.prompt}</h2>

      {!reveal ? (
        <div className="options-grid">
          {q.options.map((opt, i) => {
            let state = '';
            if (answered) state = i === q.correctIndex ? 'correct' : i === picked ? 'incorrect' : 'disabled';
            return (
              <button key={opt} className={`option-btn ${state}`} disabled={answered} onClick={() => answer(i === q.correctIndex, i)}>
                <span className="option-label">{opt}</span>
                {answered && i === q.correctIndex && <CheckCircle2 className="icon-right" size={20} />}
                {answered && i === picked && i !== q.correctIndex && <XCircle className="icon-wrong" size={20} />}
              </button>
            );
          })}
        </div>
      ) : !revealed ? (
        <div className="reveal-prompt">
          <button className="btn btn-secondary" onClick={() => setRound({ ...round, revealed: true })}><Eye size={18} /> Reveal</button>
        </div>
      ) : (
        <div className="revealed-content">
          <div className="answer-highlight"><span className="ans-val">{q.options[q.correctIndex]}</span></div>
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
          <p className="geo-fact">{q.explain}</p>
          <div className="next-action-bar">
            <button className="btn btn-primary next-btn" autoFocus onClick={() => setRound({ ...round, index: index + 1, revealed: false, picked: null })}>
              {index < questions.length - 1 ? 'Next' : 'Results'} <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
