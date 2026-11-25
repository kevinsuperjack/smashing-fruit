import type { ArcadeMode } from '../arcadeStorage';
import type { AppTheme } from '../../utils/theme';
import type {
  BubbleKind,
  BubbleOrnamentStyle,
  CreateFruitPopOptions,
  FloatingCallout,
  FruitBubble,
  FruitPopBounds,
  FruitPopEvent,
  FruitPopFruitDef,
  FruitPopHudSnapshot,
  FruitPopModeConfig,
  FruitPopState,
  PopResult,
  RngFn,
  SpawnBubbleOptions,
  SplashParticle,
  SplashRing,
} from './types';

export const FIXED_DT = 1 / 60;
export const MAX_STEP_SUBSTEP_DT = 0.05;
export const MAX_STEP_TOTAL_DT = 120;

export const GOLDEN_SEED_BUBBLE_BONUS = 3;
export const KID_ROUND_DURATION_SEC = 45;
export const ARCADE_ROUND_DURATION_SEC = 60;
export const KID_CELEBRATION_INTERVAL = 15;
export const COMBO_DECAY_SEC = 1.85;
export const MAX_COMBO_MULTIPLIER = 4;

export const RAINBOW_CHAIN_MIN_RADIUS = 155;
export const RAINBOW_CHAIN_RADIUS_SCALE = 3.4;

export const ARCADE_STAR_THRESHOLDS = {
  one: 120,
  two: 450,
  three: 900,
} as const;

export const KID_STAR_THRESHOLDS = {
  two: 5,
  three: 12,
} as const;

export const FRUIT_POP_FRUITS: readonly FruitPopFruitDef[] = [
  {
    tier: 1,
    name: 'Cherry',
    kidName: 'Cherry',
    spokenPhrase: 'Red Cherry!',
    emoji: '🍒',
    color: '#E63946',
    accentColor: '#FDA4AF',
    assetKey: 'fruit_cherry',
    basePoints: 10,
  },
  {
    tier: 2,
    name: 'Strawberry',
    kidName: 'Strawberry',
    spokenPhrase: 'Sweet Strawberry!',
    emoji: '🍓',
    color: '#FF595E',
    accentColor: '#FECDD3',
    assetKey: 'fruit_strawberry',
    basePoints: 12,
  },
  {
    tier: 3,
    name: 'Grape',
    kidName: 'Grapes',
    spokenPhrase: 'Purple Grapes!',
    emoji: '🍇',
    color: '#8338EC',
    accentColor: '#DDD6FE',
    assetKey: 'fruit_grape',
    basePoints: 14,
  },
  {
    tier: 4,
    name: 'Dekopon',
    kidName: 'Tangerine',
    spokenPhrase: 'Juicy Tangerine!',
    emoji: '🍊',
    color: '#FB8500',
    accentColor: '#FDE68A',
    assetKey: 'fruit_dekopon',
    basePoints: 16,
  },
  {
    tier: 5,
    name: 'Persimmon',
    kidName: 'Orange',
    spokenPhrase: 'Sunny Orange!',
    emoji: '🟠',
    color: '#F77F00',
    accentColor: '#FED7AA',
    assetKey: 'fruit_persimmon',
    basePoints: 18,
  },
  {
    tier: 7,
    name: 'Apple',
    kidName: 'Apple',
    spokenPhrase: 'Shiny Red Apple!',
    emoji: '🍎',
    color: '#D62828',
    accentColor: '#FCA5A5',
    assetKey: 'fruit_apple',
    basePoints: 20,
  },
  {
    tier: 8,
    name: 'Pear',
    kidName: 'Pear',
    spokenPhrase: 'Green Pear!',
    emoji: '🍐',
    color: '#A7C957',
    accentColor: '#ECFCCB',
    assetKey: 'fruit_pear',
    basePoints: 22,
  },
  {
    tier: 9,
    name: 'Peach',
    kidName: 'Peach',
    spokenPhrase: 'Fuzzy Pink Peach!',
    emoji: '🍑',
    color: '#FF99C8',
    accentColor: '#FCE7F3',
    assetKey: 'fruit_peach',
    basePoints: 24,
  },
  {
    tier: 10,
    name: 'Pineapple',
    kidName: 'Pineapple',
    spokenPhrase: 'Big Yellow Pineapple!',
    emoji: '🍍',
    color: '#FFBE0B',
    accentColor: '#FEF08A',
    assetKey: 'fruit_pineapple',
    basePoints: 26,
  },
  {
    tier: 12,
    name: 'Watermelon',
    kidName: 'Watermelon',
    spokenPhrase: 'Giant Green Watermelon!',
    emoji: '🍉',
    color: '#2D6A4F',
    accentColor: '#A7F3D0',
    assetKey: 'fruit_watermelon',
    basePoints: 30,
  },
];

export const FRUIT_POP_MODE_CONFIGS: Record<ArcadeMode, FruitPopModeConfig> = {
  KID: {
    mode: 'KID',
    roundDurationSec: KID_ROUND_DURATION_SEC,
    spawnIntervalSec: 0.95,
    minSpawnIntervalSec: 0.78,
    maxActiveBubbles: 10,
    minRadius: 38,
    maxRadius: 54,
    minSpeed: 48,
    maxSpeed: 82,
    hitRadiusMultiplier: 1.38,
    hitRadiusPaddingPx: 14,
    rainbowChance: 0.12,
    goldenChance: 0.08,
    comboWindowSec: 2.5,
    maxComboMultiplier: MAX_COMBO_MULTIPLIER,
  },
  ARCADE: {
    mode: 'ARCADE',
    roundDurationSec: ARCADE_ROUND_DURATION_SEC,
    spawnIntervalSec: 0.62,
    minSpawnIntervalSec: 0.34,
    maxActiveBubbles: 16,
    minRadius: 27,
    maxRadius: 43,
    minSpeed: 90,
    maxSpeed: 170,
    hitRadiusMultiplier: 1.12,
    hitRadiusPaddingPx: 6,
    rainbowChance: 0.09,
    goldenChance: 0.07,
    comboWindowSec: COMBO_DECAY_SEC,
    maxComboMultiplier: MAX_COMBO_MULTIPLIER,
  },
};

function clamp(val: number, min: number, max: number): number {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

function sanitizeBounds(bounds?: FruitPopBounds): FruitPopBounds {
  const rawW = bounds && Number.isFinite(bounds.width) ? bounds.width : 420;
  const rawH = bounds && Number.isFinite(bounds.height) ? bounds.height : 720;
  return {
    width: Math.max(160, rawW),
    height: Math.max(240, rawH),
  };
}

function getOrnamentForTheme(theme: AppTheme): BubbleOrnamentStyle {
  return theme === 'CHRISTMAS' ? 'snowglobe' : 'none';
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pickFruitDef(
  fruitTier: number | undefined,
  rng: RngFn,
): FruitPopFruitDef {
  if (fruitTier !== undefined) {
    for (let i = 0; i < FRUIT_POP_FRUITS.length; i++) {
      if (FRUIT_POP_FRUITS[i].tier === fruitTier) {
        return FRUIT_POP_FRUITS[i];
      }
    }
  }
  const idx = Math.min(
    FRUIT_POP_FRUITS.length - 1,
    Math.max(0, Math.floor(rng() * FRUIT_POP_FRUITS.length)),
  );
  return FRUIT_POP_FRUITS[idx];
}

function computeAnimatedRadius(bubble: FruitBubble): number {
  const spawnEase = Math.min(1, 0.35 + (bubble.age / 0.22) * 0.65);
  const breathe = 1 + Math.sin(bubble.age * 3.2 + bubble.wobblePhase) * 0.035;
  return bubble.baseRadius * spawnEase * breathe;
}

function computeClampedX(bubble: FruitBubble, boundsWidth: number): number {
  const minX = bubble.baseRadius;
  const maxX = Math.max(minX, boundsWidth - bubble.baseRadius);
  const wobbleOffset =
    Math.sin(bubble.age * bubble.wobbleFreq + bubble.wobblePhase) *
    bubble.wobbleAmp;
  return clamp(bubble.baseX + wobbleOffset, minX, maxX);
}

export function createDeterministicRng(seed: number): RngFn {
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getComboMultiplier(
  comboCount: number,
  maxMultiplier: number = MAX_COMBO_MULTIPLIER,
): number {
  if (!Number.isFinite(comboCount) || comboCount <= 0) return 1;
  const cap = Math.max(1, Math.floor(maxMultiplier));
  return Math.min(cap, 1 + Math.floor(Math.max(0, comboCount) / 3));
}

export function computeFruitPopStars(
  score: number,
  totalPopped: number,
  mode: ArcadeMode,
): number {
  if (mode === 'KID') {
    if (totalPopped >= KID_STAR_THRESHOLDS.three) return 3;
    if (totalPopped >= KID_STAR_THRESHOLDS.two) return 2;
    return 1;
  }
  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  if (safeScore >= ARCADE_STAR_THRESHOLDS.three) return 3;
  if (safeScore >= ARCADE_STAR_THRESHOLDS.two) return 2;
  if (safeScore >= ARCADE_STAR_THRESHOLDS.one) return 1;
  return 0;
}

export function computeFruitPopGoldenSeeds(
  score: number,
  stars: number,
  bonusGoldenSeeds: number,
  totalPopped: number,
  mode: ArcadeMode,
): number {
  const safeBonus = Number.isFinite(bonusGoldenSeeds)
    ? Math.max(0, Math.floor(bonusGoldenSeeds))
    : 0;

  if (mode === 'KID') {
    const safePopped = Number.isFinite(totalPopped)
      ? Math.max(0, Math.floor(totalPopped))
      : 0;
    return Math.max(3, Math.floor(safePopped / 3)) + safeBonus;
  }

  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const starBonus =
    stars >= 3 ? 15 : stars === 2 ? 8 : stars === 1 ? 3 : 0;
  return Math.floor(safeScore / 40) + starBonus + safeBonus;
}

export function createFruitPopState(
  options: CreateFruitPopOptions,
): FruitPopState {
  const mode: ArcadeMode = options.mode === 'ARCADE' ? 'ARCADE' : 'KID';
  const theme: AppTheme =
    options.theme === 'CHRISTMAS' ? 'CHRISTMAS' : 'ORCHARD';
  const kidEndless = mode === 'KID' ? Boolean(options.kidEndless) : false;
  const bounds = sanitizeBounds(options.bounds);
  const config = FRUIT_POP_MODE_CONFIGS[mode];
  const rng = options.rng ?? Math.random;

  const state: FruitPopState = {
    mode,
    theme,
    kidEndless,
    bounds,
    status: 'PLAYING',
    elapsedSec: 0,
    timeRemainingSec: kidEndless ? null : config.roundDurationSec,
    spawnCooldownSec: config.spawnIntervalSec * 0.45,
    nextEntityId: 1,
    bubbles: [],
    particles: [],
    rings: [],
    callouts: [],
    score: 0,
    totalPopped: 0,
    escapedCount: 0,
    kidCount1To10: 0,
    kidCelebrationCount: 0,
    lastFruitName: null,
    lastSpokenPhrase: null,
    discoveredFruits: [],
    comboCount: 0,
    comboMultiplier: 1,
    maxComboReached: 0,
    comboTimerSec: 0,
    rainbowPops: 0,
    goldenPops: 0,
    bonusGoldenSeeds: 0,
  };

  const initialCount =
    typeof options.initialBubbles === 'number' &&
    Number.isFinite(options.initialBubbles)
      ? Math.max(
          0,
          Math.min(config.maxActiveBubbles, Math.floor(options.initialBubbles)),
        )
      : 4;

  for (let i = 0; i < initialCount; i++) {
    const t = initialCount > 1 ? (i + 0.5) / initialCount : 0.5;
    const y = lerp(bounds.height * 0.34, bounds.height * 0.86, t);
    const bubble = spawnFruitPopBubble(state, { y, rng });
    // Pre-warm age slightly so initial bubbles appear already inflated
    bubble.age = 0.25 + i * 0.12;
    bubble.radius = computeAnimatedRadius(bubble);
    bubble.x = computeClampedX(bubble, state.bounds.width);
  }

  return state;
}

export function resizeFruitPopBounds(
  state: FruitPopState,
  bounds: FruitPopBounds,
): void {
  state.bounds = sanitizeBounds(bounds);
  for (let i = 0; i < state.bubbles.length; i++) {
    const bubble = state.bubbles[i];
    const minX = bubble.baseRadius;
    const maxX = Math.max(minX, state.bounds.width - bubble.baseRadius);
    bubble.baseX = clamp(bubble.baseX, minX, maxX);
    bubble.x = computeClampedX(bubble, state.bounds.width);
  }
}

export function setFruitPopTheme(state: FruitPopState, theme: AppTheme): void {
  const normalized: AppTheme = theme === 'CHRISTMAS' ? 'CHRISTMAS' : 'ORCHARD';
  state.theme = normalized;
  const ornament = getOrnamentForTheme(normalized);
  for (let i = 0; i < state.bubbles.length; i++) {
    state.bubbles[i].ornament = ornament;
  }
}

export function spawnFruitPopBubble(
  state: FruitPopState,
  options?: SpawnBubbleOptions,
): FruitBubble {
  const rng = options?.rng ?? Math.random;
  const config = FRUIT_POP_MODE_CONFIGS[state.mode];

  let kind: BubbleKind;
  if (options?.kind) {
    kind = options.kind;
  } else {
    const roll = rng();
    if (roll < config.goldenChance) {
      kind = 'golden';
    } else if (roll < config.goldenChance + config.rainbowChance) {
      kind = 'rainbow';
    } else {
      kind = 'fruit';
    }
  }

  const fruit = pickFruitDef(options?.fruitTier, rng);
  const baseRadius =
    options?.radius !== undefined && Number.isFinite(options.radius)
      ? Math.max(16, options.radius)
      : lerp(config.minRadius, config.maxRadius, rng());

  const minX = baseRadius + 6;
  const maxX = Math.max(minX, state.bounds.width - baseRadius - 6);
  const baseX =
    options?.x !== undefined && Number.isFinite(options.x)
      ? clamp(options.x, baseRadius, Math.max(baseRadius, state.bounds.width - baseRadius))
      : lerp(minX, maxX, rng());

  const y =
    options?.y !== undefined && Number.isFinite(options.y)
      ? options.y
      : state.bounds.height + baseRadius + 8;

  const speedBoost =
    state.mode === 'ARCADE'
      ? Math.min(1, state.elapsedSec / ARCADE_ROUND_DURATION_SEC) * 28
      : 0;
  const speed = lerp(config.minSpeed, config.maxSpeed, rng()) + speedBoost;
  const vy =
    options?.vy !== undefined && Number.isFinite(options.vy)
      ? options.vy
      : -Math.abs(speed);

  const wobbleAmp =
    state.mode === 'KID' ? lerp(8, 18, rng()) : lerp(10, 26, rng());
  const wobbleFreq = lerp(1.3, 2.5, rng());
  const wobblePhase = rng() * Math.PI * 2;
  const shimmerPhase = rng() * Math.PI * 2;

  const bubble: FruitBubble = {
    id: state.nextEntityId++,
    kind,
    fruitTier: fruit.tier,
    fruitName:
      kind === 'rainbow'
        ? 'Rainbow Bubble'
        : kind === 'golden'
        ? 'Golden Seed'
        : fruit.name,
    kidName:
      kind === 'rainbow'
        ? 'Rainbow'
        : kind === 'golden'
        ? 'Golden Seed'
        : fruit.kidName,
    spokenPhrase:
      kind === 'rainbow'
        ? 'Rainbow pop!'
        : kind === 'golden'
        ? 'Golden seed!'
        : fruit.spokenPhrase,
    emoji:
      kind === 'rainbow' ? '🌈' : kind === 'golden' ? '🪙' : fruit.emoji,
    color:
      kind === 'rainbow'
        ? '#EC4899'
        : kind === 'golden'
        ? '#F59E0B'
        : fruit.color,
    accentColor:
      kind === 'rainbow'
        ? '#FEF08A'
        : kind === 'golden'
        ? '#FEF9C3'
        : fruit.accentColor,
    assetKey: fruit.assetKey,
    x: baseX,
    baseX,
    y,
    vy,
    baseRadius,
    radius: baseRadius * 0.35,
    wobbleAmp,
    wobbleFreq,
    wobblePhase,
    age: 0,
    basePoints: fruit.basePoints,
    ornament: getOrnamentForTheme(state.theme),
    shimmerPhase,
  };

  bubble.x = computeClampedX(bubble, state.bounds.width);
  state.bubbles.push(bubble);
  return bubble;
}

function getCurrentSpawnInterval(state: FruitPopState): number {
  const config = FRUIT_POP_MODE_CONFIGS[state.mode];
  const duration = config.roundDurationSec ?? KID_ROUND_DURATION_SEC;
  const progress = clamp(state.elapsedSec / duration, 0, 1);
  return lerp(config.spawnIntervalSec, config.minSpawnIntervalSec, progress);
}

function stepSingleChunk(
  state: FruitPopState,
  dt: number,
  rng: RngFn,
  events: FruitPopEvent[],
): void {
  const config = FRUIT_POP_MODE_CONFIGS[state.mode];

  state.elapsedSec += dt;
  if (state.timeRemainingSec !== null) {
    state.timeRemainingSec = Math.max(0, state.timeRemainingSec - dt);
  }

  // Combo decay
  if (state.comboCount > 0) {
    state.comboTimerSec -= dt;
    if (state.comboTimerSec <= 0) {
      const previousCombo = state.comboCount;
      state.comboCount = 0;
      state.comboMultiplier = 1;
      state.comboTimerSec = 0;
      events.push({
        type: 'COMBO_RESET',
        previousCombo,
      });
    }
  }

  // Bubble buoyancy, horizontal sine wobble, radius breathing, and offscreen culling
  const survivingBubbles: FruitBubble[] = [];
  for (let i = 0; i < state.bubbles.length; i++) {
    const bubble = state.bubbles[i];
    bubble.age += dt;
    bubble.y += bubble.vy * dt;
    bubble.x = computeClampedX(bubble, state.bounds.width);
    bubble.radius = computeAnimatedRadius(bubble);

    if (bubble.y + bubble.baseRadius < -24) {
      state.escapedCount += 1;
    } else {
      survivingBubbles.push(bubble);
    }
  }
  state.bubbles = survivingBubbles;

  // Spawning new bubbles
  state.spawnCooldownSec -= dt;
  while (
    state.spawnCooldownSec <= 0 &&
    state.bubbles.length < config.maxActiveBubbles
  ) {
    spawnFruitPopBubble(state, { rng });
    state.spawnCooldownSec += getCurrentSpawnInterval(state);
  }
  if (state.spawnCooldownSec < 0) {
    state.spawnCooldownSec = 0;
  }

  // Update splash particles
  const survivingParticles: SplashParticle[] = [];
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life > 0) {
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = clamp(p.life / p.maxLife, 0, 1);
      survivingParticles.push(p);
    }
  }
  state.particles = survivingParticles;

  // Update splash rings
  const survivingRings: SplashRing[] = [];
  for (let i = 0; i < state.rings.length; i++) {
    const r = state.rings[i];
    r.life -= dt;
    if (r.life > 0) {
      const progress = 1 - r.life / r.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2);
      r.radius = lerp(r.radius, r.maxRadius, Math.min(1, eased * 0.45 + 0.12));
      r.alpha = clamp(r.life / r.maxLife, 0, 1);
      survivingRings.push(r);
    }
  }
  state.rings = survivingRings;

  // Update floating callouts
  const survivingCallouts: FloatingCallout[] = [];
  for (let i = 0; i < state.callouts.length; i++) {
    const c = state.callouts[i];
    c.life -= dt;
    if (c.life > 0) {
      c.y += c.vy * dt;
      survivingCallouts.push(c);
    }
  }
  state.callouts = survivingCallouts;

  // Timed round completion
  if (state.timeRemainingSec !== null && state.timeRemainingSec <= 1e-7) {
    state.timeRemainingSec = 0;
    state.status = 'FINISHED';
    const stars = computeFruitPopStars(
      state.score,
      state.totalPopped,
      state.mode,
    );
    const goldenSeedsEarned = computeFruitPopGoldenSeeds(
      state.score,
      stars,
      state.bonusGoldenSeeds,
      state.totalPopped,
      state.mode,
    );
    events.push({
      type: 'ROUND_COMPLETE',
      mode: state.mode,
      score: state.score,
      stars,
      totalPopped: state.totalPopped,
      goldenSeedsEarned,
    });
  }
}

export function stepFruitPop(
  state: FruitPopState,
  dt: number,
  rng: RngFn = Math.random,
): FruitPopEvent[] {
  if (state.status !== 'PLAYING' || !Number.isFinite(dt) || dt <= 0) {
    return [];
  }

  const events: FruitPopEvent[] = [];
  let remaining = Math.min(dt, MAX_STEP_TOTAL_DT);

  while (remaining > 1e-9 && state.status === 'PLAYING') {
    let chunk = Math.min(remaining, MAX_STEP_SUBSTEP_DT);
    if (
      state.timeRemainingSec !== null &&
      state.timeRemainingSec > 0 &&
      chunk > state.timeRemainingSec
    ) {
      chunk = state.timeRemainingSec;
    }
    stepSingleChunk(state, chunk, rng, events);
    remaining -= chunk;
  }

  return events;
}

function spawnPopVfx(
  state: FruitPopState,
  bubble: FruitBubble,
  pointsAwarded: number,
  isChainReaction: boolean,
  rng: RngFn,
): void {
  const isRainbow = bubble.kind === 'rainbow';
  const isGolden = bubble.kind === 'golden';

  const ring: SplashRing = {
    x: bubble.x,
    y: bubble.y,
    radius: bubble.radius * 0.72,
    maxRadius: isRainbow ? bubble.radius * 3.1 : bubble.radius * 2.15,
    color: bubble.color,
    lineWidth: isRainbow ? 5 : isGolden ? 4 : 3,
    alpha: 1,
    life: isRainbow ? 0.42 : 0.3,
    maxLife: isRainbow ? 0.42 : 0.3,
    isRainbow,
  };
  state.rings.push(ring);

  const particleCount = isRainbow ? 18 : isGolden ? 14 : 11;
  const rainbowPalette = [
    '#EC4899',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#8B5CF6',
  ];

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (rng() - 0.5) * 0.35;
    const speed = lerp(70, isRainbow ? 260 : 190, rng());
    const maxLife = lerp(0.28, 0.56, rng());
    const color = isRainbow
      ? rainbowPalette[i % rainbowPalette.length]
      : i % 3 === 0
      ? bubble.accentColor
      : bubble.color;

    state.particles.push({
      x: bubble.x + Math.cos(angle) * bubble.radius * 0.25,
      y: bubble.y + Math.sin(angle) * bubble.radius * 0.25,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 35,
      radius: lerp(3, isRainbow ? 7.5 : 6, rng()),
      color,
      alpha: 1,
      life: maxLife,
      maxLife,
      gravity: 280,
    });
  }

  let calloutText = `+${pointsAwarded}`;
  let calloutColor = '#FFFFFF';
  if (isRainbow) {
    calloutText = `🌈 +${pointsAwarded}`;
    calloutColor = '#FDE047';
  } else if (isGolden) {
    calloutText = `🪙 +${GOLDEN_SEED_BUBBLE_BONUS}`;
    calloutColor = '#FCD34D';
  } else if (state.mode === 'KID') {
    calloutText = `${state.kidCount1To10}! ${bubble.kidName}`;
    calloutColor = '#FEF08A';
  } else if (isChainReaction) {
    calloutText = `✨ +${pointsAwarded}`;
    calloutColor = '#F9A8D4';
  } else if (state.comboMultiplier > 1) {
    calloutText = `+${pointsAwarded} (${state.comboMultiplier}x)`;
    calloutColor = '#FDE68A';
  }

  state.callouts.push({
    id: state.nextEntityId++,
    x: bubble.x,
    y: bubble.y - bubble.radius * 0.35,
    vy: -56,
    text: calloutText,
    color: calloutColor,
    life: 0.78,
    maxLife: 0.78,
    scale: isRainbow || isGolden ? 1.18 : 1,
  });
}

export function popAtPoint(
  state: FruitPopState,
  x: number,
  y: number,
  rng: RngFn = Math.random,
): PopResult {
  return popAtPoints(state, [{ x, y }], rng);
}

export function popAtPoints(
  state: FruitPopState,
  points: ReadonlyArray<{ x: number; y: number }>,
  rng: RngFn = Math.random,
): PopResult {
  if (state.status !== 'PLAYING' || points.length === 0) {
    return {
      poppedCount: 0,
      pointsAwarded: 0,
      goldenSeedsAwarded: 0,
      events: [],
    };
  }

  const config = FRUIT_POP_MODE_CONFIGS[state.mode];
  const poppedIds = new Set<number>();
  const queue: Array<{ bubble: FruitBubble; isChainReaction: boolean }> = [];

  for (let pIdx = 0; pIdx < points.length; pIdx++) {
    const pt = points[pIdx];
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;

    // Topmost bubble first (later in array = rendered on top)
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
      const bubble = state.bubbles[i];
      if (poppedIds.has(bubble.id)) continue;

      const hitR =
        bubble.radius * config.hitRadiusMultiplier + config.hitRadiusPaddingPx;
      const dx = pt.x - bubble.x;
      const dy = pt.y - bubble.y;
      if (dx * dx + dy * dy <= hitR * hitR) {
        poppedIds.add(bubble.id);
        queue.push({ bubble, isChainReaction: false });
        break;
      }
    }
  }

  if (queue.length === 0) {
    return {
      poppedCount: 0,
      pointsAwarded: 0,
      goldenSeedsAwarded: 0,
      events: [],
    };
  }

  const events: FruitPopEvent[] = [];
  let totalPointsAwarded = 0;
  let totalGoldenSeedsAwarded = 0;
  let poppedCount = 0;

  let head = 0;
  while (head < queue.length) {
    const { bubble, isChainReaction } = queue[head++];
    poppedCount += 1;

    state.totalPopped += 1;
    state.comboCount += 1;
    state.comboMultiplier = getComboMultiplier(
      state.comboCount,
      config.maxComboMultiplier,
    );
    state.maxComboReached = Math.max(state.maxComboReached, state.comboCount);
    state.comboTimerSec = config.comboWindowSec;
    state.kidCount1To10 = ((state.totalPopped - 1) % 10) + 1;
    state.lastFruitName = bubble.kidName;
    state.lastSpokenPhrase = bubble.spokenPhrase;

    if (!state.discoveredFruits.includes(bubble.kidName)) {
      state.discoveredFruits.push(bubble.kidName);
    }

    const kindBonus =
      bubble.kind === 'rainbow' ? 25 : bubble.kind === 'golden' ? 30 : 0;
    const baseScored =
      (bubble.basePoints + kindBonus) * state.comboMultiplier;
    const pointsAwarded = isChainReaction
      ? Math.round(baseScored * 1.25)
      : baseScored;

    state.score += pointsAwarded;
    totalPointsAwarded += pointsAwarded;

    events.push({
      type: 'BUBBLE_POPPED',
      bubbleId: bubble.id,
      kind: bubble.kind,
      fruitTier: bubble.fruitTier,
      fruitName: bubble.kidName,
      spokenPhrase: bubble.spokenPhrase,
      x: bubble.x,
      y: bubble.y,
      pointsAwarded,
      comboCount: state.comboCount,
      comboMultiplier: state.comboMultiplier,
      kidCount1To10: state.kidCount1To10,
      isChainReaction,
    });

    if (bubble.kind === 'golden') {
      state.goldenPops += 1;
      state.bonusGoldenSeeds += GOLDEN_SEED_BUBBLE_BONUS;
      totalGoldenSeedsAwarded += GOLDEN_SEED_BUBBLE_BONUS;
      events.push({
        type: 'GOLDEN_SEED_POP',
        bubbleId: bubble.id,
        x: bubble.x,
        y: bubble.y,
        seedsAwarded: GOLDEN_SEED_BUBBLE_BONUS,
      });
    }

    if (bubble.kind === 'rainbow') {
      state.rainbowPops += 1;
      const blastRadius = Math.max(
        RAINBOW_CHAIN_MIN_RADIUS,
        bubble.radius * RAINBOW_CHAIN_RADIUS_SCALE,
      );
      const blastRadiusSq = blastRadius * blastRadius;
      let chainedCount = 0;

      for (let i = 0; i < state.bubbles.length; i++) {
        const candidate = state.bubbles[i];
        if (poppedIds.has(candidate.id)) continue;
        const dx = candidate.x - bubble.x;
        const dy = candidate.y - bubble.y;
        if (dx * dx + dy * dy <= blastRadiusSq) {
          poppedIds.add(candidate.id);
          queue.push({ bubble: candidate, isChainReaction: true });
          chainedCount += 1;
        }
      }

      events.push({
        type: 'RAINBOW_CHAIN',
        sourceBubbleId: bubble.id,
        x: bubble.x,
        y: bubble.y,
        chainedCount,
      });
    }

    if (
      state.mode === 'KID' &&
      state.totalPopped % KID_CELEBRATION_INTERVAL === 0
    ) {
      state.kidCelebrationCount += 1;
      events.push({
        type: 'KID_CELEBRATION',
        totalPopped: state.totalPopped,
        milestone: state.totalPopped,
      });
    }

    spawnPopVfx(state, bubble, pointsAwarded, isChainReaction, rng);
  }

  state.bubbles = state.bubbles.filter((b) => !poppedIds.has(b.id));

  return {
    poppedCount,
    pointsAwarded: totalPointsAwarded,
    goldenSeedsAwarded: totalGoldenSeedsAwarded,
    events,
  };
}

export function finishFruitPopRound(
  state: FruitPopState,
): Extract<FruitPopEvent, { type: 'ROUND_COMPLETE' }> {
  state.status = 'FINISHED';
  if (state.timeRemainingSec !== null) {
    state.timeRemainingSec = 0;
  }
  const stars = computeFruitPopStars(
    state.score,
    state.totalPopped,
    state.mode,
  );
  const goldenSeedsEarned = computeFruitPopGoldenSeeds(
    state.score,
    stars,
    state.bonusGoldenSeeds,
    state.totalPopped,
    state.mode,
  );
  return {
    type: 'ROUND_COMPLETE',
    mode: state.mode,
    score: state.score,
    stars,
    totalPopped: state.totalPopped,
    goldenSeedsEarned,
  };
}

export function getFruitPopHudSnapshot(
  state: FruitPopState,
): FruitPopHudSnapshot {
  const config = FRUIT_POP_MODE_CONFIGS[state.mode];
  const stars = computeFruitPopStars(
    state.score,
    state.totalPopped,
    state.mode,
  );
  const projectedGoldenSeeds = computeFruitPopGoldenSeeds(
    state.score,
    stars,
    state.bonusGoldenSeeds,
    state.totalPopped,
    state.mode,
  );

  return {
    mode: state.mode,
    status: state.status,
    score: state.score,
    totalPopped: state.totalPopped,
    timeRemainingSec: state.timeRemainingSec,
    comboCount: state.comboCount,
    comboMultiplier: state.comboMultiplier,
    comboTimerRatio:
      state.comboCount > 0 && config.comboWindowSec > 0
        ? clamp(state.comboTimerSec / config.comboWindowSec, 0, 1)
        : 0,
    kidCount1To10: state.kidCount1To10,
    lastFruitName: state.lastFruitName,
    bonusGoldenSeeds: state.bonusGoldenSeeds,
    stars,
    projectedGoldenSeeds,
  };
}
