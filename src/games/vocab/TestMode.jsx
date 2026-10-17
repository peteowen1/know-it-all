import React, { useMemo, useRef } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import data from '../../data/vocab.json';
import { explainRound } from './vocabLogic';
import { testContext, nextRound, scoreAnswers, guessRate, describeLevel, TEST_LENGTH, scaleBounds, formatLevel } from './vocabTest.js';
import { localDateKey } from '../../lib/dates';
import { AnswerRow, Button, GameCard, GameResults } from '../../components/ui';
import { Ask, Option, OptionGrid, PlayHead } from '../shared/Play';

const BOUNDS = scaleBounds(data.groups);
const LOWEST = BOUNDS.lowest;
const HIGHEST = BOUNDS.highest;
const onScale = (level) => level >= LOWEST && level <= HIGHEST;

/**
 * The adaptive test: twenty questions, no answers shown until the end, each
 * one chosen near the current estimate of your level. Ends with the level and
 * a review of every question with its definitions.
 */
export default function TestMode({ test, setTest, history, recent, onSeen, onComplete, onAgain, onAnswer, onExit }) {
  const ctx = useMemo(() => testContext(data), []);
  // A quick double tap would answer this question and then the next one,
  // whose options appear under the same finger. Ignore taps just after an answer.
  const lastAnswer = useRef(0);
  const { rounds, answers, picked } = test;
  // Tests saved before lengths were selectable have none: they were 20.
  const length = test.length || TEST_LENGTH;
  const done = answers.length >= length || answers.length === rounds.length;

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
      <GameResults
        data-section="words"
        eyebrow="Word play · vocabulary test"
        hero={headline}
        verdict={detail}
        squares={answers.map((a) => a.right)}
        celebrate={right === answers.length}
        onPlayAgain={onAgain}
        playAgainLabel="Take it again"
        onChangeSettings={onExit}
        settingsLabel="Back"
      >
        <p className="setup-caption">
          {right} of {answers.length} right. Lower levels mean rarer words; the scale runs from about 4.5
          (words like “ban”) down to 1 (words like “peregrinate”).
        </p>
        {history.length > 1 && (
          <>
            <h3 className="eyebrow">Your tests</h3>
            {history.slice(-5).map((h, i) => (
              <AnswerRow key={`${h.date}-${i}`} trail={onScale(h.level) ? `${h.level.toFixed(1)} ± ${h.sd.toFixed(1)}` : formatLevel(h.level, BOUNDS)}>
                {h.date}
              </AnswerRow>
            ))}
          </>
        )}
        <h3 className="eyebrow">Every question</h3>
        <ul className="vp-defs">
          {answers.map((a, i) => {
            const info = explainRound(rounds[i], data);
            return (
              <li key={rounds[i].id} data-right={a.right ? 'true' : 'false'}>
                <span className="vp-head">
                  {a.right
                    ? <Check className="icon-right" size={16} aria-label="Right" />
                    : <X className="icon-wrong" size={16} aria-label="Wrong" />}
                  <strong>{rounds[i].target}</strong> <em>(level {a.zipf.toFixed(1)})</em>
                </span>
                {info.options.filter((o) => o.right || a.picked.includes(o.word)).map((o) => (
                  <div key={o.word}>
                    <strong>{o.word}</strong> ({o.right ? 'right' : 'your pick'}): {o.def}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </GameResults>
    );
  }

  const index = answers.length;
  const r = rounds[index];

  const submit = (sel) => {
    if (Date.now() - lastAnswer.current < 400) return;
    lastAnswer.current = Date.now();
    const right = sel.length === r.answer.length && r.answer.every((w) => sel.includes(w));
    for (const key of new Set([r.target, ...r.answer])) onAnswer('vocab', key, right);
    onSeen(r.options.concat(r.target));
    const next = [...answers, { picked: sel, right, zipf: r.zipf, guess: guessRate(r) }];
    const more = next.length < length
      ? nextRound(ctx, { level: scoreAnswers(next).level, usedGroups: rounds.map((x) => x.group), index: next.length, seed: test.seed, recent })
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
    <GameCard data-section="words">
      <PlayHead left={`Test · question ${index + 1} of ${length}`}>
        <Button variant="tertiary" onClick={onExit}>Stop</Button>
      </PlayHead>
      <Ask>{ask}</Ask>
      <OptionGrid>
        {r.options.map((w, i) => (
          <Option
            key={w}
            letter={'ABCDEFGH'[i]}
            pressable={r.pick > 1}
            state={picked.includes(w) ? 'selected' : 'idle'}
            onClick={() => toggle(w)}
          >
            {w}
          </Option>
        ))}
      </OptionGrid>
      {r.pick > 1 && (
        <div className="next-action-bar">
          <Button variant="primary" className="next-btn" disabled={picked.length !== r.pick} onClick={() => submit(picked)}>
            Next ({picked.length}/{r.pick}) <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      )}
      <p className="setup-caption">Answers are shown at the end.</p>
    </GameCard>
  );
}
