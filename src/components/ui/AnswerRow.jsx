// AnswerRow: one answer slot on the names, list and chart boards (and Four by four tile states).
// `state` is pending | got | missed | wrong and is exposed as data-state; the CSS does the rest.
// Pass as="li" inside a <ul>. `lead` is a rank or clue on the left, `trail` an aside on the right.
import React from 'react';

export default function AnswerRow({ state = 'pending', as: Tag = 'div', lead, trail, className = '', children, ...rest }) {
  return (
    <Tag className={`answer-row ${className}`.trim()} data-state={state} {...rest}>
      {lead != null && <span className="answer-row-lead">{lead}</span>}
      <span className="answer-row-main">{children}</span>
      {trail != null && <span className="answer-row-trail">{trail}</span>}
    </Tag>
  );
}
