#!/usr/bin/env node
// Drives the real Worker (worker/index.js) against a throwaway local D1 to
// test the leaderboard endpoints end to end: nicknames, posting results,
// boards by period and scope, friends, groups, public opt-in and Reset.
// Run with `npm run test:worker` (not part of `npm test`: it starts workerd).

import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import worker from '../worker/index.js';
import { mondayOf } from '../worker/boards.js';

const ROOT = new URL('..', import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'kia-d1-'));
const { env, dispose } = await getPlatformProxy({ configPath: new URL('wrangler.toml', ROOT).pathname.replace(/^\/(\w:)/, '$1'), persist: { path: dir } });

let failures = 0;
const test = async (name, fn) => {
  try {
    await fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    failures++;
    console.error(`  x ${name}\n    ${err.message}`);
  }
};

try {
  // Migrations, as wrangler applies them. Comments go first: they hold semicolons.
  for (const f of ['0001_init.sql', '0002_kv_writes.sql', '0003_boards.sql']) {
    const text = readFileSync(new URL(`worker/migrations/${f}`, ROOT), 'utf8').replace(/--.*$/gm, '');
    for (const q of text.split(';').map((x) => x.trim()).filter(Boolean)) await env.DB.prepare(q).run();
  }

  const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const people = {};
  for (const [name, given] of [['ann', 'Ann'], ['bob', 'Bob'], ['cat', null], ['dan', 'Dan']]) {
    await env.DB.prepare('INSERT INTO users (sub, email, given_name, created_at) VALUES (?, ?, ?, ?)').bind(name, `${name}@x.test`, given, Date.now()).run();
    await env.DB.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').bind(await sha(`tok-${name}`), name, Date.now(), Date.now() + 1e10).run();
    people[name] = `tok-${name}`;
  }
  const call = async (who, method, path, body) => {
    const headers = { Origin: 'https://quiz.test', 'Content-Type': 'application/json' };
    if (who) headers.Cookie = `kia_session=${people[who]}`;
    const r = await worker.fetch(new Request(`https://quiz.test/api/${path}`, { method, headers, body: body && JSON.stringify(body) }), env, {});
    return { status: r.status, body: await r.json() };
  };
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let n = 0;
  const post = (who, extra) => call(who, 'POST', 'results', { roundId: `round-${who}-${++n}xx`, board: 'clue-ladder:daily', day: today, date: today, score: 10, total: 20, activeMs: 60000, wallMs: 90000, ...extra });
  const board = (who, q) => call(who, 'GET', `boards?board=clue-ladder:daily&${q}`);

  await test('signed out gets 401', async () => {
    assert.equal((await call(null, 'GET', 'profile')).status, 401);
  });

  await test('profile: nickname defaults to the Google first name, or Player', async () => {
    const a = await call('ann', 'GET', 'profile');
    assert.equal(a.body.nickname, 'Ann');
    assert.equal(a.body.public, false);
    assert.match(a.body.friendCode, /^[A-Z2-9]{8}$/);
    assert.equal((await call('ann', 'GET', 'profile')).body.friendCode, a.body.friendCode, 'one friend code each');
    assert.equal((await call('cat', 'GET', 'profile')).body.nickname, 'Player');
  });

  await test('profile: nickname rules and the public switch', async () => {
    assert.equal((await call('cat', 'PUT', 'profile', { nickname: 'Cat the Great' })).body.nickname, 'Cat the Great');
    assert.equal((await call('cat', 'PUT', 'profile', { nickname: '' })).status, 400);
    assert.equal((await call('cat', 'PUT', 'profile', { nickname: '<script>' })).status, 400);
    assert.equal((await call('cat', 'PUT', 'profile', { nickname: 'x'.repeat(25) })).status, 400);
    assert.equal((await call('dan', 'PUT', 'profile', { public: true })).body.public, true);
    assert.equal((await call('dan', 'PUT', 'profile', { public: 'yes' })).status, 400);
  });

  await test('results: stored once per round id; bad input refused', async () => {
    const r = await post('ann', { roundId: 'fixed-round-1' });
    assert.equal(r.body.stored, true);
    assert.equal((await post('ann', { roundId: 'fixed-round-1', score: 20 })).body.stored, false, 'a second post of the same round changes nothing');
    assert.equal((await post('ann', { roundId: 'bad id' })).status, 400);
    assert.equal((await post('ann', { date: '2001-01-01' })).status, 400, 'a date far from today');
    assert.equal((await post('ann', { activeMs: 5000, wallMs: 1000 })).status, 400, 'wall time shorter than active time');
    assert.equal((await post('ann', { score: -1 })).status, 400);
    assert.equal((await post('ann', { board: 'x'.repeat(130) })).status, 400);
    assert.equal((await post('ann', { roundId: ['abcdefghij'] })).status, 400, 'a non-string is a 400, not a 500');
  });

  await test('results: an earlier day played today is marked late', async () => {
    const r = await post('bob', { day: yesterday, score: 20 });
    assert.equal(r.body.late, true);
  });

  await test('friends board: only you until you add someone', async () => {
    const rows = (await board('bob', `period=day:${today}&scope=friends`)).body.rows;
    assert.deepEqual(rows.map((r) => r.nickname), []);
    await post('bob', { score: 15, activeMs: 50000 });
    await post('bob', { score: 15, activeMs: 40000 });
    const mine = (await board('bob', `period=day:${today}&scope=friends`)).body.rows;
    assert.equal(mine.length, 1, 'one row per person: their best');
    assert.equal(mine[0].ms, 40000);
    assert.equal(mine[0].me, true);
  });

  await test('friends: joining a friend code links both ways; score then time', async () => {
    const annCode = (await call('ann', 'GET', 'profile')).body.friendCode;
    const preview = await call('bob', 'GET', `invites/${annCode}`);
    assert.deepEqual([preview.body.kind, preview.body.name, preview.body.joined], ['friend', 'Ann', false]);
    assert.equal((await call('ann', 'POST', `invites/${annCode}/join`)).status, 400, 'not your own code');
    assert.equal((await call('bob', 'POST', `invites/${annCode}/join`)).body.joined, true);
    await post('ann', { score: 15, activeMs: 30000 });
    for (const who of ['ann', 'bob']) {
      const rows = (await board(who, `period=day:${today}&scope=friends`)).body.rows;
      assert.deepEqual(rows.map((r) => [r.nickname, r.score, r.ms]), [['Ann', 15, 30000], ['Bob', 15, 40000]], who);
    }
    assert.deepEqual((await call('ann', 'GET', 'invites')).body.friends.map((f) => f.nickname), ['Bob']);
    // Cat is no one's friend: sees only herself.
    assert.equal((await board('cat', `period=day:${today}&scope=friends`)).body.rows.length, 0);
  });

  await test('periods: day, week, all; late rows on that day\'s board', async () => {
    const day = (await board('bob', `period=day:${yesterday}&scope=friends`)).body.rows;
    assert.deepEqual(day.map((r) => [r.nickname, r.late]), [['Bob', true]]);
    assert.equal((await board('bob', `period=week:${mondayOf(today)}&scope=friends`)).body.rows.length, 2);
    assert.equal((await board('bob', 'period=all&scope=friends')).body.rows[0].score, 20);
    const tuesday = new Date(Date.parse(`${mondayOf(today)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    assert.equal((await board('bob', `period=week:${tuesday}&scope=friends`)).status, 400, 'a week must start on a Monday');
    assert.equal(mondayOf('2026-11-26'), '2026-11-23');
    assert.equal(mondayOf('2026-11-23'), '2026-11-23');
    assert.equal((await board('bob', 'period=week:2026-13-45&scope=friends')).status, 400, 'a malformed week is a 400');
  });

  await test('groups: create, join, see the board, outsiders refused', async () => {
    const g = await call('cat', 'POST', 'invites', { name: 'Pub quiz' });
    assert.match(g.body.code, /^[A-Z2-9]{8}$/);
    assert.equal((await call('dan', 'GET', `invites/${g.body.code}`)).body.name, 'Pub quiz');
    assert.equal((await board('ann', `period=all&scope=group:${g.body.code}`)).status, 403);
    await call('ann', 'POST', `invites/${g.body.code}/join`);
    await post('cat', { score: 5 });
    const rows = (await board('ann', `period=all&scope=group:${g.body.code}`)).body.rows;
    assert.deepEqual(rows.map((r) => r.nickname), ['Ann', 'Cat the Great']);
    assert.equal((await call('ann', 'GET', 'invites')).body.groups[0].people, 2);
    await call('ann', 'DELETE', `invites/${g.body.code}`);
    assert.equal((await board('ann', `period=all&scope=group:${g.body.code}`)).status, 403, 'left the group');
  });

  await test('public: only people who opted in, ranked by time that never pauses', async () => {
    await post('dan', { score: 15, activeMs: 10000, wallMs: 99000 });
    const rows = (await board('ann', `period=day:${today}&scope=public`)).body;
    assert.equal(rows.time, 'wall');
    assert.deepEqual(rows.rows.map((r) => [r.nickname, r.ms]), [['Dan', 99000]]);
  });

  await test('unfriend works both ways, and they cannot rejoin through your code', async () => {
    const annCode = (await call('ann', 'GET', 'profile')).body.friendCode;
    const bobCode = (await call('bob', 'GET', 'profile')).body.friendCode;
    assert.equal((await call('ann', 'GET', 'invites')).body.friends[0].code, bobCode);
    await call('ann', 'DELETE', `friends/${bobCode}`);
    assert.equal((await call('bob', 'GET', 'invites')).body.friends.length, 0);
    assert.equal((await call('bob', 'POST', `invites/${annCode}/join`)).status, 403);
  });

  await test('a new friend code: the old one stops working, friends stay', async () => {
    const dan = (await call('dan', 'GET', 'profile')).body.friendCode;
    await call('cat', 'POST', `invites/${dan}/join`);
    const fresh = (await call('dan', 'POST', 'profile/friend-code')).body.friendCode;
    assert.notEqual(fresh, dan);
    assert.equal((await call('cat', 'GET', `invites/${dan}`)).status, 404);
    assert.deepEqual((await call('dan', 'GET', 'invites')).body.friends.map((f) => f.nickname), ['Cat the Great']);
    assert.equal((await call('dan', 'GET', 'profile')).body.friendCode, fresh);
  });

  await test('guessing codes is capped at 30 tries an hour', async () => {
    let last;
    for (let i = 0; i < 31; i++) last = await call('cat', 'GET', 'invites/ZZZZZZZZ');
    assert.equal(last.status, 429);
  });

  await test('Reset deletes the leaderboard side too', async () => {
    await call('ann', 'DELETE', 'sync');
    for (const t of ['results', 'profiles', 'members']) {
      const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE sub = 'ann'`).first();
      assert.equal(r.n, 0, t);
    }
    assert.equal((await env.DB.prepare("SELECT COUNT(*) AS n FROM invites WHERE owner = 'ann'").first()).n, 0);
  });
} finally {
  await dispose();
  rmSync(dir, { recursive: true, force: true });
}

if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
console.log('Worker board tests OK.');
