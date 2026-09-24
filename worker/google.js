// Checking a "Sign in with Google" ID token without any library.
//
// The token is a JWT signed by Google with RS256. Trusting it needs four
// checks, and skipping any one of them is a real hole:
//   - signature, against Google's published public keys (else anyone can mint one)
//   - `aud` is OUR client ID (else a token issued to some other site works here)
//   - `iss` is Google
//   - `exp` is in the future (else a token copied from an old log works forever)

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_S = 60;

// Module-level cache: one Worker isolate serves many requests, and Google
// rotates these keys only every few weeks, with a Cache-Control max-age.
let keyCache = { keys: null, expiresAt: 0 };

const b64urlBytes = (s) => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function googleKeys(force = false) {
  if (!force && keyCache.keys && Date.now() < keyCache.expiresAt) return keyCache.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`Google certs fetch failed: ${res.status}`);
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1]) || 3600;
  keyCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

/**
 * Returns the token's claims if it is genuine and meant for us, else null.
 * Never throws for a bad token; throws only if Google's keys cannot be fetched.
 */
export async function verifyGoogleIdToken(token, clientId) {
  if (typeof token !== 'string' || !clientId) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header, claims;
  try {
    header = b64urlJson(parts[0]);
    claims = b64urlJson(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;

  // A key id we have not seen means Google rotated since our cache filled:
  // refetch once rather than rejecting a genuine login.
  let jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(true)).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== clientId) return null;
  if (!ISSUERS.has(claims.iss)) return null;
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) return null;
  if (typeof claims.sub !== 'string' || !claims.sub) return null;
  return claims;
}
