// Card: surface-1 panel with a hairline border, no shadow (16px padding on a phone, 24px from 720px).
// Used for any block of content that is not a game shell (setup panels, empty states, summaries).
// `as` changes the element (section, article, li).
import React from 'react';

export default function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`card ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
