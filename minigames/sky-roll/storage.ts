import {
  FRUIT_SKINS,
  FruitSkinId,
  SkyRollDifficulty,
  SkyRollSaveData,
} from './types';

const STORAGE_KEY = 'juicyDrop_skyRoll_v1';

const DEFAULT_SAVE: SkyRollSaveData = {
  highestUnlockedLevel: 1,
  starsByLevel: {},
  coins: 0,
  unlockedSkins: ['orange'],
  selectedSkin: 'orange',
  preferredDifficulty: 'KID',
};

const VALID_SKIN_IDS = new Set<FruitSkinId>(FRUIT_SKINS.map((s) => s.id));

export function loadSkyRollSave(): SkyRollSaveData {
  if (typeof window === 'undefined') return { ...DEFAULT_SAVE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const parsed = JSON.parse(raw) as Partial<SkyRollSaveData>;
    const unlockedSkins: FruitSkinId[] = Array.isArray(parsed.unlockedSkins)
      ? parsed.unlockedSkins.filter((s): s is FruitSkinId =>
          VALID_SKIN_IDS.has(s as FruitSkinId),
        )
      : ['orange'];
    if (!unlockedSkins.includes('orange')) unlockedSkins.unshift('orange');

    const selectedSkin: FruitSkinId =
      parsed.selectedSkin && unlockedSkins.includes(parsed.selectedSkin)
        ? parsed.selectedSkin
        : 'orange';

    const preferredDifficulty: SkyRollDifficulty =
      parsed.preferredDifficulty === 'ARCADE' ? 'ARCADE' : 'KID';

    return {
      highestUnlockedLevel: Math.max(
        1,
        Math.min(10, Number(parsed.highestUnlockedLevel) || 1),
      ),
      starsByLevel:
        parsed.starsByLevel && typeof parsed.starsByLevel === 'object'
          ? parsed.starsByLevel
          : {},
      coins: Math.max(0, Math.floor(Number(parsed.coins) || 0)),
      unlockedSkins,
      selectedSkin,
      preferredDifficulty,
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function persistSkyRollSave(data: SkyRollSaveData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota/private-mode storage errors
  }
}

export function getTotalStars(save: SkyRollSaveData): number {
  return Object.values(save.starsByLevel).reduce(
    (sum, s) => sum + Math.max(0, Math.min(3, Number(s) || 0)),
    0,
  );
}

export function getStarBonusCoins(stars: number): number {
  if (stars >= 3) return 40;
  if (stars === 2) return 25;
  return 15;
}
