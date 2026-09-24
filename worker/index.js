// The Know-It-All server: serves the built app and a small JSON API under /api.
//
// Static files come from `dist/` via Workers static assets; this code runs only
// for /api/* (see run_worker_first in wrangler.toml).
//
// Login is a cookie on the same site as the app, HttpOnly so page scripts can
// never read it, SameSite=Lax so another site cannot make a logged-in request
// that changes anything. Writes additionally check the Origin header.

import { verifyGoogleIdToken } from './google.js';
import { GOOGLE_CLIENT_ID, OLD_HOST } from '../src/lib/syncConfig.js';
import { isSyncedKey } from '../src/lib/syncCore.js';

const COOKIE = 'kia_session';
const SESSION_DAYS = 180;
const DAY_MS = 86_400_000;
const MAX_BODY = 512 * 1024;
const MAX_KEYS = 300;
const HANDOFF_MINUTES = 15;
const OLD_ORIGIN = `https://${OLD_HOST}`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (err) {
      console.error('API error', url.pathname, err);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  }
};

async function route(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  // The one endpoint the old github.io copy calls, cross-site. Nothing else
  // gets CORS headers, so no other site can read any other response.
  if (pathname === '/api/handoff' && (method === 'POST' || method === 'OPTIONS')) {
    return handoffCreate(request, env);
  }

  if (method !== 'GET' && !sameOrigin(request, url, env)) {
    return json({ error: 'Cross-site request refused.' }, 403);
  }

  if (pathname === '/api/auth/google' && method === 'POST') return signIn(request, env);
  if (pathname === '/api/auth/signout' && method === 'POST') return signOut(request, env);
  if (pathname.startsWith('/api/handoff/') && method === 'POST') return handoffTake(env, pathname.slice(13));

  const sub = await sessionUser(request, env);
  if (pathname === '/api/me' && method === 'GET') {
    if (!sub) return json({ signedIn: false });
    const user = await env.DB.prepare('SELECT email FROM users WHERE sub = ?').bind(sub).first();
    return json({ signedIn: true, email: user?.email || null });
  }
  if (pathname === '/api/sync') {
    if (!sub) return json({ error: 'Signed out.' }, 401);
    if (method === 'GET') return syncGet(env, sub);
    if (method === 'PUT') return syncPut(request, env, sub);
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM kv WHERE sub = ?').bind(sub).run();
      return json({ ok: true });
    }
  }
  return json({ error: 'Not found.' }, 404);
}

// ------------------------------------------------------------------ auth

async function signIn(request, env) {
  const body = await readJson(request);
  const claims = await verifyGoogleIdToken(body?.credential, GOOGLE_CLIENT_ID);
  if (!claims) return json({ error: 'Google sign-in could not be verified.' }, 401);

  const now = Date.now();
  const token = randomId(32);
  const existing = await env.DB.prepare('SELECT 1 AS x FROM kv WHERE sub = ? LIMIT 1').bind(claims.sub).first();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (sub, email, created_at, last_seen_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET email = excluded.email, last_seen_at = excluded.last_seen_at`
    ).bind(claims.sub, claims.email || null, now, now),
    env.DB.prepare('INSERT INTO sessions (token_hash, sub, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), claims.sub, now, now + SESSION_DAYS * DAY_MS),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now)
  ]);
  return json(
    { email: claims.email || null, hasData: Boolean(existing) },
    200,
    { 'Set-Cookie': cookie(token, SESSION_DAYS * 86_400) }
  );
}

async function signOut(request, env) {
  const token = readCookie(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
}

async function sessionUser(request, env) {
  const token = readCookie(request);
  if (!token) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare('SELECT sub, expires_at FROM sessions WHERE token_hash = ?').bind(hash).first();
  if (!row || row.expires_at < Date.now()) return null;
  // Sliding expiry: anyone who plays at least every six months never gets
  // logged out. Refreshed only when half-used, so most requests skip the write.
  if (row.expires_at - Date.now() < (SESSION_DAYS / 2) * DAY_MS) {
    await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(Date.now() + SESSION_DAYS * DAY_MS, hash).run();
  }
  return row.sub;
}

// ------------------------------------------------------------------ sync

async function syncGet(env, sub) {
  const { results } = await env.DB.prepare('SELECT key, value, updated_at FROM kv WHERE sub = ?').bind(sub).all();
  const keys = {};
  for (const r of results) keys[r.key] = { value: r.value, updatedAt: r.updated_at };
  return json({ keys, now: Date.now() });
}

async function syncPut(request, env, sub) {
  const body = await readJson(request);
  // readJson returns null for an oversized or unparseable body. That must be
  // an error, not "nothing to sync": the client would otherwise mark data the
  // server never stored as safely synced.
  if (!body || typeof body.keys !== 'object' || body.keys === null) {
    return json({ error: 'Body too large or not readable.' }, 413);
  }
  const entries = Object.entries(body.keys);
  if (!entries.length) return json({ received: 0 });
  if (entries.length > MAX_KEYS) return json({ error: 'Too many keys.' }, 413);

  const now = Date.now();
  const stmts = [];
  for (const [key, entry] of entries) {
    const value = entry?.value;
    const t = Number(entry?.updatedAt);
    if (!isSyncedKey(key) || !(value === null || typeof value === 'string') || !Number.isFinite(t)) {
      return json({ error: `Bad entry for ${String(key).slice(0, 40)}.` }, 400);
    }
    // A device whose clock runs fast would otherwise win every clash for as
    // long as it stays fast. Nothing may claim to be newer than the server's now.
    const updatedAt = Math.min(t, now);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO kv (sub, key, value, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(sub, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
         WHERE excluded.updated_at > kv.updated_at`
      ).bind(sub, key, value, updatedAt)
    );
  }
  await env.DB.batch(stmts);
  // How many were sent, not how many won: an older copy loses silently, by design.
  return json({ received: stmts.length, now });
}

// ------------------------------------------------------------------ handoff

// The old github.io copy cannot read this site's storage (browsers keep each
// site's storage separate), so it posts its progress here, then redirects to
// the new address with the parcel id in the URL fragment.
async function handoffCreate(request, env) {
  const origin = request.headers.get('Origin');
  const cors = origin === OLD_ORIGIN
    ? { 'Access-Control-Allow-Origin': OLD_ORIGIN, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
    : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (origin !== OLD_ORIGIN) return json({ error: 'Not allowed.' }, 403);

  const body = await readJson(request);
  const snapshot = body?.snapshot;
  if (!snapshot || typeof snapshot !== 'object') return json({ error: 'Nothing to hand over.' }, 400, cors);
  const clean = {};
  for (const [k, v] of Object.entries(snapshot)) if (isSyncedKey(k) && typeof v === 'string') clean[k] = v;

  const id = randomId(18);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM handoffs WHERE expires_at < ?').bind(now),
    env.DB.prepare('INSERT INTO handoffs (id, payload, expires_at) VALUES (?, ?, ?)')
      .bind(id, JSON.stringify(clean), now + HANDOFF_MINUTES * 60_000)
  ]);
  return json({ id }, 200, cors);
}

// Readable until it expires rather than deleted on first read: if the new
// site fails to store it (network drop, full storage), reloading the page
// retries against the same id. The new site records which ids it has merged,
// so a retry never merges the same parcel twice.
async function handoffTake(env, id) {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return json({ error: 'Not found.' }, 404);
  const row = await env.DB.prepare('SELECT payload FROM handoffs WHERE id = ? AND expires_at >= ?')
    .bind(id, Date.now()).first();
  if (!row) return json({ error: 'That hand-over has expired or was already used.' }, 404);
  return json({ snapshot: JSON.parse(row.payload) });
}

// ------------------------------------------------------------------ helpers

function sameOrigin(request, url, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  if (origin === url.origin) return true;
  // Local development only: `.dev.vars` sets this, production never does.
  return (env.DEV_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(origin);
}

async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return null;
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }
  });
}

function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/api; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request) {
  const raw = request.headers.get('Cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

function randomId(bytes) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
