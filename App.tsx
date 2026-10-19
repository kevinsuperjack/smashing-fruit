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
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  CONFIG,
  FRUIT_TIERS,
  FruitTier,
  getConfig,
  THEME,
} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  drawBackground,
  gameAudio,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useAutoFocus,
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
}

// Active Fruit Entity tracking on physics body
interface FruitEntity {
  id: string;
  tier: number;
  body: Matter.Body;
  spawnTime: number;
  renderScale: number;
  targetScale: number;
  blinkTimer: number;
  isBlinking: boolean;
  expression: 'happy' | 'bouncy' | 'shocked' | 'sleepy' | 'regal';
  expressionTimer: number;
  merged: boolean;
}

// Active Magnet pull state
interface ActiveMagnet {
  fruitAId: number;
  fruitBId: number;
  remainingFrames: number;
  totalFrames: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
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
  const [sfxMuted, setSfxMuted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [totalDrops, setTotalDrops] = useState(0);

  // Power-up States & Cooldowns
  const [antiGravityCooldown, setAntiGravityCooldown] = useState<number>(0);
  const [antiGravityActive, setAntiGravityActive] = useState<boolean>(false);
  const [magnetCooldown, setMagnetCooldown] = useState<number>(0);
  const [magnetActive, setMagnetActive] = useState<boolean>(false);

  // Next & Current Fruits in React state for HUD badges
  const [currentTier, setCurrentTier] = useState<number>(1);
  const [nextTier, setNextTier] = useState<number>(1);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Sync high score to localStorage
  const updateScoreWithHighScore = useCallback((pointsToAdd: number) => {
    setGameState((prev) => {
      const newScore = prev.score + pointsToAdd;
      setHighScore((prevBest) => {
        const best = Math.max(prevBest, newScore);
        try {
          localStorage.setItem(HIGH_SCORE_STORAGE_KEY, best.toString());
        } catch {}
        return best;
      });
      return {...prev, score: newScore};
    });
  }, []);

  // Key Google Font loading
  useEffect(() => {
    const link = document.createElement('link');
    link.href =
      'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700;800&family=Quicksand:wght@600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Back key handling
  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);

  const inputRef = useInput(canvasRef, true, {
    width: canvasWidth,
    height: canvasHeight,
  });

  // Matter Physics Simulation Engine & Refs
  const engineRef = useRef<Matter.Engine | null>(null);
  const fruitsRef = useRef<Map<number, FruitEntity>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const scorePopupsRef = useRef<ScorePopup[]>([]);

  // Jar bounds (Inside dimensions)
  const jarX = 70;
  const jarWidth = 580;
  const jarRight = jarX + jarWidth;
  const jarBottom = 1140;
  const jarTop = 270;
  const dangerLineY = 320;
  const dropperY = 175;

  // Dropper state
  const dropperXRef = useRef<number>(canvasWidth / 2);
  const targetDropperXRef = useRef<number>(canvasWidth / 2);
  const lastDropTimeRef = useRef<number>(0);
  const isPointerDownRef = useRef<boolean>(false);
  const dangerTimerRef = useRef<number>(0);
  const currentTierRef = useRef<number>(1);
  const nextTierRef = useRef<number>(1);
  const totalDropsRef = useRef<number>(0);
  const mergeQueueRef = useRef<
    Array<{fruitA: FruitEntity; fruitB: FruitEntity; midX: number; midY: number}>
  >([]);

  // Anti-Gravity & Magnet Physics Control Refs
  const antiGravityTimerRef = useRef<number>(0);
  const antiGravityCeilingRef = useRef<Matter.Body | null>(null);
  const dangerGraceCooldownRef = useRef<number>(0);
  const activeMagnetRef = useRef<ActiveMagnet | null>(null);

  // Cooldown timers in seconds
  const antiGravityCdTimerRef = useRef<number>(0);
  const magnetCdTimerRef = useRef<number>(0);

  // Weighted random dropper tier (Restricted to Tiers 1-5)
  const getRandomSpawnTier = useCallback(() => {
    const maxTier = Math.min(5, (getConfig('maxSpawnTier') as number) || 5);
    const weights = [40, 30, 18, 9, 3]; // Cherry, Strawberry, Grape, Dekopon, Persimmon
    const totalWeight = weights
      .slice(0, maxTier)
      .reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < maxTier; i++) {
      if (rand < weights[i]) return i + 1;
      rand -= weights[i];
    }
    return 1;
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
    (x: number, y: number, text: string, color: string) => {
      scorePopupsRef.current.push({
        x,
        y: Math.max(100, y - 10),
        text,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.9,
        scale: 0.5,
      });
    },
    [],
  );

  // Powerup 1: Activate Anti-Gravity
  const activateAntiGravity = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (antiGravityTimerRef.current > 0 || antiGravityCdTimerRef.current > 0) return;
    if (!engineRef.current) return;

    gameAudio.playPowerupChime();
    antiGravityTimerRef.current = 5.0; // 5 seconds duration
    antiGravityCdTimerRef.current = 15.0; // 15s cooldown
    setAntiGravityActive(true);
    setAntiGravityCooldown(15);

    // Create temporary static horizontal ceiling rigid body at y = 95
    const ceilingY = 95;
    const ceiling = Matter.Bodies.rectangle(
      canvasWidth / 2,
      ceilingY,
      jarWidth + 80,
      30,
      {isStatic: true, label: 'zero_g_ceiling', friction: 0.05, restitution: 0.5},
    );
    antiGravityCeilingRef.current = ceiling;
    Matter.Composite.add(engineRef.current.world, ceiling);

    // Initial zero-G burst
    spawnZeroGParticles(25);
    spawnScorePopup(canvasWidth / 2, 220, '🌀 ZERO-G ACTIVATED!', '#A855F7');
  }, [canvasWidth, jarWidth, spawnScorePopup, spawnZeroGParticles]);

  // Powerup 2: Activate Magnet
  const activateMagnet = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (activeMagnetRef.current || magnetCdTimerRef.current > 0) return;
    if (!engineRef.current) return;

    // Scan all fruits inside the jar and find matching pairs
    const tierMap = new Map<number, FruitEntity[]>();
    fruitsRef.current.forEach((fruit) => {
      if (!fruit.merged) {
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
      // No pairs found
      gameAudio.playErrorBuzz();
      spawnScorePopup(canvasWidth / 2, 350, 'No matching pairs found!', '#EF4444');
      return;
    }

    const pairList = tierMap.get(bestTier)!;
    const fruitA = pairList[0];
    const fruitB = pairList[1];

    activeMagnetRef.current = {
      fruitAId: fruitA.body.id,
      fruitBId: fruitB.body.id,
      remainingFrames: 90,
      totalFrames: 90,
    };

    magnetCdTimerRef.current = 12.0; // 12s cooldown
    setMagnetCooldown(12);
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

  // Drop current fruit into jar
  const dropFruit = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (isMenuOpen || isHowToPlayOpen || isEvolutionTreeOpen) return;

    const now = performance.now();
    const cooldown = (getConfig('dropCooldownMs') as number) || 450;
    if (now - lastDropTimeRef.current < cooldown) return;
    if (!engineRef.current) return;

    gameAudio.resume();

    const tierIndex = currentTierRef.current - 1;
    const tierConfig = FRUIT_TIERS[tierIndex] || FRUIT_TIERS[0];
    const radius = tierConfig.radius;

    // Clamp drop position strictly within jar walls
    const dropX = Math.max(
      jarX + radius + 4,
      Math.min(jarRight - radius - 4, dropperXRef.current),
    );
    const dropY = dropperY;

    const restitution = (getConfig('fruitRestitution') as number) || 0.22;
    const friction = tierConfig.friction ?? ((getConfig('fruitFriction') as number) || 0.08);
    const densityScale = tierConfig.density ?? ((getConfig('fruitDensityMultiplier') as number) || 0.002);

    const body = Matter.Bodies.circle(dropX, dropY, radius, {
      restitution,
      friction,
      density: densityScale * (1 + currentTierRef.current * 0.15),
      label: 'fruit',
      angularVelocity: (Math.random() - 0.5) * 0.05,
    });

    Matter.Composite.add(engineRef.current.world, body);

    const entity: FruitEntity = {
      id: `fruit_${body.id}`,
      tier: currentTierRef.current,
      body,
      spawnTime: now,
      renderScale: 0.85,
      targetScale: 1.0,
      blinkTimer: 1 + Math.random() * 3,
      isBlinking: false,
      expression: 'happy',
      expressionTimer: 0,
      merged: false,
    };

    fruitsRef.current.set(body.id, entity);
    gameAudio.playCrispClick();

    // Increment drop count
    totalDropsRef.current += 1;
    setTotalDrops((prev) => prev + 1);

    // Advance queue (Restricted to Tiers 1-5)
    const nextT = nextTierRef.current;
    const newUpcoming = getRandomSpawnTier();
    currentTierRef.current = nextT;
    nextTierRef.current = newUpcoming;
    setCurrentTier(nextT);
    setNextTier(newUpcoming);

    lastDropTimeRef.current = now;
  }, [dropperY, jarRight, jarX, getRandomSpawnTier, isMenuOpen, isHowToPlayOpen, isEvolutionTreeOpen]);

  // Direct keyboard listener for instant dropping, steering, and powerup shortcuts
  useEffect(() => {
    const handleDirectKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current.status !== 'PLAYING') return;
      if (isMenuOpen || isHowToPlayOpen || isEvolutionTreeOpen) return;

      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'Enter') {
        e.preventDefault();
        dropFruit();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        targetDropperXRef.current = Math.max(jarX + 30, targetDropperXRef.current - 45);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        targetDropperXRef.current = Math.min(jarRight - 30, targetDropperXRef.current + 45);
      } else if (e.key === 'z' || e.key === 'Z' || e.key === '1') {
        activateAntiGravity();
      } else if (e.key === 'm' || e.key === 'M' || e.key === '2') {
        activateMagnet();
      }
    };

    window.addEventListener('keydown', handleDirectKeyDown, {passive: false});
    return () => window.removeEventListener('keydown', handleDirectKeyDown);
  }, [dropFruit, activateAntiGravity, activateMagnet, isEvolutionTreeOpen, isHowToPlayOpen, isMenuOpen, jarRight, jarX]);

  // Initialize/Reset Game Session
  const initGame = useCallback(() => {
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

    // Jar Boundaries (Left, Right, Bottom)
    const ground = Matter.Bodies.rectangle(
      canvasWidth / 2,
      jarBottom + wallThickness / 2,
      jarWidth + wallThickness * 2,
      wallThickness,
      {isStatic: true, label: 'ground', friction: 0.2, restitution: 0.1},
    );

    const leftWall = Matter.Bodies.rectangle(
      jarX - wallThickness / 2,
      (jarTop + jarBottom) / 2 + 50,
      wallThickness,
      jarBottom - jarTop + 100,
      {isStatic: true, label: 'wall', friction: 0.1, restitution: 0.1},
    );

    const rightWall = Matter.Bodies.rectangle(
      jarRight + wallThickness / 2,
      (jarTop + jarBottom) / 2 + 50,
      wallThickness,
      jarBottom - jarTop + 100,
      {isStatic: true, label: 'wall', friction: 0.1, restitution: 0.1},
    );

    Matter.Composite.add(world, [ground, leftWall, rightWall]);

    // Collision listener for fruit merging
    Matter.Events.on(engine, 'collisionStart', (event) => {
      const pairs = event.pairs;
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
            fruitA.tier === fruitB.tier &&
            !fruitA.merged &&
            !fruitB.merged &&
            fruitA.body.id !== fruitB.body.id
          ) {
            fruitA.merged = true;
            fruitB.merged = true;

            const midX = (bodyA.position.x + bodyB.position.x) / 2;
            const midY = (bodyA.position.y + bodyB.position.y) / 2;

            mergeQueueRef.current.push({
              fruitA,
              fruitB,
              midX,
              midY,
            });
          }
        }
      }
    });

    engineRef.current = engine;
    fruitsRef.current.clear();
    particlesRef.current = [];
    scorePopupsRef.current = [];
    mergeQueueRef.current = [];
    dangerTimerRef.current = 0;
    dangerGraceCooldownRef.current = 0;
    antiGravityTimerRef.current = 0;
    antiGravityCdTimerRef.current = 0;
    magnetCdTimerRef.current = 0;
    antiGravityCeilingRef.current = null;
    activeMagnetRef.current = null;
    totalDropsRef.current = 0;
    setTotalDrops(0);
    setAntiGravityActive(false);
    setAntiGravityCooldown(0);
    setMagnetActive(false);
    setMagnetCooldown(0);
    lastDropTimeRef.current = performance.now() - 600;

    const t1 = getRandomSpawnTier();
    const t2 = getRandomSpawnTier();
    currentTierRef.current = t1;
    nextTierRef.current = t2;
    setCurrentTier(t1);
    setNextTier(t2);

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
  }, [canvasWidth, jarBottom, jarRight, jarTop, jarWidth, jarX, getRandomSpawnTier, sdk]);

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
      const radius = FRUIT_TIERS[fruit.tier - 1]?.radius || 30;
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
        if (other.body.id !== f.body.id && other.tier === f.tier && !other.merged) {
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

  // Direct canvas pointer event helpers
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.status !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;

      if (checkZeroGTapImpulse(x, y)) {
        return;
      }

      targetDropperXRef.current = x;
      dropperXRef.current = x;
    }
    isPointerDownRef.current = true;
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.status !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      targetDropperXRef.current = x;
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.status !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;

      if (checkZeroGTapImpulse(x, y)) {
        isPointerDownRef.current = false;
        return;
      }

      targetDropperXRef.current = x;
    }
    isPointerDownRef.current = false;
    dropFruit();
  };

  // Main Update Simulation
  const update = (deltaTime: number) => {
    if (gameState.status !== 'PLAYING' || isMenuOpen || isHowToPlayOpen || isEvolutionTreeOpen) {
      return;
    }

    const input = inputRef.current;
    const now = performance.now();
    const defaultGravity = (getConfig('gravityY') as number) || 1.5;

    // 0. Update Cooldowns and Anti-Gravity / Magnet Timers
    if (antiGravityCdTimerRef.current > 0) {
      antiGravityCdTimerRef.current = Math.max(0, antiGravityCdTimerRef.current - deltaTime);
      setAntiGravityCooldown(Math.ceil(antiGravityCdTimerRef.current));
    }

    if (magnetCdTimerRef.current > 0) {
      magnetCdTimerRef.current = Math.max(0, magnetCdTimerRef.current - deltaTime);
      setMagnetCooldown(Math.ceil(magnetCdTimerRef.current));
    }

    // Anti-Gravity Physics Phase & Gravity Adjustment
    if (antiGravityTimerRef.current > 0) {
      antiGravityTimerRef.current -= deltaTime;
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
            Matter.Composite.remove(engineRef.current.world, antiGravityCeilingRef.current);
            antiGravityCeilingRef.current = null;
          }
          engineRef.current.world.gravity.y = defaultGravity;
        }
        setAntiGravityActive(false);
        // Suppress danger line for 2.0s after settling
        dangerGraceCooldownRef.current = 2.0;
        spawnScorePopup(canvasWidth / 2, 220, 'GRAVITY RESTORED', '#38BDF8');
      }
    } else {
      if (dangerGraceCooldownRef.current > 0) {
        dangerGraceCooldownRef.current = Math.max(0, dangerGraceCooldownRef.current - deltaTime);
      }
    }

    // Active Magnet Pull Simulation
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

        if (dist > 15) {
          const forceMag = 0.0035 * (1 + (mag.totalFrames - mag.remainingFrames) / mag.totalFrames * 2.5);
          const fx = (dx / dist) * forceMag * fruitA.body.mass;
          const fy = (dy / dist) * forceMag * fruitA.body.mass;

          Matter.Body.applyForce(fruitA.body, posA, {x: fx, y: fy});
          Matter.Body.applyForce(fruitB.body, posB, {x: -fx, y: -fy});
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

        mag.remainingFrames -= 1;
        if (mag.remainingFrames <= 0) {
          activeMagnetRef.current = null;
          setMagnetActive(false);
        }
      } else {
        activeMagnetRef.current = null;
        setMagnetActive(false);
      }
    }

    // 1. Process Input for Dropper Position
    if (input) {
      if (input.pointer.x > 0 && input.pointer.y > 0) {
        targetDropperXRef.current = input.pointer.x;
      }
      if (input.actions.left) {
        targetDropperXRef.current -= 500 * deltaTime;
      }
      if (input.actions.right) {
        targetDropperXRef.current += 500 * deltaTime;
      }

      // Check drop trigger on pointer release or confirm/down action
      const justReleasedPointer =
        isPointerDownRef.current && !input.pointer.down;
      const justPressedConfirm =
        input.actions.confirm || input.actions.down || input.actions.tap;

      if (justReleasedPointer || justPressedConfirm) {
        dropFruit();
      }
      isPointerDownRef.current = input.pointer.down;
    }

    // Smooth lerp dropper position
    const currentTierRadius =
      FRUIT_TIERS[currentTierRef.current - 1]?.radius || 22;
    const minDropperX = jarX + currentTierRadius + 6;
    const maxDropperX = jarRight - currentTierRadius - 6;
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

    // 3. Process Merges with Race Condition Guard
    if (mergeQueueRef.current.length > 0 && engineRef.current) {
      const world = engineRef.current.world;
      const mergesToProcess = [...mergeQueueRef.current];
      mergeQueueRef.current = [];
      const processedBodyIds = new Set<number>();

      mergesToProcess.forEach(({fruitA, fruitB, midX, midY}) => {
        const idA = fruitA.body.id;
        const idB = fruitB.body.id;

        // Ensure neither body has already been merged/removed in this frame
        if (processedBodyIds.has(idA) || processedBodyIds.has(idB)) {
          return;
        }
        if (!fruitsRef.current.has(idA) || !fruitsRef.current.has(idB)) {
          return;
        }

        processedBodyIds.add(idA);
        processedBodyIds.add(idB);

        // Remove old bodies from physics world & registry
        Matter.Composite.remove(world, fruitA.body);
        Matter.Composite.remove(world, fruitB.body);
        fruitsRef.current.delete(idA);
        fruitsRef.current.delete(idB);

        const currentTierNum = fruitA.tier;
        const currentTierConfig = FRUIT_TIERS[currentTierNum - 1];
        const pointsEarned = currentTierConfig ? currentTierConfig.points : 2;

        // Audio juice
        if (currentTierNum >= 12) {
          gameAudio.playVictoryFanfare();
        } else if (currentTierNum >= 9) {
          gameAudio.playLevelUpStinger();
        } else if (currentTierNum >= 5) {
          gameAudio.playPowerupChime();
        } else {
          gameAudio.playCoinPickup();
        }

        // Particle Burst
        spawnJuiceSplash(midX, midY, currentTierConfig.color, 24);

        // Check if merging 2 King Durians (Tier 13) -> Pinnacle Ultimate Victory!
        if (currentTierNum >= 13) {
          const victoryPoints = 10000;
          spawnScorePopup(
            midX,
            midY,
            `+${victoryPoints} 👑 KING DURIAN PINNACLE!`,
            '#9EF01A',
          );
          spawnJuiceSplash(midX, midY, '#FFD700', 60, true);
          gameAudio.playChiptuneExplosion();

          updateScoreWithHighScore(victoryPoints);
          setGameState((prev) => ({...prev, status: 'VICTORY'}));
          return;
        }

        // Create upgraded fruit at Tier + 1
        const nextTierNum = currentTierNum + 1;
        const nextTierConfig = FRUIT_TIERS[nextTierNum - 1];
        const radius = nextTierConfig.radius;
        const restitution = (getConfig('fruitRestitution') as number) || 0.22;
        const friction = nextTierConfig.friction ?? ((getConfig('fruitFriction') as number) || 0.08);
        const densityScale = nextTierConfig.density ?? ((getConfig('fruitDensityMultiplier') as number) || 0.002);

        // Clamp spawn position safely within the jar enclosure
        const clampedSpawnX = Math.max(
          jarX + radius + 4,
          Math.min(jarRight - radius - 4, midX),
        );
        const clampedSpawnY = Math.max(
          jarTop + radius + 4,
          Math.min(jarBottom - radius - 4, midY),
        );

        const newBody = Matter.Bodies.circle(clampedSpawnX, clampedSpawnY, radius, {
          restitution,
          friction,
          density: densityScale * (1 + nextTierNum * 0.15),
          label: 'fruit',
        });

        // Smoothly stabilize physics state on newly spawned fruit
        Matter.Body.setVelocity(newBody, {
          x: 0,
          y: -1.2,
        });
        Matter.Body.setAngularVelocity(newBody, 0);

        Matter.Composite.add(world, newBody);

        const newEntity: FruitEntity = {
          id: `fruit_${newBody.id}`,
          tier: nextTierNum,
          body: newBody,
          spawnTime: now,
          renderScale: 0.2, // Bouncy pop scale-in
          targetScale: 1.0,
          blinkTimer: 1 + Math.random() * 3,
          isBlinking: false,
          expression: nextTierNum === 13 ? 'regal' : 'bouncy',
          expressionTimer: 1.0,
          merged: false,
        };

        fruitsRef.current.set(newBody.id, newEntity);

        // Float score popup
        spawnScorePopup(
          clampedSpawnX,
          clampedSpawnY,
          `+${pointsEarned} ${nextTierConfig.name}!`,
          nextTierConfig.color,
        );

        // Update score & highscore in sync
        updateScoreWithHighScore(pointsEarned);
      });
    }

    // 4. Update Fruits Animations, Expressions & Danger Line Check
    let settledBreach = false;
    const isAntiGravityRunning = antiGravityTimerRef.current > 0 || dangerGraceCooldownRef.current > 0;

    fruitsRef.current.forEach((fruit) => {
      // Elastic scale-in animation
      if (fruit.renderScale < fruit.targetScale) {
        fruit.renderScale += (fruit.targetScale - fruit.renderScale) * Math.min(1, 16 * deltaTime);
        if (Math.abs(fruit.renderScale - fruit.targetScale) < 0.01) {
          fruit.renderScale = fruit.targetScale;
        }
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

      // Expressions
      if (fruit.expressionTimer > 0) {
        fruit.expressionTimer -= deltaTime;
        if (fruit.expressionTimer <= 0) {
          fruit.expression = fruit.tier === 13 ? 'regal' : 'happy';
        }
      }

      // Check danger line condition for settled fruits (>2.0s age and low kinetic velocity)
      // Danger line is strictly suppressed during Anti-Gravity and its cooldown grace
      if (!isAntiGravityRunning) {
        const ageSeconds = (now - fruit.spawnTime) / 1000;
        const vx = fruit.body.velocity.x;
        const vy = fruit.body.velocity.y;
        const speed = Math.hypot(vx, vy);
        const fruitRadius = FRUIT_TIERS[fruit.tier - 1]?.radius || 20;
        const topY = fruit.body.position.y - fruitRadius;

        // Fruit is settled, older than 2s, and stacked over danger line
        if (ageSeconds > 2.0 && speed < 1.5 && topY < dangerLineY) {
          settledBreach = true;
          fruit.expression = 'shocked';
          fruit.expressionTimer = 0.5;
        }
      }
    });

    // 5. Danger Line Accumulator (Suppressed during Anti-Gravity)
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

    // 6. Update Particles
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

    // 7. Update Score Popups
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

  // Kawaii Face Drawing Helper
  const drawFruitFace = (
    ctx: CanvasRenderingContext2D,
    radius: number,
    fruit: FruitEntity,
  ) => {
    ctx.save();
    const faceScale = radius / 36;
    ctx.scale(faceScale, faceScale);

    const eyeOffsetX = 8;
    const eyeOffsetY = -2;

    // Cheeks
    ctx.fillStyle = 'rgba(255, 120, 140, 0.45)';
    ctx.beginPath();
    ctx.arc(-eyeOffsetX - 3, eyeOffsetY + 5, 4, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 3, eyeOffsetY + 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#2C1810';
    if (fruit.isBlinking) {
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
    } else if (fruit.expression === 'shocked') {
      // Shocked big open eyes
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 3.5, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (fruit.expression === 'regal') {
      // Regal confident sparkling eyes
      ctx.beginPath();
      ctx.arc(-eyeOffsetX, eyeOffsetY, 3.2, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX, eyeOffsetY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle highlights
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

    if (fruit.expression === 'shocked') {
      ctx.beginPath();
      ctx.arc(0, eyeOffsetY + 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (fruit.expression === 'bouncy' || fruit.expression === 'regal') {
      // Big open happy smile :D
      ctx.beginPath();
      ctx.arc(0, eyeOffsetY + 3, 4, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Sweet tiny smile :)
      ctx.beginPath();
      ctx.arc(0, eyeOffsetY + 3, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Procedural Drawing for Cucumber, King Durian, or Sprite Fallbacks
  const drawFruitBody = (
    ctx: CanvasRenderingContext2D,
    tierConfig: FruitTier,
    radius: number,
  ) => {
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
    const isDangerActive = dangerTimerRef.current > 0.05 && antiGravityTimerRef.current <= 0 && dangerGraceCooldownRef.current <= 0;

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
        `DANGER! ${Math.max(0, (dangerGrace - dangerTimerRef.current)).toFixed(1)}s`,
        canvasWidth / 2,
        dangerLineY - 10,
      );

      // Warning glow over top of jar
      ctx.fillStyle = `rgba(239, 68, 68, ${dangerRatio * 0.25})`;
      ctx.fillRect(jarX, jarTop, jarWidth, dangerLineY - jarTop);
    }
    ctx.restore();

    // 3.5 Magnet Electric Laser Beam Rendering
    if (activeMagnetRef.current) {
      const mag = activeMagnetRef.current;
      const fA = fruitsRef.current.get(mag.fruitAId);
      const fB = fruitsRef.current.get(mag.fruitBId);

      if (fA && fB) {
        ctx.save();
        const pA = fA.body.position;
        const pB = fB.body.position;

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

        // Sinuous electric arcs
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const segs = 8;
        ctx.moveTo(pA.x, pA.y);
        for (let i = 1; i < segs; i++) {
          const t = i / segs;
          const mx = pA.x + (pB.x - pA.x) * t;
          const my = pA.y + (pB.y - pA.y) * t;
          const offset = (Math.sin(performance.now() * 0.05 + i * 2) * 12) * (1 - Math.abs(t - 0.5) * 2);
          ctx.lineTo(mx - (pB.y - pA.y) / Math.hypot(pB.x - pA.x, pB.y - pA.y) * offset, my + (pB.x - pA.x) / Math.hypot(pB.x - pA.x, pB.y - pA.y) * offset);
        }
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();

        // Magnetic rings around both fruit centers
        [pA, pB].forEach((pt) => {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 20 + Math.sin(performance.now() * 0.02) * 8, 0, Math.PI * 2);
          ctx.stroke();
        });

        ctx.restore();
      }
    }

    // 4. Render Active Physics Fruits
    fruitsRef.current.forEach((fruit) => {
      const {x, y} = fruit.body.position;
      const angle = fruit.body.angle;
      const tierConfig = FRUIT_TIERS[fruit.tier - 1] || FRUIT_TIERS[0];
      const radius = tierConfig.radius;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(fruit.renderScale, fruit.renderScale);

      // Render fruit body (procedural or sprite)
      drawFruitBody(ctx, tierConfig, radius);

      // Draw cute kawaii face over fruit
      drawFruitFace(ctx, radius, fruit);

      ctx.restore();
    });

    // 5. Render Dropper, Guideline & Active Fruit (when game is playing)
    if (gameState.status === 'PLAYING') {
      const activeTierConfig =
        FRUIT_TIERS[currentTierRef.current - 1] || FRUIT_TIERS[0];
      const radius = activeTierConfig.radius;
      const curDropperX = dropperXRef.current;
      const timeSinceDrop = performance.now() - lastDropTimeRef.current;
      const cooldown = (getConfig('dropCooldownMs') as number) || 450;
      const readyProgress = Math.min(1, timeSinceDrop / cooldown);
      const isReady = readyProgress >= 1;
      const dropperScale = 0.5 + 0.5 * Math.min(1, readyProgress * 1.1);

      // Vertical Dashed Guideline
      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = isReady
        ? 'rgba(140, 88, 50, 0.45)'
        : 'rgba(140, 88, 50, 0.2)';
      ctx.lineWidth = isReady ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(curDropperX, dropperY + radius);
      ctx.lineTo(curDropperX, jarBottom - 10);
      ctx.stroke();

      // Aim target circle on jar floor
      ctx.setLineDash([]);
      ctx.fillStyle = isReady ? 'rgba(245, 158, 11, 0.35)' : 'rgba(140, 88, 50, 0.15)';
      ctx.beginPath();
      ctx.ellipse(curDropperX, jarBottom - 10, radius * 0.8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Dropper Fruit Display
      ctx.save();
      ctx.translate(curDropperX, dropperY);
      ctx.scale(dropperScale, dropperScale);
      ctx.globalAlpha = 0.65 + 0.35 * readyProgress;

      // Soft glow ring when ready
      if (isReady) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw held fruit body
      drawFruitBody(ctx, activeTierConfig, radius);

      // Cute face on held dropper fruit
      const fakeHeldFruit: FruitEntity = {
        id: 'held',
        tier: currentTierRef.current,
        body: null as any,
        spawnTime: 0,
        renderScale: 1,
        targetScale: 1,
        blinkTimer: 0,
        isBlinking: false,
        expression: isReady ? (currentTierRef.current === 13 ? 'regal' : 'happy') : 'sleepy',
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

    // 7. Render Floating Score Popups
    scorePopupsRef.current.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.translate(s.x, s.y);
      ctx.scale(s.scale, s.scale);
      ctx.font = '800 24px ' + THEME.fontFamily;
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
  };

  // Game Loop Ref Hookup
  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      // Cancel / Esc Key Handling
      if (inputRef.current) {
        const cancelPressed = inputRef.current.actions.cancel;
        if (cancelPressed && !lastCancelRef.current) {
          const currentStatus = gameStateRef.current.status;
          if (currentStatus === 'PLAYING') {
            setIsMenuOpen((prev) => !prev);
          } else if (currentStatus === 'START') {
            void exitChat({});
          } else if (
            ['GAME_OVER', 'VICTORY'].includes(currentStatus)
          ) {
            setGameState((prev) => ({...prev, status: 'START'}));
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

  // Next Fruit Asset & Info
  const nextFruitConfig = FRUIT_TIERS[nextTier - 1] || FRUIT_TIERS[0];

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
      />

      {/* TOP DEDICATED HUD BAR */}
      <header className="w-full bg-[#EAD8C0] border-b-2 border-[#C89666] shadow-sm px-2.5 py-1.5 z-20 shrink-0 flex items-center justify-between gap-1.5 max-w-2xl mx-auto pointer-events-auto">
        {/* Left: Score & High Score */}
        <div className="flex items-center gap-2">
          <div className="bg-[#FAF3E7] px-2.5 py-1 rounded-xl border border-[#D4A373] shadow-inner flex flex-col items-start min-w-[64px]">
            <span className="text-[9px] uppercase font-extrabold text-[#9A6B42] leading-none">
              SCORE
            </span>
            <span className="text-sm md:text-base font-black text-[#5C3A21] leading-tight">
              {gameState.score}
            </span>
          </div>

          <div className="hidden xs:flex bg-[#FAF3E7] px-2.5 py-1 rounded-xl border border-[#D4A373] shadow-inner flex-col items-start min-w-[64px]">
            <span className="text-[9px] uppercase font-extrabold text-[#9A6B42] leading-none flex items-center gap-1">
              <Trophy size={9} className="text-[#F59E0B]" /> BEST
            </span>
            <span className="text-sm md:text-base font-black text-[#8A5836] leading-tight">
              {Math.max(highScore, gameState.score)}
            </span>
          </div>
        </div>

        {/* Center: Next Fruit Badge */}
        <div className="flex items-center gap-1.5 bg-[#FAF3E7] px-2.5 py-1 rounded-2xl border border-[#D4A373] shadow-sm">
          <div className="flex flex-col items-center">
            <span className="text-[8px] uppercase font-extrabold text-[#9A6B42] leading-none">
              NEXT
            </span>
            <span className="text-[11px] font-bold text-[#4A2810] max-w-[65px] truncate">
              {nextFruitConfig.name}
            </span>
          </div>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center p-0.5 border shadow-sm"
            style={{
              borderColor: nextFruitConfig.color,
              backgroundColor: '#FFFFFF',
            }}>
            {assetsReady && assets[nextFruitConfig.assetKey] ? (
              <img
                src={ASSETS_MANIFEST[nextFruitConfig.assetKey]}
                alt={nextFruitConfig.name}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <div
                className="w-4 h-4 rounded-full"
                style={{backgroundColor: nextFruitConfig.color}}
              />
            )}
          </div>
        </div>

        {/* Powerups: Anti-Gravity & Magnet Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Anti-Gravity Powerup Button */}
          <button
            onClick={activateAntiGravity}
            disabled={antiGravityCooldown > 0 || antiGravityActive || gameState.status !== 'PLAYING'}
            title="Zero-G Anti-Gravity (Z / 1)"
            className={`h-9 px-2.5 rounded-xl border font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 ${
              antiGravityActive
                ? 'bg-purple-600 text-white border-purple-400 animate-pulse ring-2 ring-purple-300'
                : antiGravityCooldown > 0
                ? 'bg-purple-100/60 text-purple-400 border-purple-200 cursor-not-allowed'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300 hover:border-purple-400'
            }`}>
            <Compass size={15} className={antiGravityActive ? 'animate-spin' : 'text-purple-600'} />
            <span className="font-extrabold text-[11px]">
              {antiGravityActive
                ? `${antiGravityTimerRef.current.toFixed(0)}s`
                : antiGravityCooldown > 0
                ? `${antiGravityCooldown}s`
                : 'Zero-G'}
            </span>
          </button>

          {/* Magnet Powerup Button */}
          <button
            onClick={activateMagnet}
            disabled={magnetCooldown > 0 || magnetActive || gameState.status !== 'PLAYING'}
            title="Magnet Powerup (M / 2)"
            className={`h-9 px-2.5 rounded-xl border font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 ${
              magnetActive
                ? 'bg-amber-500 text-white border-amber-300 animate-pulse ring-2 ring-amber-300'
                : magnetCooldown > 0
                ? 'bg-amber-100/60 text-amber-400 border-amber-200 cursor-not-allowed'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 hover:border-amber-400'
            }`}>
            <Zap size={15} className="text-amber-600" />
            <span className="font-extrabold text-[11px]">
              {magnetActive ? 'Pull!' : magnetCooldown > 0 ? `${magnetCooldown}s` : 'Magnet'}
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

      {/* GAME CANVAS PLAYFIELD */}
      {assetsReady && (
        <div className="flex-1 w-full min-h-0 relative flex items-center justify-center pointer-events-auto touch-none select-none">
          {/* First drop onboarding visual prompt */}
          {gameState.status === 'PLAYING' && totalDrops === 0 && (
            <div className="absolute top-2 z-10 pointer-events-none flex flex-col items-center animate-bounce px-4">
              <div className="bg-[#8C5832]/95 text-white text-xs md:text-sm font-black px-4 py-2 rounded-full shadow-lg border-2 border-[#E8CAAA] flex items-center gap-2">
                <span>👆 Drag to Aim &bull; Release or Tap to Drop!</span>
                <span className="hidden sm:inline text-yellow-300 font-bold">(Space / &darr;)</span>
              </div>
            </div>
          )}

          {/* Anti-Gravity Onscreen tap hint */}
          {antiGravityActive && (
            <div className="absolute top-3 z-10 pointer-events-none flex flex-col items-center animate-pulse px-3">
              <div className="bg-purple-900/90 text-purple-100 text-xs font-bold px-3 py-1.5 rounded-full shadow border border-purple-400 flex items-center gap-1.5">
                <span>🌀 ZERO-G! Tap any floating fruit to push it toward its matching twin!</span>
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
            style={{
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              width: `min(100%, calc(100vh * ${canvasWidth} / ${canvasHeight}))`,
            }}
            className="h-auto max-w-full max-h-full drop-shadow-xl cursor-pointer touch-none"
          />
        </div>
      )}

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
                  className="w-5 h-5 rounded-full flex items-center justify-center border shadow-xs"
                  style={{
                    backgroundColor: tier.color,
                    borderColor: '#FFFFFF',
                  }}
                  title={`${tier.tier}. ${tier.name} (+${tier.points} pts)`}>
                  {tier.tier === 6 ? (
                    <span className="text-[8px] font-black text-white">🥒</span>
                  ) : tier.tier === 13 ? (
                    <span className="text-[8px] font-black text-white">👑</span>
                  ) : (
                    <span className="text-[7px] font-black text-white drop-shadow-xs">
                      {tier.tier}
                    </span>
                  )}
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
              ? '👆 Drag & Release to Drop'
              : '🖱️ Move & Click • Space / ↓ • Z: Zero-G • M: Magnet'}
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
                <Sparkles size={20} className="text-[#F59E0B]" /> 13-Tier Evolution Guide
              </h2>
              <button
                onClick={() => setIsEvolutionTreeOpen(false)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-[#EAD8C0] hover:bg-[#D4A373] text-[#5C3A21] flex items-center justify-center cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#7A502E] mb-3 text-center">
              Merge matching fruits to evolve them into larger tiers and score massive points!
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
                      backgroundColor: tier.tier === 13 ? '#FEF3C7' : '#FFFFFF',
                    }}>
                    {tier.tier === 6 ? (
                      <span className="text-xl">🥒</span>
                    ) : tier.tier === 13 ? (
                      <span className="text-xl">👑</span>
                    ) : assetsReady && assets[tier.assetKey] ? (
                      <img
                        src={ASSETS_MANIFEST[tier.assetKey]}
                        alt={tier.name}
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{backgroundColor: tier.color}}
                      />
                    )}
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
              onClick={() => setIsEvolutionTreeOpen(false)}
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
                onClick={() => setIsHowToPlayOpen(false)}
                className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[#EAD8C0] hover:bg-[#D4A373] text-[#5C3A21] flex items-center justify-center cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="w-full space-y-3 text-xs md:text-sm text-[#5C3A21] mb-6 overflow-y-auto max-h-[50vh] touch-auto">
              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  1. Aim and Drop 🍒
                </strong>
                Move your mouse or drag your finger horizontally to position the
                held fruit. Release or tap anywhere to drop it into the jar (or press Space / &darr;). Dropper spawns are restricted to Tiers 1-5.
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  2. 13-Tier Evolution Chain 🥒 &bull; 🍉 &bull; 👑
                </strong>
                Merge matching fruits to evolve from Cherry all the way to Tier 6 Cucumber, Watermelon, and Tier 13 King Durian!
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  3. 🌀 Zero-G Anti-Gravity Power-Up
                </strong>
                Inverts gravity for 5 seconds! A ceiling barrier prevents fruit escape, and danger-line game over is paused. Tap floating fruits during Zero-G to launch them toward their matching twin!
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  4. 🧲 Magnet Power-Up
                </strong>
                Instantly tracks down the highest tier matching fruit pair in the jar and magnetically pulls them together with an electric tractor beam!
              </div>
            </div>

            <button
              onClick={() => setIsHowToPlayOpen(false)}
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
                onClick={() => setIsMenuOpen(false)}
                className="w-full bg-[#8C5832] hover:bg-[#724524] text-white py-3.5 rounded-2xl font-bold text-lg shadow-md flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer">
                <Play size={20} /> Resume
              </button>

              {/* Audio Controls */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const muted = gameAudio.toggleMute();
                    setSfxMuted(muted);
                  }}
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
                <Sparkles size={18} className="text-[#F59E0B]" /> Fruit Evolution Guide
              </button>

              {/* Restart current session */}
              <button
                onClick={initGame}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] border-2 border-[#D4A373] text-[#D97706] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                <RotateCw size={18} /> Restart Session
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
              Drop & merge fruits inside the cozy wooden jar to create Cucumber, Watermelon, and the legendary King Durian!
            </p>

            <div className="w-full space-y-3">
              <button
                onClick={initGame}
                autoFocus
                className="w-full bg-[#8C5832] hover:bg-[#724524] text-white py-4 rounded-2xl font-black text-lg md:text-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer">
                <Play size={24} />
                PLAY GAME
              </button>

              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] text-[#5C3A21] py-3 rounded-2xl font-bold text-sm border-2 border-[#D4A373] transition-all flex items-center justify-center gap-2 cursor-pointer">
                <HelpCircle size={18} />
                How to Play
              </button>

              <button
                onClick={() => setIsEvolutionTreeOpen(true)}
                className="w-full bg-[#FAF3E7] hover:bg-[#F3E3CF] text-[#5C3A21] py-3 rounded-2xl font-bold text-sm border-2 border-[#D4A373] transition-all flex items-center justify-center gap-2 cursor-pointer">
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
          description={`Final Score: ${gameState.score} • Best: ${Math.max(
            highScore,
            gameState.score,
          )}`}
          actionLabel="TRY AGAIN"
          onAction={initGame}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}

      {/* VICTORY SCREEN */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="👑 KING DURIAN CROWNED! 🎉"
          description={`Supreme Fruit Master! Final Score: ${gameState.score}`}
          actionLabel="PLAY AGAIN"
          onAction={initGame}
          icon={<RotateCw size={24} />}
          tone="victory"
        />
      )}
    </div>
  );
}
