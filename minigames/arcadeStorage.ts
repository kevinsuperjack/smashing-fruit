import type {
  FruitSkinId,
  SkyRollDifficulty,
  SkyRollSaveData,
} from './sky-roll/types';

export const SKY_ROLL_STORAGE_KEY = 'juicyDrop_skyRoll_v1';
export const FRUIT_POP_STORAGE_KEY = 'juicyDrop_fruitPop_v1';
export const MEMORY_MATCH_STORAGE_KEY = 'juicyDrop_memoryMatch_v1';

export type ArcadeMode = 'KID' | 'ARCADE';
export type MemoryMatchGridId = '3x2' | '4x3' | '4x4' | '5x4';

export interface FruitPopSaveData {
  bestScore: number;
  bestStars: number;
  totalPopped: number;
  preferredMode: ArcadeMode;
}

export interface MemoryMatchSaveData {
  bestStarsByGrid: Partial<Record<MemoryMatchGridId, number>>;
  bestMovesByGrid: Partial<Record<MemoryMatchGridId, number>>;
  totalSmoothiesBlended: number;
  preferredMode: ArcadeMode;
}

const VALID_SKY_SKIN_IDS: ReadonlySet<string> = new Set<FruitSkinId>([
  'orange',
  'strawberry',
  'watermelon',
  'peach',
  'pineapple',
  'durian',
]);

const VALID_GRID_IDS: readonly MemoryMatchGridId[] = [
  '3x2',
  '4x3',
  '4x4',
  '5x4',
];

const VALID_GRID_ID_SET: ReadonlySet<string> = new Set(VALID_GRID_IDS);

function getSafeStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (
      !storage ||
      typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function'
    ) {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  const storage = getSafeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getSafeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota/private-mode/security errors
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeNonNegativeInt(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function sanitizeStars(value: unknown): number {
  return Math.max(0, Math.min(3, sanitizeNonNegativeInt(value)));
}

function sanitizeMode(value: unknown): ArcadeMode {
  return value === 'ARCADE' ? 'ARCADE' : 'KID';
}

function createDefaultSkyRollSave(): SkyRollSaveData {
  return {
    highestUnlockedLevel: 1,
    starsByLevel: {},
    coins: 0,
    unlockedSkins: ['orange'],
    selectedSkin: 'orange',
    preferredDifficulty: 'KID',
  };
}

function sanitizeSkyRollSave(raw: unknown): SkyRollSaveData {
  if (!isPlainRecord(raw)) {
    return createDefaultSkyRollSave();
  }

  const unlockedSet = new Set<FruitSkinId>();
  if (Array.isArray(raw.unlockedSkins)) {
    for (const entry of raw.unlockedSkins) {
      if (typeof entry === 'string' && VALID_SKY_SKIN_IDS.has(entry)) {
        unlockedSet.add(entry as FruitSkinId);
      }
    }
  }
  const unlockedSkins: FruitSkinId[] = Array.from(unlockedSet);
  if (!unlockedSkins.includes('orange')) {
    unlockedSkins.unshift('orange');
  }

  const selectedSkin: FruitSkinId =
    typeof raw.selectedSkin === 'string' &&
    unlockedSkins.includes(raw.selectedSkin as FruitSkinId)
      ? (raw.selectedSkin as FruitSkinId)
      : 'orange';

  const preferredDifficulty: SkyRollDifficulty =
    raw.preferredDifficulty === 'ARCADE' ? 'ARCADE' : 'KID';

  const rawLevel = Number(raw.highestUnlockedLevel);
  const highestUnlockedLevel = Number.isFinite(rawLevel)
    ? Math.max(1, Math.min(10, Math.floor(rawLevel)))
    : 1;

  const starsByLevel: Record<number, number> = {};
  if (isPlainRecord(raw.starsByLevel)) {
    for (const key of Object.keys(raw.starsByLevel)) {
      const levelNum = Number(key);
      if (Number.isInteger(levelNum) && levelNum >= 1) {
        starsByLevel[levelNum] = sanitizeStars(raw.starsByLevel[key]);
      }
    }
  }

  return {
    highestUnlockedLevel,
    starsByLevel,
    coins: sanitizeNonNegativeInt(raw.coins),
    unlockedSkins,
    selectedSkin,
    preferredDifficulty,
  };
}

export function getGoldenSeeds(): number {
  return sanitizeSkyRollSave(readJson(SKY_ROLL_STORAGE_KEY)).coins;
}

export function addGoldenSeeds(amount: number): number {
  const current = sanitizeSkyRollSave(readJson(SKY_ROLL_STORAGE_KEY));
  const delta =
    typeof amount === 'number' && Number.isFinite(amount)
      ? Math.max(0, Math.floor(amount))
      : 0;
  if (delta <= 0) {
    return current.coins;
  }
  const nextCoins = current.coins + delta;
  writeJson(SKY_ROLL_STORAGE_KEY, {
    ...current,
    coins: nextCoins,
  });
  return nextCoins;
}

function createDefaultFruitPopSave(): FruitPopSaveData {
  return {
    bestScore: 0,
    bestStars: 0,
    totalPopped: 0,
    preferredMode: 'KID',
  };
}

function sanitizeFruitPopSave(raw: unknown): FruitPopSaveData {
  if (!isPlainRecord(raw)) {
    return createDefaultFruitPopSave();
  }
  return {
    bestScore: sanitizeNonNegativeInt(raw.bestScore),
    bestStars: sanitizeStars(raw.bestStars),
    totalPopped: sanitizeNonNegativeInt(raw.totalPopped),
    preferredMode: sanitizeMode(raw.preferredMode),
  };
}

export function loadFruitPopSave(): FruitPopSaveData {
  return sanitizeFruitPopSave(readJson(FRUIT_POP_STORAGE_KEY));
}

export function persistFruitPopSave(data: FruitPopSaveData): void {
  writeJson(FRUIT_POP_STORAGE_KEY, sanitizeFruitPopSave(data));
}

export function recordFruitPopRun(run: {
  score: number;
  stars: number;
  popped: number;
  mode: ArcadeMode;
}): FruitPopSaveData {
  const prev = loadFruitPopSave();
  const next: FruitPopSaveData = {
    bestScore: Math.max(prev.bestScore, sanitizeNonNegativeInt(run.score)),
    bestStars: Math.max(prev.bestStars, sanitizeStars(run.stars)),
    totalPopped: prev.totalPopped + sanitizeNonNegativeInt(run.popped),
    preferredMode: sanitizeMode(run.mode),
  };
  persistFruitPopSave(next);
  return { ...next };
}

export function getFruitPopBestStars(save: FruitPopSaveData): number {
  if (!isPlainRecord(save)) return 0;
  return sanitizeStars(save.bestStars);
}

function createDefaultMemoryMatchSave(): MemoryMatchSaveData {
  return {
    bestStarsByGrid: {},
    bestMovesByGrid: {},
    totalSmoothiesBlended: 0,
    preferredMode: 'KID',
  };
}

function cloneMemoryMatchSave(save: MemoryMatchSaveData): MemoryMatchSaveData {
  return {
    bestStarsByGrid: { ...save.bestStarsByGrid },
    bestMovesByGrid: { ...save.bestMovesByGrid },
    totalSmoothiesBlended: save.totalSmoothiesBlended,
    preferredMode: save.preferredMode,
  };
}

function sanitizeMemoryMatchSave(raw: unknown): MemoryMatchSaveData {
  if (!isPlainRecord(raw)) {
    return createDefaultMemoryMatchSave();
  }

  const bestStarsByGrid: Partial<Record<MemoryMatchGridId, number>> = {};
  if (isPlainRecord(raw.bestStarsByGrid)) {
    for (const gridId of VALID_GRID_IDS) {
      if (Object.prototype.hasOwnProperty.call(raw.bestStarsByGrid, gridId)) {
        bestStarsByGrid[gridId] = sanitizeStars(raw.bestStarsByGrid[gridId]);
      }
    }
  }

  const bestMovesByGrid: Partial<Record<MemoryMatchGridId, number>> = {};
  if (isPlainRecord(raw.bestMovesByGrid)) {
    for (const gridId of VALID_GRID_IDS) {
      if (Object.prototype.hasOwnProperty.call(raw.bestMovesByGrid, gridId)) {
        const moves = sanitizeNonNegativeInt(raw.bestMovesByGrid[gridId]);
        if (moves > 0) {
          bestMovesByGrid[gridId] = moves;
        }
      }
    }
  }

  return {
    bestStarsByGrid,
    bestMovesByGrid,
    totalSmoothiesBlended: sanitizeNonNegativeInt(raw.totalSmoothiesBlended),
    preferredMode: sanitizeMode(raw.preferredMode),
  };
}

export function loadMemoryMatchSave(): MemoryMatchSaveData {
  return sanitizeMemoryMatchSave(readJson(MEMORY_MATCH_STORAGE_KEY));
}

export function persistMemoryMatchSave(data: MemoryMatchSaveData): void {
  writeJson(MEMORY_MATCH_STORAGE_KEY, sanitizeMemoryMatchSave(data));
}

export function recordMemoryMatchWin(run: {
  gridId: MemoryMatchGridId;
  stars: number;
  moves: number;
  smoothiesBlended: number;
  mode: ArcadeMode;
}): MemoryMatchSaveData {
  const prev = loadMemoryMatchSave();
  const bestStarsByGrid: Partial<Record<MemoryMatchGridId, number>> = {
    ...prev.bestStarsByGrid,
  };
  const bestMovesByGrid: Partial<Record<MemoryMatchGridId, number>> = {
    ...prev.bestMovesByGrid,
  };

  if (VALID_GRID_ID_SET.has(run.gridId)) {
    const prevStars = prev.bestStarsByGrid[run.gridId] ?? 0;
    bestStarsByGrid[run.gridId] = Math.max(prevStars, sanitizeStars(run.stars));

    const moves = sanitizeNonNegativeInt(run.moves);
    if (moves > 0) {
      const prevMoves = prev.bestMovesByGrid[run.gridId];
      bestMovesByGrid[run.gridId] =
        prevMoves !== undefined && prevMoves > 0
          ? Math.min(prevMoves, moves)
          : moves;
    }
  }

  const next: MemoryMatchSaveData = {
    bestStarsByGrid,
    bestMovesByGrid,
    totalSmoothiesBlended:
      prev.totalSmoothiesBlended + sanitizeNonNegativeInt(run.smoothiesBlended),
    preferredMode: sanitizeMode(run.mode),
  };
  persistMemoryMatchSave(next);
  return cloneMemoryMatchSave(next);
}

export function getMemoryMatchTotalStars(save: MemoryMatchSaveData): number {
  if (!isPlainRecord(save) || !isPlainRecord(save.bestStarsByGrid)) {
    return 0;
  }
  let total = 0;
  for (const gridId of VALID_GRID_IDS) {
    if (Object.prototype.hasOwnProperty.call(save.bestStarsByGrid, gridId)) {
      total += sanitizeStars(save.bestStarsByGrid[gridId]);
    }
  }
  return total;
}
