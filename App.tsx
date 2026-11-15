// tslint:disable
/* eslint-disable */
import Matter from 'matter-js';
import {
  Volume2,
  VolumeX,
  RotateCw,
  Play,
  HelpCircle,
  Menu as MenuIcon,
  X,
  Trophy,
  Sparkles,
  Zap,
  Compass,
  ArrowLeftRight,
  Calendar,
  Copy,
  Check,
} from 'lucide-react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  CONFIG,
  DropItem,
  FRUIT_TIERS,
  FruitTier,
  getConfig,
  SPECIAL_DROPS,
  SpecialDropKind,
  THEME,
} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {FruitBadgeIcon} from './components/FruitBadgeIcon';
import {
  createFixedStepper,
  createSeededRng,
  drawBackground,
  gameAudio,
  GameState,
  getDailyHarvestInfo,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useInput,
  useIsMobile,
} from './utils/helper';
import {
  usePlayground,
  usePlaygroundGameLifecycle,
  useRpc,
} from './utils/usePlayground';

const BACKGROUND_MUSIC_URL = 'assets/audio/bgm_cozy_orchard.mp3';
const HIGH_SCORE_STORAGE_KEY = 'juicydrop_highscore_v2';
const DAILY_HIGH_SCORE_PREFIX = 'juicydrop_daily_best_v1_';
const SFX_MUTE_STORAGE_KEY = 'juicydrop_sfx_muted_v1';
const MUSIC_MUTE_STORAGE_KEY = 'juicydrop_music_muted_v1';

type GameMode = 'CLASSIC' | 'DAILY';
type FruitExpression =
  | 'happy'
  | 'bouncy'
  | 'shocked'
  | 'sleepy'
  | 'regal'
  | 'sweating'
  | 'dizzy'
  | 'starry';

const ASSETS_MANIFEST: Record<string, string> = {
  cozy_wooden_backdrop: 'assets/images/cozy_wooden_backdrop.png',
  fruit_cherry: 'assets/images/fruit_cherry.png',
  fruit_strawberry: 'assets/images/fruit_strawberry.png',
  fruit_grape: 'assets/images/fruit_grape.png',
  fruit_dekopon: 'assets/images/fruit_dekopon.png',
  fruit_persimmon: 'assets/images/fruit_persimmon.png',
  fruit_apple: 'assets/images/fruit_apple.png',
  fruit_pear: 'assets/images/fruit_pear.png',
  fruit_peach: 'assets/images/fruit_peach.png',
  fruit_pineapple: 'assets/images/fruit_pineapple.png',
  fruit_melon: 'assets/images/fruit_melon.png',
  fruit_watermelon: 'assets/images/fruit_watermelon.png',
};

// Particle representation for juicy bursts and zero-G / electric effects
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  isSparkle?: boolean;
  isZeroG?: boolean;
  isElectric?: boolean;
}

// Floating score / banner text popup
interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  scale: number;
  fontSize?: number;
}

// Expanding juicy shockwave ring on merges & combos
interface ShockwaveRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  lineWidth: number;
}

// Active Fruit Entity tracking on physics body
interface FruitEntity {
  id: string;
  tier: number;
  special: SpecialDropKind;
  body: Matter.Body;
  spawnTime: number;
  renderScale: number;
  targetScale: number;
  squashX: number;
  squashY: number;
  squashVelX: number;
  squashVelY: number;
  lastImpactTime: number;
  blinkTimer: number;
  isBlinking: boolean;
  expression: FruitExpression;
  expressionTimer: number;
  merged: boolean;
}

interface MergeQueueEntry {
  fruitA: FruitEntity;
  fruitB: FruitEntity;
  midX: number;
  midY: number;
  kind: 'normal' | 'rainbow' | 'fizz_pair';
}

function getDropItemDetails(item: DropItem): {
  name: string;
  radius: number;
  color: string;
  tierConfig: FruitTier;
} {
  if (item.special !== 'none') {
    const spec = SPECIAL_DROPS[item.special];
    return {
      name: spec.name,
      radius: spec.radius,
      color: spec.color,
      tierConfig: FRUIT_TIERS[0],
    };
  }
  const tierConfig = FRUIT_TIERS[item.tier - 1] || FRUIT_TIERS[0];
  return {
    name: tierConfig.name,
    radius: tierConfig.radius,
    color: tierConfig.color,
    tierConfig,
  };
}

function getFruitEntityRadius(fruit: FruitEntity): number {
  if (fruit.special !== 'none') {
    return SPECIAL_DROPS[fruit.special].radius;
  }
  return FRUIT_TIERS[fruit.tier - 1]?.radius || 22;
}

// Active Magnet pull state
interface ActiveMagnet {
  fruitAId: number;
  fruitBId: number;
  remainingSeconds: number;
  totalSeconds: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper> | null>(null);
  const lastCancelRef = useRef(false);
  const isMobile = useIsMobile();

  // Playground SDK Integration
  const {sdk} = usePlayground();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // Preload Assets
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const canvasWidth = getConfig('baseCanvasWidth') as number;
  const canvasHeight = getConfig('baseCanvasHeight') as number;

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // Game UI and Flow State
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      return saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isEvolutionTreeOpen, setIsEvolutionTreeOpen] = useState(false);
  const [sfxMuted, setSfxMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(SFX_MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [musicMuted, setMusicMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(MUSIC_MUTE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [totalDrops, setTotalDrops] = useState(0);
  const [isEndlessMode, setIsEndlessMode] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('CLASSIC');
  const dailyInfo = useMemo(() => getDailyHarvestInfo(), []);
  const [dailyHighScore, setDailyHighScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const saved = localStorage.getItem(
        `${DAILY_HIGH_SCORE_PREFIX}${getDailyHarvestInfo().seedKey}`,
      );
      return saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [scorecardCopied, setScorecardCopied] = useState(false);
  const [maxCombo, setMaxCombo] = useState(0);
  const [totalMerges, setTotalMerges] = useState(0);
  const [highestTier, setHighestTier] = useState(1);
  const [musicTensionTier, setMusicTensionTier] = useState<0 | 1 | 2>(0);

  // Merge-Charged Power-up States (0..100%, start ready at 100%)
  const [antiGravityCharge, setAntiGravityCharge] = useState<number>(100);
  const [antiGravityActive, setAntiGravityActive] = useState<boolean>(false);
  const [antiGravityActiveSec, setAntiGravityActiveSec] = useState<number>(0);
  const [magnetCharge, setMagnetCharge] = useState<number>(100);
  const [magnetActive, setMagnetActive] = useState<boolean>(false);

  // Dropper, Next & Hold Basket Items in React state for HUD badges
  const [currentItem, setCurrentItem] = useState<DropItem>({
    tier: 1,
    special: 'none',
  });
  const [nextItem, setNextItem] = useState<DropItem>({
    tier: 1,
    special: 'none',
  });
  const [heldItem, setHeldItem] = useState<DropItem | null>(null);
  const [canSwapHold, setCanSwapHold] = useState<boolean>(true);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;
  const isMenuOpenRef = useRef(isMenuOpen);
  isMenuOpenRef.current = isMenuOpen;
  const isHowToPlayOpenRef = useRef(isHowToPlayOpen);
  isHowToPlayOpenRef.current = isHowToPlayOpen;
  const isEvolutionTreeOpenRef = useRef(isEvolutionTreeOpen);
  isEvolutionTreeOpenRef.current = isEvolutionTreeOpen;
  const isEndlessModeRef = useRef(isEndlessMode);
  isEndlessModeRef.current = isEndlessMode;

  // Sync high score & daily best to localStorage
  const updateScoreWithHighScore = useCallback(
    (pointsToAdd: number) => {
      setGameState((prev) => {
        const newScore = prev.score + pointsToAdd;
        setHighScore((prevBest) => {
          const best = Math.max(prevBest, newScore);
          try {
            localStorage.setItem(HIGH_SCORE_STORAGE_KEY, best.toString());
          } catch {}
          return best;
        });
        if (gameModeRef.current === 'DAILY') {
          setDailyHighScore((prevDaily) => {
            const bestDaily = Math.max(prevDaily, newScore);
            try {
              localStorage.setItem(
                `${DAILY_HIGH_SCORE_PREFIX}${dailyInfo.seedKey}`,
                bestDaily.toString(),
              );
            } catch {}
            return bestDaily;
          });
        }
        return {...prev, score: newScore};
      });
    },
    [dailyInfo.seedKey],
  );

  // Sync SFX volume, persisted mute state & platform mute events
  useEffect(() => {
    const defaultSfxVol = (getConfig('defaultSfxVolume') as number) ?? 0.65;
    gameAudio.setVolume(defaultSfxVol);
    gameAudio.setMuted(sfxMuted);
    try {
      localStorage.setItem(SFX_MUTE_STORAGE_KEY, sfxMuted ? '1' : '0');
    } catch {}
  }, [sfxMuted]);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_MUTE_STORAGE_KEY, musicMuted ? '1' : '0');
    } catch {}
  }, [musicMuted]);

  useEffect(() => {
    const onPlatformMute = (e: Event) => {
      const customEvent = e as CustomEvent<{muted: boolean}>;
      if (typeof customEvent.detail?.muted === 'boolean') {
        setSfxMuted(customEvent.detail.muted);
      }
    };
    window.addEventListener('playground-mute', onPlatformMute);
    return () => window.removeEventListener('playground-mute', onPlatformMute);
  }, []);

  // Back key handling
  useEffect(() => {
    (window as any).canHandleBackKey =
      gameState.status !== 'START' || isHowToPlayOpen || isEvolutionTreeOpen;
  }, [gameState.status, isHowToPlayOpen, isEvolutionTreeOpen]);

  const inputRef = useInput(
    canvasRef,
    true,
    {
      width: canvasWidth,
      height: canvasHeight,
    },
    assetsReady,
  );

  // Matter Physics Simulation Engine & Refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const fruitsRef = useRef<Map<number, FruitEntity>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const scorePopupsRef = useRef<ScorePopup[]>([]);
  const shockwavesRef = useRef<ShockwaveRing[]>([]);

  // Jar bounds (Inside dimensions)
  const jarX = 70;
  const jarWidth = 580;
  const jarRight = jarX + jarWidth;
  const jarBottom = 1140;
  const jarTop = 270;
  const dangerLineY = 320;
  const dropperY = 175;

  // Dropper & Input state
  const dropperXRef = useRef<number>(canvasWidth / 2);
  const targetDropperXRef = useRef<number>(canvasWidth / 2);
  const lastDropTimeRef = useRef<number>(0);
  const sessionPlayStartRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const zeroGTapHandledRef = useRef<boolean>(false);
  const dangerTimerRef = useRef<number>(0);
  const currentItemRef = useRef<DropItem>({tier: 1, special: 'none'});
  const nextItemRef = useRef<DropItem>({tier: 1, special: 'none'});
  const heldItemRef = useRef<DropItem | null>(null);
  const canSwapHoldRef = useRef<boolean>(true);
  const rngRef = useRef<() => number>(Math.random);
  const dropsSinceSpecialRef = useRef<number>(0);
  const pendingSpecialRewardRef = useRef<boolean>(false);
  const comboRewardClaimedRef = useRef<boolean>(false);
  const totalDropsRef = useRef<number>(0);
  const mergeQueueRef = useRef<MergeQueueEntry[]>([]);

  // Combo, Tension & Screen Shake Refs
  const comboCountRef = useRef<number>(0);
  const comboTimerRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  const totalMergesRef = useRef<number>(0);
  const highestTierRef = useRef<number>(1);
  const screenShakeRef = useRef<number>(0);
  const tensionTierRef = useRef<0 | 1 | 2>(0);
  const simmerDurationRef = useRef<number>(0);

  // Anti-Gravity & Magnet Physics Control Refs
  const antiGravityTimerRef = useRef<number>(0);
  const antiGravityCeilingRef = useRef<Matter.Body | null>(null);
  const dangerGraceCooldownRef = useRef<number>(0);
  const activeMagnetRef = useRef<ActiveMagnet | null>(null);

  // Merge-Charged Power-up Meters (0..100%) + integer display guards
  const antiGravityChargeRef = useRef<number>(100);
  const magnetChargeRef = useRef<number>(100);
  const lastDisplayedAgChargeRef = useRef<number>(100);
  const lastDisplayedAgActiveSecRef = useRef<number>(0);
  const lastDisplayedMagChargeRef = useRef<number>(100);

  // Helper to add merge/catalyst charge to Zero-G & Magnet meters
  const addPowerupCharge = useCallback((agDelta: number, magDelta: number) => {
    let playedReady = false;

    if (antiGravityTimerRef.current <= 0 && antiGravityChargeRef.current < 100) {
      const prevAg = antiGravityChargeRef.current;
      const nextAg = Math.min(100, prevAg + agDelta);
      antiGravityChargeRef.current = nextAg;
      const nextAgInt = Math.floor(nextAg);
      if (nextAgInt !== lastDisplayedAgChargeRef.current) {
        lastDisplayedAgChargeRef.current = nextAgInt;
        setAntiGravityCharge(nextAgInt);
      }
      if (prevAg < 100 && nextAg >= 100) {
        playedReady = true;
      }
    }

    if (!activeMagnetRef.current && magnetChargeRef.current < 100) {
      const prevMag = magnetChargeRef.current;
      const nextMag = Math.min(100, prevMag + magDelta);
      magnetChargeRef.current = nextMag;
      const nextMagInt = Math.floor(nextMag);
      if (nextMagInt !== lastDisplayedMagChargeRef.current) {
        lastDisplayedMagChargeRef.current = nextMagInt;
        setMagnetCharge(nextMagInt);
      }
      if (prevMag < 100 && nextMag >= 100 && !playedReady) {
        playedReady = true;
      }
    }

    if (playedReady) {
      gameAudio.playMeterReady();
    }
  }, []);

  // Weighted random / seeded dropper item (Tiers 1-5 + Earned/Paced Special Drops)
  const drawNextDropItem = useCallback((allowSpecial = true): DropItem => {
    const cadence = Math.max(
      6,
      (getConfig('specialDropCadence') as number) || 20,
    );
    const alreadyQueuedSpecial =
      currentItemRef.current.special !== 'none' ||
      nextItemRef.current.special !== 'none';

    if (
      allowSpecial &&
      !alreadyQueuedSpecial &&
      (pendingSpecialRewardRef.current ||
        dropsSinceSpecialRef.current >= cadence)
    ) {
      pendingSpecialRewardRef.current = false;
      dropsSinceSpecialRef.current = 0;
      const specialKind: SpecialDropKind =
        rngRef.current() < 0.6 ? 'rainbow' : 'fizz';
      return {tier: 1, special: specialKind};
    }

    const maxTier = Math.min(5, (getConfig('maxSpawnTier') as number) || 5);
    const weights = [40, 30, 18, 9, 3]; // Cherry, Strawberry, Grape, Dekopon, Persimmon
    const totalWeight = weights
      .slice(0, maxTier)
      .reduce((a, b) => a + b, 0);
    let rand = rngRef.current() * totalWeight;
    for (let i = 0; i < maxTier; i++) {
      if (rand < weights[i]) return {tier: i + 1, special: 'none'};
      rand -= weights[i];
    }
    return {tier: 1, special: 'none'};
  }, []);

  // Spawn Juice Particles
  const spawnJuiceSplash = useCallback(
    (x: number, y: number, color: string, count = 18, isSparkle = false) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 7;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (isSparkle ? 3 : 1),
          radius: isSparkle ? 3 + Math.random() * 5 : 4 + Math.random() * 8,
          color,
          alpha: 1,
          life: 0,
          maxLife: 0.5 + Math.random() * 0.4,
          isSparkle,
        });
      }
    },
    [],
  );

  // Spawn Zero-G particles
  const spawnZeroGParticles = useCallback((count = 8) => {
    const colors = ['#C084FC', '#38BDF8', '#E879F9', '#818CF8'];
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: jarX + 20 + Math.random() * (jarWidth - 40),
        y: jarBottom - 20 - Math.random() * (jarBottom - jarTop - 50),
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1.5 - Math.random() * 2.5,
        radius: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.9,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.8,
        isZeroG: true,
      });
    }
  }, [jarBottom, jarRight, jarTop, jarWidth, jarX]);

  // Spawn Score Popup
  const spawnScorePopup = useCallback(
    (
      x: number,
      y: number,
      text: string,
      color: string,
      fontSize?: number,
      scale = 0.5,
    ) => {
      scorePopupsRef.current.push({
        x,
        y: Math.max(100, y - 10),
        text,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.95,
        scale,
        fontSize,
      });
    },
    [],
  );

  // Spawn Expanding Shockwave Ring
  const spawnShockwave = useCallback(
    (x: number, y: number, maxRadius: number, color: string, lineWidth = 5) => {
      shockwavesRef.current.push({
        x,
        y,
        radius: Math.max(10, maxRadius * 0.2),
        maxRadius,
        color,
        alpha: 0.9,
        life: 0,
        maxLife: 0.42,
        lineWidth,
      });
    },
    [],
  );

  // Powerup 1: Activate Anti-Gravity (Consumes 100% Merge Charge)
  const activateAntiGravity = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (
      isMenuOpenRef.current ||
      isHowToPlayOpenRef.current ||
      isEvolutionTreeOpenRef.current
    ) {
      return;
    }
    if (antiGravityTimerRef.current > 0 || antiGravityChargeRef.current < 100) {
      return;
    }
    if (!engineRef.current) return;

    gameAudio.playPowerupChime();
    antiGravityTimerRef.current = 5.0; // 5 seconds duration
    antiGravityChargeRef.current = 0;
    lastDisplayedAgActiveSecRef.current = 5;
    lastDisplayedAgChargeRef.current = 0;
    setAntiGravityActive(true);
    setAntiGravityActiveSec(5);
    setAntiGravityCharge(0);

    // Create temporary static horizontal ceiling rigid body at y = 95
    const ceilingY = 95;
    const ceiling = Matter.Bodies.rectangle(
      canvasWidth / 2,
      ceilingY,
      jarWidth + 120,
      30,
      {isStatic: true, label: 'zero_g_ceiling', friction: 0.05, restitution: 0.5},
    );
    antiGravityCeilingRef.current = ceiling;
    Matter.Composite.add(engineRef.current.world, ceiling);

    // Initial zero-G burst
    spawnZeroGParticles(25);
    spawnScorePopup(canvasWidth / 2, 220, '🌀 ZERO-G ACTIVATED!', '#A855F7');
  }, [canvasWidth, jarWidth, spawnScorePopup, spawnZeroGParticles]);

  // Powerup 2: Activate Magnet (Consumes 100% Merge Charge when a pair exists)
  const activateMagnet = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (
      isMenuOpenRef.current ||
      isHowToPlayOpenRef.current ||
      isEvolutionTreeOpenRef.current
    ) {
      return;
    }
    if (activeMagnetRef.current || magnetChargeRef.current < 100) return;
    if (!engineRef.current) return;

    // Scan normal fruits inside the jar and find matching pairs
    const tierMap = new Map<number, FruitEntity[]>();
    fruitsRef.current.forEach((fruit) => {
      if (!fruit.merged && fruit.special === 'none') {
        const list = tierMap.get(fruit.tier) || [];
        list.push(fruit);
        tierMap.set(fruit.tier, list);
      }
    });

    // Find highest tier with >= 2 fruits
    let bestTier = -1;
    for (let t = FRUIT_TIERS.length; t >= 1; t--) {
      const list = tierMap.get(t);
      if (list && list.length >= 2) {
        bestTier = t;
        break;
      }
    }

    if (bestTier === -1) {
      // No pairs found — preserve charge!
      gameAudio.playErrorBuzz();
      spawnScorePopup(canvasWidth / 2, 350, 'No matching pairs found!', '#EF4444');
      return;
    }

    // Iterate all (i, j) pairs to select the closest matching pair
    const pairList = tierMap.get(bestTier)!;
    let fruitA = pairList[0];
    let fruitB = pairList[1];
    let bestDist = Infinity;
    for (let i = 0; i < pairList.length; i++) {
      for (let j = i + 1; j < pairList.length; j++) {
        const candidateA = pairList[i];
        const candidateB = pairList[j];
        const d = Math.hypot(
          candidateB.body.position.x - candidateA.body.position.x,
          candidateB.body.position.y - candidateA.body.position.y,
        );
        if (d < bestDist) {
          bestDist = d;
          fruitA = candidateA;
          fruitB = candidateB;
        }
      }
    }

    activeMagnetRef.current = {
      fruitAId: fruitA.body.id,
      fruitBId: fruitB.body.id,
      remainingSeconds: 2.2,
      totalSeconds: 2.2,
    };

    magnetChargeRef.current = 0;
    lastDisplayedMagChargeRef.current = 0;
    setMagnetCharge(0);
    setMagnetActive(true);

    gameAudio.playArcadeLaser();
    const tierConfig = FRUIT_TIERS[bestTier - 1];
    spawnScorePopup(
      (fruitA.body.position.x + fruitB.body.position.x) / 2,
      (fruitA.body.position.y + fruitB.body.position.y) / 2,
      `🧲 MAGNETIZING ${tierConfig.name.toUpperCase()}!`,
      '#F59E0B',
    );
  }, [canvasWidth, spawnScorePopup]);

  // Tactical 1-Slot Hold / Swap Basket (once per drop)
  const swapHoldFruit = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (
      isMenuOpenRef.current ||
      isHowToPlayOpenRef.current ||
      isEvolutionTreeOpenRef.current
    ) {
      return;
    }
    if (!canSwapHoldRef.current) {
      gameAudio.playErrorBuzz();
      return;
    }

    gameAudio.resume();
    gameAudio.playBasketSwap();

    if (heldItemRef.current === null) {
      const stashed = currentItemRef.current;
      const promoted = nextItemRef.current;
      heldItemRef.current = stashed;
      currentItemRef.current = promoted;
      const upcoming = drawNextDropItem(true);
      nextItemRef.current = upcoming;
      setHeldItem(stashed);
      setCurrentItem(promoted);
      setNextItem(upcoming);
    } else {
      const prevHeld = heldItemRef.current;
      const prevCurrent = currentItemRef.current;
      heldItemRef.current = prevCurrent;
      currentItemRef.current = prevHeld;
      setHeldItem(prevCurrent);
      setCurrentItem(prevHeld);
    }

    canSwapHoldRef.current = false;
    setCanSwapHold(false);
  }, [drawNextDropItem]);

  // Drop current fruit or special item into jar
  const dropFruit = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (
      isMenuOpenRef.current ||
      isHowToPlayOpenRef.current ||
      isEvolutionTreeOpenRef.current
    ) {
      return;
    }

    const now = performance.now();
    const cooldown = (getConfig('dropCooldownMs') as number) || 450;
    if (now - lastDropTimeRef.current < cooldown) return;
    if (!engineRef.current) return;

    gameAudio.resume();

    const droppedItem = currentItemRef.current;
    const {radius, tierConfig} = getDropItemDetails(droppedItem);

    // Clamp drop position strictly within jar walls
    const dropX = Math.max(
      jarX + radius + 4,
      Math.min(jarRight - radius - 4, dropperXRef.current),
    );
    const dropY = dropperY;

    const restitution =
      droppedItem.special === 'fizz'
        ? 0.36
        : (getConfig('fruitRestitution') as number) || 0.22;
    const friction =
      droppedItem.special !== 'none'
        ? 0.05
        : (tierConfig.friction ?? ((getConfig('fruitFriction') as number) || 0.08));
    const densityScale =
      tierConfig.density ??
      ((getConfig('fruitDensityMultiplier') as number) || 0.002);

    const body = Matter.Bodies.circle(dropX, dropY, radius, {
      restitution,
      friction,
      density:
        densityScale *
        (1 + (droppedItem.special !== 'none' ? 2.5 : droppedItem.tier) * 0.15),
      label: 'fruit',
      angularVelocity: (Math.random() - 0.5) * 0.05,
    });

    Matter.Composite.add(engineRef.current.world, body);

    const entity: FruitEntity = {
      id: `fruit_${body.id}`,
      tier: droppedItem.tier,
      special: droppedItem.special,
      body,
      spawnTime: now,
      renderScale: 0.85,
      targetScale: 1.0,
      squashX: 1,
      squashY: 1,
      squashVelX: 0,
      squashVelY: 0,
      lastImpactTime: now,
      blinkTimer: 1 + Math.random() * 3,
      isBlinking: false,
      expression: 'happy',
      expressionTimer: 0,
      merged: false,
    };

    fruitsRef.current.set(body.id, entity);
    gameAudio.playCrispClick();

    if (
      droppedItem.special === 'none' &&
      droppedItem.tier > highestTierRef.current
    ) {
      highestTierRef.current = droppedItem.tier;
      setHighestTier(droppedItem.tier);
    }

    // Increment drop counters & unlock Hold swap for the new turn
    totalDropsRef.current += 1;
    if (droppedItem.special === 'none') {
      dropsSinceSpecialRef.current += 1;
    }
    setTotalDrops((prev) => prev + 1);
    canSwapHoldRef.current = true;
    setCanSwapHold(true);

    // Advance queue
    const promotedNext = nextItemRef.current;
    currentItemRef.current = promotedNext;
    const newUpcoming = drawNextDropItem(true);
    nextItemRef.current = newUpcoming;
    setCurrentItem(promotedNext);
    setNextItem(newUpcoming);

    lastDropTimeRef.current = now;
  }, [dropperY, jarRight, jarX, drawNextDropItem]);

  // Direct keyboard listener for instant dropping, Hold swap, and powerup shortcuts
  useEffect(() => {
    const handleDirectKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current.status !== 'PLAYING') return;
      if (
        isMenuOpenRef.current ||
        isHowToPlayOpenRef.current ||
        isEvolutionTreeOpenRef.current
      ) {
        return;
      }

      if (
        e.key === ' ' ||
        e.key === 'Spacebar' ||
        e.key === 'ArrowDown' ||
        e.key === 's' ||
        e.key === 'S' ||
        e.key === 'Enter'
      ) {
        e.preventDefault();
        if (e.repeat) return;
        if (performance.now() - sessionPlayStartRef.current <= 180) return;
        dropFruit();
      } else if (e.key === 'c' || e.key === 'C' || e.key === 'Shift') {
        e.preventDefault();
        if (e.repeat) return;
        swapHoldFruit();
      } else if (e.key === 'z' || e.key === 'Z' || e.key === '1') {
        if (e.repeat) return;
        activateAntiGravity();
      } else if (e.key === 'm' || e.key === 'M' || e.key === '2') {
        if (e.repeat) return;
        activateMagnet();
      }
    };

    window.addEventListener('keydown', handleDirectKeyDown, {passive: false});
    return () => window.removeEventListener('keydown', handleDirectKeyDown);
  }, [dropFruit, swapHoldFruit, activateAntiGravity, activateMagnet]);

  // Continue seamlessly in Endless Mode after crowning / merging King Durians
  const resumeEndlessMode = useCallback(() => {
    isEndlessModeRef.current = true;
    setIsEndlessMode(true);
    dangerTimerRef.current = 0;
    dangerGraceCooldownRef.current = 2.0;
    sessionPlayStartRef.current = performance.now();
    setGameState((prev) => ({...prev, status: 'PLAYING'}));
    gameAudio.playPowerupChime();
  }, []);

  // Initialize/Reset Game Session (supports 'CLASSIC' or date-seeded 'DAILY')
  const initGame = useCallback(
    (requestedMode?: GameMode | unknown) => {
      const activeMode: GameMode =
        requestedMode === 'DAILY' || requestedMode === 'CLASSIC'
          ? requestedMode
          : gameModeRef.current;

      gameModeRef.current = activeMode;
      setGameMode(activeMode);
      setScorecardCopied(false);

      rngRef.current =
        activeMode === 'DAILY'
          ? createSeededRng(`juicydrop-daily-${dailyInfo.seedKey}`)
          : Math.random;

      // Clear existing physics
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        Matter.Engine.clear(engineRef.current);
      }

      const gravityY = (getConfig('gravityY') as number) || 1.5;
      const engine = Matter.Engine.create({
        gravity: {x: 0, y: gravityY, scale: 0.0012},
      });

      const world = engine.world;
      const wallThickness = 60;
      const wallTopY = 60;
      const wallBottomY = jarBottom + wallThickness;
      const wallHeight = wallBottomY - wallTopY;
      const wallCenterY = (wallTopY + wallBottomY) / 2;

      // Jar Boundaries (Left, Right extended up to y=60 for Zero-G enclosure, Bottom)
      const ground = Matter.Bodies.rectangle(
        canvasWidth / 2,
        jarBottom + wallThickness / 2,
        jarWidth + wallThickness * 2,
        wallThickness,
        {isStatic: true, label: 'ground', friction: 0.2, restitution: 0.1},
      );

      const leftWall = Matter.Bodies.rectangle(
        jarX - wallThickness / 2,
        wallCenterY,
        wallThickness,
        wallHeight,
        {isStatic: true, label: 'wall', friction: 0.1, restitution: 0.1},
      );

      const rightWall = Matter.Bodies.rectangle(
        jarRight + wallThickness / 2,
        wallCenterY,
        wallThickness,
        wallHeight,
        {isStatic: true, label: 'wall', friction: 0.1, restitution: 0.1},
      );

      Matter.Composite.add(world, [ground, leftWall, rightWall]);

      // Collision listener for fruit merging, special drops & tactile bounces
      Matter.Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        const nowCollision = performance.now();
        const rainbowMaxTier =
          (getConfig('rainbowMaxTargetTier') as number) || 9;

        for (let i = 0; i < pairs.length; i++) {
          const pair = pairs[i];
          const bodyA = pair.bodyA;
          const bodyB = pair.bodyB;

          if (bodyA.label === 'fruit' && bodyB.label === 'fruit') {
            const fruitA = fruitsRef.current.get(bodyA.id);
            const fruitB = fruitsRef.current.get(bodyB.id);

            if (
              fruitA &&
              fruitB &&
              !fruitA.merged &&
              !fruitB.merged &&
              fruitA.body.id !== fruitB.body.id
            ) {
              const midX = (bodyA.position.x + bodyB.position.x) / 2;
              const midY = (bodyA.position.y + bodyB.position.y) / 2;

              // 1. Standard matching normal fruit merge
              if (
                fruitA.special === 'none' &&
                fruitB.special === 'none' &&
                fruitA.tier === fruitB.tier
              ) {
                fruitA.merged = true;
                fruitB.merged = true;
                mergeQueueRef.current.push({
                  fruitA,
                  fruitB,
                  midX,
                  midY,
                  kind: 'normal',
                });
                continue;
              }

              // 2. Rainbow Dewdrop wildcard contact
              if (fruitA.special === 'rainbow' || fruitB.special === 'rainbow') {
                const rainbowFruit =
                  fruitA.special === 'rainbow' ? fruitA : fruitB;
                const otherFruit =
                  fruitA.special === 'rainbow' ? fruitB : fruitA;

                if (otherFruit.special === 'fizz') {
                  rainbowFruit.merged = true;
                  otherFruit.merged = true;
                  mergeQueueRef.current.push({
                    fruitA: rainbowFruit,
                    fruitB: otherFruit,
                    midX,
                    midY,
                    kind: 'fizz_pair',
                  });
                  continue;
                }

                rainbowFruit.merged = true;
                if (
                  otherFruit.special === 'rainbow' ||
                  otherFruit.tier <= rainbowMaxTier
                ) {
                  otherFruit.merged = true;
                }
                mergeQueueRef.current.push({
                  fruitA: rainbowFruit,
                  fruitB: otherFruit,
                  midX,
                  midY,
                  kind: 'rainbow',
                });
                continue;
              }

              // 3. Twin Fizz Berries touching each other -> instant double fizz detonation!
              if (fruitA.special === 'fizz' && fruitB.special === 'fizz') {
                fruitA.merged = true;
                fruitB.merged = true;
                mergeQueueRef.current.push({
                  fruitA,
                  fruitB,
                  midX,
                  midY,
                  kind: 'fizz_pair',
                });
                continue;
              }
            }
          }

          // Non-merge collision: tactile squash-and-stretch + soft thud SFX
          const dvx = bodyA.velocity.x - bodyB.velocity.x;
          const dvy = bodyA.velocity.y - bodyB.velocity.y;
          const impactSpeed = Math.hypot(dvx, dvy);

          if (impactSpeed > 1.8) {
            const nx = pair.collision?.normal
              ? Math.abs(pair.collision.normal.x)
              : Math.abs(dvx);
            const ny = pair.collision?.normal
              ? Math.abs(pair.collision.normal.y)
              : Math.abs(dvy);
            const isVerticalImpact = ny >= nx;
            const impulse = Math.min(6.2, (impactSpeed - 1.8) * 0.9);
            let soundPlayed = false;

            const applyBounceSquash = (fruit: FruitEntity | undefined) => {
              if (!fruit || fruit.merged) return;
              if (nowCollision - fruit.lastImpactTime <= 85) return;
              fruit.lastImpactTime = nowCollision;

              if (isVerticalImpact) {
                fruit.squashVelX += impulse;
                fruit.squashVelY -= impulse;
              } else {
                fruit.squashVelX -= impulse;
                fruit.squashVelY += impulse;
              }

              if (!soundPlayed && impactSpeed > 2.6) {
                soundPlayed = true;
                gameAudio.playSoftBounce(
                  Math.min(1, (impactSpeed - 1.8) / 8),
                  fruit.tier,
                );
              }
            };

            if (bodyA.label === 'fruit') {
              applyBounceSquash(fruitsRef.current.get(bodyA.id));
            }
            if (bodyB.label === 'fruit') {
              applyBounceSquash(fruitsRef.current.get(bodyB.id));
            }
          }
        }
      });

      const startNow = performance.now();
      engineRef.current = engine;
      fruitsRef.current.clear();
      particlesRef.current = [];
      scorePopupsRef.current = [];
      shockwavesRef.current = [];
      mergeQueueRef.current = [];
      dangerTimerRef.current = 0;
      dangerGraceCooldownRef.current = 0;
      antiGravityTimerRef.current = 0;
      antiGravityChargeRef.current = 100;
      magnetChargeRef.current = 100;
      lastDisplayedAgChargeRef.current = 100;
      lastDisplayedAgActiveSecRef.current = 0;
      lastDisplayedMagChargeRef.current = 100;
      antiGravityCeilingRef.current = null;
      activeMagnetRef.current = null;
      totalDropsRef.current = 0;
      dropsSinceSpecialRef.current = 0;
      pendingSpecialRewardRef.current = false;
      comboRewardClaimedRef.current = false;
      comboCountRef.current = 0;
      comboTimerRef.current = 0;
      maxComboRef.current = 0;
      totalMergesRef.current = 0;
      highestTierRef.current = 1;
      screenShakeRef.current = 0;
      tensionTierRef.current = 0;
      simmerDurationRef.current = 0;
      isEndlessModeRef.current = false;
      zeroGTapHandledRef.current = false;
      isPointerDownRef.current = false;
      heldItemRef.current = null;
      canSwapHoldRef.current = true;
      sessionPlayStartRef.current = startNow;
      lastDropTimeRef.current = startNow - 600;

      setTotalDrops(0);
      setIsEndlessMode(false);
      setMaxCombo(0);
      setTotalMerges(0);
      setHighestTier(1);
      setMusicTensionTier(0);
      setAntiGravityActive(false);
      setAntiGravityActiveSec(0);
      setAntiGravityCharge(100);
      setMagnetActive(false);
      setMagnetCharge(100);
      setHeldItem(null);
      setCanSwapHold(true);

      const item1 = drawNextDropItem(false);
      const item2 = drawNextDropItem(false);
      currentItemRef.current = item1;
      nextItemRef.current = item2;
      setCurrentItem(item1);
      setNextItem(item2);

      dropperXRef.current = canvasWidth / 2;
      targetDropperXRef.current = canvasWidth / 2;

      setGameState({
        status: 'PLAYING',
        score: 0,
        level: 1,
      });
      setIsMenuOpen(false);
      setIsHowToPlayOpen(false);
      setIsEvolutionTreeOpen(false);

      // Ensure audio context unlocks cleanly
      gameAudio.resume();

      if (sdk) {
        sdk.startGame();
      }
    },
    [
      canvasWidth,
      dailyInfo.seedKey,
      drawNextDropItem,
      jarBottom,
      jarRight,
      jarWidth,
      jarX,
      sdk,
    ],
  );

  // Lifecycle & Score Reporting
  usePlaygroundGameLifecycle(gameState, sdk);

  // Auto-play on ?autoplay
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // Trigger SFX on Game Over / Victory
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    } else if (gameState.status === 'VICTORY') {
      gameAudio.playVictoryFanfare();
    }
  }, [gameState.status]);

  // Tap-to-impulse during Zero-G or standard pointer handling
  const checkZeroGTapImpulse = (tapX: number, tapY: number): boolean => {
    if (antiGravityTimerRef.current <= 0) return false;

    // Check if player clicked directly on any existing fruit inside the container
    let clickedFruit: FruitEntity | null = null;
    fruitsRef.current.forEach((fruit) => {
      if (fruit.merged || fruit.special !== 'none') return;
      const radius = getFruitEntityRadius(fruit);
      const dx = fruit.body.position.x - tapX;
      const dy = fruit.body.position.y - tapY;
      if (Math.hypot(dx, dy) <= radius + 10) {
        clickedFruit = fruit;
      }
    });

    if (clickedFruit) {
      const f = clickedFruit as FruitEntity;
      // Find nearest matching twin tier fruit
      let nearestTwin: FruitEntity | null = null;
      let minDist = Infinity;
      fruitsRef.current.forEach((other) => {
        if (
          other.body.id !== f.body.id &&
          other.special === 'none' &&
          other.tier === f.tier &&
          !other.merged
        ) {
          const d = Math.hypot(
            other.body.position.x - f.body.position.x,
            other.body.position.y - f.body.position.y,
          );
          if (d < minDist) {
            minDist = d;
            nearestTwin = other;
          }
        }
      });

      if (nearestTwin) {
        const twin = nearestTwin as FruitEntity;
        const dirX = twin.body.position.x - f.body.position.x;
        const dirY = twin.body.position.y - f.body.position.y;
        const len = Math.hypot(dirX, dirY) || 1;
        const pushForce = 0.035 * f.body.mass;

        Matter.Body.applyForce(f.body, f.body.position, {
          x: (dirX / len) * pushForce,
          y: (dirY / len) * pushForce,
        });

        // Twin counter impulse
        Matter.Body.applyForce(twin.body, twin.body.position, {
          x: (-dirX / len) * pushForce * 0.5,
          y: (-dirY / len) * pushForce * 0.5,
        });

        gameAudio.playConfirmSelect();
        spawnJuiceSplash(f.body.position.x, f.body.position.y, '#C084FC', 14, true);
        return true;
      }
    }
    return false;
  };

  // Direct canvas pointer event helpers with pointer capture & Zero-G tap isolation
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.status !== 'PLAYING') return;
    if (isMenuOpen || isHowToPlayOpen || isEvolutionTreeOpen) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;

      if (checkZeroGTapImpulse(x, y)) {
        zeroGTapHandledRef.current = true;
        isPointerDownRef.current = false;
        return;
      }

      targetDropperXRef.current = x;
      dropperXRef.current = x;
    }

    zeroGTapHandledRef.current = false;
    isPointerDownRef.current = true;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.status !== 'PLAYING') return;
    if (isMenuOpen || isHowToPlayOpen || isEvolutionTreeOpen) return;
    if (zeroGTapHandledRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      targetDropperXRef.current = x;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (zeroGTapHandledRef.current) {
      zeroGTapHandledRef.current = false;
      isPointerDownRef.current = false;
      return;
    }

    if (gameState.status !== 'PLAYING') {
      isPointerDownRef.current = false;
      return;
    }

    const wasPointerDown = isPointerDownRef.current;
    isPointerDownRef.current = false;
    if (!wasPointerDown) return;

    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      targetDropperXRef.current = x;
    }
    dropFruit();
  };

  const handleCanvasPointerCancel = (
    e: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    zeroGTapHandledRef.current = false;
    isPointerDownRef.current = false;
  };

  // Main Update Simulation
  const update = (deltaTime: number) => {
    if (
      gameState.status !== 'PLAYING' ||
      isMenuOpen ||
      isHowToPlayOpen ||
      isEvolutionTreeOpen
    ) {
      return;
    }

    const input = inputRef.current;
    const now = performance.now();
    const defaultGravity = (getConfig('gravityY') as number) || 1.5;

    // 0. Decay Combo Timer & Screen Shake (Power-ups now recharge strictly via merges!)
    if (comboTimerRef.current > 0) {
      comboTimerRef.current = Math.max(0, comboTimerRef.current - deltaTime);
      if (comboTimerRef.current <= 0) {
        comboCountRef.current = 0;
        comboRewardClaimedRef.current = false;
      }
    }

    if (screenShakeRef.current > 0) {
      screenShakeRef.current = Math.max(
        0,
        screenShakeRef.current - deltaTime * 28,
      );
      if (screenShakeRef.current < 0.1) {
        screenShakeRef.current = 0;
      }
    }

    // Anti-Gravity Physics Phase & Gravity Adjustment
    if (antiGravityTimerRef.current > 0) {
      antiGravityTimerRef.current = Math.max(
        0,
        antiGravityTimerRef.current - deltaTime,
      );
      const nextActiveInt = Math.ceil(antiGravityTimerRef.current);
      if (nextActiveInt !== lastDisplayedAgActiveSecRef.current) {
        lastDisplayedAgActiveSecRef.current = nextActiveInt;
        setAntiGravityActiveSec(nextActiveInt);
      }

      if (engineRef.current) {
        if (antiGravityTimerRef.current > 2.0) {
          // First 3 seconds: negative gravity -0.3
          engineRef.current.world.gravity.y = -0.3;
        } else {
          // Last 2 seconds: slight gravity 0.05
          engineRef.current.world.gravity.y = 0.05;
        }

        // Apply subtle random horizontal drift velocity to all floating fruits
        fruitsRef.current.forEach((fruit) => {
          Matter.Body.applyForce(fruit.body, fruit.body.position, {
            x: (Math.random() - 0.5) * 0.0006 * fruit.body.mass,
            y: (Math.random() - 0.5) * 0.0003 * fruit.body.mass,
          });
        });
      }

      // Zero-G visual particle stream
      if (Math.random() < 0.35) {
        spawnZeroGParticles(2);
      }

      if (antiGravityTimerRef.current <= 0) {
        // Anti-Gravity Ended: Remove ceiling, restore normal gravity
        if (engineRef.current) {
          if (antiGravityCeilingRef.current) {
            Matter.Composite.remove(
              engineRef.current.world,
              antiGravityCeilingRef.current,
            );
            antiGravityCeilingRef.current = null;
          }
          engineRef.current.world.gravity.y = defaultGravity;
        }
        lastDisplayedAgActiveSecRef.current = 0;
        setAntiGravityActiveSec(0);
        setAntiGravityActive(false);
        // Suppress danger line for 2.0s after settling
        dangerGraceCooldownRef.current = 2.0;
        spawnScorePopup(canvasWidth / 2, 220, 'GRAVITY RESTORED', '#38BDF8');
      }
    } else {
      if (dangerGraceCooldownRef.current > 0) {
        dangerGraceCooldownRef.current = Math.max(
          0,
          dangerGraceCooldownRef.current - deltaTime,
        );
      }
    }

    // Active Magnet Pull Simulation (mass-scaled + anti-stuck hop)
    if (activeMagnetRef.current && engineRef.current) {
      const mag = activeMagnetRef.current;
      const fruitA = fruitsRef.current.get(mag.fruitAId);
      const fruitB = fruitsRef.current.get(mag.fruitBId);

      if (fruitA && fruitB && !fruitA.merged && !fruitB.merged) {
        const posA = fruitA.body.position;
        const posB = fruitB.body.position;
        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 1) {
          const nx = dx / dist;
          const ny = dy / dist;
          const progress = Math.max(
            0,
            Math.min(
              1,
              (mag.totalSeconds - mag.remainingSeconds) / mag.totalSeconds,
            ),
          );
          const forceMag = 0.0038 * (1 + progress * 2.5);

          if (dist > 12) {
            Matter.Body.applyForce(fruitA.body, posA, {
              x: nx * forceMag * fruitA.body.mass,
              y: ny * forceMag * fruitA.body.mass,
            });
            Matter.Body.applyForce(fruitB.body, posB, {
              x: -nx * forceMag * fruitB.body.mass,
              y: -ny * forceMag * fruitB.body.mass,
            });
          }

          // Anti-stuck hop: if obstructed by neighbors and approach speed stalls
          const approachSpeed =
            (fruitA.body.velocity.x - fruitB.body.velocity.x) * nx +
            (fruitA.body.velocity.y - fruitB.body.velocity.y) * ny;
          if (dist > 20 && approachSpeed < 1.0) {
            Matter.Body.applyForce(fruitA.body, posA, {
              x: 0,
              y: -0.0014 * fruitA.body.mass,
            });
            Matter.Body.applyForce(fruitB.body, posB, {
              x: 0,
              y: -0.0014 * fruitB.body.mass,
            });
          }
        }

        // Magnet electric arc particles
        if (Math.random() < 0.6) {
          const t = Math.random();
          particlesRef.current.push({
            x: posA.x + dx * t + (Math.random() - 0.5) * 16,
            y: posA.y + dy * t + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            radius: 2 + Math.random() * 3,
            color: Math.random() < 0.5 ? '#38BDF8' : '#F59E0B',
            alpha: 1,
            life: 0,
            maxLife: 0.3,
            isElectric: true,
          });
        }

        mag.remainingSeconds -= deltaTime;
        if (mag.remainingSeconds <= 0) {
          activeMagnetRef.current = null;
          setMagnetActive(false);
        }
      } else {
        activeMagnetRef.current = null;
        setMagnetActive(false);
      }
    }

    // 1. Continuous Smooth Keyboard Aiming
    if (input) {
      if (input.actions.left) {
        targetDropperXRef.current -= 560 * deltaTime;
      }
      if (input.actions.right) {
        targetDropperXRef.current += 560 * deltaTime;
      }
    }

    // Smooth lerp dropper position
    const currentItemRadius = getDropItemDetails(currentItemRef.current).radius;
    const minDropperX = jarX + currentItemRadius + 6;
    const maxDropperX = jarRight - currentItemRadius - 6;
    targetDropperXRef.current = Math.max(
      minDropperX,
      Math.min(maxDropperX, targetDropperXRef.current),
    );
    dropperXRef.current +=
      (targetDropperXRef.current - dropperXRef.current) *
      Math.min(1, deltaTime * 24);

    // 2. Physics Step
    if (engineRef.current) {
      Matter.Engine.update(engineRef.current, deltaTime * 1000);
    }

    // Helper to detonate a Fizz Berry catalyst (pops nearby Tier 1-2 clutter + boosts meters)
    const detonateFizzAt = (
      world: Matter.World,
      cx: number,
      cy: number,
      comboMult: number,
    ) => {
      gameAudio.playFizzPop();
      spawnShockwave(cx, cy, 195, '#06B6D4', 6);
      spawnShockwave(cx, cy, 130, '#A3E635', 4);
      spawnJuiceSplash(cx, cy, '#22D3EE', 28, true);
      screenShakeRef.current = Math.max(screenShakeRef.current, 5.5);

      // Find up to 3 closest unmerged Tier 1-2 clutter fruits within 220px
      const smallCandidates: Array<{fruit: FruitEntity; dist: number}> = [];
      fruitsRef.current.forEach((cand) => {
        if (cand.merged || cand.special !== 'none' || cand.tier > 2) return;
        const d = Math.hypot(
          cand.body.position.x - cx,
          cand.body.position.y - cy,
        );
        if (d <= 220) {
          smallCandidates.push({fruit: cand, dist: d});
        }
      });
      smallCandidates.sort((a, b) => a.dist - b.dist);
      const popped = smallCandidates.slice(0, 3);
      let bonusPts = Math.round(60 * comboMult);

      popped.forEach(({fruit: target}) => {
        target.merged = true;
        const tx = target.body.position.x;
        const ty = target.body.position.y;
        const tConf = FRUIT_TIERS[target.tier - 1] || FRUIT_TIERS[0];
        Matter.Composite.remove(world, target.body);
        fruitsRef.current.delete(target.body.id);
        spawnJuiceSplash(tx, ty, tConf.color, 14, true);
        bonusPts += Math.round(tConf.points * 2 * comboMult);
      });

      // Fizzy buoyant nudge on nearby remaining fruits
      fruitsRef.current.forEach((other) => {
        if (other.merged) return;
        const ox = other.body.position.x - cx;
        const oy = other.body.position.y - cy;
        const od = Math.hypot(ox, oy);
        if (od > 1 && od < 250) {
          const falloff = 1 - od / 250;
          const push = 0.0028 * falloff * other.body.mass;
          Matter.Body.applyForce(other.body, other.body.position, {
            x: (ox / od) * push,
            y: (oy / od) * push - 0.0012 * falloff * other.body.mass,
          });
          other.expression = 'bouncy';
          other.expressionTimer = 0.9;
        }
      });

      addPowerupCharge(20, 20);
      spawnScorePopup(
        cx,
        cy,
        popped.length > 0
          ? `🫧 FIZZ POP x${popped.length}! +${bonusPts}`
          : `🫧 FIZZ BOOST! +${bonusPts}`,
        '#06B6D4',
        25,
        0.65,
      );
      updateScoreWithHighScore(bonusPts);
    };

    // 3. Process Merges with Race Condition Guard, Special Drops, Charge Meters & Combos
    if (mergeQueueRef.current.length > 0 && engineRef.current) {
      const world = engineRef.current.world;
      const mergesToProcess = [...mergeQueueRef.current];
      mergeQueueRef.current = [];
      const processedBodyIds = new Set<number>();
      const mergeBlastCenters: Array<{x: number; y: number; r: number}> = [];
      const rainbowMaxTier =
        (getConfig('rainbowMaxTargetTier') as number) || 9;
      const specialComboReq =
        (getConfig('specialComboTrigger') as number) || 4;
      const agBase = (getConfig('zeroGChargeBase') as number) || 10;
      const magBase = (getConfig('magnetChargeBase') as number) || 14;
      const comboChargeMult =
        (getConfig('comboChargeMultiplier') as number) || 1.75;

      mergesToProcess.forEach(({fruitA, fruitB, midX, midY, kind}) => {
        const idA = fruitA.body.id;
        const idB = fruitB.body.id;

        if (processedBodyIds.has(idA) || processedBodyIds.has(idB)) {
          return;
        }
        if (!fruitsRef.current.has(idA) || !fruitsRef.current.has(idB)) {
          return;
        }

        // Special Case A: Twin Fizz Berries (or Rainbow + Fizz) colliding
        if (kind === 'fizz_pair') {
          processedBodyIds.add(idA);
          processedBodyIds.add(idB);
          Matter.Composite.remove(world, fruitA.body);
          Matter.Composite.remove(world, fruitB.body);
          fruitsRef.current.delete(idA);
          fruitsRef.current.delete(idB);
          const comboMult = Math.min(
            3.0,
            1 + Math.max(0, comboCountRef.current - 1) * 0.25,
          );
          detonateFizzAt(world, midX, midY, comboMult);
          mergeBlastCenters.push({x: midX, y: midY, r: 45});
          return;
        }

        // Special Case B: Rainbow Dewdrop touching Tier 10-13 endgame fruit (Prismatic Bonus, keeps big fruit safe!)
        if (
          kind === 'rainbow' &&
          fruitB.special === 'none' &&
          fruitB.tier > rainbowMaxTier
        ) {
          processedBodyIds.add(idA);
          Matter.Composite.remove(world, fruitA.body);
          fruitsRef.current.delete(idA);

          const comboMult = Math.min(
            3.0,
            1 + Math.max(0, comboCountRef.current - 1) * 0.25,
          );
          const prismaticBonus = Math.round(250 * comboMult);
          gameAudio.playWildcardShimmer();
          spawnShockwave(midX, midY, 150, '#EC4899', 5);
          spawnJuiceSplash(midX, midY, '#F472B6', 28, true);

          fruitB.squashX = 1.24;
          fruitB.squashY = 0.78;
          fruitB.expression = 'starry';
          fruitB.expressionTimer = 1.2;
          Matter.Body.applyForce(fruitB.body, fruitB.body.position, {
            x: 0,
            y: -0.002 * fruitB.body.mass,
          });

          addPowerupCharge(16, 20);
          spawnScorePopup(
            midX,
            midY,
            `🌈 +${prismaticBonus} PRISMATIC BONUS!`,
            '#EC4899',
            25,
            0.65,
          );
          updateScoreWithHighScore(prismaticBonus);
          mergeBlastCenters.push({
            x: midX,
            y: midY,
            r: getFruitEntityRadius(fruitB),
          });
          return;
        }

        processedBodyIds.add(idA);
        processedBodyIds.add(idB);

        // Remove both merged bodies from physics world & registry
        Matter.Composite.remove(world, fruitA.body);
        Matter.Composite.remove(world, fruitB.body);
        fruitsRef.current.delete(idA);
        fruitsRef.current.delete(idB);

        // Combo & Session Stat Tracking
        if (comboTimerRef.current > 0) {
          comboCountRef.current += 1;
        } else {
          comboCountRef.current = 1;
          comboRewardClaimedRef.current = false;
        }
        comboTimerRef.current =
          (getConfig('comboWindowSeconds') as number) || 2.2;

        totalMergesRef.current += 1;
        setTotalMerges(totalMergesRef.current);

        if (comboCountRef.current > maxComboRef.current) {
          maxComboRef.current = comboCountRef.current;
          setMaxCombo(maxComboRef.current);
        }

        // Earn a Special Drop on reaching 4x+ combo chain!
        if (
          comboCountRef.current >= specialComboReq &&
          !comboRewardClaimedRef.current
        ) {
          comboRewardClaimedRef.current = true;
          pendingSpecialRewardRef.current = true;
          spawnScorePopup(
            canvasWidth / 2,
            jarTop + 42,
            '🌈 SPECIAL DROP EARNED!',
            '#EC4899',
            24,
            0.65,
          );
        }

        // Determine base tier being evolved (twin Rainbow Dewdrops evolve straight into Tier 6 Cucumber!)
        const isTwinRainbow =
          kind === 'rainbow' &&
          fruitA.special === 'rainbow' &&
          fruitB.special === 'rainbow';
        const currentTierNum = isTwinRainbow
          ? 5
          : kind === 'rainbow'
          ? fruitB.tier
          : fruitA.tier;
        const achievedTier = Math.min(13, currentTierNum + 1);
        if (achievedTier > highestTierRef.current) {
          highestTierRef.current = achievedTier;
          setHighestTier(achievedTier);
        }

        // Pure Merge Charge gain for Zero-G & Magnet
        const chargeBoost =
          comboCountRef.current >= 3 ? comboChargeMult : 1.0;
        addPowerupCharge(
          (agBase + currentTierNum * 2) * chargeBoost,
          (magBase + currentTierNum * 2) * chargeBoost,
        );

        const currentTierConfig = FRUIT_TIERS[currentTierNum - 1];
        const basePts = isTwinRainbow
          ? 300
          : currentTierConfig
          ? currentTierConfig.points
          : 2;
        const comboMult = Math.min(3.0, 1 + (comboCountRef.current - 1) * 0.25);
        const earnedPoints = Math.round(basePts * comboMult);

        // Audio juice
        if (kind === 'rainbow') {
          gameAudio.playWildcardShimmer();
        } else if (currentTierNum >= 12) {
          gameAudio.playVictoryFanfare();
        } else if (currentTierNum >= 9) {
          gameAudio.playLevelUpStinger();
        } else if (currentTierNum >= 5) {
          gameAudio.playPowerupChime();
        } else {
          gameAudio.playCoinPickup();
        }

        if (comboCountRef.current >= 2) {
          gameAudio.playComboChime(comboCountRef.current);
          const comboColor =
            comboCountRef.current >= 5
              ? '#F43F5E'
              : comboCountRef.current >= 3
              ? '#F59E0B'
              : '#10B981';
          spawnScorePopup(
            midX,
            Math.max(125, midY - 38),
            `🔥 ${comboCountRef.current}x COMBO!`,
            comboColor,
            27,
            0.7,
          );
        }

        // Particle Burst
        spawnJuiceSplash(
          midX,
          midY,
          kind === 'rainbow'
            ? '#EC4899'
            : currentTierConfig
            ? currentTierConfig.color
            : '#F59E0B',
          kind === 'rainbow' ? 30 : 24,
          kind === 'rainbow',
        );

        // Check if merging 2 King Durians (Tier 13) -> Pinnacle Ultimate Victory / Endless Supernova!
        if (currentTierNum >= 13) {
          const victoryPoints = Math.round(10000 * comboMult);
          spawnShockwave(midX, midY, 260, '#FFD700', 8);
          spawnShockwave(midX, midY, 180, '#9EF01A', 5);
          spawnJuiceSplash(midX, midY, '#FFD700', 60, true);
          screenShakeRef.current = 12;
          gameAudio.playChiptuneExplosion();

          fruitsRef.current.forEach((other) => {
            if (other.merged) return;
            const ox = other.body.position.x - midX;
            const oy = other.body.position.y - midY;
            const od = Math.hypot(ox, oy);
            if (od > 1 && od < 380) {
              const falloff = 1 - od / 380;
              const push = 0.004 * falloff * other.body.mass;
              Matter.Body.applyForce(other.body, other.body.position, {
                x: (ox / od) * push,
                y: (oy / od) * push - 0.0012 * falloff * other.body.mass,
              });
            }
          });

          updateScoreWithHighScore(victoryPoints);
          mergeBlastCenters.push({x: midX, y: midY, r: 130});

          const shouldPromptVictory =
            (getConfig('kingDurianVictory') as boolean) !== false &&
            !isEndlessModeRef.current;

          if (shouldPromptVictory) {
            spawnScorePopup(
              midX,
              midY,
              `+${victoryPoints} 👑 KING DURIAN PINNACLE!`,
              '#9EF01A',
              28,
              0.75,
            );
            setGameState((prev) => ({...prev, status: 'VICTORY'}));
          } else {
            spawnScorePopup(
              midX,
              midY,
              `👑 +${victoryPoints} SUPERNOVA CLEAR!`,
              '#FFD700',
              30,
              0.8,
            );
          }
          return;
        }

        // Create upgraded fruit at Tier + 1
        const nextTierNum = currentTierNum + 1;
        const nextTierConfig = FRUIT_TIERS[nextTierNum - 1];
        const radius = nextTierConfig.radius;
        const restitution = (getConfig('fruitRestitution') as number) || 0.22;
        const friction =
          nextTierConfig.friction ??
          ((getConfig('fruitFriction') as number) || 0.08);
        const densityScale =
          nextTierConfig.density ??
          ((getConfig('fruitDensityMultiplier') as number) || 0.002);

        const clampedSpawnX = Math.max(
          jarX + radius + 4,
          Math.min(jarRight - radius - 4, midX),
        );
        const clampedSpawnY = Math.max(
          jarTop + radius + 4,
          Math.min(jarBottom - radius - 4, midY),
        );

        const newBody = Matter.Bodies.circle(
          clampedSpawnX,
          clampedSpawnY,
          radius,
          {
            restitution,
            friction,
            density: densityScale * (1 + nextTierNum * 0.15),
            label: 'fruit',
          },
        );

        Matter.Body.setVelocity(newBody, {
          x: 0,
          y: -1.2,
        });
        Matter.Body.setAngularVelocity(newBody, 0);

        Matter.Composite.add(world, newBody);

        const newEntity: FruitEntity = {
          id: `fruit_${newBody.id}`,
          tier: nextTierNum,
          special: 'none',
          body: newBody,
          spawnTime: now,
          renderScale: 0.2,
          targetScale: 1.0,
          squashX: 1.32,
          squashY: 0.72,
          squashVelX: 0,
          squashVelY: 0,
          lastImpactTime: now,
          blinkTimer: 1 + Math.random() * 3,
          isBlinking: false,
          expression: nextTierNum === 13 ? 'regal' : 'bouncy',
          expressionTimer: 1.0,
          merged: false,
        };

        fruitsRef.current.set(newBody.id, newEntity);
        mergeBlastCenters.push({x: clampedSpawnX, y: clampedSpawnY, r: radius});

        // Expanding shockwave ring
        spawnShockwave(
          clampedSpawnX,
          clampedSpawnY,
          radius * 2.15 + comboCountRef.current * 14,
          kind === 'rainbow' ? '#EC4899' : nextTierConfig.color,
          comboCountRef.current >= 3 || nextTierNum >= 8 ? 6 : 4,
        );

        if (nextTierNum === 13) {
          spawnJuiceSplash(clampedSpawnX, clampedSpawnY, '#FFD700', 40, true);
        }

        // Subtle radial shockwave push & screen shake on combos >= 3 or high-tier merges >= 8
        if (comboCountRef.current >= 3 || nextTierNum >= 8) {
          const shakeImpulse = Math.min(
            9,
            2.2 +
              (comboCountRef.current >= 3 ? comboCountRef.current * 0.85 : 0) +
              (nextTierNum >= 8 ? (nextTierNum - 7) * 1.1 : 0),
          );
          screenShakeRef.current = Math.max(
            screenShakeRef.current,
            shakeImpulse,
          );

          const blastRadius = radius * 2.8 + 60;
          fruitsRef.current.forEach((other) => {
            if (other.body.id === newBody.id || other.merged) return;
            const ox = other.body.position.x - clampedSpawnX;
            const oy = other.body.position.y - clampedSpawnY;
            const od = Math.hypot(ox, oy);
            if (od > 1 && od < blastRadius) {
              const falloff = 1 - od / blastRadius;
              const push = 0.0022 * falloff * other.body.mass;
              Matter.Body.applyForce(other.body, other.body.position, {
                x: (ox / od) * push,
                y: (oy / od) * push - 0.0006 * falloff * other.body.mass,
              });
            }
          });
        }

        spawnScorePopup(
          clampedSpawnX,
          clampedSpawnY,
          kind === 'rainbow'
            ? `🌈 +${earnedPoints} ${nextTierConfig.name}!`
            : `+${earnedPoints} ${nextTierConfig.name}!`,
          kind === 'rainbow' ? '#EC4899' : nextTierConfig.color,
          nextTierNum >= 9 ? 26 : 24,
          0.55,
        );

        updateScoreWithHighScore(earnedPoints);
      });

      // Trigger any settled Fizz Berry catalysts adjacent to this frame's merges!
      if (mergeBlastCenters.length > 0) {
        const fizzToDetonate: FruitEntity[] = [];
        fruitsRef.current.forEach((cand) => {
          if (cand.merged || cand.special !== 'fizz') return;
          const hitNearby = mergeBlastCenters.some((mc) => {
            const d = Math.hypot(
              cand.body.position.x - mc.x,
              cand.body.position.y - mc.y,
            );
            return d <= mc.r + SPECIAL_DROPS.fizz.radius + 115;
          });
          if (hitNearby) {
            fizzToDetonate.push(cand);
          }
        });

        const activeComboMult = Math.min(
          3.0,
          1 + Math.max(0, comboCountRef.current - 1) * 0.25,
        );
        fizzToDetonate.forEach((fizzEntity) => {
          if (fizzEntity.merged || !fruitsRef.current.has(fizzEntity.body.id)) {
            return;
          }
          fizzEntity.merged = true;
          const fx = fizzEntity.body.position.x;
          const fy = fizzEntity.body.position.y;
          Matter.Composite.remove(world, fizzEntity.body);
          fruitsRef.current.delete(fizzEntity.body.id);
          detonateFizzAt(world, fx, fy, activeComboMult);
        });
      }
    }

    // 4. Update Fruits Rescue Clamp, Squash Springs, Expressions & Simmer/Danger Tension
    let settledBreach = false;
    let settledSimmer = false;
    const isAntiGravityRunning =
      antiGravityTimerRef.current > 0 || dangerGraceCooldownRef.current > 0;
    const springDt = Math.min(deltaTime, 0.033);
    const springStiffness = 230;
    const springDamping = 15;
    const simmerLineY = dangerLineY + 135;
    const activeMag = activeMagnetRef.current;

    fruitsRef.current.forEach((fruit) => {
      const fruitRadius = getFruitEntityRadius(fruit);

      // Safety rescue clamp: prevent multi-body pressure from ever forcing a fruit outside jar bounds
      const minX = jarX + fruitRadius;
      const maxX = jarRight - fruitRadius;
      const maxY = jarBottom - fruitRadius;
      const minY =
        antiGravityTimerRef.current > 0 ? 110 + fruitRadius : 60 + fruitRadius;
      const pos = fruit.body.position;
      let clampedX = pos.x;
      let clampedY = pos.y;
      let vx = fruit.body.velocity.x;
      let vy = fruit.body.velocity.y;
      let needsRescue = false;

      if (pos.x < minX) {
        clampedX = minX;
        if (vx < 0) vx = 0;
        needsRescue = true;
      } else if (pos.x > maxX) {
        clampedX = maxX;
        if (vx > 0) vx = 0;
        needsRescue = true;
      }

      if (pos.y > maxY) {
        clampedY = maxY;
        if (vy > 0) vy = 0;
        needsRescue = true;
      } else if (pos.y < minY) {
        clampedY = minY;
        if (vy < 0) vy = 0;
        needsRescue = true;
      }

      if (needsRescue) {
        Matter.Body.setPosition(fruit.body, {x: clampedX, y: clampedY});
        Matter.Body.setVelocity(fruit.body, {x: vx, y: vy});
      }

      // Elastic scale-in animation
      if (fruit.renderScale < fruit.targetScale) {
        fruit.renderScale +=
          (fruit.targetScale - fruit.renderScale) * Math.min(1, 16 * deltaTime);
        if (Math.abs(fruit.renderScale - fruit.targetScale) < 0.01) {
          fruit.renderScale = fruit.targetScale;
        }
      }

      // Spring-damper squash-and-stretch integration back toward 1.0
      const accX =
        (1.0 - fruit.squashX) * springStiffness -
        fruit.squashVelX * springDamping;
      const accY =
        (1.0 - fruit.squashY) * springStiffness -
        fruit.squashVelY * springDamping;
      fruit.squashVelX += accX * springDt;
      fruit.squashVelY += accY * springDt;
      fruit.squashX = Math.max(
        0.68,
        Math.min(1.38, fruit.squashX + fruit.squashVelX * springDt),
      );
      fruit.squashY = Math.max(
        0.68,
        Math.min(1.38, fruit.squashY + fruit.squashVelY * springDt),
      );
      if (
        Math.abs(fruit.squashX - 1) < 0.003 &&
        Math.abs(fruit.squashVelX) < 0.02
      ) {
        fruit.squashX = 1;
        fruit.squashVelX = 0;
      }
      if (
        Math.abs(fruit.squashY - 1) < 0.003 &&
        Math.abs(fruit.squashVelY) < 0.02
      ) {
        fruit.squashY = 1;
        fruit.squashVelY = 0;
      }

      // Blink animation
      fruit.blinkTimer -= deltaTime;
      if (fruit.blinkTimer <= 0) {
        if (!fruit.isBlinking) {
          fruit.isBlinking = true;
          fruit.blinkTimer = 0.15;
        } else {
          fruit.isBlinking = false;
          fruit.blinkTimer = 2 + Math.random() * 4;
        }
      }

      // Decay timed expressions
      if (fruit.expressionTimer > 0) {
        fruit.expressionTimer -= deltaTime;
        if (fruit.expressionTimer <= 0) {
          fruit.expression =
            fruit.special === 'none' && fruit.tier === 13 ? 'regal' : 'happy';
        }
      }

      // Contextual Physics Expressions (Zero-G Dizzy, Magnet Starry, Simmer Sweat, Danger Shock)
      const isMagLocked =
        activeMag !== null &&
        (activeMag.fruitAId === fruit.body.id ||
          activeMag.fruitBId === fruit.body.id);

      if (antiGravityTimerRef.current > 0) {
        fruit.expression = 'dizzy';
        fruit.expressionTimer = 0.12;
      } else if (isMagLocked) {
        fruit.expression = 'starry';
        fruit.expressionTimer = 0.15;
      } else if (!isAntiGravityRunning) {
        const ageSeconds = (now - fruit.spawnTime) / 1000;
        const speed = Math.hypot(fruit.body.velocity.x, fruit.body.velocity.y);
        const topY = fruit.body.position.y - fruitRadius;

        if (ageSeconds > 2.0 && speed < 1.5 && topY < dangerLineY) {
          settledBreach = true;
          fruit.expression = 'shocked';
          fruit.expressionTimer = 0.35;
        } else if (ageSeconds > 1.5 && speed < 1.8 && topY < simmerLineY) {
          settledSimmer = true;
          if (fruit.expressionTimer <= 0.12) {
            fruit.expression = 'sweating';
            fruit.expressionTimer = 0.25;
          }
        }
      }
    });

    // 5. Danger Line Accumulator & Dynamic Audio Tension Escalation / Relief
    const dangerGrace = (getConfig('dangerGraceSeconds') as number) || 2.5;
    if (settledBreach && !isAntiGravityRunning) {
      dangerTimerRef.current += deltaTime;
      if (dangerTimerRef.current >= dangerGrace) {
        setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
      }
    } else {
      dangerTimerRef.current = Math.max(
        0,
        dangerTimerRef.current - deltaTime * 1.5,
      );
    }

    const nextTensionTier: 0 | 1 | 2 =
      !isAntiGravityRunning && dangerTimerRef.current > 0.05
        ? 2
        : !isAntiGravityRunning && settledSimmer
        ? 1
        : 0;

    if (nextTensionTier > 0) {
      simmerDurationRef.current += deltaTime;
    } else if (tensionTierRef.current > 0) {
      if (tensionTierRef.current === 2 || simmerDurationRef.current >= 2.2) {
        gameAudio.playReliefSplash();
      }
      simmerDurationRef.current = 0;
    }

    if (nextTensionTier !== tensionTierRef.current) {
      tensionTierRef.current = nextTensionTier;
      setMusicTensionTier(nextTensionTier);
    }

    // 6. Update Shockwave Rings
    for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
      const sw = shockwavesRef.current[i];
      sw.life += deltaTime;
      const t = Math.min(1, sw.life / sw.maxLife);
      const easeOut = 1 - Math.pow(1 - t, 3);
      sw.radius = sw.maxRadius * (0.2 + 0.8 * easeOut);
      sw.alpha = Math.max(0, (1 - t) * 0.85);
      if (sw.life >= sw.maxLife) {
        shockwavesRef.current.splice(i, 1);
      }
    }

    // 7. Update Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      if (!p.isZeroG && !p.isElectric) {
        p.vy += 0.18; // standard particle gravity
      } else if (p.isZeroG) {
        p.vy -= 0.05; // zero-G particle float up
      }
      p.vx *= 0.98;
      p.life += deltaTime;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        particlesRef.current.splice(i, 1);
      }
    }

    // 8. Update Score Popups
    for (let i = scorePopupsRef.current.length - 1; i >= 0; i--) {
      const s = scorePopupsRef.current[i];
      s.y -= 45 * deltaTime;
      s.life += deltaTime;
      s.scale = Math.min(1.2, s.scale + deltaTime * 3);
      s.alpha = Math.max(0, 1 - s.life / s.maxLife);
      if (s.life >= s.maxLife) {
        scorePopupsRef.current.splice(i, 1);
      }
    }
  };

  // Kawaii & Contextual Physics Face Drawing Helper
  const drawFruitFace = (
    ctx: CanvasRenderingContext2D,
    radius: number,
    fruit: FruitEntity,
    overrideExpression?: FruitExpression,
  ) => {
    const expr = overrideExpression || fruit.expression;
    const nowMs = performance.now();

    ctx.save();
    const faceScale = radius / 36;
    ctx.scale(faceScale, faceScale);

    const eyeOffsetX = 8;
    const eyeOffsetY = -2;

    // Cheeks (richer blush when starry-eyed!)
    ctx.fillStyle =
      expr === 'starry'
        ? 'rgba(255, 95, 130, 0.65)'
        : 'rgba(255, 120, 140, 0.45)';
    ctx.beginPath();
    ctx.arc(-eyeOffsetX - 3, eyeOffsetY + 5, expr === 'starry' ? 4.8 : 4, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 3, eyeOffsetY + 5, expr === 'starry' ? 4.8 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#2C1810';
    if (expr === 'dizzy') {
      // Rotating spiral Zero-G eyes (@ @)
      const spin = nowMs * 0.008;
      [-eyeOffsetX, eyeOffsetX].forEach((ex, idx) => {
        ctx.save();
        ctx.translate(ex, eyeOffsetY);
        ctx.rotate(idx === 0 ? spin : -spin);
        ctx.strokeStyle = '#2C1810';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let t = 0; t <= 14; t++) {
          const ang = t * 0.85;
          const rSpiral = 0.28 * t;
          const px = Math.cos(ang) * rSpiral;
          const py = Math.sin(ang) * rSpiral;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      });
    } else if (expr === 'starry') {
      // Golden 4-point star eyes (Magnet Beam / Merge Aim lock!)
      const pulse = 1 + 0.14 * Math.sin(nowMs * 0.016);
      [-eyeOffsetX, eyeOffsetX].forEach((ex) => {
        ctx.save();
        ctx.translate(ex, eyeOffsetY);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let p = 0; p < 8; p++) {
          const ang = (p * Math.PI) / 4 - Math.PI / 2;
          const rStar = p % 2 === 0 ? 4.4 : 1.7;
          const sx = Math.cos(ang) * rStar;
          const sy = Math.sin(ang) * rStar;
          if (p === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    } else if (fruit.isBlinking && expr !== 'shocked' && expr !== 'sweating') {
      // Blinking curved eye lines
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2C1810';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY + 1, 3.5, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeOffsetX, eyeOffsetY + 1, 3.5, Math.PI, 0);
      ctx.stroke();
    } else if (expr === 'shocked') {
      // Wide panic eyes with white sclera ring
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 4.4, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2C1810';
      ctx.lineWidth = 1.3;
      ctx.stroke();

      const jitterX = Math.sin(nowMs * 0.045) * 0.6;
      ctx.fillStyle = '#2C1810';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + jitterX, eyeOffsetY, 2.1, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + jitterX, eyeOffsetY, 2.1, 0, Math.PI * 2);
      ctx.fill();
    } else if (expr === 'sweating') {
      // Worried eyes + angled nervous brows
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY + 0.5, 2.9, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY + 0.5, 2.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX - 0.9, eyeOffsetY - 0.6, 1.1, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX - 0.9, eyeOffsetY - 0.6, 1.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#2C1810';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-eyeOffsetX - 3.2, eyeOffsetY - 4.2);
      ctx.lineTo(-eyeOffsetX + 2.5, eyeOffsetY - 5.8);
      ctx.moveTo(eyeOffsetX + 3.2, eyeOffsetY - 4.2);
      ctx.lineTo(eyeOffsetX - 2.5, eyeOffsetY - 5.8);
      ctx.stroke();
    } else if (expr === 'regal') {
      // Regal confident sparkling eyes
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 3.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX - 1, eyeOffsetY - 1, 1.4, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX - 1, eyeOffsetY - 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Happy eyes with cute sparkle pupil
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 3, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX - 1, eyeOffsetY - 1, 1.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX - 1, eyeOffsetY - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mouth
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.fillStyle = '#C84B31';

    if (expr === 'shocked') {
      ctx.beginPath();
      ctx.ellipse(0, eyeOffsetY + 6.5, 3.2, 4.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (expr === 'dizzy') {
      ctx.beginPath();
      ctx.arc(0, eyeOffsetY + 5.5, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (expr === 'sweating') {
      // Nervous wavy mouth (~)
      ctx.beginPath();
      ctx.moveTo(-4, eyeOffsetY + 5.5);
      ctx.quadraticCurveTo(-2, eyeOffsetY + 3.5, 0, eyeOffsetY + 5.5);
      ctx.quadraticCurveTo(2, eyeOffsetY + 7.5, 4, eyeOffsetY + 5.5);
      ctx.stroke();
    } else if (
      expr === 'bouncy' ||
      expr === 'regal' ||
      expr === 'starry'
    ) {
      // Big open happy smile :D
      ctx.beginPath();
      ctx.arc(0, eyeOffsetY + 3, 4.2, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Sweet tiny smile :)
      ctx.beginPath();
      ctx.arc(0, eyeOffsetY + 3, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Animated cyan sweat droplet(s) when in Simmer / Danger tension!
    if (expr === 'sweating' || expr === 'shocked') {
      const drawSweatDrop = (dx: number, dy: number, sScale: number) => {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(sScale, sScale);
        ctx.fillStyle = '#38BDF8';
        ctx.strokeStyle = '#0369A1';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -4.5);
        ctx.bezierCurveTo(3.5, -0.5, 3.5, 4, 0, 4.5);
        ctx.bezierCurveTo(-3.5, 4, -3.5, -0.5, 0, -4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };

      const dropBob = (nowMs * 0.006) % 1;
      drawSweatDrop(14.5, -9 + dropBob * 4.5, 0.95);
      if (expr === 'shocked') {
        const dropBob2 = ((nowMs * 0.006) + 0.5) % 1;
        drawSweatDrop(-14.5, -7 + dropBob2 * 4.5, 0.85);
      }
    }

    ctx.restore();
  };

  // Procedural Drawing for Special Drops, Cucumber, King Durian, or Sprite Fallbacks
  const drawFruitBody = (
    ctx: CanvasRenderingContext2D,
    tierConfig: FruitTier,
    radius: number,
    special: SpecialDropKind = 'none',
  ) => {
    const nowMs = performance.now();

    // Special 1: Rainbow Dewdrop Wildcard
    if (special === 'rainbow') {
      const hueShift = (nowMs * 0.09) % 360;
      const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
      grad.addColorStop(0, `hsl(${hueShift}, 95%, 65%)`);
      grad.addColorStop(0.33, `hsl(${(hueShift + 90) % 360}, 95%, 60%)`);
      grad.addColorStop(0.66, `hsl(${(hueShift + 190) % 360}, 95%, 60%)`);
      grad.addColorStop(1, `hsl(${(hueShift + 280) % 360}, 95%, 65%)`);

      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFBEB';
      ctx.lineWidth = 3.2;
      ctx.stroke();

      // Glossy specular sheen
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(
        -radius * 0.3,
        -radius * 0.34,
        radius * 0.3,
        radius * 0.17,
        -0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      // Twinkling 4-point star glint
      ctx.translate(radius * 0.36, -radius * 0.36);
      ctx.rotate(nowMs * 0.003);
      ctx.fillStyle = '#FFFFFF';
      const glintR = radius * 0.24;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? glintR : glintR * 0.35;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    // Special 2: Fizz Berry Catalyst
    if (special === 'fizz') {
      ctx.save();
      const grad = ctx.createRadialGradient(
        -radius * 0.25,
        -radius * 0.25,
        radius * 0.1,
        0,
        0,
        radius,
      );
      grad.addColorStop(0, '#CFFAFE');
      grad.addColorStop(0.55, '#06B6D4');
      grad.addColorStop(1, '#0E7490');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Rising internal soda bubbles
      const bubbleSeeds = [
        {x: -0.38, phase: 0.0, r: 0.13},
        {x: 0.36, phase: 0.35, r: 0.11},
        {x: -0.15, phase: 0.65, r: 0.09},
        {x: 0.22, phase: 0.82, r: 0.12},
      ];
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      bubbleSeeds.forEach((b) => {
        const rise = ((nowMs * 0.0012 + b.phase) % 1) * 1.1 - 0.55;
        ctx.beginPath();
        ctx.arc(
          radius * b.x,
          -radius * rise,
          Math.max(2, radius * b.r),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });

      // Effervescent dashed outer ring
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#BEF264';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    // 1. Procedural Cucumber (Tier 6)
    if (tierConfig.tier === 6) {
      // Base cucumber green circle
      ctx.fillStyle = '#38B000';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Dark green longitudinal curved stripes
      ctx.strokeStyle = '#1F7A00';
      ctx.lineWidth = Math.max(2, radius * 0.08);
      ctx.lineCap = 'round';

      const stripeOffsets = [-0.65, -0.32, 0, 0.32, 0.65];
      stripeOffsets.forEach((factor) => {
        ctx.beginPath();
        const startX = radius * factor * 0.85;
        const cpX = radius * factor * 1.05;
        ctx.moveTo(startX, -radius * 0.85);
        ctx.quadraticCurveTo(cpX, 0, startX, radius * 0.85);
        ctx.stroke();
      });

      // Subtle yellow-green bumpy dots
      ctx.fillStyle = '#70E000';
      const bumpPoints = [
        {x: -radius * 0.45, y: -radius * 0.4},
        {x: -radius * 0.15, y: -radius * 0.6},
        {x: radius * 0.35, y: -radius * 0.45},
        {x: -radius * 0.5, y: radius * 0.25},
        {x: radius * 0.4, y: radius * 0.3},
        {x: -radius * 0.2, y: radius * 0.55},
        {x: radius * 0.15, y: radius * 0.6},
      ];
      bumpPoints.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1.5, radius * 0.05), 0, Math.PI * 2);
        ctx.fill();
      });

      // Outer crisp outline
      ctx.strokeStyle = '#195703';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }

    // 2. Procedural King Durian (Tier 13)
    if (tierConfig.tier === 13) {
      // Outer spiky circumference: ring of spiky golden-yellow/green triangles
      const spikeCount = 20;
      const innerR = radius * 0.88;
      const outerR = radius * 1.14;

      ctx.save();
      ctx.fillStyle = '#E9D846';
      ctx.strokeStyle = '#70B800';
      ctx.lineWidth = 2.5;

      for (let i = 0; i < spikeCount; i++) {
        const a1 = (i / spikeCount) * Math.PI * 2;
        const aMid = ((i + 0.5) / spikeCount) * Math.PI * 2;
        const a2 = ((i + 1) / spikeCount) * Math.PI * 2;

        const x1 = Math.cos(a1) * innerR;
        const y1 = Math.sin(a1) * innerR;
        const xTip = Math.cos(aMid) * outerR;
        const yTip = Math.sin(aMid) * outerR;
        const x2 = Math.cos(a2) * innerR;
        const y2 = Math.sin(a2) * innerR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(xTip, yTip);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? '#E9D846' : '#9EF01A';
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      // Main golden-green body gradient
      const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, radius * 0.1, 0, 0, radius);
      grad.addColorStop(0, '#D4F754');
      grad.addColorStop(0.6, '#9EF01A');
      grad.addColorStop(1, '#539E00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#3A7000';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Royal Golden Crown on Top
      ctx.save();
      ctx.translate(0, -radius * 0.82);
      const crownW = radius * 0.7;
      const crownH = radius * 0.42;

      // Crown base fill
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(-crownW / 2, crownH / 2);
      ctx.lineTo(-crownW / 2, -crownH / 4);
      ctx.lineTo(-crownW / 4, crownH / 8);
      ctx.lineTo(0, -crownH / 2);
      ctx.lineTo(crownW / 4, crownH / 8);
      ctx.lineTo(crownW / 2, -crownH / 4);
      ctx.lineTo(crownW / 2, crownH / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ruby jewels on crown peaks
      ctx.fillStyle = '#E63946';
      [-crownW / 2, 0, crownW / 2].forEach((gemX, idx) => {
        const gemY = idx === 1 ? -crownH / 2 : -crownH / 4;
        ctx.beginPath();
        ctx.arc(gemX, gemY, radius * 0.055, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      return;
    }

    // 3. Standard sprite or geometric fallback for other tiers
    const img = assets[tierConfig.assetKey];
    if (img && img.complete && img.naturalWidth > 0) {
      const drawH = radius * 2.15;
      const drawW = drawH * tierConfig.aspectRatio;
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.fillStyle = tierConfig.color;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  // Main Draw Pipeline
  const draw = (ctx: CanvasRenderingContext2D) => {
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    // 1. Cozy Background Backdrop
    drawBackground(
      ctx,
      assets['cozy_wooden_backdrop'],
      canvasWidth,
      canvasHeight,
      THEME.backgroundPastel,
    );

    // Warm ambient tint for atmosphere
    ctx.fillStyle = 'rgba(253, 246, 227, 0.25)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Playfield container with subtle screen-shake transform
    ctx.save();
    if (screenShakeRef.current > 0) {
      const shakeMag = screenShakeRef.current;
      const sx = (Math.random() - 0.5) * 2 * shakeMag;
      const sy = (Math.random() - 0.5) * 2 * shakeMag;
      ctx.translate(sx, sy);
    }

    // 2. Render Wooden Shelf & Jar Backdrop
    ctx.save();
    // Glass Jar Interior Glow
    ctx.fillStyle = THEME.jarGlass;
    ctx.beginPath();
    ctx.roundRect(jarX, jarTop, jarWidth, jarBottom - jarTop, [
      0,
      0,
      36,
      36,
    ]);
    ctx.fill();

    // Jar Inner Shadow & Rim Highlights
    ctx.strokeStyle = THEME.woodBorder;
    ctx.lineWidth = 8;
    ctx.stroke();

    // Zero-G Cosmic Glow tint inside jar when Anti-Gravity is active
    if (antiGravityTimerRef.current > 0) {
      const gAlpha = 0.15 + 0.08 * Math.sin(performance.now() * 0.008);
      ctx.fillStyle = `rgba(168, 85, 247, ${gAlpha})`;
      ctx.beginPath();
      ctx.roundRect(jarX, jarTop, jarWidth, jarBottom - jarTop, [0, 0, 36, 36]);
      ctx.fill();

      // Zero-G ceiling line indicator
      ctx.strokeStyle = '#A855F7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(jarX, 95);
      ctx.lineTo(jarRight, 95);
      ctx.stroke();
    }

    // Wooden Jar Rim and Outer Trim
    ctx.strokeStyle = THEME.woodDark;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(jarX - 10, jarTop);
    ctx.lineTo(jarX, jarTop);
    ctx.lineTo(jarX, jarBottom - 10);
    ctx.arcTo(jarX, jarBottom, jarX + 36, jarBottom, 36);
    ctx.lineTo(jarRight - 36, jarBottom);
    ctx.arcTo(jarRight, jarBottom, jarRight, jarBottom - 36, 36);
    ctx.lineTo(jarRight, jarTop);
    ctx.lineTo(jarRight + 10, jarTop);
    ctx.stroke();

    // Jar Base Platter
    ctx.fillStyle = THEME.woodDark;
    ctx.beginPath();
    ctx.roundRect(jarX - 24, jarBottom, jarWidth + 48, 22, 10);
    ctx.fill();
    ctx.fillStyle = THEME.woodLight;
    ctx.beginPath();
    ctx.roundRect(jarX - 20, jarBottom + 3, jarWidth + 40, 5, 3);
    ctx.fill();

    // Glass Reflection streaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(jarX + 24, jarTop + 20);
    ctx.lineTo(jarX + 44, jarTop + 20);
    ctx.lineTo(jarX + 16, jarBottom - 40);
    ctx.lineTo(jarX + 8, jarBottom - 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Danger Line (Pulsing / Warning)
    ctx.save();
    const dangerGrace = (getConfig('dangerGraceSeconds') as number) || 2.5;
    const dangerRatio = Math.min(1, dangerTimerRef.current / dangerGrace);
    const isDangerActive =
      dangerTimerRef.current > 0.05 &&
      antiGravityTimerRef.current <= 0 &&
      dangerGraceCooldownRef.current <= 0;

    ctx.lineWidth = isDangerActive ? 3.5 : 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = isDangerActive
      ? `rgba(239, 68, 68, ${0.4 + Math.sin(performance.now() * 0.015) * 0.5})`
      : 'rgba(239, 68, 68, 0.45)';

    ctx.beginPath();
    ctx.moveTo(jarX + 10, dangerLineY);
    ctx.lineTo(jarRight - 10, dangerLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Danger Warning Indicator Icon/Banner if active
    if (isDangerActive) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.font = 'bold 15px ' + THEME.fontFamily;
      ctx.textAlign = 'center';
      ctx.fillText(
        `DANGER! ${Math.max(0, dangerGrace - dangerTimerRef.current).toFixed(1)}s`,
        canvasWidth / 2,
        dangerLineY - 10,
      );

      // Warning glow over top of jar
      ctx.fillStyle = `rgba(239, 68, 68, ${dangerRatio * 0.25})`;
      ctx.fillRect(jarX, jarTop, jarWidth, dangerLineY - jarTop);
    }
    ctx.restore();

    // 3.5 Magnet Electric Laser Beam Rendering (with Zero-Dist NaN Guard)
    if (activeMagnetRef.current) {
      const mag = activeMagnetRef.current;
      const fA = fruitsRef.current.get(mag.fruitAId);
      const fB = fruitsRef.current.get(mag.fruitBId);

      if (fA && fB) {
        ctx.save();
        const pA = fA.body.position;
        const pB = fB.body.position;
        const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y);

        // Outer neon glow beam
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
        ctx.lineWidth = 10 + Math.sin(performance.now() * 0.03) * 4;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        // Inner electric core beam
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        // Sinuous electric arcs (guarded against 0/0 NaN when centers overlap)
        if (segLen > 1) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          const segs = 8;
          const perpX = -(pB.y - pA.y) / segLen;
          const perpY = (pB.x - pA.x) / segLen;
          ctx.moveTo(pA.x, pA.y);
          for (let i = 1; i < segs; i++) {
            const t = i / segs;
            const mx = pA.x + (pB.x - pA.x) * t;
            const my = pA.y + (pB.y - pA.y) * t;
            const offset =
              Math.sin(performance.now() * 0.05 + i * 2) *
              12 *
              (1 - Math.abs(t - 0.5) * 2);
            ctx.lineTo(mx + perpX * offset, my + perpY * offset);
          }
          ctx.lineTo(pB.x, pB.y);
          ctx.stroke();
        }

        // Magnetic rings around both fruit centers
        [pA, pB].forEach((pt) => {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(
            pt.x,
            pt.y,
            20 + Math.sin(performance.now() * 0.02) * 8,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        });

        ctx.restore();
      }
    }

    // 3.8 Render Expanding Shockwave Rings
    shockwavesRef.current.forEach((sw) => {
      ctx.save();
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1.5, sw.lineWidth * (0.4 + 0.6 * sw.alpha));
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Precompute Smart Swept-Circle Raycast so targeted fruits also light up with starry eyes!
    const activeDropItem = currentItemRef.current;
    const activeItemMeta = getDropItemDetails(activeDropItem);
    const activeRadius = activeItemMeta.radius;
    const curDropperX = Math.max(
      jarX + activeRadius + 4,
      Math.min(jarRight - activeRadius - 4, dropperXRef.current),
    );
    const isUpwardZeroG = antiGravityTimerRef.current > 2.0;
    const rainbowMaxTier = (getConfig('rainbowMaxTargetTier') as number) || 9;

    let landingCenterY = jarBottom - activeRadius;
    let matchedFruit: FruitEntity | null = null;

    if (gameState.status === 'PLAYING') {
      fruitsRef.current.forEach((f) => {
        if (f.merged) return;
        const fx = f.body.position.x;
        const fy = f.body.position.y;
        const fr = getFruitEntityRadius(f);
        const dx = Math.abs(curDropperX - fx);
        const sumR = activeRadius + fr;
        if (dx < sumR && fy > dropperY) {
          const candY = fy - Math.sqrt(sumR * sumR - dx * dx);
          if (candY < landingCenterY) {
            landingCenterY = candY;
            matchedFruit = f;
          }
        }
      });
      landingCenterY = Math.max(dropperY + activeRadius, landingCenterY);
    }

    const rayHitFruit = matchedFruit as FruitEntity | null;
    const isWildcardMerge =
      !isUpwardZeroG &&
      activeDropItem.special === 'rainbow' &&
      rayHitFruit !== null &&
      ((rayHitFruit.special === 'none' && rayHitFruit.tier <= rainbowMaxTier) ||
        rayHitFruit.special === 'rainbow' ||
        rayHitFruit.special === 'fizz');
    const isStandardMerge =
      !isUpwardZeroG &&
      activeDropItem.special === 'none' &&
      rayHitFruit !== null &&
      rayHitFruit.special === 'none' &&
      rayHitFruit.tier === activeDropItem.tier;
    const isFizzPairMerge =
      !isUpwardZeroG &&
      activeDropItem.special === 'fizz' &&
      rayHitFruit !== null &&
      (rayHitFruit.special === 'fizz' || rayHitFruit.special === 'rainbow');
    const isMergeTarget =
      isWildcardMerge || isStandardMerge || isFizzPairMerge;
    const aimStarryId =
      gameState.status === 'PLAYING' && isMergeTarget && rayHitFruit
        ? rayHitFruit.body.id
        : -1;

    // 4. Render Active Physics Fruits (world-axis squash applied BEFORE sprite rotation)
    fruitsRef.current.forEach((fruit) => {
      const {x, y} = fruit.body.position;
      const angle = fruit.body.angle;
      const tierConfig = FRUIT_TIERS[fruit.tier - 1] || FRUIT_TIERS[0];
      const radius = getFruitEntityRadius(fruit);

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(
        fruit.renderScale * fruit.squashX,
        fruit.renderScale * fruit.squashY,
      );
      ctx.rotate(angle);

      // Render fruit body (special drop, procedural, or sprite)
      drawFruitBody(ctx, tierConfig, radius, fruit.special);

      // Draw contextual face (highlight raycast merge target with starry eyes!)
      const faceOverride: FruitExpression | undefined =
        fruit.body.id === aimStarryId && antiGravityTimerRef.current <= 0
          ? 'starry'
          : undefined;
      drawFruitFace(ctx, radius, fruit, faceOverride);

      ctx.restore();
    });

    // 5. Render Smart Swept-Circle Raycast Aiming & Dropper Fruit (when game is playing)
    if (gameState.status === 'PLAYING') {
      const activeTierConfig = activeItemMeta.tierConfig;
      const radius = activeRadius;
      const timeSinceDrop = performance.now() - lastDropTimeRef.current;
      const cooldown = (getConfig('dropCooldownMs') as number) || 450;
      const readyProgress = Math.min(1, timeSinceDrop / cooldown);
      const isReady = readyProgress >= 1;
      const dropperScale = 0.5 + 0.5 * Math.min(1, readyProgress * 1.1);
      const reticlePrimaryColor = isWildcardMerge
        ? '#EC4899'
        : isFizzPairMerge
        ? '#06B6D4'
        : '#10B981';

      ctx.save();
      if (isUpwardZeroG) {
        // Dim short stub during upward Zero-G float; suppress downward landing ghost
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(curDropperX, dropperY + radius);
        ctx.lineTo(curDropperX, Math.min(jarTop + 60, landingCenterY));
        ctx.stroke();
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);

        // Highlight target matching fruit with emerald/magenta-gold halo
        if (isMergeTarget && rayHitFruit) {
          const targetR = getFruitEntityRadius(rayHitFruit) + 5 + pulse * 4;
          ctx.save();
          ctx.strokeStyle = reticlePrimaryColor;
          ctx.lineWidth = 3.5;
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(
            rayHitFruit.body.position.x,
            rayHitFruit.body.position.y,
            targetR,
            0,
            Math.PI * 2,
          );
          ctx.stroke();

          ctx.setLineDash([6, 6]);
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            rayHitFruit.body.position.x,
            rayHitFruit.body.position.y,
            targetR + 4,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
          ctx.restore();
        }

        // Vertical Dashed Guideline from dropper bottom to exact landing center
        if (isMergeTarget) {
          ctx.save();
          ctx.strokeStyle = isWildcardMerge
            ? 'rgba(236, 72, 153, 0.35)'
            : 'rgba(245, 158, 11, 0.35)';
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(curDropperX, dropperY + radius);
          ctx.lineTo(curDropperX, landingCenterY);
          ctx.stroke();
          ctx.restore();
        }

        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = isMergeTarget
          ? reticlePrimaryColor
          : isReady
          ? 'rgba(140, 88, 50, 0.45)'
          : 'rgba(140, 88, 50, 0.2)';
        ctx.lineWidth = isMergeTarget ? 3 : isReady ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(curDropperX, dropperY + radius);
        ctx.lineTo(curDropperX, landingCenterY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Translucent Ghost Landing Circle at exact swept-circle contact center
        ctx.fillStyle = isMergeTarget
          ? isWildcardMerge
            ? `rgba(236, 72, 153, ${0.16 + pulse * 0.1})`
            : `rgba(16, 185, 129, ${0.15 + pulse * 0.1})`
          : isReady
          ? 'rgba(255, 255, 255, 0.18)'
          : 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(curDropperX, landingCenterY, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.setLineDash(isMergeTarget ? [] : [5, 5]);
        ctx.strokeStyle = isMergeTarget
          ? reticlePrimaryColor
          : isReady
          ? 'rgba(245, 158, 11, 0.55)'
          : 'rgba(140, 88, 50, 0.25)';
        ctx.lineWidth = isMergeTarget ? 3 : 2;
        ctx.beginPath();
        ctx.arc(curDropperX, landingCenterY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isMergeTarget) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(
            curDropperX,
            landingCenterY,
            Math.max(4, radius - 4),
            0,
            Math.PI * 2,
          );
          ctx.stroke();

          const pillLabel = isWildcardMerge
            ? '🌈 WILDCARD!'
            : isFizzPairMerge
            ? '🫧 FIZZ BLAST!'
            : '✨ MERGE!';
          const pillW = isWildcardMerge || isFizzPairMerge ? 114 : 94;
          const pillH = 22;
          const pillX = Math.max(
            jarX + pillW / 2 + 6,
            Math.min(jarRight - pillW / 2 - 6, curDropperX),
          );
          const pillY = Math.max(
            dropperY + radius + 20,
            landingCenterY - radius - 16,
          );

          ctx.fillStyle = isWildcardMerge
            ? 'rgba(131, 24, 67, 0.92)'
            : isFizzPairMerge
            ? 'rgba(14, 116, 144, 0.92)'
            : 'rgba(6, 95, 70, 0.92)';
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(pillX - pillW / 2, pillY - pillH / 2, pillW, pillH, 11);
          ctx.fill();
          ctx.stroke();

          ctx.font = '800 12px ' + THEME.fontFamily;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#FDE68A';
          ctx.fillText(pillLabel, pillX, pillY + 0.5);
        } else {
          // Center landing dot
          ctx.fillStyle = isReady
            ? 'rgba(245, 158, 11, 0.65)'
            : 'rgba(140, 88, 50, 0.3)';
          ctx.beginPath();
          ctx.arc(curDropperX, landingCenterY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Dropper Fruit Display
      ctx.save();
      ctx.translate(curDropperX, dropperY);
      ctx.scale(dropperScale, dropperScale);
      ctx.globalAlpha = 0.65 + 0.35 * readyProgress;

      // Soft glow ring when ready
      if (isReady) {
        ctx.strokeStyle =
          isMergeTarget && !isUpwardZeroG
            ? reticlePrimaryColor
            : 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw held fruit or special body
      drawFruitBody(ctx, activeTierConfig, radius, activeDropItem.special);

      // Cute face on held dropper fruit
      const fakeHeldFruit: FruitEntity = {
        id: 'held',
        tier: activeDropItem.tier,
        special: activeDropItem.special,
        body: null as any,
        spawnTime: 0,
        renderScale: 1,
        targetScale: 1,
        squashX: 1,
        squashY: 1,
        squashVelX: 0,
        squashVelY: 0,
        lastImpactTime: 0,
        blinkTimer: 0,
        isBlinking: false,
        expression: isReady
          ? isMergeTarget
            ? 'starry'
            : activeDropItem.special === 'none' && activeDropItem.tier === 13
            ? 'regal'
            : 'happy'
          : 'sleepy',
        expressionTimer: 0,
        merged: false,
      };
      drawFruitFace(ctx, radius, fakeHeldFruit);

      // Dropper cloud / holder badge above
      ctx.fillStyle = '#8C5832';
      ctx.beginPath();
      ctx.arc(0, -radius - 12, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 6. Render Particles
    particlesRef.current.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.isSparkle) {
        // Star sparkle shape
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 5);
        ctx.fillRect(-p.radius, -p.radius / 3, p.radius * 2, (p.radius * 2) / 3);
        ctx.fillRect(-p.radius / 3, -p.radius, (p.radius * 2) / 3, p.radius * 2);
      } else if (p.isZeroG) {
        // Glowing cosmic orb
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
      } else {
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 7. Sleek On-Canvas Combo Badge + Draining Timer Bar (upper-right of jar)
    if (comboCountRef.current >= 2 && comboTimerRef.current > 0) {
      const comboWindow = (getConfig('comboWindowSeconds') as number) || 2.2;
      const ratio = Math.max(0, Math.min(1, comboTimerRef.current / comboWindow));
      const comboMult = Math.min(3.0, 1 + (comboCountRef.current - 1) * 0.25);
      const multText = Number.isInteger(comboMult)
        ? `${comboMult}.0x`
        : `${comboMult.toFixed(2).replace(/0$/, '')}x`;

      const badgeW = 152;
      const badgeH = 44;
      const badgeX = jarRight - badgeW - 14;
      const badgeY = jarTop + 14;
      const pulseScale = 1 + 0.04 * Math.sin(performance.now() * 0.018);

      ctx.save();
      ctx.translate(badgeX + badgeW / 2, badgeY + badgeH / 2);
      ctx.scale(pulseScale, pulseScale);
      ctx.translate(-badgeW / 2, -badgeH / 2);

      // Pill backdrop
      ctx.fillStyle = 'rgba(74, 40, 16, 0.9)';
      ctx.strokeStyle = comboCountRef.current >= 4 ? '#F43F5E' : '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(0, 0, badgeW, badgeH, 14);
      ctx.fill();
      ctx.stroke();

      // Combo Title + Multiplier Pill
      ctx.font = '900 14px ' + THEME.fontFamily;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FEF3C7';
      ctx.fillText(`🔥 ${comboCountRef.current}x COMBO`, 10, 16);

      ctx.font = '800 11px ' + THEME.fontFamily;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34D399';
      ctx.fillText(multText, badgeW - 10, 16);

      // Draining Timer Track
      const barX = 10;
      const barY = 30;
      const barW = badgeW - 20;
      const barH = 7;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3.5);
      ctx.fill();

      // Active Draining Bar
      if (ratio > 0) {
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGrad.addColorStop(0, '#F59E0B');
        barGrad.addColorStop(1, comboCountRef.current >= 4 ? '#F43F5E' : '#10B981');
        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, Math.max(6, barW * ratio), barH, 3.5);
        ctx.fill();
      }

      ctx.restore();
    }

    // 8. Render Floating Score Popups
    scorePopupsRef.current.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      ctx.font = `800 ${s.fontSize || 24}px ${THEME.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#4A2810';
      ctx.strokeText(s.text, 0, 0);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, 0, 0);
      ctx.restore();
    });

    // End playfield screen-shake transform
    ctx.restore();
  };

  // Game Loop Ref Hookup
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      // Cancel / Esc Key Handling in strict top-down overlay priority
      if (inputRef.current) {
        const cancelPressed = inputRef.current.actions.cancel;
        if (cancelPressed && !lastCancelRef.current) {
          if (isEvolutionTreeOpenRef.current) {
            setIsEvolutionTreeOpen(false);
            sessionPlayStartRef.current = performance.now();
          } else if (isHowToPlayOpenRef.current) {
            setIsHowToPlayOpen(false);
            sessionPlayStartRef.current = performance.now();
          } else {
            const currentStatus = gameStateRef.current.status;
            if (currentStatus === 'PLAYING') {
              if (isMenuOpenRef.current) {
                setIsMenuOpen(false);
                sessionPlayStartRef.current = performance.now();
              } else {
                setIsMenuOpen(true);
              }
            } else if (
              currentStatus === 'GAME_OVER' ||
              currentStatus === 'VICTORY'
            ) {
              setGameState((prev) => ({...prev, status: 'START'}));
            } else if (currentStatus === 'START') {
              void exitChat({});
            }
          }
        }
        lastCancelRef.current = cancelPressed;
      }

      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [exitChat]);

  const isMusicPlaying =
    gameState.status === 'PLAYING' && !isMenuOpen && !musicMuted;

  const musicPlaybackRate = antiGravityActive
    ? 0.94
    : musicTensionTier === 2
    ? 1.09
    : musicTensionTier === 1
    ? 1.04
    : 1.0;

  // Next & Hold Item Info
  const nextItemMeta = getDropItemDetails(nextItem);
  const heldItemMeta = heldItem ? getDropItemDetails(heldItem) : null;

  // Session summary stats for Game Over & Victory overlays
  const bestFruitName = FRUIT_TIERS[highestTier - 1]?.name || 'Cherry';
  const sessionStats = [
    {
      label: 'Best Fruit',
      value: bestFruitName,
    },
    {
      label: 'Max Combo',
      value: `${Math.max(1, maxCombo)}x`,
    },
    {
      label: 'Merges',
      value: totalMerges,
    },
  ];

  // Copy 1-click emoji scorecard for Daily Harvest or Classic runs
  const copyShareableScorecard = () => {
    const badgeEmoji =
      highestTier >= 13 ? '👑' : highestTier >= 12 ? '🍉' : '🍒';
    const headerLine =
      gameMode === 'DAILY'
        ? `${badgeEmoji} Juicy Drop — Daily Harvest #${dailyInfo.dayNumber} (${dailyInfo.dateLabel})`
        : `${badgeEmoji} Juicy Drop — Classic Run`;
    const scorecardText = [
      headerLine,
      `🏆 Score: ${gameState.score.toLocaleString()} • Best: ${bestFruitName}`,
      `🔥 Max Combo: ${Math.max(1, maxCombo)}x • Merges: ${totalMerges}`,
      `https://smashing-fruits.netlify.app`,
    ].join('\n');

    try {
      void navigator.clipboard.writeText(scorecardText);
      setScorecardCopied(true);
      gameAudio.playConfirmSelect();
      window.setTimeout(() => setScorecardCopied(false), 2200);
    } catch {}
  };

  const shareFooterNode = (
    <button
      onClick={copyShareableScorecard}
      className="px-4 py-2 rounded-full bg-black/35 hover:bg-black/50 border border-white/30 text-white/95 text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer">
      {scorecardCopied ? (
        <>
          <Check size={15} className="text-emerald-300" />
          <span>Scorecard Copied!</span>
        </>
      ) : (
        <>
          <Copy size={15} />
          <span>
            {gameMode === 'DAILY'
              ? `Share Daily #${dailyInfo.dayNumber} Scorecard`
              : 'Copy Run Scorecard'}
          </span>
        </>
      )}
    </button>
  );

  return (
    <div
      style={{fontFamily: THEME.fontFamily}}
      className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-[#F7EFE2] text-[#4A2810] select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#FDF6E3] text-[#8C5832]">
          <div className="text-2xl font-bold animate-pulse">
            Juicing Fresh Fruits...
          </div>
        </div>
      )}

      <BackgroundMusic
        url={BACKGROUND_MUSIC_URL}
        isPlaying={isMusicPlaying}
        isMuted={musicMuted}
        volume={(getConfig('defaultMusicVolume') as number) ?? 0.18}
        playbackRate={musicPlaybackRate}
      />

      {/* TOP DEDICATED HUD BAR */}
      <header className="w-full bg-[#EAD8C0] border-b-2 border-[#C89666] shadow-sm px-2 py-1.5 z-20 shrink-0 flex items-center justify-between gap-1 max-w-2xl mx-auto pointer-events-auto">
        {/* Left: Score, High Score & Mode Pills */}
        <div className="flex items-center gap-1">
          <div className="bg-[#FAF3E7] px-2 py-1 rounded-xl border border-[#D4A373] shadow-inner flex flex-col items-start min-w-[54px]">
            <span className="text-[8px] uppercase font-extrabold text-[#9A6B42] leading-none">
              SCORE
            </span>
            <span className="text-sm md:text-base font-black text-[#5C3A21] leading-tight">
              {gameState.score}
            </span>
          </div>

          <div className="hidden sm:flex bg-[#FAF3E7] px-2 py-1 rounded-xl border border-[#D4A373] shadow-inner flex-col items-start min-w-[54px]">
            <span className="text-[8px] uppercase font-extrabold text-[#9A6B42] leading-none flex items-center gap-1">
              <Trophy size={9} className="text-[#F59E0B]" /> BEST
            </span>
            <span className="text-sm md:text-base font-black text-[#8A5836] leading-tight">
              {gameMode === 'DAILY'
                ? Math.max(dailyHighScore, gameState.score)
                : Math.max(highScore, gameState.score)}
            </span>
          </div>

          {gameMode === 'DAILY' && (
            <div
              title={`Daily Harvest #${dailyInfo.dayNumber} (${dailyInfo.dateLabel})`}
              className="hidden md:flex bg-emerald-100 text-emerald-900 px-2 py-1 rounded-full border border-emerald-400 shadow-xs items-center gap-1 shrink-0">
              <Calendar size={10} className="text-emerald-700" />
              <span className="text-[9px] font-black tracking-tight leading-none">
                #{dailyInfo.dayNumber}
              </span>
            </div>
          )}

          {isEndlessMode && (
            <div
              title="Endless Mode Active"
              className="bg-gradient-to-r from-amber-400 to-yellow-300 text-[#4A2810] px-1.5 py-1 rounded-full border border-amber-600 shadow-sm flex items-center gap-0.5 shrink-0">
              <span className="text-[9px] font-black tracking-tight leading-none">
                ∞
              </span>
            </div>
          )}
        </div>

        {/* Center: Tactical HOLD Slot + NEXT Fruit Badge */}
        <div className="flex items-center gap-1">
          <button
            onClick={swapHoldFruit}
            disabled={!canSwapHold || gameState.status !== 'PLAYING'}
            title="Hold / Swap Fruit (C or Shift, once per drop)"
            className={`flex items-center gap-1 px-2 py-1 rounded-2xl border shadow-sm transition-all cursor-pointer active:scale-95 ${
              canSwapHold && gameState.status === 'PLAYING'
                ? 'bg-[#FAF3E7] hover:bg-[#F3E3CF] border-[#C89666]'
                : 'bg-[#FAF3E7]/55 border-[#D4A373]/60 opacity-65 cursor-not-allowed'
            }`}>
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase font-extrabold text-[#9A6B42] leading-none flex items-center gap-0.5">
                HOLD <ArrowLeftRight size={8} />
              </span>
              <span className="hidden sm:inline text-[10px] font-bold text-[#4A2810] max-w-[52px] truncate">
                {heldItemMeta ? heldItemMeta.name : 'Empty'}
              </span>
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center p-0.5 border shadow-xs"
              style={{
                borderColor: heldItemMeta ? heldItemMeta.color : '#C89666',
                borderStyle: heldItemMeta ? 'solid' : 'dashed',
                backgroundColor: heldItemMeta ? '#FFFFFF' : '#F5ECE0',
              }}>
              {heldItem && heldItemMeta ? (
                <FruitBadgeIcon
                  tier={heldItemMeta.tierConfig}
                  special={heldItem.special}
                  assetUrl={ASSETS_MANIFEST[heldItemMeta.tierConfig.assetKey]}
                  imageLoaded={Boolean(
                    assetsReady && assets[heldItemMeta.tierConfig.assetKey],
                  )}
                  size={22}
                />
              ) : (
                <span className="text-[9px] font-extrabold text-[#A67C52]">
                  C
                </span>
              )}
            </div>
          </button>

          <div className="flex items-center gap-1 bg-[#FAF3E7] px-2 py-1 rounded-2xl border border-[#D4A373] shadow-sm">
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase font-extrabold text-[#9A6B42] leading-none">
                NEXT
              </span>
              <span className="hidden sm:inline text-[10px] font-bold text-[#4A2810] max-w-[58px] truncate">
                {nextItemMeta.name}
              </span>
            </div>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center p-0.5 border shadow-sm"
              style={{
                borderColor: nextItemMeta.color,
                backgroundColor: '#FFFFFF',
              }}>
              <FruitBadgeIcon
                tier={nextItemMeta.tierConfig}
                special={nextItem.special}
                assetUrl={ASSETS_MANIFEST[nextItemMeta.tierConfig.assetKey]}
                imageLoaded={Boolean(
                  assetsReady && assets[nextItemMeta.tierConfig.assetKey],
                )}
                size={22}
              />
            </div>
          </div>
        </div>

        {/* Powerups: Merge-Charged Zero-G & Magnet Action Buttons */}
        <div className="flex items-center gap-1">
          {/* Anti-Gravity Merge-Charged Button */}
          <button
            onClick={activateAntiGravity}
            disabled={
              antiGravityCharge < 100 ||
              antiGravityActive ||
              gameState.status !== 'PLAYING'
            }
            title="Zero-G Anti-Gravity (Z / 1) — Charged by merging fruits!"
            className={`relative overflow-hidden h-9 px-2 rounded-xl border font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 ${
              antiGravityActive
                ? 'bg-purple-600 text-white border-purple-400 animate-pulse ring-2 ring-purple-300'
                : antiGravityCharge < 100
                ? 'bg-purple-50/80 text-purple-600 border-purple-200 cursor-not-allowed'
                : 'bg-purple-100 hover:bg-purple-200 text-purple-900 border-purple-400 ring-1 ring-purple-300'
            }`}>
            {!antiGravityActive && antiGravityCharge < 100 && (
              <div
                className="absolute inset-y-0 left-0 bg-purple-300/45 transition-all duration-200 pointer-events-none"
                style={{width: `${antiGravityCharge}%`}}
              />
            )}
            <Compass
              size={14}
              className={`relative z-10 ${
                antiGravityActive ? 'animate-spin text-white' : 'text-purple-700'
              }`}
            />
            <span className="relative z-10 font-extrabold text-[10px] md:text-[11px]">
              {antiGravityActive
                ? `${antiGravityActiveSec}s`
                : antiGravityCharge < 100
                ? `${antiGravityCharge}%`
                : 'Zero-G'}
            </span>
          </button>

          {/* Magnet Merge-Charged Button */}
          <button
            onClick={activateMagnet}
            disabled={
              magnetCharge < 100 ||
              magnetActive ||
              gameState.status !== 'PLAYING'
            }
            title="Magnet Beam (M / 2) — Charged by merging fruits!"
            className={`relative overflow-hidden h-9 px-2 rounded-xl border font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 ${
              magnetActive
                ? 'bg-amber-500 text-white border-amber-300 animate-pulse ring-2 ring-amber-300'
                : magnetCharge < 100
                ? 'bg-amber-50/80 text-amber-700 border-amber-200 cursor-not-allowed'
                : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400 ring-1 ring-amber-300'
            }`}>
            {!magnetActive && magnetCharge < 100 && (
              <div
                className="absolute inset-y-0 left-0 bg-amber-300/50 transition-all duration-200 pointer-events-none"
                style={{width: `${magnetCharge}%`}}
              />
            )}
            <Zap
              size={14}
              className={`relative z-10 ${
                magnetActive ? 'text-white' : 'text-amber-600'
              }`}
            />
            <span className="relative z-10 font-extrabold text-[10px] md:text-[11px]">
              {magnetActive
                ? 'Pull!'
                : magnetCharge < 100
                ? `${magnetCharge}%`
                : 'Magnet'}
            </span>
          </button>

          {/* Evolution Guide */}
          <button
            onClick={() => setIsEvolutionTreeOpen(true)}
            aria-label="Fruit Evolution Guide"
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-[#FAF3E7] hover:bg-[#F3E3CF] active:scale-95 text-[#5C3A21] border border-[#D4A373] shadow-sm flex items-center justify-center transition-all cursor-pointer">
            <Sparkles size={16} className="text-[#F59E0B]" />
          </button>

          {/* Menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open Menu"
            className="px-2.5 h-9 min-w-[36px] min-h-[36px] rounded-xl bg-[#8C5832] hover:bg-[#724524] active:scale-95 text-white font-bold text-xs border border-[#5C3A21] shadow flex items-center gap-1 transition-all cursor-pointer">
            <MenuIcon size={16} />
          </button>
        </div>
      </header>

      {/* GAME CANVAS PLAYFIELD (Always mounted so canvasRef exists on mount) */}
      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center pointer-events-auto touch-none select-none">
        {/* First drop onboarding visual prompt */}
        {assetsReady && gameState.status === 'PLAYING' && totalDrops === 0 && (
          <div className="absolute top-2 z-10 pointer-events-none flex flex-col items-center animate-bounce px-4">
            <div className="bg-[#8C5832]/95 text-white text-xs md:text-sm font-black px-4 py-2 rounded-full shadow-lg border-2 border-[#E8CAAA] flex items-center gap-2">
              <span>👆 Drag to Aim &bull; Release or Tap to Drop!</span>
              <span className="hidden sm:inline text-yellow-300 font-bold">
                (Space / &darr;)
              </span>
            </div>
          </div>
        )}

        {/* Anti-Gravity Onscreen tap hint */}
        {assetsReady && antiGravityActive && (
          <div className="absolute top-3 z-10 pointer-events-none flex flex-col items-center animate-pulse px-3">
            <div className="bg-purple-900/90 text-purple-100 text-xs font-bold px-3 py-1.5 rounded-full shadow border border-purple-400 flex items-center gap-1.5">
              <span>
                🌀 ZERO-G! Tap any floating fruit to push it toward its matching
                twin!
              </span>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerCancel}
          style={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
          }}
          className="h-auto max-w-full max-h-full drop-shadow-xl cursor-pointer touch-none"
        />
      </div>

      {/* BOTTOM EVOLUTION LEGEND & CONTROLS */}
      <footer className="w-full bg-[#EAD8C0] border-t border-[#C89666] px-2 py-1 shrink-0 z-10 max-w-2xl mx-auto flex flex-col gap-1 pointer-events-auto">
        {/* Interactive Evolution Chain Strip (Scrollable & Responsive) */}
        <div
          onClick={() => setIsEvolutionTreeOpen(true)}
          title="Click to view full Evolution Guide"
          className="flex items-center justify-between overflow-x-auto py-0.5 px-1 bg-[#FAF3E7] rounded-xl border border-[#D4A373] shadow-inner cursor-pointer hover:bg-[#F5ECE0] transition-colors">
          <div className="flex items-center gap-1 shrink-0">
            {FRUIT_TIERS.map((tier, idx) => (
              <React.Fragment key={tier.name}>
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center bg-white border shadow-xs shrink-0"
                  style={{
                    borderColor: tier.color,
                  }}
                  title={`${tier.tier}. ${tier.name} (+${tier.points} pts)`}>
                  <FruitBadgeIcon
                    tier={tier}
                    assetUrl={ASSETS_MANIFEST[tier.assetKey]}
                    imageLoaded={Boolean(
                      assetsReady && assets[tier.assetKey],
                    )}
                    size={16}
                  />
                </div>
                {idx < FRUIT_TIERS.length - 1 && (
                  <span className="text-[9px] text-[#A67C52] font-bold">›</span>
                )}
              </React.Fragment>
            ))}
          </div>
          <span className="text-[10px] font-extrabold text-[#8C5832] shrink-0 ml-2">
            13 Tiers
          </span>
        </div>

        {/* Footer controls hint */}
        <div className="flex items-center justify-between text-[10px] md:text-xs text-[#7A502E] px-1">
          <span className="font-medium">
            {isMobile
              ? '👆 Drag & Drop • Tap HOLD to Swap'
              : '🖱️ Aim & Click • Space: Drop • C: Hold • Z: Zero-G • M: Magnet'}
          </span>
          <span className="font-bold text-[#8C5832]">
            Evolve to 👑 King Durian!
          </span>
        </div>
      </footer>

      {/* EVOLUTION TREE MODAL (ALL 13 TIERS) */}
      {isEvolutionTreeOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-[#FFF9F0] border-4 border-[#8C5832] rounded-3xl p-5 m-3 shadow-2xl flex flex-col items-center pointer-events-auto">
            <div className="w-full flex items-center justify-between mb-2 border-b-2 border-[#E8CAAA] pb-2">
              <h2 className="text-xl font-extrabold text-[#5C3A21] flex items-center gap-2">
                <Sparkles size={20} className="text-[#F59E0B]" /> 13-Tier
                Evolution Guide
              </h2>
              <button
                onClick={() => {
                  setIsEvolutionTreeOpen(false);
                  sessionPlayStartRef.current = performance.now();
                }}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-[#EAD8C0] hover:bg-[#D4A373] text-[#5C3A21] flex items-center justify-center cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#7A502E] mb-3 text-center">
              Merge matching fruits to evolve them into larger tiers and score
              massive points!
            </p>

            <div className="w-full grid grid-cols-2 gap-2 overflow-y-auto max-h-[52vh] p-1 touch-auto">
              {FRUIT_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`flex items-center gap-2 p-2 rounded-2xl border shadow-sm ${
                    tier.tier === 13
                      ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300'
                      : tier.tier === 6
                      ? 'bg-emerald-50 border-emerald-400'
                      : 'bg-[#FAF3E7] border-[#D4A373]'
                  }`}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center p-0.5 border shadow-inner shrink-0"
                    style={{
                      borderColor: tier.color,
                      backgroundColor:
                        tier.tier === 13 ? '#FEF3C7' : '#FFFFFF',
                    }}>
                    <FruitBadgeIcon
                      tier={tier}
                      assetUrl={ASSETS_MANIFEST[tier.assetKey]}
                      imageLoaded={Boolean(
                        assetsReady && assets[tier.assetKey],
                      )}
                      size={30}
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#4A2810] truncate">
                      {tier.tier}. {tier.name}
                    </span>
                    <span className="text-[10px] text-[#9A6B42] font-semibold">
                      +{tier.points} pts
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setIsEvolutionTreeOpen(false);
                sessionPlayStartRef.current = performance.now();
              }}
              className="mt-3 w-full bg-[#8C5832] hover:bg-[#724524] active:scale-98 text-white py-2.5 rounded-full font-bold text-sm shadow transition-all cursor-pointer">
              Got It!
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY MODAL */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-[#FFF9F0] border-4 border-[#8C5832] rounded-3xl p-6 m-3 shadow-2xl flex flex-col items-center pointer-events-auto">
            <div className="w-full flex items-center justify-between mb-4 border-b-2 border-[#E8CAAA] pb-2">
              <h2 className="text-2xl font-extrabold text-[#5C3A21] flex items-center gap-2">
                <HelpCircle size={24} className="text-[#F59E0B]" /> How To Play
              </h2>
              <button
                onClick={() => {
                  setIsHowToPlayOpen(false);
                  sessionPlayStartRef.current = performance.now();
                }}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[#EAD8C0] hover:bg-[#D4A373] text-[#5C3A21] flex items-center justify-center cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="w-full space-y-3 text-xs md:text-sm text-[#5C3A21] mb-6 overflow-y-auto max-h-[50vh] touch-auto">
              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  1. Smart Aim, Drop &amp; Hold Basket 🍒
                </strong>
                Drag or move to aim with the swept-circle preview—matching
                targets light up with starry eyes and a ✨ MERGE! halo. Tap{' '}
                <strong>HOLD</strong> (or press <strong>C / Shift</strong>) once
                per turn to stash or swap a fruit for 2-step chain setups!
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  2. Special Drops: 🌈 Rainbow Dew &amp; 🫧 Fizz Berry
                </strong>
                Hit a <strong>4x+ Combo</strong> or every 20 drops to earn a
                Special Drop! <strong>Rainbow Dew</strong> upgrades any touched
                fruit up to Tier 9 Peach (or grants a +250 Prismatic Bonus on
                bigger fruits). <strong>Fizz Berry</strong> detonates when an
                adjacent merge happens nearby, popping small clutter and
                charging your meters!
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  3. Merge-Charged 🌀 Zero-G &amp; 🧲 Magnet
                </strong>
                Both abilities start at 100% and recharge strictly by{' '}
                <strong>merging fruits</strong> (1.75x faster on 3x+ combos!).
                Tap floating fruits during Zero-G to launch them toward their
                twin, or fire Magnet to pull your highest-tier matching pair
                together!
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  4. 📅 Daily Harvest &amp; 👑 King Durian
                </strong>
                Play Classic or compete in today&apos;s deterministic{' '}
                <strong>Daily Harvest</strong> where everyone gets the exact
                same sequence of drops, then copy your scorecard at the end!
              </div>
            </div>

            <button
              onClick={() => {
                setIsHowToPlayOpen(false);
                sessionPlayStartRef.current = performance.now();
              }}
              className="w-full bg-[#8C5832] hover:bg-[#724524] active:scale-98 text-white py-3 rounded-full font-bold text-base shadow transition-all cursor-pointer">
              Back to Game
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* GAME MENU OVERLAY */}
      {isMenuOpen && gameState.status === 'PLAYING' && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-md bg-[#FFF9F0] border-4 border-[#8C5832] rounded-3xl p-6 m-3 shadow-2xl flex flex-col items-center pointer-events-auto">
            <h2 className="text-3xl font-black text-[#5C3A21] mb-5 tracking-wide">
              Game Menu
            </h2>

            <div className="w-full space-y-3 mb-6">
              {/* Resume Button */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  sessionPlayStartRef.current = performance.now();
                }}
                className="w-full bg-[#8C5832] hover:bg-[#724524] text-white py-3.5 rounded-2xl font-bold text-lg shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer">
                <Play size={20} /> Resume
              </button>

              {/* Audio Controls */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSfxMuted((prev) => !prev)}
                  className="py-3 px-4 rounded-2xl bg-[#FAF3E7] hover:bg-[#F3E3CF] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                  {sfxMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  SFX: {sfxMuted ? 'Off' : 'On'}
                </button>

                <button
                  onClick={() => setMusicMuted((prev) => !prev)}
                  className="py-3 px-4 rounded-2xl bg-[#FAF3E7] hover:bg-[#F3E3CF] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                  {musicMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  Music: {musicMuted ? 'Off' : 'On'}
                </button>
              </div>

              {/* How to play & Evolution */}
              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] border-2 border-[#D4A373] text-[#5C3A21] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                <HelpCircle size={18} /> How to Play
              </button>

              <button
                onClick={() => setIsEvolutionTreeOpen(true)}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] border-2 border-[#D4A373] text-[#5C3A21] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                <Sparkles size={18} className="text-[#F59E0B]" /> Fruit
                Evolution Guide
              </button>

              {/* Restart current session */}
              <button
                onClick={() => initGame()}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] border-2 border-[#D4A373] text-[#D97706] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                <RotateCw size={18} /> Restart{' '}
                {gameMode === 'DAILY'
                  ? `Daily #${dailyInfo.dayNumber}`
                  : 'Session'}
              </button>

              {/* Quit to main start menu */}
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full bg-red-100 hover:bg-red-200 border-2 border-red-300 text-red-700 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                Quit to Title
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* START TITLE SCREEN */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral">
          <div className="bg-[#FFF9F0] p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col items-center w-full max-w-sm border-4 border-[#8C5832] pointer-events-auto">
            <div className="w-16 h-16 rounded-full bg-[#FFE4BA] border-2 border-[#C89666] flex items-center justify-center shadow-inner mb-3">
              <span className="text-3xl animate-bounce">👑</span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black mb-2 text-[#5C3A21] text-center tracking-wide">
              Juicy Drop
            </h1>
            <p className="text-xs md:text-sm text-[#8C5832] font-semibold text-center mb-6">
              Drop &amp; merge fruits inside the cozy wooden jar to create
              Cucumber, Watermelon, and the legendary King Durian!
            </p>

            <div className="w-full space-y-2.5">
              <button
                onClick={() => initGame('CLASSIC')}
                autoFocus
                className="w-full bg-[#8C5832] hover:bg-[#724524] text-white py-3.5 rounded-2xl font-black text-lg md:text-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer">
                <Play size={22} />
                PLAY CLASSIC
              </button>

              <button
                onClick={() => initGame('DAILY')}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3 px-4 rounded-2xl font-extrabold text-sm md:text-base shadow-md transition-all flex items-center justify-between active:scale-98 cursor-pointer border-2 border-emerald-300/60">
                <span className="flex items-center gap-2">
                  <Calendar size={18} />
                  <span>DAILY HARVEST #{dailyInfo.dayNumber}</span>
                </span>
                <span className="text-[11px] bg-black/25 px-2 py-0.5 rounded-full font-bold text-emerald-100">
                  {dailyHighScore > 0 ? `Best: ${dailyHighScore}` : 'Same Seed!'}
                </span>
              </button>

              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] text-[#5C3A21] py-2.5 rounded-2xl font-bold text-sm border-2 border-[#D4A373] transition-all flex items-center justify-center gap-2 cursor-pointer">
                <HelpCircle size={18} />
                How to Play
              </button>

              <button
                onClick={() => setIsEvolutionTreeOpen(true)}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] text-[#5C3A21] py-2.5 rounded-2xl font-bold text-sm border-2 border-[#D4A373] transition-all flex items-center justify-center gap-2 cursor-pointer">
                <Sparkles size={18} className="text-[#F59E0B]" />
                13-Tier Evolution Guide
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* GAME OVER SCREEN */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="JAR OVERFLOW!"
          description={`${
            gameMode === 'DAILY'
              ? `Daily #${dailyInfo.dayNumber} Score`
              : 'Final Score'
          }: ${gameState.score} • Best: ${
            gameMode === 'DAILY'
              ? Math.max(dailyHighScore, gameState.score)
              : Math.max(highScore, gameState.score)
          }`}
          stats={sessionStats}
          actionLabel="TRY AGAIN"
          onAction={() => initGame()}
          icon={<RotateCw size={24} />}
          extraFooter={shareFooterNode}
          tone="danger"
        />
      )}

      {/* VICTORY SCREEN */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="👑 KING DURIAN CROWNED! 🎉"
          description={`Supreme Fruit Master! ${
            gameMode === 'DAILY' ? `Daily #${dailyInfo.dayNumber} ` : ''
          }Score: ${gameState.score}`}
          stats={sessionStats}
          actionLabel="KEEP PLAYING (ENDLESS)"
          onAction={resumeEndlessMode}
          icon={<Play size={22} />}
          secondaryActionLabel="NEW GAME"
          onSecondaryAction={() => initGame()}
          secondaryIcon={<RotateCw size={20} />}
          extraFooter={shareFooterNode}
          tone="victory"
        />
      )}
    </div>
  );
}
