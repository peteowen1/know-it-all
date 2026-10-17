import React from 'react';
import { Award, Check, Compass, Flame, Hash, Library, ScrollText, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { CATEGORY_LIST, DIFFICULTIES } from '../data/categories';
import { formatIntervals, INTERVALS, GRADUATED_BOX } from '../lib/scheduler';
import { Card, CategoryIcon, Pill } from './ui';
import ProgressTransfer from './ProgressTransfer';

const pct = (correct, total) => (total ? Math.round((correct / total) * 100) : 0);
const fmt = (n) => n.toLocaleString('en-AU');

// Fewer answers than this and a percentage says nothing; show "not enough yet".
const MIN_FOR_RATE = 3;

function Meter({ value, max, label }) {
  return (
    <div className="meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <div className="meter-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function RateRow({ icon, label, hint, correct, total }) {
  const enough = total >= MIN_FOR_RATE;
  const accuracy = pct(correct, total);
  return (
    <li className="rate-row">
      <div className="rate-head">
        <span className="rate-label">
          {icon}
          {label}
          {hint && <span className="rate-hint">{hint}</span>}
        </span>
        <span className={`rate-value ${enough ? '' : 'rate-value--none'}`}>
          {enough ? `${accuracy}% (${correct}/${total})` : 'not enough yet'}
        </span>
      </div>
      {enough && <Meter value={accuracy} max={100} label={`${label} accuracy`} />}
    </li>
  );
}

export default function AnalyticsDashboard({
  stats,
  bankStats,
  vaultSummary,
  seenCount,
  totalBank,
  profile,
  onImport
}) {
  const weaknessCount = vaultSummary?.total ?? 0;
  const categoryStats = stats.categoryStats || {};
  const difficultyStats = stats.difficultyStats || {};
  const answered = stats.totalAnswered || 0;
  const accuracyNow = stats.overallAccuracy || 0;

  const breakdown = CATEGORY_LIST.map((cat) => {
    const d = categoryStats[cat.id] || { total: 0, correct: 0 };
    return { ...cat, ...d, accuracy: pct(d.correct, d.total), bankCount: bankStats?.byCategory?.[cat.id] || 0 };
  });

  // Only recommend a focus once there is enough data for the number to mean
  // anything. A single wrong answer is not a weakness.
  const rated = breakdown.filter((c) => c.total >= 5);
  const weakest = [...rated].sort((a, b) => a.accuracy - b.accuracy)[0];
  const strongest = [...rated].sort((a, b) => b.accuracy - a.accuracy)[0];
  const unexplored = breakdown.filter((c) => c.total === 0);

  // Each milestone says how far along it is. `ratio` is null when a bar would mislead.
  const halfBank = Math.floor(totalBank / 2);
  const milestones = [
    {
      title: 'First round', desc: 'Finish one quiz', Glyph: ScrollText,
      unlocked: stats.totalQuizzes >= 1,
      ratio: (stats.totalQuizzes || 0) / 1, text: `${Math.min(stats.totalQuizzes || 0, 1)}/1`
    },
    {
      title: 'Week of it', desc: 'Seven day streak', Glyph: Flame,
      unlocked: stats.streak >= 7,
      ratio: (stats.streak || 0) / 7, text: `${Math.min(stats.streak || 0, 7)}/7 days`
    },
    {
      title: 'Century', desc: 'Answer 100 questions', Glyph: Hash,
      unlocked: answered >= 100,
      ratio: answered / 100, text: `${Math.min(answered, 100)}/100`
    },
    {
      title: 'Half the bank', desc: `See ${fmt(halfBank)} different questions`, Glyph: Library,
      unlocked: seenCount >= totalBank / 2,
      ratio: seenCount / (totalBank / 2), text: `${fmt(Math.min(seenCount, halfBank))}/${fmt(halfBank)}`
    },
    {
      // Two conditions: 100 answers first, then 80% across them.
      title: 'Sharp', desc: '80% overall accuracy over 100+ questions', Glyph: Target,
      unlocked: answered >= 100 && accuracyNow >= 80,
      ratio: answered < 100 ? answered / 100 : accuracyNow / 80,
      text: answered < 100 ? `${answered}/100 answered` : `${accuracyNow}% of 80%`
    },
    {
      title: 'Vault cleared', desc: 'Empty the weakness vault after answering 100+', Glyph: ShieldCheck,
      unlocked: answered >= 100 && weaknessCount === 0,
      ratio: answered < 100 ? answered / 100 : null,
      text: answered < 100 ? `${answered}/100 answered` : `${weaknessCount} left in the vault`
    }
  ];

  return (
    <div className="analytics quiz-screen" data-section="weekend">
      <div className="screen-head">
        <h2>Progress</h2>
        <p>Where you are strong, where you are not, and what to drill next.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-tile">
          <span className="stat-icon"><Target size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          <div>
            <span className="stat-value">{fmt(stats.totalQuizzes || 0)}</span>
            <span className="stat-title">Rounds completed</span>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><Flame size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          <div>
            <span className="stat-value">{fmt(stats.streak || 0)}</span>
            <span className="stat-title">Day streak</span>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><TrendingUp size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          <div>
            <span className="stat-value">{accuracyNow}%</span>
            <span className="stat-title">Overall accuracy</span>
          </div>
        </div>
        <div className="stat-tile">
          <span className="stat-icon"><Award size={20} strokeWidth={1.75} aria-hidden="true" /></span>
          <div>
            <span className="stat-value">{fmt(seenCount)} of {fmt(totalBank)}</span>
            <span className="stat-title">Questions seen</span>
          </div>
        </div>
      </div>

      {weakest && strongest && weakest.id !== strongest.id && (
        <div className="note note--focus">
          <CategoryIcon id={weakest.id} size={22} className="note-icon" aria-hidden="true" />
          <div>
            <h3>Drill next: {weakest.name}</h3>
            <p>
              You are on {weakest.accuracy}% there ({weakest.correct}/{weakest.total}) against{' '}
              {strongest.accuracy}% in {strongest.name}. That gap is {strongest.accuracy - weakest.accuracy}{' '}
              points, and closing it is worth more than anything else you could practise.
            </p>
          </div>
        </div>
      )}

      {unexplored.length > 0 && stats.totalQuizzes > 0 && (
        <div className="note">
          <Compass size={22} className="note-icon" aria-hidden="true" />
          <div>
            <h3>Not touched yet</h3>
            <p>
              {unexplored.map((c) => c.name).join(', ')}: no answers yet. Run a focused round before
              trusting the numbers above.
            </p>
          </div>
        </div>
      )}

      <Card className="rates">
        <h3>By category</h3>
        <ul className="rate-list">
          {breakdown.map((cat) => (
            <RateRow
              key={cat.id}
              icon={<CategoryIcon id={cat.id} size={18} aria-hidden="true" />}
              label={cat.name}
              correct={cat.correct}
              total={cat.total}
            />
          ))}
        </ul>
      </Card>

      <Card className="rates">
        <h3>By difficulty</h3>
        <ul className="rate-list">
          {DIFFICULTIES.map((d) => {
            const s = difficultyStats[d.id] || { total: 0, correct: 0 };
            return <RateRow key={d.id} label={d.label} hint={d.hint} correct={s.correct} total={s.total} />;
          })}
        </ul>
      </Card>

      {vaultSummary?.total > 0 && (
        <div className="note">
          <ShieldCheck size={22} className="note-icon" aria-hidden="true" />
          <div>
            <h3>
              {vaultSummary.due > 0
                ? `${vaultSummary.due} question${vaultSummary.due === 1 ? '' : 's'} due for revision`
                : 'Nothing due for revision right now'}
            </h3>
            <p>
              {vaultSummary.total} tracked in the vault
              {vaultSummary.struggling > 0 && `, ${vaultSummary.struggling} missed more than once`}.
              Questions return after {formatIntervals(INTERVALS)}. Clear all {GRADUATED_BOX} stages and
              they leave for good.
            </p>
          </div>
        </div>
      )}

      {profile && onImport && <ProgressTransfer profile={profile} onImport={onImport} />}

      <section aria-labelledby="milestones-title">
        <h3 id="milestones-title" className="milestones-title">Milestones</h3>
        <ul className="milestones">
          {milestones.map(({ title, desc, Glyph, unlocked, ratio, text }) => (
            <li key={title} className="milestone" data-done={unlocked}>
              <span className="milestone-icon"><Glyph size={20} strokeWidth={1.75} aria-hidden="true" /></span>
              <div className="milestone-body">
                <h4>{title}</h4>
                <p>{desc}</p>
                {unlocked ? (
                  <Pill variant="correct"><Check size={12} aria-hidden="true" /> Done</Pill>
                ) : (
                  <div className="milestone-progress">
                    {ratio !== null && <Meter value={ratio} max={1} label={`${title} progress`} />}
                    <span className="milestone-fraction">{text}</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
