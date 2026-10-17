// CategoryIcon: the lucide icon for a question category id from data/categories.js.
// Used by quiz setup, the question card, the answer sheet, the vault and the progress screen.
// Unknown ids (a question with no category) fall back to a question mark.
import React from 'react';
import { CATEGORIES } from '../../data/categories';
import Icon from './Icon';

export default function CategoryIcon({ id, size = 20, ...rest }) {
  return <Icon name={CATEGORIES[id]?.icon || 'CircleHelp'} size={size} {...rest} />;
}
