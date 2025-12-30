export interface BingoCell {
  id: string;
  value: string | number;
  marked: boolean;
  isFreeSpace: boolean;
}

export interface BingoCard {
  id: string;
  ownerIndex: number;
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
  prize: string;
  allItems: (string | number)[]; // The pool of all possible call items
  calledItems: (string | number)[]; // History of called items
  currentCall: string | number | null;
  cards: BingoCard[]; // All cards in play
  winnerIds: string[]; // IDs of cards that won
}

// --- Networking Types ---

export type AppRole = 'LANDING' | 'HOST' | 'PLAYER';

export type MessageType = 'JOIN_REQUEST' | 'WELCOME' | 'NEXT_CALL' | 'GAME_RESET' | 'CLAIM_BINGO' | 'BINGO_ANNOUNCED' | 'NEW_GAME';

export interface NetworkMessage {
  type: MessageType;
  payload?: any;
}

export interface WelcomePayload {
  playerIndex: number;
  playerName: string;
  cards: BingoCard[];
  theme: string;
  prize: string;
  currentCall: string | number | null;
  calledItems: (string | number)[];
}

export interface JoinRequestPayload {
  playerName: string;
}