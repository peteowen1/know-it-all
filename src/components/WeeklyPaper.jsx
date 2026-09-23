import React, { useMemo } from 'react';
import { Newspaper, Play, RotateCcw } from 'lucide-react';
import QuizSimulator from './QuizSimulator';
import { buildWeeklyPaper, WEEKLY_SHAPE } from '../lib/quizBuilder';
import { saturdayKey, addDaysToKey } from '../lib/dates';
import { usePersistentState } from '../lib/persist';

const PAST_WEEKS = 4;

const pretty = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The Saturday paper: one 25-question quiz a week, the same for everyone,
 * ramping from warm-ups to the hard end. This week's paper plus the last four
 * stay playable; your first score on each is kept (replays do not overwrite
 * it, the same as doing the real quiz twice).
 */
export default function WeeklyPaper({ scores, onPaperDone, onComplete, onMissed, onCorrect }) {
  const thisWeek = saturdayKey();
  const weeks = useMemo(
    () => Array.from({ length: PAST_WEEKS + 1 }, (_, i) => addDaysToKey(thisWeek, -7 * i)),
    [thisWeek]
  );
  // Saved so the round survives the app being closed (see src/lib/persist.js).
  // runId tells a replay apart from the saved run, so Replay starts fresh.
  const [open, setOpen] = usePersistentState('weekly_open', null); // week key being played
  const [runId, setRunId] = usePersistentState('weekly_run', 0);
  const paper = useMemo(() => (open ? buildWeeklyPaper(open) : null), [open]);

  if (paper) {
    const first = scores[open];
    // A replay is practice: it must not count again towards quiz totals, the
    // streak or the vault, or replaying a paper would inflate all three.
    const counts = !first;
    return (
      <QuizSimulator
        key={`weekly-${open}-${runId}`}
        questions={paper.questions}
        seed={paper.seed}
        saveAs="weekly"
        saveId={`${open}:${runId}`}
        title={`The Saturday paper · ${pretty(open)}`}
        subtitle={
          first
            ? `You scored ${first.score}/${first.total} on this paper first time round. This replay will not change it.`
            : `${WEEKLY_SHAPE.easy} warm-ups, ${WEEKLY_SHAPE.medium} middle-order, ${WEEKLY_SHAPE.hard} hard ones to finish. Same paper for everyone this week.`
        }
        onComplete={(result) => {
          if (counts) onComplete(result);
          onPaperDone(open, result);
        }}
        onMissed={counts ? onMissed : undefined}
        onCorrect={counts ? onCorrect : undefined}
        onNewQuiz={() => setOpen(null)}
      />
    );
  }

  return (
    <div className="card game-setup">
      <div className="game-setup-head">
        <h2><Newspaper size={22} /> The Saturday paper</h2>
      </div>
      <p className="game-record">
        Twenty-five questions, easy to hard, the same for everyone. A new paper every Saturday. Switch between
        multiple choice and reveal-and-mark during the quiz.
      </p>
      <div className="paper-list">
        {weeks.map((w) => {
          const s = scores[w];
          return (
            <div key={w} className={`paper-row ${w === thisWeek ? 'current' : ''}`}>
              <div>
                <strong>{w === thisWeek ? 'This week' : pretty(w)}</strong>
                <span>{w === thisWeek ? pretty(w) : ''}</span>
              </div>
              <span className="paper-score">{s ? `${s.score}/${s.total}` : '—'}</span>
              <button
                className={`btn ${s ? 'btn-ghost' : 'btn-primary'}`}
                onClick={() => {
                  setRunId((r) => r + 1);
                  setOpen(w);
                }}
              >
                {s ? <><RotateCcw size={16} /> Replay</> : <><Play size={16} /> Start</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
