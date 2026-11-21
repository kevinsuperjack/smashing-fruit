export type SkyRollDifficulty = 'KID' | 'ARCADE';

export type SkyRollTheme =
  | 'meadow'
  | 'rainbow'
  | 'clouds'
  | 'windmill'
  | 'castle';

export type FruitSkinId =
  | 'orange'
  | 'strawberry'
  | 'watermelon'
  | 'peach'
  | 'pineapple'
  | 'durian';

export interface FruitSkinDef {
  id: FruitSkinId;
  name: string;
  emoji: string;
  price: number;
  primaryColor: string;
  accentColor: string;
  tagline: string;
}

export const FRUIT_SKINS: FruitSkinDef[] = [
  {
    id: 'orange',
    name: 'Sunny Orange',
    emoji: '🍊',
    price: 0,
    primaryColor: '#FF9800',
    accentColor: '#FFE082',
    tagline: 'Bouncy & bright!',
  },
  {
    id: 'strawberry',
    name: 'Sweet Berry',
    emoji: '🍓',
    price: 25,
    primaryColor: '#E53935',
    accentColor: '#66BB6A',
    tagline: 'Zippy red berry!',
  },
  {
    id: 'watermelon',
    name: 'Juicy Melon',
    emoji: '🍉',
    price: 50,
    primaryColor: '#2E7D32',
    accentColor: '#A5D6A7',
    tagline: 'Big striped roller!',
  },
  {
    id: 'peach',
    name: 'Fuzzy Peach',
    emoji: '🍑',
    price: 80,
    primaryColor: '#FF8A80',
    accentColor: '#FFD180',
    tagline: 'Soft & speedy!',
  },
  {
    id: 'pineapple',
    name: 'Golden Pine',
    emoji: '🍍',
    price: 120,
    primaryColor: '#FBC02D',
    accentColor: '#8D6E63',
    tagline: 'Cool sunny vibes!',
  },
  {
    id: 'durian',
    name: 'King Durian',
    emoji: '👑',
    price: 180,
    primaryColor: '#9CCC65',
    accentColor: '#FFD54F',
    tagline: 'Royal golden crown!',
  },
];

export type TrackSegmentKind = 'straight' | 'ramp' | 'moving' | 'finish';

/**
 * A walkable 3D sky track segment.
 * Forward travel progresses along -Z (zStart > zEnd, e.g. 4 -> -20).
 */
export interface TrackSegment {
  id: string;
  kind: TrackSegmentKind;
  x: number;
  zStart: number;
  zEnd: number;
  width: number;
  yStart: number;
  yEnd: number;
  color?: string;
  /** Optional lateral ('x') or forward ('z') oscillation for moving bridges. */
  moveAxis?: 'x' | 'z';
  moveRange?: number;
  moveSpeed?: number;
  movePhase?: number;
  /** Glowing forward boost pad on this segment (z offset from zStart toward zEnd). */
  boostAtZ?: number;
  /** Glowing bounce pad that auto-launches the ball upward & forward. */
  bouncePadAtZ?: number;
  bounceVelocityY?: number;
  bounceVelocityZ?: number;
  /** In Kid Mode only, adds a helpful glowing auto-bounce pad at the end of the segment before a gap. */
  kidAutoBounceAtZ?: number;
  /** Mid-course checkpoint arch placed at this Z coordinate on the segment. */
  checkpointAtZ?: number;
  /** Disable Kid Mode side guardrails on this segment (e.g., for moving platforms). */
  noGuardrails?: boolean;
}

export type ObstacleKind = 'slider' | 'windmill' | 'bumper';

export interface ObstacleDef {
  id: string;
  kind: ObstacleKind;
  /** Center X position (sliders oscillate around this X). */
  x: number;
  /** Base surface Y where the obstacle sits. */
  y: number;
  /** World Z position. */
  z: number;
  /** Width of a slider barrier or length of a windmill arm. */
  size: number;
  /** Height of obstacle body. */
  height: number;
  /** Oscillation range (for sliders) or radius (for bumpers). */
  range: number;
  /** Oscillation or rotation speed in rad/s. */
  speed: number;
  phase?: number;
}

export interface CoinDef {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface SkyLevelDef {
  id: number;
  name: string;
  theme: SkyRollTheme;
  subtitle: string;
  parTimeSec: number;
  spawn: { x: number; y: number; z: number };
  finishZ: number;
  segments: TrackSegment[];
  obstacles: ObstacleDef[];
  coins: CoinDef[];
}

export interface SkyRollSaveData {
  highestUnlockedLevel: number;
  starsByLevel: Record<number, number>;
  coins: number;
  unlockedSkins: FruitSkinId[];
  selectedSkin: FruitSkinId;
  preferredDifficulty: SkyRollDifficulty;
}

export interface ThemePalette {
  name: string;
  skyTop: string;
  skyBottom: string;
  fogColor: string;
  trackMain: string;
  trackEdge: string;
  accent: string;
  badgeBg: string;
}

export const SKY_THEME_PALETTES: Record<SkyRollTheme, ThemePalette> = {
  meadow: {
    name: 'Sunny Meadow',
    skyTop: '#38BDF8',
    skyBottom: '#E0F2FE',
    fogColor: '#BAE6FD',
    trackMain: '#F5CBA7',
    trackEdge: '#A04000',
    accent: '#22C55E',
    badgeBg: 'from-emerald-500 to-green-500',
  },
  rainbow: {
    name: 'Rainbow Bridges',
    skyTop: '#60A5FA',
    skyBottom: '#FCE7F3',
    fogColor: '#E0E7FF',
    trackMain: '#FDE68A',
    trackEdge: '#EC4899',
    accent: '#A855F7',
    badgeBg: 'from-pink-500 to-purple-500',
  },
  clouds: {
    name: 'Bouncy Clouds',
    skyTop: '#0EA5E9',
    skyBottom: '#F0F9FF',
    fogColor: '#E0F2FE',
    trackMain: '#FFFFFF',
    trackEdge: '#38BDF8',
    accent: '#06B6D4',
    badgeBg: 'from-sky-500 to-cyan-500',
  },
  windmill: {
    name: 'Windmill Towers',
    skyTop: '#FB923C',
    skyBottom: '#FEF3C7',
    fogColor: '#FDE68A',
    trackMain: '#FDBA74',
    trackEdge: '#9A3412',
    accent: '#F59E0B',
    badgeBg: 'from-amber-500 to-orange-500',
  },
  castle: {
    name: 'King Durian Castle',
    skyTop: '#6366F1',
    skyBottom: '#FDE68A',
    fogColor: '#DDD6FE',
    trackMain: '#E9D5FF',
    trackEdge: '#D97706',
    accent: '#EAB308',
    badgeBg: 'from-violet-600 to-amber-500',
  },
};
