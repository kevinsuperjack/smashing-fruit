import type { MutableRefObject } from 'react';
import type { ArcadeMode } from '../arcadeStorage';
import type { AppTheme } from '../../utils/theme';

export interface FruitPopSplashProps {
  sfxMuted: boolean;
  musicMuted: boolean;
  kidVoiceEnabled: boolean;
  theme: AppTheme;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onExitToHub: () => void;
  backHandlerRef?: MutableRefObject<(() => void) | null>;
}

export type FruitPopView = 'LOBBY' | 'PLAYING' | 'PAUSED' | 'RESULTS';

export type BubbleKind = 'fruit' | 'rainbow' | 'golden';

export type BubbleOrnamentStyle = 'none' | 'snowglobe';

export type RngFn = () => number;

export interface FruitPopFruitDef {
  tier: number;
  name: string;
  kidName: string;
  spokenPhrase: string;
  emoji: string;
  color: string;
  accentColor: string;
  assetKey: string;
  basePoints: number;
}

export interface FruitPopBounds {
  width: number;
  height: number;
}

export interface FruitBubble {
  id: number;
  kind: BubbleKind;
  fruitTier: number;
  fruitName: string;
  kidName: string;
  spokenPhrase: string;
  emoji: string;
  color: string;
  accentColor: string;
  assetKey: string;
  /** Current X coordinate in logical CSS pixels. */
  x: number;
  /** Anchor X coordinate around which horizontal sine wobble oscillates. */
  baseX: number;
  /** Current Y coordinate in logical CSS pixels (0 = top, height = bottom). */
  y: number;
  /** Upward buoyancy velocity in px/sec (negative moves upward). */
  vy: number;
  baseRadius: number;
  /** Animated radius (spawn scale-in + gentle breathing). */
  radius: number;
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  age: number;
  basePoints: number;
  /** Christmas metadata: 'snowglobe' when theme === 'CHRISTMAS', else 'none'. */
  ornament: BubbleOrnamentStyle;
  shimmerPhase: number;
}

export interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface SplashRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
  alpha: number;
  life: number;
  maxLife: number;
  isRainbow: boolean;
}

export interface FloatingCallout {
  id: number;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface FruitPopModeConfig {
  mode: ArcadeMode;
  /** Null when kidEndless === true; otherwise 45s (KID) or 60s (ARCADE). */
  roundDurationSec: number | null;
  spawnIntervalSec: number;
  minSpawnIntervalSec: number;
  maxActiveBubbles: number;
  minRadius: number;
  maxRadius: number;
  minSpeed: number;
  maxSpeed: number;
  hitRadiusMultiplier: number;
  hitRadiusPaddingPx: number;
  rainbowChance: number;
  goldenChance: number;
  comboWindowSec: number;
  maxComboMultiplier: number;
}

export interface FruitPopState {
  mode: ArcadeMode;
  theme: AppTheme;
  kidEndless: boolean;
  bounds: FruitPopBounds;
  status: 'PLAYING' | 'FINISHED';
  elapsedSec: number;
  /** Remaining seconds in timed rounds; null when kidEndless is true. */
  timeRemainingSec: number | null;
  spawnCooldownSec: number;
  nextEntityId: number;
  bubbles: FruitBubble[];
  particles: SplashParticle[];
  rings: SplashRing[];
  callouts: FloatingCallout[];
  score: number;
  totalPopped: number;
  escapedCount: number;
  /** 1..10 cyclic counter for Kid Mode counting announcements (0 before first pop). */
  kidCount1To10: number;
  kidCelebrationCount: number;
  lastFruitName: string | null;
  lastSpokenPhrase: string | null;
  discoveredFruits: string[];
  comboCount: number;
  comboMultiplier: number;
  maxComboReached: number;
  comboTimerSec: number;
  rainbowPops: number;
  goldenPops: number;
  bonusGoldenSeeds: number;
}

export type FruitPopEvent =
  | {
      type: 'BUBBLE_POPPED';
      bubbleId: number;
      kind: BubbleKind;
      fruitTier: number;
      fruitName: string;
      spokenPhrase: string;
      x: number;
      y: number;
      pointsAwarded: number;
      comboCount: number;
      comboMultiplier: number;
      kidCount1To10: number;
      isChainReaction: boolean;
    }
  | {
      type: 'RAINBOW_CHAIN';
      sourceBubbleId: number;
      x: number;
      y: number;
      chainedCount: number;
    }
  | {
      type: 'GOLDEN_SEED_POP';
      bubbleId: number;
      x: number;
      y: number;
      seedsAwarded: number;
    }
  | {
      type: 'KID_CELEBRATION';
      totalPopped: number;
      milestone: number;
    }
  | {
      type: 'COMBO_RESET';
      previousCombo: number;
    }
  | {
      type: 'ROUND_COMPLETE';
      mode: ArcadeMode;
      score: number;
      stars: number;
      totalPopped: number;
      goldenSeedsEarned: number;
    };

export interface PopResult {
  poppedCount: number;
  pointsAwarded: number;
  goldenSeedsAwarded: number;
  events: FruitPopEvent[];
}

export interface FruitPopHudSnapshot {
  mode: ArcadeMode;
  status: 'PLAYING' | 'FINISHED';
  score: number;
  totalPopped: number;
  timeRemainingSec: number | null;
  comboCount: number;
  comboMultiplier: number;
  comboTimerRatio: number;
  kidCount1To10: number;
  lastFruitName: string | null;
  bonusGoldenSeeds: number;
  stars: number;
  projectedGoldenSeeds: number;
}

export interface CreateFruitPopOptions {
  mode: ArcadeMode;
  theme?: AppTheme;
  bounds?: FruitPopBounds;
  /** In KID mode, true enables endless playground with celebrations every 15 pops; false uses 45s joyful rounds. */
  kidEndless?: boolean;
  /** Optional initial bubble count to pre-populate on screen (default 4). */
  initialBubbles?: number;
  rng?: RngFn;
}

export interface SpawnBubbleOptions {
  kind?: BubbleKind;
  fruitTier?: number;
  x?: number;
  y?: number;
  radius?: number;
  vy?: number;
  rng?: RngFn;
}
