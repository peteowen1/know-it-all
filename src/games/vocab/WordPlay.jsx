import React from 'react';
import { ArrowRight } from 'lucide-react';
import data from '../../data/vocab.json';
import { buildVocabRounds, isCorrect, explainRound } from './vocabLogic';
import { gameEntry, itemWeights, weakestItems } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import TestMode from './TestMode';
import { AnswerRow, Button, Chip, GameCard, GameResults, Pill, SetupRow } from '../../components/ui';
import { Ask, GameSetup, Option, OptionGrid, PlayHead } from '../shared/Play';
import { verdictFor } from '../shared/verdict';
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
// How many recently shown words to remember, and how much less likely they are
// to be drawn again: about 30 games' worth of options, drawn at a tenth the rate.
const RECENT_KEEP = 600;
const RECENT_WEIGHT = 0.1;
const TYPE_LABEL = { mixed: 'Mixed', syn: 'Synonyms', ant: 'Opposites', meaning: 'Meanings' };
const LEVEL_LABEL = { easy: 'Everyday', all: 'Mixed', hard: 'Advanced' };
const ROLE_LABEL = { same: 'same meaning', trap: 'same meaning: the trap', opposite: 'opposite', unrelated: '' };

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
  // Words shown in the last few games. Fresh words are drawn first, so the
  // whole list comes round before anything repeats. Missed words still come
  // back through their stats weight.
  const [rawRecent, setRecent] = usePersistentState('word_play_recent', []);
  const recentList = Array.isArray(rawRecent) ? rawRecent : [];
  const recent = new Set(recentList);
  const onSeen = (words) => setRecent((prev) => {
    const kept = (Array.isArray(prev) ? prev : []).filter((w) => !words.includes(w));
    return [...kept, ...words].slice(-RECENT_KEEP);
  });
  const startTest = () => setTest(newTest(testContext(data), testLength, recent));

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
        onAgain={() => setTest(newTest(testContext(data), test.length || testLength, recent))}
        recent={recent}
        onSeen={onSeen}
        onExit={() => setTest(null)}
      />
    );
  }

  const start = () => {
    const weights = itemWeights(stats, 'vocab', ALL_WORDS.map((x) => x.w));
    for (const w of recent) if (weights[w] !== undefined) weights[w] *= RECENT_WEIGHT;
    // Words still being learned: missed more than one time in four. A word
    // leaves once it is mostly got right, instead of staying after one miss.
    const { items } = gameEntry(stats, 'vocab');
    const review = new Set(Object.entries(items).filter(([, v]) => v.seen - v.correct > v.seen / 4).map(([k]) => k));
    const rounds = buildVocabRounds(data, { seed: `${Date.now()}`, type: prefs.type, level: prefs.level, count: practiceLength, weights, review });
    setGame({ rounds, index: 0, picked: [], results: [] });
  };

  if (!game) {
    const weak = weakestItems(stats, 'vocab', 8);
    return (
      <GameSetup title="Word play" section="words" onExit={onExit}>
        <section className="vp-mode">
          <h3>Practise</h3>
          <p className="setup-record">
            Every answer shows what each word means and its whole family, and words you miss come back more often.
            {entry.plays ? ` ${entry.plays} played · best ${entry.bestPct}%.` : ''}
          </p>
          <SetupRow label="Kind">
            {Object.entries(TYPE_LABEL).map(([k, label]) => (
              <Chip key={k} active={prefs.type === k} onClick={() => setPrefs({ ...prefs, type: k })}>{label}</Chip>
            ))}
          </SetupRow>
          <SetupRow label="Level">
            {Object.entries(LEVEL_LABEL).map(([k, label]) => (
              <Chip key={k} active={prefs.level === k} onClick={() => setPrefs({ ...prefs, level: k })}>{label}</Chip>
            ))}
          </SetupRow>
          <SetupRow label="Length">
            {PRACTICE_LENGTHS.map((n) => (
              <Chip key={n} active={practiceLength === n} onClick={() => setPrefs({ ...prefs, practiceLength: n })}>{n} rounds</Chip>
            ))}
          </SetupRow>
          <Button variant="primary" className="game-start" onClick={start}>Start practice</Button>
        </section>
        <section className="vp-mode">
          <h3>Test</h3>
          <p className="setup-record">
            Questions get harder as you get them right, and answers are shown at the end. Gives you a level based on how
            rare the words you know are; the longer test is more precise.
            {history.length ? ` Last test: ${formatLevel(history[history.length - 1].level, BOUNDS)}.` : ''}
          </p>
          <SetupRow label="Length">
            {TEST_LENGTHS.map((n) => (
              <Chip key={n} active={testLength === n} onClick={() => setPrefs({ ...prefs, testLength: n })}>{n} questions</Chip>
            ))}
          </SetupRow>
          <Button variant="secondary" className="game-start" onClick={startTest}>Start test</Button>
        </section>
        {weak.length > 0 && (
          <div className="vp-weak">
            <h3 className="eyebrow">Your tricky words</h3>
            {weak.map((x) => (
              <AnswerRow key={x.key} state="missed" trail={`${x.correct}/${x.seen}`}>
                <strong>{x.key}</strong>: {DEF.get(x.key)}
              </AnswerRow>
            ))}
          </div>
        )}
      </GameSetup>
    );
  }

  const { rounds, index, picked, results } = game;
  const score = results.filter((r) => r.correct).length;

  if (index >= rounds.length) {
    return (
      <GameResults
        data-section="words"
        eyebrow="Word play"
        score={score}
        total={rounds.length}
        verdict={verdictFor(score, rounds.length)}
        squares={results.map((x) => x.correct)}
        onPlayAgain={start}
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {rounds.map((r, i) => (
          <AnswerRow key={r.id} state={results[i].correct ? 'got' : 'missed'}>
            <strong>{r.target}</strong>: {DEF.get(r.target)}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const r = rounds[index];
  const done = results.length > index;
  const info = done ? explainRound(r, data) : null;

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
    onSeen(r.options.concat(r.target));
    const next = [...results, { picked: sel, correct }];
    setGame({ ...game, picked: sel, results: next });
    if (next.length === rounds.length) {
      onRoundComplete('vocab', { score: next.filter((x) => x.correct).length, total: rounds.length, answers: [] });
    }
  }

  return (
    <GameCard data-section="words">
      <PlayHead left={`Round ${index + 1} of ${rounds.length} · ${TYPE_LABEL[r.type]}`}>
        <Pill variant="accent">{score} right</Pill>
      </PlayHead>

      <Ask>{ask(r)}</Ask>
      <OptionGrid>
        {r.options.map((w, i) => {
          let state = picked.includes(w) ? 'selected' : 'idle';
          if (done) state = r.answer.includes(w) ? 'correct' : picked.includes(w) ? 'wrong' : 'dim';
          return (
            <Option key={w} letter={'ABCDEFGH'[i]} pressable={r.pick > 1 && !done} state={state} disabled={done} onClick={() => toggle(w)}>
              {w}
            </Option>
          );
        })}
      </OptionGrid>

      {!done && r.pick > 1 && (
        <div className="play-grade">
          <Button variant="primary" disabled={picked.length !== r.pick} onClick={() => submit(picked)}>
            Check ({picked.length}/{r.pick})
          </Button>
        </div>
      )}

      {done && (
        <div className="vp-reveal">
          <ul className="vp-defs">
            {info.options.map((o) => (
              <li key={o.word} data-right={o.right ? 'true' : 'false'}>
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
          <Button variant="primary" className="next-btn" autoFocus onClick={() => setGame({ ...game, index: index + 1, picked: [] })}>
            {index < rounds.length - 1 ? 'Next' : 'Results'} <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      )}
    </GameCard>
  );
}
