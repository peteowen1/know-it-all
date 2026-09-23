import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Eye, Flag as GiveUp, RotateCcw, XCircle } from 'lucide-react';
import { topSongs, topArtists, buildChartQuiz, matchChartGuess, decadesOf } from './chartLogic';
import { gameEntry } from '../../lib/gameStats';
import { Chip, SetupRow } from '../geo/CountryQuiz';

const FORMATS = {
  songs: { label: 'Songs board', blurb: 'Type songs or artists to fill the chart' },
  artists: { label: 'Artists board', blurb: 'Name the biggest acts' },
  quiz: { label: 'Quiz', blurb: 'Which year? Which song?' }
};

/**
 * A "by year" chart game. `domain` supplies the data and wording, so the same
 * component can later run films and TV:
 *   { id, title, noun, years, source }
 */
export default function ChartGame({ domain, stats, answerMode, onAnswerModeChange, onAnswer, onRoundComplete, onExit }) {
  const decades = useMemo(() => decadesOf(domain.years), [domain.years]);
  const [format, setFormat] = useState('songs');
  const [span, setSpan] = useState('year'); // 'year' | 'decade'
  const [decade, setDecade] = useState(null); // null = any
  const [timed, setTimed] = useState(true);
  const [round, setRound] = useState(null);
  const roundId = useRef(0);
  const entry = gameEntry(stats, domain.id);

  const allYears = Object.keys(domain.years).map(Number);
  const pickRange = () => {
    const d = decade ?? decades[Math.floor(Math.random() * decades.length)];
    if (span === 'decade' || format === 'quiz') return [d, d + 9];
    const inDecade = allYears.filter((y) => y >= d && y <= d + 9);
    const y = inDecade[Math.floor(Math.random() * inDecade.length)];
    return [y, y];
  };

  const start = () => {
    const [from, to] = pickRange();
    roundId.current += 1;
    const label = from === to ? String(from) : `the ${from}s`;
    if (format === 'quiz') {
      const questions = buildChartQuiz(domain.years, { from: decade == null ? Math.min(...allYears) : from, to: decade == null ? Math.max(...allYears) : to, count: 10 });
      setRound({ id: roundId.current, type: 'quiz', label: decade == null ? 'all years' : label, questions, index: 0, answers: [], revealed: false, picked: null });
      return;
    }
    const size = from === to ? 10 : 20;
    const items = format === 'songs' ? topSongs(domain.years, from, to, size) : topArtists(domain.years, from, to, size);
    setRound({
      id: roundId.current,
      type: 'board',
      format,
      label,
      items,
      found: [],
      endsAt: timed ? Date.now() + (size === 10 ? 120 : 180) * 1000 : null,
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
        <SetupRow label="Format">
          {Object.entries(FORMATS).map(([k, f]) => (
            <Chip key={k} active={format === k} onClick={() => setFormat(k)} title={f.blurb}>{f.label}</Chip>
          ))}
        </SetupRow>
        {format !== 'quiz' && (
          <SetupRow label="Span">
            <Chip active={span === 'year'} onClick={() => setSpan('year')}>One year (top 10)</Chip>
            <Chip active={span === 'decade'} onClick={() => setSpan('decade')}>Whole decade (top 20)</Chip>
          </SetupRow>
        )}
        <SetupRow label="Decade">
          <Chip active={decade === null} onClick={() => setDecade(null)}>Any</Chip>
          {decades.map((d) => (
            <Chip key={d} active={decade === d} onClick={() => setDecade(d)}>{d}s</Chip>
          ))}
        </SetupRow>
        {format === 'quiz' ? (
          <SetupRow label="Answer">
            <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>Multiple choice</Chip>
            <Chip active={answerMode === 'reveal'} onClick={() => onAnswerModeChange('reveal')}>Reveal &amp; self-mark</Chip>
          </SetupRow>
        ) : (
          <>
            <SetupRow label="Hints">
              <Chip active={answerMode === 'choice'} onClick={() => onAnswerModeChange('choice')}>
                Easy: show the {format === 'songs' ? 'artist' : 'biggest song'}
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
        <p className="game-record small">{domain.source}. Decade boards add up each song's points across every year it charted.</p>
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
        onAnswer={(key, correct) => onAnswer(domain.id, key, correct)}
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
          answers: r.items.map((it) => ({ key: it.id, correct: r.found.includes(it.id) }))
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
  const { items, found, endsAt, over, message, label, format } = round;
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
        <span className="names-title">
          Top {format === 'songs' ? 'songs' : 'artists'} of <strong>{label}</strong>
        </span>
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
            placeholder={format === 'songs' ? 'song or artist…' : 'artist…'}
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
