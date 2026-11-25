import type { ArcadeMode, MemoryMatchGridId } from '../arcadeStorage';
import type {
  FlipCardResult,
  FlipIgnoreReason,
  MemoryCard,
  MemoryFruitDescriptor,
  MemoryMatchGridPreset,
  MemoryMatchPayout,
  MemoryMatchRoundState,
  MemoryMatchSummary,
  RngFn,
} from './types';

export const SMOOTHIE_STREAK_TARGET = 3;
export const SMOOTHIE_BLEND_BONUS_SEEDS = 5;
export const KID_HINT_IDLE_MS = 8000;
export const MISMATCH_REVEAL_MS = 750;

export const MEMORY_MATCH_GRID_ORDER: readonly MemoryMatchGridId[] = [
  '3x2',
  '4x3',
  '4x4',
  '5x4',
];

export const KID_MODE_GRIDS: readonly MemoryMatchGridId[] = ['3x2', '4x3'];
export const ARCADE_MODE_GRIDS: readonly MemoryMatchGridId[] = [
  '4x3',
  '4x4',
  '5x4',
];

export const MEMORY_MATCH_GRID_PRESETS: Record<
  MemoryMatchGridId,
  MemoryMatchGridPreset
> = {
  '3x2': {
    id: '3x2',
    label: '3×2',
    kidLabel: 'Starter (3×2)',
    arcadeLabel: '3×2',
    cols: 3,
    rows: 2,
    totalCards: 6,
    totalPairs: 3,
    threeStarMaxMoves: 4,
    twoStarMaxMoves: 6,
    baseCompletionSeeds: 4,
    maxCardCap: 136,
  },
  '4x3': {
    id: '4x3',
    label: '4×3',
    kidLabel: 'Big Kid (4×3)',
    arcadeLabel: 'Cozy (4×3)',
    cols: 4,
    rows: 3,
    totalCards: 12,
    totalPairs: 6,
    threeStarMaxMoves: 9,
    twoStarMaxMoves: 13,
    baseCompletionSeeds: 8,
    maxCardCap: 118,
  },
  '4x4': {
    id: '4x4',
    label: '4×4',
    kidLabel: '4×4',
    arcadeLabel: 'Classic (4×4)',
    cols: 4,
    rows: 4,
    totalCards: 16,
    totalPairs: 8,
    threeStarMaxMoves: 12,
    twoStarMaxMoves: 18,
    baseCompletionSeeds: 12,
    maxCardCap: 106,
  },
  '5x4': {
    id: '5x4',
    label: '5×4',
    kidLabel: '5×4',
    arcadeLabel: 'Master (5×4)',
    cols: 5,
    rows: 4,
    totalCards: 20,
    totalPairs: 10,
    threeStarMaxMoves: 16,
    twoStarMaxMoves: 24,
    baseCompletionSeeds: 16,
    maxCardCap: 94,
  },
};

export const STAR_BONUS_SEEDS: Record<1 | 2 | 3, number> = {
  1: 2,
  2: 6,
  3: 12,
};

/**
 * Self-contained mirror of FRUIT_TIERS (1..13) + KID_FRUIT_LABELS from constants.ts
 * so Node v26 native TypeScript execution works without extensionless runtime imports.
 */
export const MEMORY_FRUIT_CATALOG: readonly MemoryFruitDescriptor[] = [
  {
    tier: 1,
    name: 'Cherry',
    kidName: 'Cherry',
    spokenPhrase: 'Red Cherry!',
    assetKey: 'fruit_cherry',
    radius: 22,
    points: 2,
    color: '#E63946',
    aspectRatio: 332 / 526,
    width: 332,
    height: 526,
  },
  {
    tier: 2,
    name: 'Strawberry',
    kidName: 'Strawberry',
    spokenPhrase: 'Sweet Strawberry!',
    assetKey: 'fruit_strawberry',
    radius: 30,
    points: 4,
    color: '#FF595E',
    aspectRatio: 541 / 653,
    width: 541,
    height: 653,
  },
  {
    tier: 3,
    name: 'Grape',
    kidName: 'Grapes',
    spokenPhrase: 'Purple Grapes!',
    assetKey: 'fruit_grape',
    radius: 40,
    points: 8,
    color: '#8338EC',
    aspectRatio: 648 / 596,
    width: 648,
    height: 596,
  },
  {
    tier: 4,
    name: 'Dekopon',
    kidName: 'Tangerine',
    spokenPhrase: 'Juicy Tangerine!',
    assetKey: 'fruit_dekopon',
    radius: 50,
    points: 16,
    color: '#FB8500',
    aspectRatio: 580 / 573,
    width: 580,
    height: 573,
  },
  {
    tier: 5,
    name: 'Persimmon',
    kidName: 'Orange',
    spokenPhrase: 'Sunny Orange!',
    assetKey: 'fruit_persimmon',
    radius: 60,
    points: 32,
    color: '#F77F00',
    aspectRatio: 574 / 486,
    width: 574,
    height: 486,
  },
  {
    tier: 6,
    name: 'Cucumber',
    kidName: 'Cucumber',
    spokenPhrase: 'Crunchy Green Cucumber!',
    assetKey: 'fruit_cucumber',
    radius: 52,
    points: 48,
    color: '#38B000',
    aspectRatio: 1,
    width: 500,
    height: 500,
    proceduralOnly: true,
  },
  {
    tier: 7,
    name: 'Apple',
    kidName: 'Apple',
    spokenPhrase: 'Shiny Red Apple!',
    assetKey: 'fruit_apple',
    radius: 72,
    points: 64,
    color: '#D62828',
    aspectRatio: 513 / 571,
    width: 513,
    height: 571,
  },
  {
    tier: 8,
    name: 'Pear',
    kidName: 'Pear',
    spokenPhrase: 'Green Pear!',
    assetKey: 'fruit_pear',
    radius: 86,
    points: 128,
    color: '#A7C957',
    aspectRatio: 519 / 753,
    width: 519,
    height: 753,
  },
  {
    tier: 9,
    name: 'Peach',
    kidName: 'Peach',
    spokenPhrase: 'Fuzzy Pink Peach!',
    assetKey: 'fruit_peach',
    radius: 100,
    points: 256,
    color: '#FF99C8',
    aspectRatio: 623 / 577,
    width: 623,
    height: 577,
  },
  {
    tier: 10,
    name: 'Pineapple',
    kidName: 'Pineapple',
    spokenPhrase: 'Big Yellow Pineapple!',
    assetKey: 'fruit_pineapple',
    radius: 116,
    points: 512,
    color: '#FFBE0B',
    aspectRatio: 459 / 805,
    width: 459,
    height: 805,
  },
  {
    tier: 11,
    name: 'Melon',
    kidName: 'Melon',
    spokenPhrase: 'Round Sweet Melon!',
    assetKey: 'fruit_melon',
    radius: 134,
    points: 1024,
    color: '#52B788',
    aspectRatio: 718 / 786,
    width: 718,
    height: 786,
  },
  {
    tier: 12,
    name: 'Watermelon',
    kidName: 'Watermelon',
    spokenPhrase: 'Giant Green Watermelon!',
    assetKey: 'fruit_watermelon',
    radius: 154,
    points: 2048,
    color: '#2D6A4F',
    aspectRatio: 619 / 620,
    width: 619,
    height: 620,
  },
  {
    tier: 13,
    name: 'King Durian',
    kidName: 'King Durian',
    spokenPhrase: 'Golden King Durian!',
    assetKey: 'fruit_durian',
    radius: 130,
    points: 5000,
    color: '#9EF01A',
    aspectRatio: 1,
    width: 500,
    height: 500,
    proceduralOnly: true,
  },
];

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 0.999999999999;
  return value;
}

export function createSeededRng(seed: number): RngFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getGridPreset(gridId: MemoryMatchGridId): MemoryMatchGridPreset {
  return MEMORY_MATCH_GRID_PRESETS[gridId] ?? MEMORY_MATCH_GRID_PRESETS['4x3'];
}

export function getAvailableGridsForMode(
  mode: ArcadeMode,
): readonly MemoryMatchGridId[] {
  return mode === 'KID' ? KID_MODE_GRIDS : ARCADE_MODE_GRIDS;
}

export function getDefaultGridForMode(mode: ArcadeMode): MemoryMatchGridId {
  return mode === 'KID' ? '3x2' : '4x3';
}

export function shuffleWithRng<T>(
  items: readonly T[],
  rng: RngFn = Math.random,
): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(clampUnit(rng()) * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

export function createDeck(
  gridId: MemoryMatchGridId,
  rng: RngFn = Math.random,
): MemoryCard[] {
  const preset = getGridPreset(gridId);
  const chosenFruits = shuffleWithRng(MEMORY_FRUIT_CATALOG, rng).slice(
    0,
    preset.totalPairs,
  );

  const pairs: MemoryCard[] = [];
  chosenFruits.forEach((fruit, pairIndex) => {
    pairs.push({
      id: `tier-${fruit.tier}-0`,
      pairIndex,
      tier: fruit.tier,
      fruit,
      flipped: false,
      matched: false,
    });
    pairs.push({
      id: `tier-${fruit.tier}-1`,
      pairIndex,
      tier: fruit.tier,
      fruit,
      flipped: false,
      matched: false,
    });
  });

  return shuffleWithRng(pairs, rng);
}

export function createRoundState(
  gridId: MemoryMatchGridId,
  mode: ArcadeMode,
  rng: RngFn = Math.random,
): MemoryMatchRoundState {
  const preset = getGridPreset(gridId);
  return {
    gridId: preset.id,
    mode,
    cards: createDeck(preset.id, rng),
    flippedIds: [],
    moves: 0,
    matchedPairs: 0,
    totalPairs: preset.totalPairs,
    streak: 0,
    bestStreak: 0,
    blenderProgress: 0,
    smoothiesBlended: 0,
    blenderBonusSeeds: 0,
    isCompleted: false,
  };
}

export function canFlipCard(
  state: MemoryMatchRoundState,
  cardId: string,
): { ok: true } | { ok: false; reason: FlipIgnoreReason } {
  if (state.isCompleted) {
    return { ok: false, reason: 'ROUND_COMPLETE' };
  }
  if (state.flippedIds.length >= 2) {
    return { ok: false, reason: 'TWO_CARDS_OPEN' };
  }
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) {
    return { ok: false, reason: 'CARD_NOT_FOUND' };
  }
  if (card.matched) {
    return { ok: false, reason: 'ALREADY_MATCHED' };
  }
  if (card.flipped || state.flippedIds.includes(cardId)) {
    return { ok: false, reason: 'ALREADY_FLIPPED' };
  }
  return { ok: true };
}

export function flipCard(
  state: MemoryMatchRoundState,
  cardId: string,
): FlipCardResult {
  const guard = canFlipCard(state, cardId);
  if (!guard.ok) {
    return {
      state,
      status: 'IGNORED',
      ignoreReason: guard.reason,
      flippedCard: null,
      pairCards: null,
      smoothieTriggered: false,
      bonusSeedsEarned: 0,
      isRoundComplete: state.isCompleted,
    };
  }

  // First card flip
  if (state.flippedIds.length === 0) {
    let flippedCard: MemoryCard | null = null;
    const nextCards = state.cards.map((card) => {
      if (card.id !== cardId) return card;
      flippedCard = { ...card, flipped: true };
      return flippedCard;
    });

    const nextState: MemoryMatchRoundState = {
      ...state,
      cards: nextCards,
      flippedIds: [cardId],
    };

    return {
      state: nextState,
      status: 'FIRST_CARD',
      flippedCard,
      pairCards: null,
      smoothieTriggered: false,
      bonusSeedsEarned: 0,
      isRoundComplete: false,
    };
  }

  // Second card flip
  const firstId = state.flippedIds[0];
  const firstCard = state.cards.find((c) => c.id === firstId);
  const secondCardRaw = state.cards.find((c) => c.id === cardId);

  if (!firstCard || !secondCardRaw) {
    return {
      state,
      status: 'IGNORED',
      ignoreReason: 'CARD_NOT_FOUND',
      flippedCard: null,
      pairCards: null,
      smoothieTriggered: false,
      bonusSeedsEarned: 0,
      isRoundComplete: state.isCompleted,
    };
  }

  const nextMoves = state.moves + 1;
  const isMatch = firstCard.tier === secondCardRaw.tier;

  if (isMatch) {
    let updatedFirst: MemoryCard = {
      ...firstCard,
      flipped: true,
      matched: true,
    };
    let updatedSecond: MemoryCard = {
      ...secondCardRaw,
      flipped: true,
      matched: true,
    };

    const nextCards = state.cards.map((card) => {
      if (card.id === firstCard.id) {
        updatedFirst = { ...card, flipped: true, matched: true };
        return updatedFirst;
      }
      if (card.id === secondCardRaw.id) {
        updatedSecond = { ...card, flipped: true, matched: true };
        return updatedSecond;
      }
      return card;
    });

    const nextMatchedPairs = state.matchedPairs + 1;
    const nextStreak = state.streak + 1;
    const nextBestStreak = Math.max(state.bestStreak, nextStreak);
    const rawBlender = state.blenderProgress + 1;
    const smoothieTriggered = rawBlender >= SMOOTHIE_STREAK_TARGET;
    const bonusSeedsEarned = smoothieTriggered ? SMOOTHIE_BLEND_BONUS_SEEDS : 0;
    const nextBlenderProgress = smoothieTriggered ? 0 : rawBlender;
    const nextSmoothiesBlended =
      state.smoothiesBlended + (smoothieTriggered ? 1 : 0);
    const nextBlenderBonusSeeds = state.blenderBonusSeeds + bonusSeedsEarned;
    const isCompleted = nextMatchedPairs >= state.totalPairs;

    const nextState: MemoryMatchRoundState = {
      ...state,
      cards: nextCards,
      flippedIds: [],
      moves: nextMoves,
      matchedPairs: nextMatchedPairs,
      streak: nextStreak,
      bestStreak: nextBestStreak,
      blenderProgress: nextBlenderProgress,
      smoothiesBlended: nextSmoothiesBlended,
      blenderBonusSeeds: nextBlenderBonusSeeds,
      isCompleted,
    };

    return {
      state: nextState,
      status: 'MATCH',
      flippedCard: updatedSecond,
      pairCards: [updatedFirst, updatedSecond],
      smoothieTriggered,
      bonusSeedsEarned,
      isRoundComplete: isCompleted,
    };
  }

  // Mismatch: keep both open until clearMismatch(state) is called
  let updatedSecond: MemoryCard = { ...secondCardRaw, flipped: true };
  const nextCards = state.cards.map((card) => {
    if (card.id !== secondCardRaw.id) return card;
    updatedSecond = { ...card, flipped: true };
    return updatedSecond;
  });

  const nextState: MemoryMatchRoundState = {
    ...state,
    cards: nextCards,
    flippedIds: [firstCard.id, secondCardRaw.id],
    moves: nextMoves,
    streak: 0,
    blenderProgress: 0,
  };

  return {
    state: nextState,
    status: 'MISMATCH',
    flippedCard: updatedSecond,
    pairCards: [firstCard, updatedSecond],
    smoothieTriggered: false,
    bonusSeedsEarned: 0,
    isRoundComplete: false,
  };
}

export function clearMismatch(
  state: MemoryMatchRoundState,
): MemoryMatchRoundState {
  if (state.flippedIds.length === 0) {
    return state;
  }
  const openSet = new Set(state.flippedIds);
  const nextCards = state.cards.map((card) => {
    if (!card.matched && openSet.has(card.id) && card.flipped) {
      return { ...card, flipped: false };
    }
    return card;
  });
  return {
    ...state,
    cards: nextCards,
    flippedIds: [],
  };
}

export function computeStars(
  gridId: MemoryMatchGridId,
  moves: number,
): 1 | 2 | 3 {
  const preset = getGridPreset(gridId);
  if (!Number.isFinite(moves) || moves <= 0) {
    return 1;
  }
  if (moves <= preset.threeStarMaxMoves) {
    return 3;
  }
  if (moves <= preset.twoStarMaxMoves) {
    return 2;
  }
  return 1;
}

export function computeRoundPayout(
  gridId: MemoryMatchGridId,
  stars: 1 | 2 | 3,
  smoothiesBlended: number,
): MemoryMatchPayout {
  const preset = getGridPreset(gridId);
  const baseSeeds = preset.baseCompletionSeeds;
  const starBonusSeeds = STAR_BONUS_SEEDS[stars];
  const completionSeeds = baseSeeds + starBonusSeeds;
  const safeBlends = Math.max(
    0,
    Math.floor(Number.isFinite(smoothiesBlended) ? smoothiesBlended : 0),
  );
  const blenderBonusSeeds = safeBlends * SMOOTHIE_BLEND_BONUS_SEEDS;
  const totalSeeds = completionSeeds + blenderBonusSeeds;

  return {
    baseSeeds,
    starBonusSeeds,
    completionSeeds,
    blenderBonusSeeds,
    totalSeeds,
  };
}

export function buildRoundSummary(
  state: MemoryMatchRoundState,
): MemoryMatchSummary {
  const stars = computeStars(state.gridId, state.moves);
  const payout = computeRoundPayout(
    state.gridId,
    stars,
    state.smoothiesBlended,
  );
  return {
    gridId: state.gridId,
    mode: state.mode,
    moves: state.moves,
    totalPairs: state.totalPairs,
    stars,
    bestStreak: state.bestStreak,
    smoothiesBlended: state.smoothiesBlended,
    payout,
  };
}

export function findHintPair(
  cards: readonly MemoryCard[],
  flippedIds: readonly string[] = [],
  rng: RngFn = () => 0,
): [string, string] | null {
  if (flippedIds.length >= 2) {
    return null;
  }

  if (flippedIds.length === 1) {
    const first = cards.find((c) => c.id === flippedIds[0] && !c.matched);
    if (first) {
      const partner = cards.find(
        (c) => c.tier === first.tier && c.id !== first.id && !c.matched,
      );
      if (partner) {
        return [first.id, partner.id];
      }
    }
  }

  const byTier = new Map<number, MemoryCard[]>();
  for (const card of cards) {
    if (card.matched || card.flipped) continue;
    const bucket = byTier.get(card.tier);
    if (bucket) {
      bucket.push(card);
    } else {
      byTier.set(card.tier, [card]);
    }
  }

  const pairs: [string, string][] = [];
  for (const group of byTier.values()) {
    if (group.length >= 2) {
      pairs.push([group[0].id, group[1].id]);
    }
  }

  if (pairs.length === 0) {
    return null;
  }

  const index = Math.floor(clampUnit(rng()) * pairs.length);
  return pairs[index];
}
