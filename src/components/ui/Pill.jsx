// Pill: every status tag, count and score chip (24px high). Variants: neutral, accent, correct, wrong.
// Used by the header streak, game boards (score, timer), results (most missed) and quiz screens.
// `accent` follows the live section accent (--accent).
import React from 'react';
import Icon from './Icon';

export default function Pill({ variant = 'neutral', icon, className = '', children, ...rest }) {
  return (
    <span className={`pill pill-${variant} ${className}`.trim()} {...rest}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}
