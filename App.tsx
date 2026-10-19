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
  ChevronDown,
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
const HIGH_SCORE_STORAGE_KEY = 'juicydrop_highscore_v1';

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

// Particle representation for juicy bursts
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
}

// Floating score text popup
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
  expression: 'happy' | 'bouncy' | 'shocked' | 'sleepy';
  expressionTimer: number;
  merged: boolean;
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

  // Weighted random dropper tier (1..5)
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
          radius: isSparkle ? 3 + Math.random() * 4 : 4 + Math.random() * 8,
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
    const friction = (getConfig('fruitFriction') as number) || 0.08;
    const densityScale =
      (getConfig('fruitDensityMultiplier') as number) || 0.002;

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

    // Advance queue
    const nextT = nextTierRef.current;
    const newUpcoming = getRandomSpawnTier();
    currentTierRef.current = nextT;
    nextTierRef.current = newUpcoming;
    setCurrentTier(nextT);
    setNextTier(newUpcoming);

    lastDropTimeRef.current = now;
  }, [dropperY, jarRight, jarX, getRandomSpawnTier, isMenuOpen, isHowToPlayOpen, isEvolutionTreeOpen]);

  // Direct keyboard listener for instant dropping and steering
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
      }
    };

    window.addEventListener('keydown', handleDirectKeyDown, {passive: false});
    return () => window.removeEventListener('keydown', handleDirectKeyDown);
  }, [dropFruit, isEvolutionTreeOpen, isHowToPlayOpen, isMenuOpen, jarRight, jarX]);

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
    totalDropsRef.current = 0;
    setTotalDrops(0);
    lastDropTimeRef.current = performance.now() - 600; // Allow immediate first drop

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

  // Direct canvas pointer event helpers for guaranteed fail-safe drop
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.status !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) {
      const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
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
        if (currentTierNum >= 10) {
          gameAudio.playLevelUpStinger();
        } else if (currentTierNum >= 5) {
          gameAudio.playPowerupChime();
        } else {
          gameAudio.playCoinPickup();
        }

        // Particle Burst
        spawnJuiceSplash(midX, midY, currentTierConfig.color, 24);

        // Check if merging 2 Watermelons (Tier 11) -> Win / Ultimate explosion
        if (currentTierNum === 11) {
          const victoryPoints = 4096;
          spawnScorePopup(
            midX,
            midY,
            `+${victoryPoints} ULTIMATE!`,
            '#F59E0B',
          );
          spawnJuiceSplash(midX, midY, '#FFD700', 44, true);
          gameAudio.playChiptuneExplosion();

          updateScoreWithHighScore(victoryPoints);
          if (getConfig('twoWatermelonsVictory')) {
            setGameState((prev) => ({...prev, status: 'VICTORY'}));
          }
          return;
        }

        // Create upgraded fruit at Tier + 1
        const nextTierNum = currentTierNum + 1;
        const nextTierConfig = FRUIT_TIERS[nextTierNum - 1];
        const radius = nextTierConfig.radius;
        const restitution = (getConfig('fruitRestitution') as number) || 0.22;
        const friction = (getConfig('fruitFriction') as number) || 0.08;
        const densityScale =
          (getConfig('fruitDensityMultiplier') as number) || 0.002;

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
          expression: 'bouncy',
          expressionTimer: 0.8,
          merged: false,
        };

        fruitsRef.current.set(newBody.id, newEntity);

        // Float score popup
        spawnScorePopup(
          clampedSpawnX,
          clampedSpawnY,
          `+${pointsEarned}`,
          nextTierConfig.color,
        );

        // Update score & highscore in sync
        updateScoreWithHighScore(pointsEarned);
      });
    }

    // 4. Update Fruits Animations, Expressions & Danger Line Check
    let settledBreach = false;
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
          fruit.expression = 'happy';
        }
      }

      // Check danger line condition for settled fruits (>2.0s age and low kinetic velocity)
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
    });

    // 5. Danger Line Accumulator
    const dangerGrace = (getConfig('dangerGraceSeconds') as number) || 2.5;
    if (settledBreach) {
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
      p.vy += 0.18; // particle gravity
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
    ctx.fillStyle = 'rgba(255, 120, 140, 0.4)';
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
    } else if (fruit.expression === 'bouncy') {
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
    const isDangerActive = dangerTimerRef.current > 0.05;

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

    // 4. Render Active Physics Fruits
    fruitsRef.current.forEach((fruit) => {
      const {x, y} = fruit.body.position;
      const angle = fruit.body.angle;
      const tierConfig = FRUIT_TIERS[fruit.tier - 1] || FRUIT_TIERS[0];
      const radius = tierConfig.radius;
      const img = assets[tierConfig.assetKey];

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(fruit.renderScale, fruit.renderScale);

      // Render fruit sprite or fallback circle
      if (img && img.complete && img.naturalWidth > 0) {
        // Draw with correct aspect ratio maintaining centered radius box
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
      const activeImg = assets[activeTierConfig.assetKey];
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

      if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        const drawH = radius * 2.15;
        const drawW = drawH * activeTierConfig.aspectRatio;
        ctx.drawImage(activeImg, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.fillStyle = activeTierConfig.color;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

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
        expression: isReady ? 'happy' : 'sleepy',
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

      {/* TOP DEDICATED HUD BAR (Pointer Events: Buttons are interactive, bar does not block canvas) */}
      <header className="w-full bg-[#EAD8C0] border-b-2 border-[#C89666] shadow-sm px-3 py-1.5 z-20 shrink-0 flex items-center justify-between gap-2 max-w-2xl mx-auto pointer-events-auto">
        {/* Left: Score & High Score */}
        <div className="flex items-center gap-3">
          <div className="bg-[#FAF3E7] px-3 py-1 rounded-xl border border-[#D4A373] shadow-inner flex flex-col items-start min-w-[70px]">
            <span className="text-[10px] uppercase font-extrabold text-[#9A6B42] leading-none">
              SCORE
            </span>
            <span className="text-base md:text-lg font-black text-[#5C3A21] leading-tight">
              {gameState.score}
            </span>
          </div>

          <div className="hidden sm:flex bg-[#FAF3E7] px-3 py-1 rounded-xl border border-[#D4A373] shadow-inner flex-col items-start min-w-[70px]">
            <span className="text-[10px] uppercase font-extrabold text-[#9A6B42] leading-none flex items-center gap-1">
              <Trophy size={10} className="text-[#F59E0B]" /> BEST
            </span>
            <span className="text-base md:text-lg font-black text-[#8A5836] leading-tight">
              {Math.max(highScore, gameState.score)}
            </span>
          </div>
        </div>

        {/* Center: Next Fruit Badge */}
        <div className="flex items-center gap-2 bg-[#FAF3E7] px-3 py-1 rounded-2xl border border-[#D4A373] shadow-sm">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase font-extrabold text-[#9A6B42] leading-none">
              NEXT
            </span>
            <span className="text-xs font-bold text-[#4A2810]">
              {nextFruitConfig.name}
            </span>
          </div>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center p-0.5 border-2 shadow-sm"
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
                className="w-5 h-5 rounded-full"
                style={{backgroundColor: nextFruitConfig.color}}
              />
            )}
          </div>
        </div>

        {/* Right: Evolution Guide & Menu Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEvolutionTreeOpen(true)}
            aria-label="Fruit Evolution Guide"
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-[#FAF3E7] hover:bg-[#F3E3CF] active:scale-95 text-[#5C3A21] border border-[#D4A373] shadow-sm flex items-center justify-center transition-all cursor-pointer">
            <Sparkles size={18} className="text-[#F59E0B]" />
          </button>

          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open Menu"
            className="px-3 h-10 min-w-[48px] min-h-[48px] rounded-xl bg-[#8C5832] hover:bg-[#724524] active:scale-95 text-white font-bold text-xs md:text-sm border border-[#5C3A21] shadow flex items-center gap-1 transition-all cursor-pointer">
            <MenuIcon size={18} />
            <span className="hidden xs:inline">Menu</span>
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
                <span className="hidden sm:inline text-yellow-300 font-bold">(or Spacebar / &darr;)</span>
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

      {/* BOTTOM MOBILE CONTROLS / INSTRUCTIONS */}
      <footer className="w-full bg-[#EAD8C0] border-t border-[#C89666] px-3 py-1.5 text-center shrink-0 z-10 max-w-2xl mx-auto flex items-center justify-between text-[11px] md:text-xs text-[#7A502E] pointer-events-auto">
        <span className="font-medium">
          {isMobile
            ? '👆 Drag & Release to Drop'
            : '🖱️ Move & Click to Drop • Space / ↓'}
        </span>
        <span className="font-bold text-[#8C5832]">
          Merge 2 🍉 to Win!
        </span>
      </footer>

      {/* EVOLUTION TREE MODAL */}
      {isEvolutionTreeOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-[#FFF9F0] border-4 border-[#8C5832] rounded-3xl p-5 m-3 shadow-2xl flex flex-col items-center pointer-events-auto">
            <div className="w-full flex items-center justify-between mb-3 border-b-2 border-[#E8CAAA] pb-2">
              <h2 className="text-xl font-extrabold text-[#5C3A21] flex items-center gap-2">
                <Sparkles size={20} className="text-[#F59E0B]" /> Fruit
                Evolution Tree
              </h2>
              <button
                onClick={() => setIsEvolutionTreeOpen(false)}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-[#EAD8C0] hover:bg-[#D4A373] text-[#5C3A21] flex items-center justify-center cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#7A502E] mb-4 text-center">
              Merge identical fruit pairs to evolve into larger fruits!
            </p>

            <div className="w-full grid grid-cols-2 gap-2 overflow-y-auto max-h-[55vh] p-1 touch-auto">
              {FRUIT_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className="flex items-center gap-2 p-2 rounded-2xl bg-[#FAF3E7] border border-[#D4A373] shadow-sm">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center p-0.5 border shadow-inner shrink-0"
                    style={{
                      borderColor: tier.color,
                      backgroundColor: '#FFFFFF',
                    }}>
                    {assetsReady && assets[tier.assetKey] ? (
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
              className="mt-4 w-full bg-[#8C5832] hover:bg-[#724524] active:scale-98 text-white py-2.5 rounded-full font-bold text-sm shadow transition-all cursor-pointer">
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
                <HelpCircle size={24} className="text-[#F59E0B]" /> How To
                Play
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
                held fruit. Release or tap anywhere to drop it into the jar (or press Space / &darr;).
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  2. Merge Identical Fruits 🍇+🍇
                </strong>
                When two matching fruits touch, they combine into the next
                evolution tier and award score points.
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  3. Watch The Danger Line ⚠️
                </strong>
                If settled fruits remain stacked above the red dashed line for
                more than 2.5 seconds, the jar overflows and the game ends!
              </div>

              <div className="p-3 bg-[#FAF3E7] rounded-xl border border-[#D4A373]">
                <strong className="block text-[#8C5832] mb-1">
                  4. Ultimate Watermelon Fusion 🍉
                </strong>
                Combine two giant watermelons for the ultimate celebratory 4096
                point explosion!
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

      {/* GAME MENU OVERLAY (PAUSE / AUDIO CONTROLS) */}
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
                <Sparkles size={18} className="text-[#F59E0B]" /> Fruit
                Evolution Guide
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
              {assetsReady && assets['fruit_watermelon'] ? (
                <img
                  src={ASSETS_MANIFEST['fruit_watermelon']}
                  alt="Juicy Drop"
                  className="w-12 h-12 object-contain animate-bounce pointer-events-none"
                />
              ) : (
                <span className="text-3xl">🍉</span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-black mb-2 text-[#5C3A21] text-center tracking-wide">
              Juicy Drop
            </h1>
            <p className="text-xs md:text-sm text-[#8C5832] font-semibold text-center mb-6">
              Drop & merge fruits inside the cozy wooden jar to grow giant
              watermelons!
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
                Fruit Evolution Guide
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
          title="WATERMELON MERGED! 🍉🎉"
          description={`Ultimate Masterpiece! Final Score: ${gameState.score}`}
          actionLabel="PLAY AGAIN"
          onAction={initGame}
          icon={<RotateCw size={24} />}
          tone="victory"
        />
      )}
    </div>
  );
}
