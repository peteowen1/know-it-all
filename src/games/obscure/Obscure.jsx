import React from 'react';
import data from '../../data/obscure.json';
import { pickCategories, scoreGuess, ROUNDS } from './obscureLogic';
import { localDateKey } from '../../lib/dates';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { AnswerRow, Button, GameCard, GameResults, Pill, TextInput } from '../../components/ui';
import { GameSetup, NextBar, PlayHead, Prompt } from '../shared/Play';
import KindIcon from '../shared/KindIcon';

/**
 * Obscure-est: one answer per category, any right answer scores, rarer right
 * answers score more (1 for the one everyone gives, 100 for the deepest cut).
 * After each answer the rarest and the most obvious answers are shown, which
 * is where the learning is.
 */
export default function Obscure({ stats, onRoundComplete, onExit }) {
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [game, setGame] = usePersistentState('obscure', null);
  const entry = gameEntry(stats, 'pointless');

  const start = (daily) => {
    const seed = daily ? localDateKey() : `${Date.now()}`;
    setGame({ daily, cats: pickCategories(data.categories, seed), index: 0, results: [], input: '', note: null });
  };

  if (!game) {
    return (
      <GameSetup
        title="Obscure-est"
        section="lab"
        onExit={onExit}
        record={
          <>
            One answer per category. Any right answer scores; the rarer it is, the more it scores, up to 100. Wrong
            scores nothing. {ROUNDS} categories.
            {entry.plays ? ` ${entry.plays} played · best ${entry.best}/${ROUNDS * 100}.` : ''}
          </>
        }
        note="Rarity is measured: population for countries and capitals, Wikipedia readership for people, chart points for songs and box office for films. A small country you know well can still score high."
      >
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>Today's five</Button>
          <Button variant="secondary" icon="Shuffle" onClick={() => start(false)}>Random</Button>
        </div>
      </GameSetup>
    );
  }

  const { cats, index, results } = game;
  const total = results.reduce((s, r) => s + r.score, 0);

  if (index >= cats.length) {
    return (
      <GameResults
        data-section="lab"
        eyebrow="Obscure-est"
        score={total}
        total={cats.length * 100}
        verdict={total >= cats.length * 60 ? 'Deep cuts. Very few people know these.' : total > 0 ? 'Some right answers, mostly the obvious ones.' : 'Nothing on the list this time.'}
        squares={results.map((x) => x.score > 0)}
        celebrate={false}
        onPlayAgain={() => start(false)}
        playAgainLabel="Another five"
        onChangeSettings={() => setGame(null)}
        settingsLabel="Back"
      >
        {cats.map((c, i) => (
          <AnswerRow
            key={c.id}
            state={results[i].score >= 70 ? 'got' : results[i].score > 0 ? 'pending' : 'missed'}
            trail={results[i].answer ? `${results[i].answer.text} · ${results[i].score}` : `"${results[i].guess}" · 0`}
          >
            {c.prompt}
          </AnswerRow>
        ))}
      </GameResults>
    );
  }

  const cat = cats[index];
  const done = results.length > index;
  const res = done ? results[index] : null;

  const submit = (e) => {
    e.preventDefault();
    const guess = game.input.trim();
    if (done || !guess) return;
    const r = scoreGuess(cat, guess);
    // Ambiguous is not an answer yet: ask for more rather than score it 0.
    if (r.ambiguous) {
      setGame({ ...game, note: 'That matches more than one answer here. Be more specific.' });
      return;
    }
    const next = [...results, { ...r, guess }];
    setGame({ ...game, results: next, note: null });
    if (next.length === cats.length) {
      onRoundComplete('pointless', { score: next.reduce((s, x) => s + x.score, 0), total: cats.length * 100, answers: [] });
    }
  };

  return (
    <GameCard data-section="lab">
      <PlayHead left={`Category ${index + 1} of ${cats.length}`}>
        <Pill variant="accent">{total} pts</Pill>
      </PlayHead>
      <Prompt className="chart-prompt">
        <span className="play-kind"><KindIcon kind={cat.kind} set="obscure" size={24} /></span> {cat.prompt}
      </Prompt>
      <p className="setup-caption">{cat.answers.length} right answers on the list.</p>

      {!done ? (
        <form className="board-form" onSubmit={submit}>
          <TextInput
            autoFocus
            value={game.input}
            onChange={(e) => setGame({ ...game, input: e.target.value, note: null })}
            placeholder="Your answer…"
            label="Your answer"
          />
          <Button variant="primary" type="submit" disabled={!game.input.trim()}>Answer</Button>
        </form>
      ) : (
        <>
          <p className="play-verdict" data-tone={res.score >= 70 ? 'good' : res.score > 0 ? 'meh' : 'bad'} role="status">
            {res.answer ? `${res.answer.text}: ${res.score} point${res.score === 1 ? '' : 's'}` : `"${res.guess}" is not on the list: 0`}
          </p>
          <div className="obs-reveal">
            <div>
              <span className="eyebrow">Rarest</span>
              {cat.answers.slice(-4).reverse().map((a) => <span key={a.text}>{a.text} <em>{a.score} pts</em></span>)}
            </div>
            <div>
              <span className="eyebrow">Most obvious</span>
              {cat.answers.slice(0, 4).map((a) => <span key={a.text}>{a.text} <em>{a.score} pts</em></span>)}
            </div>
          </div>
          <NextBar onClick={() => setGame({ ...game, index: index + 1, input: '' })}>
            {index < cats.length - 1 ? 'Next category' : 'Results'}
          </NextBar>
        </>
      )}
      {game.note && <p className="game-board-msg" role="status">{game.note}</p>}
    </GameCard>
  );
}
