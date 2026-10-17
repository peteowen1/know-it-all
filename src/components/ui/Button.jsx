// Button: the one button. Variants: primary (solid accent, ONE per screen), secondary (outlined),
// tertiary (text), danger (red text, only inside a confirm), correct / wrong (tinted self-mark pair).
// Used by every screen's action row; replaces hand-written "btn btn-*" class strings over time.
import React from 'react';
import Icon from './Icon';

const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  tertiary: 'btn-tertiary',
  danger: 'btn-danger-text',
  correct: 'btn-success',
  wrong: 'btn-danger'
};

export default function Button({ variant = 'secondary', icon, className = '', children, type = 'button', ...rest }) {
  return (
    <button type={type} className={`btn ${VARIANT_CLASS[variant] || VARIANT_CLASS.secondary} ${className}`.trim()} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
