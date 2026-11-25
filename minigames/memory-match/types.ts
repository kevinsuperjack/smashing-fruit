import type React from 'react';
import type { AppTheme } from '../../utils/theme';
import type { ArcadeMode, MemoryMatchGridId } from '../arcadeStorage';

export interface SmoothieMemoryMatchProps {
  sfxMuted: boolean;
  musicMuted: boolean;
  kidVoiceEnabled: boolean;
  theme: AppTheme;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onExitToHub: () => void;
  backHandlerRef?: React.MutableRefObject<(() => void) | null>;
}

export type MemoryMatchScreen = 'LOBBY' | 'PLAYING' | 'PAUSED' | 'RESULTS';

export interface MemoryMatchGridPreset {
  id: MemoryMatchGridId;
  label: string;
  kidLabel: string;
  arcadeLabel: string;
  cols: number;
  rows: number;
  totalCards: number;
  totalPairs: number;
  threeStarMaxMoves: number;
  twoStarMaxMoves: number;
  baseCompletionSeeds: number;
  maxCardCap: number;
}

export interface MemoryFruitDescriptor {
  tier: number;
  name: string;
  kidName: string;
  spokenPhrase: string;
  assetKey: string;
  radius: number;
  points: number;
  color: string;
  aspectRatio: number;
  width: number;
  height: number;
  proceduralOnly?: boolean;
}

export type RngFn = () => number;

export interface MemoryCard {
  id: string;
  pairIndex: number;
  tier: number;
  fruit: MemoryFruitDescriptor;
  flipped: boolean;
  matched: boolean;
}

export interface MemoryMatchRoundState {
  gridId: MemoryMatchGridId;
  mode: ArcadeMode;
  cards: MemoryCard[];
  flippedIds: string[];
  moves: number;
  matchedPairs: number;
  totalPairs: number;
  streak: number;
  bestStreak: number;
  blenderProgress: number;
  smoothiesBlended: number;
  blenderBonusSeeds: number;
  isCompleted: boolean;
}

export type FlipOutcomeStatus =
  | 'IGNORED'
  | 'FIRST_CARD'
  | 'MATCH'
  | 'MISMATCH';

export type FlipIgnoreReason =
  | 'ROUND_COMPLETE'
  | 'CARD_NOT_FOUND'
  | 'ALREADY_MATCHED'
  | 'ALREADY_FLIPPED'
  | 'TWO_CARDS_OPEN';

export interface FlipCardResult {
  state: MemoryMatchRoundState;
  status: FlipOutcomeStatus;
  ignoreReason?: FlipIgnoreReason;
  flippedCard: MemoryCard | null;
  pairCards: [MemoryCard, MemoryCard] | null;
  smoothieTriggered: boolean;
  bonusSeedsEarned: number;
  isRoundComplete: boolean;
}

export interface MemoryMatchPayout {
  baseSeeds: number;
  starBonusSeeds: number;
  completionSeeds: number;
  blenderBonusSeeds: number;
  totalSeeds: number;
}

export interface MemoryMatchSummary {
  gridId: MemoryMatchGridId;
  mode: ArcadeMode;
  moves: number;
  totalPairs: number;
  stars: 1 | 2 | 3;
  bestStreak: number;
  smoothiesBlended: number;
  payout: MemoryMatchPayout;
}
