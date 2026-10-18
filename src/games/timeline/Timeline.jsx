import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import data from '../../data/timeline.json';
import { buildRound, scoreOrder } from './timelineLogic';
import { localDateKey } from '../../lib/dates';
import { useDay, daysOwn, clearDay } from '../../lib/day';
import { gameEntry } from '../../lib/gameStats';
import { usePersistentState } from '../../lib/persist';
import { dailyShare } from '../../lib/share';
import { AnswerRow, Button, Chip, GameBoard, GameResults, SetupRow, EarlierDays } from '../../components/ui';
import { GameSetup } from '../shared/Play';
import { verdictFor } from '../shared/verdict';
import KindIcon from '../shared/KindIcon';

/**
 * Timeline: put five events in order, oldest at the top. Scored on how many of
 * the ten pairs are the right way round, so a near-miss still scores.
 */
export default function Timeline({ stats, onRoundComplete, onExit }) {
  const [difficulty, setDifficulty] = useState('easy');
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  const [round, setRound] = usePersistentState('timeline', null);
  // An earlier day's board when the address asks for one (?day=, src/lib/day.js).
  const day = useDay();
  const entry = gameEntry(stats, 'timeline');

  const start = (daily) => {
    // A random round is not tied to a day, so it leaves the earlier day's address.
    if (!daily) clearDay();
    const date = daily ? day || localDateKey() : localDateKey();
    const seed = daily ? `${date}:${difficulty}` : `${Date.now()}`;
    setRound({ daily, date, order: buildRound(data.events, { difficulty, seed }), checked: false });
  };

  if (!round || (day && !(round.daily && round.date === day))) {
    return (
      <GameSetup
        title="Timeline"
        section="lab"
        onExit={onExit}
        record={
          <>
            Five events. Put them in order, oldest at the top. Every pair you have the right way round scores.
            {entry.plays ? ` ${entry.plays} played · best ${entry.bestPct}%.` : ''}
          </>
        }
        note={`${data.events.length} events: number-one songs and films, Best Picture and Emmy winners, leaders taking office, and famous births.`}
      >
        <SetupRow
          label="Difficulty"
          caption={difficulty === 'easy' ? 'The five years are well apart.' : 'All five events fall within 12 years of each other.'}
        >
          <Chip active={difficulty === 'easy'} onClick={() => setDifficulty('easy')}>Easy: years well apart</Chip>
          <Chip active={difficulty === 'hard'} onClick={() => setDifficulty('hard')}>Hard: all within 12 years</Chip>
        </SetupRow>
        <EarlierDays day={day} />
        <div className="setup-actions">
          <Button variant="primary" icon="CalendarDays" onClick={() => start(true)}>{daysOwn(day)} timeline</Button>
          <Button variant="secondary" icon="Shuffle" onClick={() => start(false)}>Random</Button>
        </div>
      </GameSetup>
    );
  }

  const { order, checked } = round;
  const move = (i, d) => {
    const j = i + d;
    if (checked || j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setRound({ ...round, order: next });
  };
  const check = () => {
    const s = scoreOrder(order);
    setRound({ ...round, checked: true, score: s });
    onRoundComplete('timeline', { score: s.correct, total: s.total, answers: [] });
  };
  const truth = [...order].sort((a, b) => a.year - b.year);

  const title = round.daily ? `${daysOwn(round.date === localDateKey() ? null : round.date)} timeline` : 'Timeline';

  if (checked) {
    const { correct, total } = round.score;
    return (
      <GameResults
        data-section="lab"
        eyebrow={`${title} · pairs the right way round`}
        hero={`${correct} / ${total} pairs`}
        score={correct}
        total={total}
        verdict={
          correct <= 1
            ? 'Looks like newest-first. Oldest goes at the top; flipped, that would be ' + (total - correct) + '/' + total + '.'
            : verdictFor(correct, total)
        }
        squares={order.map((e, i) => truth[i] === e)}
        celebrate={correct === total}
        onPlayAgain={() => start(false)}
        share={round.daily ? dailyShare('Timeline', 'timeline', round.date) : undefined}
        playAgainLabel="Another"
        onChangeSettings={() => setRound(null)}
      >
        <h3 className="eyebrow">Right order</h3>
        <ol className="tl-list">
          {truth.map((e, i) => (
            <AnswerRow key={e.text} as="li" state={order[i] === e ? 'got' : 'missed'} lead={<strong>{e.year}</strong>}>
              <span className="tl-text">{e.text}</span>
            </AnswerRow>
          ))}
        </ol>
      </GameResults>
    );
  }

  return (
    <GameBoard
      data-section="lab"
      title={title}
      subtitle="Oldest at the top"
      footer={<Button variant="primary" onClick={check}>Check order</Button>}
    >
      {/* Direction labels on the list itself: a note in the corner was missed,
          and a fully reversed order scores 1 of 10 with no clue why. */}
      <p className="tl-end"><ArrowUp size={14} aria-hidden="true" /> Oldest</p>
      <ol className="tl-list">
        {order.map((e, i) => (
          <AnswerRow
            key={e.text}
            as="li"
            lead={<KindIcon kind={e.kind} />}
            trail={
              <span className="tl-moves">
                <button type="button" className="tl-move" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move earlier: ${e.text}`}><ArrowUp size={18} aria-hidden="true" /></button>
                <button type="button" className="tl-move" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move later: ${e.text}`}><ArrowDown size={18} aria-hidden="true" /></button>
              </span>
            }
          >
            <span className="tl-text">{e.text}</span>
          </AnswerRow>
        ))}
      </ol>
      <p className="tl-end"><ArrowDown size={14} aria-hidden="true" /> Newest</p>
    </GameBoard>
  );
}
