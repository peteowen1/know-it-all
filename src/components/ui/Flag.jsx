// Flag: a flag-icons SVG flag. Sizes lg (hero), md (96px option) and sm (inline with text).
// Used wherever a country flag is shown. Pass the country name as `label` so screen readers hear it;
// pass `decorative` when the name is already written next to the flag.
import React from 'react';

export default function Flag({ code, size = 'lg', label, decorative = false, className = '' }) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label || 'Flag' };
  return <span className={`fi fi-${code.toLowerCase()} ui-flag ui-flag--${size} ${className}`.trim()} {...a11y} />;
}
