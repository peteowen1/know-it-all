// KindIcon: the lucide icon for a clue's kind in Timeline, Name the year and Obscure-est.
// Replaces the emoji those games used. Pass `set` to pick the map (births vs famous people).
import React from 'react';
import { Baby, Film, Globe, Landmark, Music, Star, Trophy, Tv } from 'lucide-react';

const TIMELINE = { music: Music, film: Film, oscars: Trophy, tv: Tv, leaders: Landmark, people: Baby };
const OBSCURE = { geo: Globe, people: Star, music: Music, film: Film };

export default function KindIcon({ kind, set = 'timeline', size = 20 }) {
  const Glyph = (set === 'obscure' ? OBSCURE : TIMELINE)[kind] || Star;
  return <Glyph size={size} strokeWidth={1.75} aria-hidden="true" />;
}
