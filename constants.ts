import {SpriteConfig} from './utils/helper';

/**
 * Theming configuration for Juicy Drop.
 */
export const THEME = {
  fontFamily: '"Fredoka", "Quicksand", "Nunito", system-ui, sans-serif',
  backgroundPastel: '#FDF6E3',
  woodBorder: '#C89666',
  woodDark: '#8C5832',
  woodLight: '#E8CAAA',
  jarGlass: 'rgba(255, 255, 255, 0.45)',
  jarBorder: '#8A5836',
  dangerColor: '#EF4444',
  dangerGlow: 'rgba(239, 68, 68, 0.35)',
  accentGold: '#F59E0B',
  accentGreen: '#10B981',
};

/**
 * Fruit Tier definition interface
 */
export interface FruitTier {
  tier: number;
  name: string;
  assetKey: string;
  radius: number;
  points: number;
  color: string;
  aspectRatio: number;
  width: number;
  height: number;
}

/**
 * Fruit definitions for all 11 tiers
 */
export const FRUIT_TIERS: FruitTier[] = [
  {
    tier: 1,
    name: 'Cherry',
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
    name: 'Apple',
    assetKey: 'fruit_apple',
    radius: 72,
    points: 64,
    color: '#D62828',
    aspectRatio: 513 / 571,
    width: 513,
    height: 571,
  },
  {
    tier: 7,
    name: 'Pear',
    assetKey: 'fruit_pear',
    radius: 86,
    points: 128,
    color: '#A7C957',
    aspectRatio: 519 / 753,
    width: 519,
    height: 753,
  },
  {
    tier: 8,
    name: 'Peach',
    assetKey: 'fruit_peach',
    radius: 100,
    points: 256,
    color: '#FF99C8',
    aspectRatio: 623 / 577,
    width: 623,
    height: 577,
  },
  {
    tier: 9,
    name: 'Pineapple',
    assetKey: 'fruit_pineapple',
    radius: 116,
    points: 512,
    color: '#FFBE0B',
    aspectRatio: 459 / 805,
    width: 459,
    height: 805,
  },
  {
    tier: 10,
    name: 'Melon',
    assetKey: 'fruit_melon',
    radius: 134,
    points: 1024,
    color: '#52B788',
    aspectRatio: 718 / 786,
    width: 718,
    height: 786,
  },
  {
    tier: 11,
    name: 'Watermelon',
    assetKey: 'fruit_watermelon',
    radius: 154,
    points: 2048,
    color: '#2D6A4F',
    aspectRatio: 619 / 620,
    width: 619,
    height: 620,
  },
];

/**
 * Configuration for the game.
 */
export const CONFIG = {
  // Game Setup
  title: {
    value: 'Juicy Drop',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 1200,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System Constants
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },

  // Thematic elements
  backgroundColor: {
    value: '#FDF6E3',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#F59E0B',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Fredoka, Quicksand, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Audio Levels
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.7,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // Physics Tuning
  gravityY: {
    value: 1.5,
    type: 'number',
    label: 'Gravity Y',
    group: 'Physics',
  },
  fruitRestitution: {
    value: 0.22,
    type: 'number',
    label: 'Fruit Bounciness',
    group: 'Physics',
  },
  fruitFriction: {
    value: 0.08,
    type: 'number',
    label: 'Fruit Friction',
    group: 'Physics',
  },
  fruitDensityMultiplier: {
    value: 0.002,
    type: 'number',
    label: 'Fruit Density Scale',
    group: 'Physics',
  },

  // Rules & Difficulty
  dropCooldownMs: {
    value: 500,
    type: 'number',
    label: 'Drop Cooldown (ms)',
    group: 'Rules',
  },
  dangerGraceSeconds: {
    value: 2.5,
    type: 'number',
    label: 'Danger Grace Time (s)',
    group: 'Rules',
  },
  maxSpawnTier: {
    value: 5,
    type: 'number',
    label: 'Max Dropper Fruit Tier',
    group: 'Rules',
  },
  twoWatermelonsVictory: {
    value: true,
    type: 'boolean',
    label: 'Two Watermelons Win Condition',
    group: 'Rules',
  },

  // Assets metadata references
  assetBgWidth: {
    value: 1376,
    type: 'number',
    label: 'Background Width',
    group: 'ASSETS',
  },
  assetBgHeight: {
    value: 768,
    type: 'number',
    label: 'Background Height',
    group: 'ASSETS',
  },
  assetBgAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Background Aspect Ratio',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const PRESETS = {};
