// The NYT-style shareable result: game, day, score, a row of squares and the
// link. Pure, so scripts/test-lib.mjs can check the exact text.

import { pathForTab } from './route.js';

/** "Know-It-All · Daily five · 18 Oct\n4 / 5\n🟩🟩🟥🟩🟩\nquiz.peteowen.dev/daily-five" */
export function shareText({ game, day, score, squares = [], url }) {
  const lines = [[`Know-It-All · ${game}`, day].filter(Boolean).join(' · '), String(score)];
  if (squares.length) lines.push(squares.map((ok) => (ok ? '🟩' : '🟥')).join(''));
  if (url) lines.push(url.replace(/^https?:\/\//, ''));
  return lines.join('\n');
}

/** Today as the share line shows it: "18 Oct". */
export const shareDay = (date = new Date()) => date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

/**
 * Share or copy the text. The phone's share sheet where there is one (it can
 * go straight to a chat), the clipboard otherwise. Resolves 'shared',
 * 'copied', or 'failed' (the caller then shows the text to copy by hand).
 */
export async function shareOrCopy(text) {
  try {
    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      await navigator.share({ text });
      return 'shared';
    }
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (err) {
    // Closing the share sheet without picking anything is not a failure.
    if (err?.name === 'AbortError') return 'shared';
    return 'failed';
  }
}

/** The share settings for a daily round: its name and its own address. */
export const dailyShare = (game, tab) => ({
  game,
  tab,
  url: typeof window === 'undefined' ? undefined : `${window.location.origin}${pathForTab(tab)}`
});
