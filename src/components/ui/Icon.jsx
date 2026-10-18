// Icon: the one place lucide icons are resolved from a NAME string (stroke 1.75, currentColor).
// Used by GameIcon, CategoryIcon, Button, Pill and any screen that stores an icon name as data
// (registry.js, categories.js, flashcard decks, milestones). Add a name to ICONS to make it available.
import React from 'react';
import {
  Atom, Award, BadgeCheck, BarChart3, Bird, BookA, BookOpen, Check, ChevronDown, ChevronRight,
  Church, CalendarDays, Circle, CircleCheck, CircleHelp, CircleX, Clapperboard, Clock, Cloud,
  Coffee, Coins, Crown, Dices, Drama, Eraser, Eye, EyeOff, Film, Flag, Flame, FlaskConical, Gem,
  Ghost, Gift, Globe, Hand, Hash, Heart, Hourglass, Languages, Layers, LayoutGrid, Library,
  Lightbulb, Link, Map, Medal, MessageSquareText, Microscope, Moon, Music, Newspaper, Orbit,
  Palette, Puzzle, Radio, RotateCcw, Scale, ScrollText, Shuffle, Sparkles, Sprout, Star, Sun,
  Swords, Target, Telescope, ThumbsUp, Timer, Trophy, Tv, TrendingUp, User, UserRound, Users,
  Utensils, Vote, Wine, X, Zap, ArrowRight, ArrowLeft, ArrowLeftRight, Landmark, Lock, Share2
} from 'lucide-react';

const ICONS = {
  Atom, Award, BadgeCheck, BarChart3, Bird, BookA, BookOpen, Check, ChevronDown, ChevronRight,
  Church, CalendarDays, Circle, CircleCheck, CircleHelp, CircleX, Clapperboard, Clock, Cloud,
  Coffee, Coins, Crown, Dices, Drama, Eraser, Eye, EyeOff, Film, Flag, Flame, FlaskConical, Gem,
  Ghost, Gift, Globe, Hand, Hash, Heart, Hourglass, Languages, Layers, LayoutGrid, Library,
  Lightbulb, Link, Map, Medal, MessageSquareText, Microscope, Moon, Music, Newspaper, Orbit,
  Palette, Puzzle, Radio, RotateCcw, Scale, ScrollText, Shuffle, Sparkles, Sprout, Star, Sun,
  Swords, Target, Telescope, ThumbsUp, Timer, Trophy, Tv, TrendingUp, User, UserRound, Users,
  Utensils, Vote, Wine, X, Zap, ArrowRight, ArrowLeft, ArrowLeftRight, Landmark, Lock,
  Share: Share2
};

export default function Icon({ name, size = 20, ...rest }) {
  const Glyph = ICONS[name];
  if (!Glyph && import.meta.env?.DEV) console.warn(`Icon: unknown name "${name}"; add it to ICONS in ui/Icon.jsx`);
  const Use = Glyph || Circle;
  return <Use size={size} strokeWidth={1.75} {...rest} />;
}
