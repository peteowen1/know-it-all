// Flag: a flag-icons SVG flag. Sizes lg (hero), md (96px option) and sm (inline with text).
// Used wherever a country flag is shown. Pass the country name as `label` so screen readers hear it;
// pass `decorative` when the name is already written next to the flag.
import React from 'react';

export default function Flag({ code, size = 'lg', label, decorative = false, className = '' }) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label || 'Flag' };
  return <span className={`fi fi-${code.toLowerCase()} ui-flag ui-flag--${size} ${className}`.trim()} {...a11y} />;
}

/**
 * Fetch flags before they are shown, so the next question's flag is already
 * there. Each flag is a separate small SVG that the browser only requests when
 * a flag-icons class first appears, and on a phone that round trip left the
 * flag box blank for a moment. The image address is read from the stylesheet
 * (it is content-hashed at build time) through an off-screen probe.
 */
export function preloadFlags(codes) {
  if (typeof document === 'undefined') return;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
  document.body.appendChild(probe);
  for (const code of new Set(codes)) {
    probe.className = `fi fi-${String(code).toLowerCase()}`;
    const url = /url\("?([^")]+)"?\)/.exec(getComputedStyle(probe).backgroundImage)?.[1];
    if (url) new Image().src = url;
  }
  probe.remove();
}
