import React from 'react';
import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import data from '../../data/vocab.json';
import { buildVocabRounds, isCorrect, explainRound } from './vocabLogic';
import { gameEntry, itemWeights, weakestItems } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import TestMode from './TestMode';
import { testContext, newTest, TEST_LENGTHS, scaleBounds, formatLevel } from './vocabTest.js';

const ALL_WORDS = data.groups.flatMap((g) => g.words.map(([w, d]) => ({ w, d })));
const DEF = new Map(ALL_WORDS.map(({ w, d }) => [w, d]));
const BOUNDS = scaleBounds(data.groups);
const GROUP_IDS = new Set(data.groups.map((g) => g.id));

// A game saved before vocab.json changed can name a family or word that no
// longer exists, and explaining it would throw on every load. Drop it instead.
const stillValid = (game) =>
  Array.isArray(game?.rounds) && game.rounds.every((r) => GROUP_IDS.has(r.group) && r.options.every((w) => DEF.has(w)));

const PRACTICE_LENGTHS = [5, 10, 20];
const TYPE_LABEL = { mixed: 'Mixed', syn: 'Synonyms', ant: 'Opposites', meaning: 'Meanings' };
const LEVEL_LABEL = { easy: 'Everyday', all: 'Mixed', hard: 'Advanced' };
const ROLE_LABEL = { same: 'same meaning', trap: 'same meaning (the trap)', opposite: 'opposite', unrelated: '' };

function ask(r) {
  if (r.type === 'syn') return `Pick the ${r.pick} words that mean the same`;
  if (r.type === 'ant') return <>Which is the opposite of <strong>{r.target}</strong>?</>;
  return <>Which word means “{r.prompt}”?</>;
}

/**
 * Word play: synonyms, opposites and meanings. After every answer the reveal
 * card defines every option and shows the whole word family, because the point
 * is learning the words, not just scoring.
 */
export default function WordPlay({ stats, onAnswer, onRoundComplete, onExit }) {
  const [saved, setGame] = usePersistentState('word_play', null);
  const game = saved && stillValid(saved) ? saved : null;
  const [savedTest, setTest] = usePersistentState('word_play_test', null);
  const test = savedTest && stillValid(savedTest) ? savedTest : null;
  const [rawHistory, setHistory] = usePersistentState('word_play_history', []);
  const history = Array.isArray(rawHistory) ? rawHistory.filter((h) => Number.isFinite(h?.level)) : [];
  const [prefs, setPrefs] = usePersistentState('word_play_prefs', { type: 'mixed', level: 'all', practiceLength: 10, testLength: 10 });
  const practiceLength = PRACTICE_LENGTHS.includes(prefs.practiceLength) ? prefs.practiceLength : 10;
  const testLength = TEST_LENGTHS.includes(prefs.testLength) ? prefs.testLength : 10;
  const entry = gameEntry(stats, 'vocab');
  const startTest = () => setTest(newTest(testContext(data.groups), testLength));

  if (test) {
    return (
      <TestMode
        test={test}
        setTest={setTest}
        history={history}
        onAnswer={onAnswer}
        onComplete={(res) => {
          setHistory(() => [...history, { date: res.date, level: res.level, sd: res.sd }].slice(-50));
          onRoundComplete('vocab-test', { score: res.right, total: res.total, answers: [] });
        }}
        onAgain={startTest}
        onExit={() => setTest(null)}
      />
    );
  }

  const start = () => {
    const weights = itemWeights(stats, 'vocab', ALL_WORDS.map((x) => x.w));
    const rounds = buildVocabRounds(data.groups, { seed: `${Date.now()}`, type: prefs.type, level: prefs.level, count: practiceLength, weights });
    setGame({ rounds, index: 0, picked: [], results: [] });
  };

  if (!game) {
    const weak = weakestItems(stats, 'vocab', 8);
    return (
      <div className="card game-setup">
        <div className="game-setup-head">
          <h2>Word play</h2>
          <button className="btn btn-ghost" onClick={onExit}>All games</button>
        </div>
        <section className="vp-mode">
          <h3>Practise</h3>
          <p className="game-record">
            Every answer shows what each word means and its whole family, and words you miss come back more often.
            {entry.plays ? ` ${entry.plays} played · best ${entry.bestPct}%.` : ''}
          </p>
          <div className="vp-choice">
            {Object.entries(TYPE_LABEL).map(([k, label]) => (
              <button key={k} className={`btn ${prefs.type === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrefs({ ...prefs, type: k })}>{label}</button>
            ))}
          </div>
          <div className="vp-choice">
            {Object.entries(LEVEL_LABEL).map(([k, label]) => (
              <button key={k} className={`btn ${prefs.level === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrefs({ ...prefs, level: k })}>{label}</button>
            ))}
          </div>
          <div className="vp-choice">
            {PRACTICE_LENGTHS.map((n) => (
              <button key={n} className={`btn ${practiceLength === n ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrefs({ ...prefs, practiceLength: n })}>{n} rounds</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={start}>Start practice</button>
        </section>
        <section className="vp-mode">
          <h3>Test</h3>
          <p className="game-record">
            Questions get harder as you get them right, and answers are shown at the end. Gives you a level based on how
            rare the words you know are; the longer test is more precise.
            {history.length ? ` Last test: ${formatLevel(history[history.length - 1].level, BOUNDS)}.` : ''}
          </p>
          <div className="vp-choice">
            {TEST_LENGTHS.map((n) => (
              <button key={n} className={`btn ${testLength === n ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPrefs({ ...prefs, testLength: n })}>{n} questions</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={startTest}>Start test</button>
        </section>
        {weak.length > 0 && (
          <div className="vp-weak">
            <h3>Your tricky words</h3>
            {weak.map((x) => (
              <div key={x.key} className="ny-sum-row">
                <span><strong>{x.key}</strong>: {DEF.get(x.key)}</span>
                <span>{x.correct}/{x.seen}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const { rounds, index, picked, results } = game;
  const score = results.filter((r) => r.correct).length;

  if (index >= rounds.length) {
    return (
      <div className="card game-results">
        <h2>{score} / {rounds.length}</h2>
        <div className="ny-summary">
          {rounds.map((r, i) => (
            <div key={r.id} className="ny-sum-row">
              <span><strong>{r.target}</strong>: {DEF.get(r.target)}</span>
              <strong>{results[i].correct ? '✓' : '✗'}</strong>
            </div>
          ))}
        </div>
        <div className="actions-bar centered">
          <button className="btn btn-primary" onClick={start}><RotateCcw size={18} /> Play again</button>
          <button className="btn btn-ghost" onClick={() => setGame(null)}>Back</button>
        </div>
      </div>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const info = done ? explainRound(r, data.groups) : null;

  const toggle = (w) => {
    if (done) return;
    if (r.pick === 1) return submit([w]);
    setGame({ ...game, picked: picked.includes(w) ? picked.filter((x) => x !== w) : [...picked, w].slice(-r.pick) });
  };

  function submit(sel) {
    const correct = isCorrect(r, sel);
    // Every word the round was testing is scored, so a missed synonym pair
    // brings both words back.
    for (const key of new Set([r.target, ...r.answer])) onAnswer('vocab', key, correct);
    const next = [...results, { picked: sel, correct }];
    setGame({ ...game, picked: sel, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('vocab', { score: next.filter((x) => x.correct).length, total: rounds.length, answers: [] });
    }
  }

  return (
    <div className="card geo-question">
      <div className="progress-text">
        <span>Round {index + 1} of {rounds.length} · {TYPE_LABEL[r.type]}</span>
        <span className="score-pill">{score} right</span>
      </div>

      <p className="geo-ask">{ask(r)}</p>
      <div className="options-grid">
        {r.options.map((w) => {
          let state = picked.includes(w) ? 'selected' : '';
          if (done) state = r.answer.includes(w) ? 'correct' : picked.includes(w) ? 'incorrect' : 'disabled';
          return (
            <button key={w} className={`option-btn ${state}`} disabled={done} onClick={() => toggle(w)}>
              <span className="option-label">{w}</span>
              {done && r.answer.includes(w) && <CheckCircle2 className="icon-right" size={20} />}
              {done && picked.includes(w) && !r.answer.includes(w) && <XCircle className="icon-wrong" size={20} />}
            </button>
          );
        })}
      </div>

      {!done && r.pick > 1 && (
        <div className="actions-bar centered">
          <button className="btn btn-primary" disabled={picked.length !== r.pick} onClick={() => submit(picked)}>
            Check ({picked.length}/{r.pick})
          </button>
        </div>
      )}

      {done && (
        <div className="vp-reveal">
          <ul className="vp-defs">
            {info.options.map((o) => (
              <li key={o.word} className={o.right ? 'right' : ''}>
                <strong>{o.word}</strong> {ROLE_LABEL[o.role] && <em>({ROLE_LABEL[o.role]})</em>}
                <div>{o.def}</div>
              </li>
            ))}
          </ul>
          <p><strong>Words for “{info.sense}”:</strong> {info.family.map((f) => f.word).join(', ')}</p>
          {info.opposite && (
            <p><strong>Opposite, “{info.opposite.sense}”:</strong> {info.opposite.words.map((f) => f.word).join(', ')}</p>
          )}
        </div>
      )}

      {done && (
        <div className="next-action-bar">
          <button className="btn btn-primary next-btn" autoFocus onClick={() => setGame({ ...game, index: index + 1, picked: [] })}>
            {index < rounds.length - 1 ? 'Next' : 'Results'} <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
