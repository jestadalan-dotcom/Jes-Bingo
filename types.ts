export interface BingoCell {
  id: string;
  value: string | number;
  marked: boolean;
  isFreeSpace: boolean;
}

export interface BingoCard {
  id: string;
  ownerIndex: number; // 0-9
  cardIndex: number; // 0-3
  playerName: string;
  cells: BingoCell[]; // Flat array of 25 cells
  hasBingo: boolean;
  colorTheme: string;
}

export type GameMode = 'STANDARD' | 'THEMED';

export interface GameState {
  isSetup: boolean;
  mode: GameMode;
  theme: string;
  allItems: (string | number)[]; // The pool of all possible call items
  calledItems: (string | number)[]; // History of called items
  currentCall: string | number | null;
  cards: BingoCard[]; // All 40 cards (10 players * 4 cards)
  winnerIds: string[]; // IDs of cards that won
}

export const THEME_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
];