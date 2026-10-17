// MostMissed: "most missed" chips on a results screen, built from weakestItems() output
// ([{ key, seen, correct }]). Used inside GameResults. Give each item a `label`, or pass `labelOf(key)`.
// Renders nothing when the list is empty.
import React from 'react';
import Pill from './Pill';

export default function MostMissed({ items, labelOf, title = 'Most missed', className = '' }) {
  if (!items || items.length === 0) return null;
  return (
    <section className={`most-missed ${className}`.trim()}>
      <h3 className="eyebrow">{title}</h3>
      <ul className="most-missed-list">
        {items.map((it) => {
          const missed = it.seen - it.correct;
          return (
            <li key={it.key}>
              <Pill variant="wrong" title={`Missed ${missed} of ${it.seen}`}>
                {it.label ?? labelOf?.(it.key) ?? it.key}
                <span className="visually-hidden">, missed {missed} of {it.seen}</span>
              </Pill>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
