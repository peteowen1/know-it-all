import React, { useMemo } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import QuizSimulator from './QuizSimulator';
import { Button, Card, Pill } from './ui';
import { buildWeeklyPaper, WEEKLY_SHAPE } from '../lib/quizBuilder';
import { saturdayKey, addDaysToKey } from '../lib/dates';
import { usePersistentState } from '../lib/persist';
import { HowButton, HowPanel } from '../games/shared/HowItWorks';

const PAST_WEEKS = 4;

const pretty = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const prettyShort = (key) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

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
    <Card className="weekly quiz-screen" data-section="weekend">
      <div className="screen-head">
        <div className="screen-title-row">
          <h2>The Saturday paper</h2>
          <HowButton />
        </div>
        <p>
          Twenty-five questions, easy to hard, the same for everyone. A new paper every Saturday.
          Switch between multiple choice and Recall during the quiz.
        </p>
      </div>
      <HowPanel />
      <ul className="weekly-list">
        {weeks.map((w) => {
          const s = scores[w];
          const isCurrent = w === thisWeek;
          // The current week gets the label plus the date; older weeks are just the date.
          return (
            <li key={w} className="weekly-row" data-current={isCurrent}>
              <div className="weekly-when">
                <strong>{isCurrent ? 'This week' : prettyShort(w)}</strong>
                {isCurrent && <span className="weekly-date">{prettyShort(w)}</span>}
                <Pill variant={s ? 'accent' : 'neutral'}>{s ? `${s.score}/${s.total}` : 'not yet'}</Pill>
              </div>
              <Button
                variant={!s && isCurrent ? 'primary' : 'secondary'}
                aria-label={`${s ? 'Replay' : 'Start'} the paper for ${pretty(w)}`}
                onClick={() => {
                  setRunId((r) => r + 1);
                  setOpen(w);
                }}
              >
                {s ? <><RotateCcw size={16} aria-hidden="true" /> Replay</> : <><Play size={16} aria-hidden="true" /> Start</>}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
