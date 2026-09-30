import React, { useMemo, useRef } from 'react';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import data from '../../data/vocab.json';
import { explainRound } from './vocabLogic';
import { testContext, nextRound, scoreAnswers, guessRate, describeLevel, TEST_LENGTH } from './vocabTest.js';
import { localDateKey } from '../../lib/dates';

// The measurable range: the rarest and commonest words in the set. A level
// outside it is extrapolation, so it is reported as a bound, not a number.
const ZIPFS = data.groups.flatMap((g) => g.words.map((w) => w[2]));
const LOWEST = Math.min(...ZIPFS) + 0.2;
const HIGHEST = Math.max(...ZIPFS) - 0.2;

/**
 * The adaptive test: twenty questions, no answers shown until the end, each
 * one chosen near the current estimate of your level. Ends with the level and
 * a review of every question with its definitions.
 */
export default function TestMode({ test, setTest, history, onComplete, onAgain, onAnswer, onExit }) {
  const ctx = useMemo(() => testContext(data.groups), []);
  // A quick double tap would answer this question and then the next one,
  // whose options appear under the same finger. Ignore taps just after an answer.
  const lastAnswer = useRef(0);
  const { rounds, answers, picked } = test;
  const done = answers.length >= TEST_LENGTH || answers.length === rounds.length;

  if (done) {
    const { level, sd } = scoreAnswers(answers);
    const right = answers.filter((a) => a.right).length;
    let headline = `Level ${level.toFixed(1)} ± ${sd.toFixed(1)}`;
    let detail = `You reliably know ${describeLevel(level)}.`;
    if (level < LOWEST) {
      headline = 'Off the top of the scale';
      detail = 'You knew words rarer than anything in the test, so it cannot put a number on your level.';
    } else if (level > HIGHEST) {
      headline = 'Below the bottom of the scale';
      detail = 'The test ran out of common enough words to place you. Practice mode is the place to start.';
    }
    return (
      <div className="card game-results">
        <h2>{headline}</h2>
        <p className="game-record">
          {detail} {right} of {answers.length} right. Lower levels mean rarer words; the scale runs from about 4.5
          (words like “ban”) down to 1 (words like “peregrinate”).
        </p>
        {history.length > 1 && (
          <div className="ny-summary">
            <h3>Your tests</h3>
            {history.slice(-5).map((h, i) => (
              <div key={`${h.date}-${i}`} className="ny-sum-row">
                <span>{h.date}</span>
                <strong>{h.level.toFixed(1)} ± {h.sd.toFixed(1)}</strong>
              </div>
            ))}
          </div>
        )}
        <h3>Every question</h3>
        <ul className="vp-defs">
          {answers.map((a, i) => {
            const info = explainRound(rounds[i], data.groups);
            return (
              <li key={rounds[i].id} className={a.right ? 'right' : ''}>
                {a.right ? <CheckCircle2 className="icon-right" size={16} /> : <XCircle className="icon-wrong" size={16} />}{' '}
                <strong>{rounds[i].target}</strong> <em>(level {a.zipf.toFixed(1)})</em>
                {info.options.filter((o) => o.right || a.picked.includes(o.word)).map((o) => (
                  <div key={o.word}>
                    {o.right ? '✓' : '✗'} <strong>{o.word}</strong>: {o.def}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={onAgain}>Take it again</button>
          <button className="btn btn-ghost" onClick={onExit}>Back</button>
        </div>
      </div>
    );
  }

  const index = answers.length;
  const r = rounds[index];

  const submit = (sel) => {
    if (Date.now() - lastAnswer.current < 400) return;
    lastAnswer.current = Date.now();
    const right = sel.length === r.answer.length && r.answer.every((w) => sel.includes(w));
    for (const key of new Set([r.target, ...r.answer])) onAnswer('vocab', key, right);
    const next = [...answers, { picked: sel, right, zipf: r.zipf, guess: guessRate(r) }];
    const more = next.length < TEST_LENGTH
      ? nextRound(ctx, { level: scoreAnswers(next).level, usedGroups: rounds.map((x) => x.group), index: next.length, seed: test.seed })
      : null;
    setTest({ ...test, answers: next, picked: [], rounds: more ? [...rounds, more] : rounds });
    // Saved the moment the last answer goes in, so leaving from the results
    // screen still keeps the result.
    if (!more) {
      const { level, sd } = scoreAnswers(next);
      onComplete({ level, sd, date: localDateKey(), right: next.filter((a) => a.right).length, total: next.length });
    }
  };

  const toggle = (w) => {
    if (Date.now() - lastAnswer.current < 400) return;
    if (r.pick === 1) return submit([w]);
    setTest({ ...test, picked: picked.includes(w) ? picked.filter((x) => x !== w) : [...picked, w].slice(-r.pick) });
  };

  const ask = r.type === 'syn'
    ? `Pick the ${r.pick} words that mean the same`
    : r.type === 'ant'
      ? <>Which is the opposite of <strong>{r.target}</strong>?</>
      : <>Which word means “{r.prompt}”?</>;

  return (
    <div className="card geo-question">
      <div className="progress-text">
        <span>Test · question {index + 1} of {TEST_LENGTH}</span>
        <button className="btn btn-ghost" onClick={onExit}>Stop</button>
      </div>
      <p className="geo-ask">{ask}</p>
      <div className="options-grid">
        {r.options.map((w) => (
          <button key={w} className={`option-btn ${picked.includes(w) ? 'selected' : ''}`} onClick={() => toggle(w)}>
            <span className="option-label">{w}</span>
          </button>
        ))}
      </div>
      {r.pick > 1 && (
        <div className="next-action-bar">
          <button className="btn btn-primary next-btn" disabled={picked.length !== r.pick} onClick={() => submit(picked)}>
            Next ({picked.length}/{r.pick}) <ArrowRight size={18} />
          </button>
        </div>
      )}
      <p className="game-record">Answers are shown at the end.</p>
    </div>
  );
}
