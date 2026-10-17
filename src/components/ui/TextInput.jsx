// TextInput: the one text field for typed answers (48px high, 16px text so iOS does not zoom).
// Used by the names, list, year and missing-link games. Pass `label` for the accessible name.
// Autocomplete, autocapitalise and spellcheck are off by default (it is an answer box, not a form).
import React from 'react';

export default function TextInput({ label, className = '', ref, ...rest }) {
  return (
    <input
      ref={ref}
      type="text"
      className={`input ${className}`.trim()}
      aria-label={label}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
    />
  );
}
