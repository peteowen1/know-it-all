import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { subscribe, getEmail } from '../lib/sync';
import { Chip } from './ui';
import { formatClock } from '../lib/roundClock';
import { boardKey, getBoard, getInvites, getProfile, openFriends, roundDay, roundPosted, thisWeek } from '../lib/boards';

/**
 * The leaderboard under a finished round's time: you against your friends, a
 * group, or everyone who opted in, for that day (daily rounds), this week or
 * all time. Each person's best: more points, then less time. Friends' and
 * groups' boards use time on screen; the public board uses time that never
 * pauses (docs/plans/LEADERBOARDS.md).
 */
export default function BoardPanel({ time }) {
  const day = roundDay(time.roundId);
  const periods = [...(day ? [[`day:${day}`, 'That day']] : []), [`week:${thisWeek()}`, 'This week'], ['all', 'All time']];
  const [period, setPeriod] = useState(periods[0][0]);
  const [scope, setScope] = useState('friends');
  const [scopes, setScopes] = useState([['friends', 'Friends']]);
  const [state, setState] = useState({ loading: true });
  const email = useSyncExternalStore(subscribe, getEmail);

  // Groups you are in, and the public board if you opted in.
  useEffect(() => {
    if (!email) return undefined;
    let live = true;
    Promise.all([getInvites(), getProfile()])
      .then(([inv, profile]) => {
        if (!live) return;
        setScopes([
          ['friends', 'Friends'],
          ...inv.groups.map((g) => [`group:${g.code}`, g.name]),
          ...(profile.public ? [['public', 'Everyone']] : [])
        ]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [email]);

  useEffect(() => {
    if (!email) return undefined;
    let live = true;
    setState({ loading: true });
    // Wait for this round's own post, so it is on the board it opens.
    roundPosted(time.roundId)
      .then(() => getBoard(boardKey(time.board), period, scope))
      .then((b) => live && setState({ rows: b.rows }))
      .catch((err) => live && setState({ error: err.message }));
    return () => {
      live = false;
    };
  }, [email, time.roundId, time.board, period, scope]);

  if (!email) {
    return <p className="board-note">Sign in (top right) to see how this stacks up against your friends.</p>;
  }

  return (
    <section className="board-panel" aria-label="Leaderboard">
      <div className="board-tabs">
        {scopes.map(([id, label]) => (
          <Chip key={id} active={scope === id} onClick={() => setScope(id)}>{label}</Chip>
        ))}
      </div>
      <div className="board-tabs">
        {periods.map(([id, label]) => (
          <Chip key={id} active={period === id} onClick={() => setPeriod(id)}>{label}</Chip>
        ))}
      </div>
      {state.loading && <p className="board-note">Loading…</p>}
      {state.error && <p className="board-note">{state.error}</p>}
      {state.rows && (
        <ol className="board-rows">
          {state.rows.slice(0, 10).map((r) => (
            <li key={r.rank} data-me={r.me || undefined}>
              <span className="board-rank">{r.rank}</span>
              <span className="board-name">{r.nickname}{r.late ? <em> · late</em> : null}</span>
              <span className="board-score">{r.score}{r.total ? ` / ${r.total}` : ''}</span>
              <span className="board-time">{formatClock(r.ms)}</span>
            </li>
          ))}
          {state.rows.length > 10 && state.rows.find((r) => r.me && r.rank > 10) && (() => {
            const r = state.rows.find((x) => x.me);
            return (
              <li data-me>
                <span className="board-rank">{r.rank}</span>
                <span className="board-name">{r.nickname}</span>
                <span className="board-score">{r.score}{r.total ? ` / ${r.total}` : ''}</span>
                <span className="board-time">{formatClock(r.ms)}</span>
              </li>
            );
          })()}
        </ol>
      )}
      {state.rows && state.rows.length <= 1 && scope === 'friends' && (
        <p className="board-note">Just you so far. <button type="button" className="link-button" onClick={openFriends}>Add friends</button> to compare.</p>
      )}
      {state.rows && state.rows.length > 1 && (
        <p className="board-note"><button type="button" className="link-button" onClick={openFriends}>Friends and groups</button></p>
      )}
    </section>
  );
}
