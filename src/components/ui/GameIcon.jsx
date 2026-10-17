// GameIcon: the lucide icon for a game id from games/registry.js. 24px inside the hub tile, 20px inline.
// Used by GameHub; any screen that wants to show a game's icon passes its registry id.
// The icon NAME lives on the registry entry; the name-to-glyph map lives in ui/Icon.jsx.
import React from 'react';
import { GAMES } from '../../games/registry';
import Icon from './Icon';

const ICON_BY_GAME = new Map(GAMES.map((g) => [g.id, g.icon]));

export default function GameIcon({ id, size = 20, ...rest }) {
  return <Icon name={ICON_BY_GAME.get(id)} size={size} {...rest} />;
}
