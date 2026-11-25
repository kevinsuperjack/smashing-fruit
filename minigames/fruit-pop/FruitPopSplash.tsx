import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SnowfallOverlay } from '../../components/SnowfallOverlay';
import { gameAudio, kidVoice } from '../../utils/helper';
import { APP_THEMES } from '../../utils/theme';
import {
  type ArcadeMode,
  type FruitPopSaveData,
  addGoldenSeeds,
  getGoldenSeeds,
  loadFruitPopSave,
  persistFruitPopSave,
  recordFruitPopRun,
} from '../arcadeStorage';
import {
  FRUIT_POP_FRUITS,
  GOLDEN_SEED_BUBBLE_BONUS,
  computeFruitPopGoldenSeeds,
  computeFruitPopStars,
  createFruitPopState,
  finishFruitPopRound,
  getComboMultiplier,
  getFruitPopHudSnapshot,
  popAtPoint,
  resizeFruitPopBounds,
  setFruitPopTheme,
  stepFruitPop,
} from './engine';
import type {
  FruitBubble,
  FruitPopEvent,
  FruitPopHudSnapshot,
  FruitPopSplashProps,
  FruitPopState,
  FruitPopView,
} from './types';

export type { FruitPopSplashProps } from './types';

interface ResultsSummary {
  mode: ArcadeMode;
  score: number;
  totalPopped: number;
  maxCombo: number;
  stars: number;
  goldenSeedsEarned: number;
  discoveredCount: number;
  rainbowPops: number;
  goldenPops: number;
}

interface CanvasSnowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  swayAmp: number;
  swayPhase: number;
  alpha: number;
}

interface TwinkleStar {
  nx: number;
  ny: number;
  r: number;
  phase: number;
}

const CANVAS_TWINKLE_STARS: readonly TwinkleStar[] = Array.from(
  { length: 28 },
  (_, idx) => ({
    nx: ((idx * 37 + 11) % 96 + 2) / 100,
    ny: ((idx * 23 + 5) % 58 + 3) / 100,
    r: 1 + (idx % 3) * 0.65,
    phase: idx * 0.73,
  }),
);

function createCanvasSnowflakes(width: number, height: number): CanvasSnowflake[] {
  const w = Math.max(200, width);
  const h = Math.max(300, height);
  return Array.from({ length: 34 }, (_, idx) => ({
    x: ((idx * 53 + 17) % 100) * 0.01 * w,
    y: ((idx * 31 + 7) % 100) * 0.01 * h,
    r: 1.8 + (idx % 4) * 1.1,
    vy: 26 + (idx % 5) * 11,
    swayAmp: 8 + (idx % 4) * 5,
    swayPhase: idx * 0.85,
    alpha: 0.42 + (idx % 5) * 0.11,
  }));
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerR: number,
  innerR: number,
  rotation: number,
  fillStyle: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function drawBubbleFace(
  ctx: CanvasRenderingContext2D,
  radius: number,
  isSpecial: boolean,
): void {
  const scale = radius / 36;
  ctx.save();
  ctx.scale(scale, scale);

  // Rosy cheeks
  ctx.fillStyle = 'rgba(255, 118, 145, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-12, 4, 4.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12, 4, 4.5, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.arc(-8.5, -2.5, 3.1, 0, Math.PI * 2);
  ctx.arc(8.5, -2.5, 3.1, 0, Math.PI * 2);
  ctx.fill();

  // Eye sparkles
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-9.6, -3.7, 1.25, 0, Math.PI * 2);
  ctx.arc(7.4, -3.7, 1.25, 0, Math.PI * 2);
  ctx.fill();

  // Happy mouth
  ctx.strokeStyle = '#2C1810';
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (isSpecial) {
    ctx.arc(0, 2.5, 6.2, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.fillStyle = '#C84B31';
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.arc(0, 2.2, 5.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  bubble: FruitBubble,
  elapsedSec: number,
  spriteMap: Map<string, HTMLImageElement>,
): void {
  const r = Math.max(8, bubble.radius);
  const { x, y, kind } = bubble;

  ctx.save();
  ctx.translate(x, y);

  // Christmas snowglobe ornament cap & hanging loop
  if (bubble.ornament === 'snowglobe') {
    const capW = r * 0.44;
    const capH = r * 0.22;
    const capY = -r - capH * 0.45;

    ctx.beginPath();
    ctx.arc(0, capY - capH * 0.4, r * 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    const capGrad = ctx.createLinearGradient(-capW / 2, capY, capW / 2, capY);
    capGrad.addColorStop(0, '#B45309');
    capGrad.addColorStop(0.5, '#FDE68A');
    capGrad.addColorStop(1, '#D97706');
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.roundRect(-capW / 2, capY, capW, capH, 4);
    ctx.fill();
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Outer bubble tint sphere
  const sphereGrad = ctx.createRadialGradient(
    -r * 0.3,
    -r * 0.32,
    r * 0.12,
    0,
    0,
    r,
  );
  if (kind === 'rainbow') {
    const hue = (elapsedSec * 90 + bubble.id * 45) % 360;
    sphereGrad.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    sphereGrad.addColorStop(0.45, `hsla(${hue}, 95%, 68%, 0.42)`);
    sphereGrad.addColorStop(1, `hsla(${(hue + 140) % 360}, 92%, 58%, 0.62)`);
  } else if (kind === 'golden') {
    sphereGrad.addColorStop(0, 'rgba(254, 249, 195, 0.85)');
    sphereGrad.addColorStop(0.55, 'rgba(250, 204, 21, 0.46)');
    sphereGrad.addColorStop(1, 'rgba(217, 119, 6, 0.66)');
  } else {
    sphereGrad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
    sphereGrad.addColorStop(0.58, `${bubble.color}33`);
    sphereGrad.addColorStop(1, `${bubble.color}70`);
  }

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  // Inner fruit / special core
  const innerR = r * 0.62;
  if (kind === 'rainbow') {
    const hue = (elapsedSec * 120 + bubble.id * 35) % 360;
    const rbGrad = ctx.createLinearGradient(-innerR, -innerR, innerR, innerR);
    rbGrad.addColorStop(0, `hsl(${hue}, 95%, 65%)`);
    rbGrad.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 95%, 65%)`);
    rbGrad.addColorStop(1, `hsl(${(hue + 240) % 360}, 95%, 65%)`);

    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fillStyle = rbGrad;
    ctx.fill();
    ctx.strokeStyle = '#FFFBEB';
    ctx.lineWidth = 2;
    ctx.stroke();

    drawBubbleFace(ctx, innerR, true);
    drawFourPointStar(
      ctx,
      innerR * 0.72,
      -innerR * 0.72,
      r * 0.22,
      r * 0.08,
      elapsedSec * 2.2,
      '#FFFFFF',
    );
  } else if (kind === 'golden') {
    const goldGrad = ctx.createRadialGradient(
      -innerR * 0.25,
      -innerR * 0.25,
      innerR * 0.1,
      0,
      0,
      innerR,
    );
    goldGrad.addColorStop(0, '#FEF9C3');
    goldGrad.addColorStop(0.5, '#FACC15');
    goldGrad.addColorStop(1, '#D97706');

    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fillStyle = goldGrad;
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.font = `700 ${Math.round(innerR * 1.05)}px "Fredoka", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪙', 0, 1);

    drawFourPointStar(
      ctx,
      -innerR * 0.72,
      -innerR * 0.72,
      r * 0.19,
      r * 0.07,
      -elapsedSec * 1.8,
      '#FEF9C3',
    );
  } else {
    const sprite = spriteMap.get(bubble.assetKey);
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const drawSize = innerR * 2.05;
      ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fillStyle = bubble.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawBubbleFace(ctx, innerR, false);
    }
  }

  // Soap-bubble rim + specular crescent + bottom bounce sheen
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle =
    kind === 'golden'
      ? 'rgba(254, 240, 138, 0.92)'
      : 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = kind === 'rainbow' || kind === 'golden' ? 2.6 : 2;
  ctx.stroke();

  // Top-left glossy reflection
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.15, r * 0.28, r * 0.13, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.fill();
  ctx.restore();

  // Bottom-right secondary rim highlight
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0.12 * Math.PI, 0.42 * Math.PI);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Christmas ornament animated shimmer sweep
  if (bubble.ornament === 'snowglobe') {
    const shimmer = 0.5 + 0.5 * Math.sin(elapsedSec * 3.4 + bubble.shimmerPhase);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
    ctx.clip();

    const offset = -r * 1.4 + shimmer * r * 2.8;
    const sweepGrad = ctx.createLinearGradient(
      offset - r * 0.35,
      -r,
      offset + r * 0.35,
      r,
    );
    sweepGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sweepGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.36)');
    sweepGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }

  ctx.restore();
}

export const FruitPopSplash: React.FC<FruitPopSplashProps> = ({
  sfxMuted,
  musicMuted,
  kidVoiceEnabled,
  theme,
  onToggleSfx,
  onToggleMusic,
  onExitToHub,
  backHandlerRef,
}) => {
  const [save, setSave] = useState<FruitPopSaveData>(() => loadFruitPopSave());
  const [goldenSeeds, setGoldenSeeds] = useState<number>(() => getGoldenSeeds());
  const [mode, setMode] = useState<ArcadeMode>(() => loadFruitPopSave().preferredMode);
  const [kidEndless, setKidEndless] = useState<boolean>(false);
  const [view, setView] = useState<FruitPopView>('LOBBY');
  const [runNonce, setRunNonce] = useState<number>(0);
  const [hud, setHud] = useState<FruitPopHudSnapshot>({
    mode: 'KID',
    status: 'PLAYING',
    score: 0,
    totalPopped: 0,
    timeRemainingSec: 45,
    comboCount: 0,
    comboMultiplier: 1,
    comboTimerRatio: 0,
    kidCount1To10: 0,
    lastFruitName: null,
    bonusGoldenSeeds: 0,
    stars: 1,
    projectedGoldenSeeds: 3,
  });
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsSummary | null>(null);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineStateRef = useRef<FruitPopState | null>(null);
  const spriteMapRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const snowParticlesRef = useRef<CanvasSnowflake[]>([]);
  const bannerTimerRef = useRef<number | null>(null);
  const runCommittedRef = useRef<boolean>(false);

  const viewRef = useRef<FruitPopView>(view);
  viewRef.current = view;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const kidVoiceEnabledRef = useRef(kidVoiceEnabled);
  kidVoiceEnabledRef.current = kidVoiceEnabled;

  const themePalette = APP_THEMES[theme];
  const isChristmas = theme === 'CHRISTMAS';

  // Preload fruit PNG sprites once
  useEffect(() => {
    const map = spriteMapRef.current;
    for (let i = 0; i < FRUIT_POP_FRUITS.length; i++) {
      const fruit = FRUIT_POP_FRUITS[i];
      if (!map.has(fruit.assetKey)) {
        const img = new Image();
        img.src = `assets/images/${fruit.assetKey}.png`;
        map.set(fruit.assetKey, img);
      }
    }
  }, []);

  // Sync live theme updates into active simulation state
  useEffect(() => {
    if (engineStateRef.current) {
      setFruitPopTheme(engineStateRef.current, theme);
    }
  }, [theme]);

  const showBanner = useCallback((text: string, durationMs = 1500) => {
    setBannerText(text);
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerText(null);
      bannerTimerRef.current = null;
    }, durationMs);
  }, []);

  const clearBanner = useCallback(() => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setBannerText(null);
  }, []);

  const commitRunResults = useCallback(
    (state: FruitPopState): ResultsSummary => {
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

      if (!runCommittedRef.current) {
        runCommittedRef.current = true;
        if (goldenSeedsEarned > 0) {
          const nextSeeds = addGoldenSeeds(goldenSeedsEarned);
          setGoldenSeeds(nextSeeds);
        }
        const nextSave = recordFruitPopRun({
          score: state.score,
          stars,
          popped: state.totalPopped,
          mode: state.mode,
        });
        setSave(nextSave);
      }

      return {
        mode: state.mode,
        score: state.score,
        totalPopped: state.totalPopped,
        maxCombo: state.maxComboReached,
        stars,
        goldenSeedsEarned,
        discoveredCount: state.discoveredFruits.length,
        rainbowPops: state.rainbowPops,
        goldenPops: state.goldenPops,
      };
    },
    [],
  );

  const commitPartialProgressIfNeeded = useCallback(() => {
    if (runCommittedRef.current) return;
    const state = engineStateRef.current;
    runCommittedRef.current = true;
    if (!state) return;
    if (state.totalPopped === 0 && state.bonusGoldenSeeds === 0) return;

    const partialSeeds =
      state.bonusGoldenSeeds +
      (state.mode === 'KID'
        ? Math.floor(state.totalPopped / 4)
        : Math.floor(state.score / 80));

    if (partialSeeds > 0) {
      const nextSeeds = addGoldenSeeds(partialSeeds);
      setGoldenSeeds(nextSeeds);
    }

    const stars = computeFruitPopStars(
      state.score,
      state.totalPopped,
      state.mode,
    );
    const nextSave = recordFruitPopRun({
      score: state.score,
      stars,
      popped: state.totalPopped,
      mode: state.mode,
    });
    setSave(nextSave);
  }, []);

  const handleEngineEvents = useCallback(
    (events: FruitPopEvent[], state: FruitPopState, fromStep: boolean) => {
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type === 'BUBBLE_POPPED') {
          if (!ev.isChainReaction && ev.kind === 'fruit') {
            const pitch = 420 + ev.fruitTier * 36 + Math.min(8, ev.comboCount) * 18;
            gameAudio.playTone({
              type: 'sine',
              freq: pitch,
              freqTo: pitch * 1.45,
              dur: 0.09,
              gain: 0.14,
            });
            if (ev.comboMultiplier >= 2) {
              gameAudio.playComboChime(ev.comboMultiplier);
            }
            if (state.mode === 'KID' && kidVoiceEnabledRef.current) {
              kidVoice.speakMerge(
                ev.kidCount1To10,
                ev.spokenPhrase,
                ev.fruitTier >= 8,
              );
            }
          }
        } else if (ev.type === 'RAINBOW_CHAIN') {
          gameAudio.playWildcardShimmer();
          gameAudio.playPowerupChime();
          showBanner(
            ev.chainedCount > 0
              ? `🌈 RAINBOW POP! +${ev.chainedCount} CHAIN!`
              : '🌈 RAINBOW POP!',
            1400,
          );
          if (state.mode === 'KID' && kidVoiceEnabledRef.current) {
            kidVoice.speakPriority('Rainbow pop!');
          }
        } else if (ev.type === 'GOLDEN_SEED_POP') {
          gameAudio.playSkyCoin(1 + state.goldenPops);
          showBanner(`🪙 +${ev.seedsAwarded} GOLDEN SEEDS!`, 1350);
          if (state.mode === 'KID' && kidVoiceEnabledRef.current) {
            kidVoice.speakPriority('Golden seed!');
          }
        } else if (ev.type === 'KID_CELEBRATION') {
          gameAudio.playOrderComplete();
          showBanner(`🎉 ${ev.milestone} BUBBLES POPPED!`, 1600);
          if (kidVoiceEnabledRef.current) {
            kidVoice.speakPriority('Yay! Super popping!');
          }
        } else if (ev.type === 'ROUND_COMPLETE' && fromStep) {
          if (ev.stars >= 2) {
            gameAudio.playVictoryFanfare();
          } else {
            gameAudio.playOrderComplete();
          }
          const summary = commitRunResults(state);
          setResults(summary);
          setHud(getFruitPopHudSnapshot(state));
          setView('RESULTS');
        }
      }
    },
    [commitRunResults, showBanner],
  );

  const startRun = useCallback(
    (selectedMode: ArcadeMode, endlessFlag: boolean) => {
      gameAudio.playConfirmSelect();
      kidVoice.cancel();
      clearBanner();
      runCommittedRef.current = false;
      setResults(null);

      const host = canvasHostRef.current;
      const width = host ? host.clientWidth : window.innerWidth;
      const height = host ? host.clientHeight : window.innerHeight;

      const nextState = createFruitPopState({
        mode: selectedMode,
        theme: themeRef.current,
        kidEndless: selectedMode === 'KID' ? endlessFlag : false,
        bounds: {
          width: Math.max(240, width || 420),
          height: Math.max(360, height || 720),
        },
      });

      engineStateRef.current = nextState;
      snowParticlesRef.current = createCanvasSnowflakes(
        nextState.bounds.width,
        nextState.bounds.height,
      );
      setHud(getFruitPopHudSnapshot(nextState));
      setView('PLAYING');
      setRunNonce((n) => n + 1);

      if (selectedMode === 'KID' && kidVoiceEnabledRef.current) {
        kidVoice.speakPriority('Pop the fruit bubbles!');
      }
    },
    [clearBanner],
  );

  const returnToLobby = useCallback(() => {
    commitPartialProgressIfNeeded();
    kidVoice.cancel();
    clearBanner();
    engineStateRef.current = null;
    setResults(null);
    setView('LOBBY');
  }, [clearBanner, commitPartialProgressIfNeeded]);

  const handleFinishEarly = useCallback(() => {
    const state = engineStateRef.current;
    if (!state) return;
    gameAudio.playVictoryFanfare();
    kidVoice.cancel();
    clearBanner();
    finishFruitPopRound(state);
    const summary = commitRunResults(state);
    setResults(summary);
    setHud(getFruitPopHudSnapshot(state));
    setView('RESULTS');
  }, [clearBanner, commitRunResults]);

  const handleSelectMode = useCallback((nextMode: ArcadeMode) => {
    gameAudio.playCrispClick();
    setMode(nextMode);
    setSave((prev) => {
      const updated: FruitPopSaveData = { ...prev, preferredMode: nextMode };
      persistFruitPopSave(updated);
      return updated;
    });
  }, []);

  // Unified Back / Escape handler (App.tsx invokes backHandlerRef.current)
  useEffect(() => {
    if (!backHandlerRef) return;
    backHandlerRef.current = () => {
      const current = viewRef.current;
      if (current === 'PLAYING') {
        kidVoice.cancel();
        setView('PAUSED');
      } else if (current === 'PAUSED') {
        setView('PLAYING');
      } else if (current === 'RESULTS') {
        returnToLobby();
      } else {
        kidVoice.cancel();
        onExitToHub();
      }
    };
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, onExitToHub, returnToLobby]);

  // Auto-pause on tab hide / window blur
  useEffect(() => {
    const handleAutoPause = () => {
      if (viewRef.current === 'PLAYING') {
        kidVoice.cancel();
        setView('PAUSED');
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) handleAutoPause();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', handleAutoPause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', handleAutoPause);
    };
  }, []);

  // Cleanup voice and toast timers on unmount
  useEffect(() => {
    return () => {
      kidVoice.cancel();
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    };
  }, []);

  // 60fps Canvas loop + ResizeObserver + DPI scaling (active whenever in Playfield views)
  const inPlayfield = view !== 'LOBBY';
  useEffect(() => {
    if (!inPlayfield) return;

    const host = canvasHostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let logicalWidth = Math.max(240, host.clientWidth || 420);
    let logicalHeight = Math.max(360, host.clientHeight || 720);
    let currentDpr = Math.min(window.devicePixelRatio || 1, 2);

    const syncCanvasSize = () => {
      logicalWidth = Math.max(240, host.clientWidth || 420);
      logicalHeight = Math.max(360, host.clientHeight || 720);
      currentDpr = Math.min(window.devicePixelRatio || 1, 2);

      const targetW = Math.floor(logicalWidth * currentDpr);
      const targetH = Math.floor(logicalHeight * currentDpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      if (engineStateRef.current) {
        resizeFruitPopBounds(engineStateRef.current, {
          width: logicalWidth,
          height: logicalHeight,
        });
      }
      if (snowParticlesRef.current.length === 0) {
        snowParticlesRef.current = createCanvasSnowflakes(
          logicalWidth,
          logicalHeight,
        );
      }
    };

    syncCanvasSize();
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(host);

    let disposed = false;
    let rafId = 0;
    let lastFrameMs = performance.now();
    let lastHudSyncMs = 0;

    const renderFrame = (nowMs: number) => {
      if (disposed) return;

      const dt = Math.min(0.05, Math.max(0, (nowMs - lastFrameMs) / 1000));
      lastFrameMs = nowMs;

      const state = engineStateRef.current;
      if (state) {
        if (viewRef.current === 'PLAYING' && state.status === 'PLAYING') {
          const events = stepFruitPop(state, dt);
          if (events.length > 0) {
            handleEngineEvents(events, state, true);
          }

          if (nowMs - lastHudSyncMs >= 75) {
            lastHudSyncMs = nowMs;
            setHud(getFruitPopHudSnapshot(state));
          }
        }

        // Draw frame
        ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
        const w = logicalWidth;
        const h = logicalHeight;
        const christmasActive = themeRef.current === 'CHRISTMAS';

        // 1. Sky / Winter Backdrop
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        if (christmasActive) {
          bgGrad.addColorStop(0, '#0F172A');
          bgGrad.addColorStop(0.55, '#064E3B');
          bgGrad.addColorStop(1, '#1E1B4B');
        } else {
          bgGrad.addColorStop(0, '#7DD3FC');
          bgGrad.addColorStop(0.52, '#FEF3C7');
          bgGrad.addColorStop(1, '#FDE68A');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        if (christmasActive) {
          // Twinkling winter stars
          for (let i = 0; i < CANVAS_TWINKLE_STARS.length; i++) {
            const star = CANVAS_TWINKLE_STARS[i];
            const alpha =
              0.35 + 0.55 * (0.5 + 0.5 * Math.sin(nowMs * 0.0025 + star.phase));
            ctx.beginPath();
            ctx.arc(star.nx * w, star.ny * h, star.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(254, 243, 199, ${alpha.toFixed(2)})`;
            ctx.fill();
          }

          // Distant snowy hill silhouette
          ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
          ctx.beginPath();
          ctx.moveTo(0, h);
          ctx.lineTo(0, h * 0.86);
          ctx.quadraticCurveTo(w * 0.28, h * 0.78, w * 0.56, h * 0.85);
          ctx.quadraticCurveTo(w * 0.82, h * 0.91, w, h * 0.82);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        } else {
          // Warm orchard sun glow & rolling hills
          const sunGlow = ctx.createRadialGradient(
            w * 0.82,
            h * 0.16,
            10,
            w * 0.82,
            h * 0.16,
            Math.max(w, h) * 0.35,
          );
          sunGlow.addColorStop(0, 'rgba(255, 251, 235, 0.85)');
          sunGlow.addColorStop(1, 'rgba(254, 243, 199, 0)');
          ctx.fillStyle = sunGlow;
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = 'rgba(134, 239, 172, 0.35)';
          ctx.beginPath();
          ctx.moveTo(0, h);
          ctx.lineTo(0, h * 0.88);
          ctx.quadraticCurveTo(w * 0.3, h * 0.8, w * 0.62, h * 0.88);
          ctx.quadraticCurveTo(w * 0.85, h * 0.93, w, h * 0.85);
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }

        // 2. Canvas Snowfall (when Christmas theme is active)
        if (christmasActive) {
          const flakes = snowParticlesRef.current;
          const animDt = viewRef.current === 'PLAYING' ? dt : 0;
          for (let i = 0; i < flakes.length; i++) {
            const f = flakes[i];
            if (animDt > 0) {
              f.y += f.vy * animDt;
              f.swayPhase += animDt * 1.4;
              if (f.y > h + 12) {
                f.y = -10;
                f.x = ((f.x + w * 0.37) % w);
              }
            }
            const sx = f.x + Math.sin(f.swayPhase) * f.swayAmp;
            ctx.beginPath();
            ctx.arc(sx, f.y, f.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
            ctx.fill();
          }
        }

        // 3. Expanding Splash Rings
        for (let i = 0; i < state.rings.length; i++) {
          const ring = state.rings[i];
          ctx.save();
          ctx.globalAlpha = ring.alpha;
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
          ctx.strokeStyle = ring.isRainbow ? '#FEF08A' : ring.color;
          ctx.lineWidth = ring.lineWidth;
          ctx.stroke();
          ctx.restore();
        }

        // 4. Floating Fruit Bubbles
        for (let i = 0; i < state.bubbles.length; i++) {
          drawBubble(
            ctx,
            state.bubbles[i],
            state.elapsedSec,
            spriteMapRef.current,
          );
        }

        // 5. Juicy Droplet Particles
        for (let i = 0; i < state.particles.length; i++) {
          const p = state.particles[i];
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.restore();
        }

        // 6. Floating Score / Counting Callouts
        for (let i = 0; i < state.callouts.length; i++) {
          const c = state.callouts[i];
          const alpha = Math.max(0, Math.min(1, c.life / c.maxLife));
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = `900 ${Math.round(18 * c.scale)}px "Fredoka", "Nunito", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(44, 24, 16, 0.72)';
          ctx.strokeText(c.text, c.x, c.y);
          ctx.fillStyle = c.color;
          ctx.fillText(c.text, c.x, c.y);
          ctx.restore();
        }
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [handleEngineEvents, inPlayfield, runNonce]);

  // Multi-touch pointer down handler directly on Canvas (no pointer capture blocking)
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (viewRef.current !== 'PLAYING') return;
      const state = engineStateRef.current;
      const canvas = canvasRef.current;
      if (!state || !canvas) return;

      gameAudio.resume();
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (e.clientX - rect.left) * (state.bounds.width / rect.width);
      const y = (e.clientY - rect.top) * (state.bounds.height / rect.height);

      const result = popAtPoint(state, x, y);
      if (result.poppedCount > 0) {
        handleEngineEvents(result.events, state, false);
        setHud(getFruitPopHudSnapshot(state));
      }
    },
    [handleEngineEvents],
  );

  // ===========================================================================
  // LOBBY SCREEN
  // ===========================================================================
  if (view === 'LOBBY') {
    const lobbyRootClass = isChristmas
      ? `fixed inset-0 z-40 flex flex-col ${themePalette.hubBgClass} ${themePalette.hubTextClass} select-none overflow-hidden`
      : 'fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-pink-100 via-[#FDF6E3] to-[#EAD8C0] text-[#4A2810] select-none overflow-hidden';

    const cardSurfaceClass = isChristmas
      ? 'bg-emerald-950/80 rounded-3xl p-3 border-2 border-amber-300/75 shadow-lg text-amber-50 backdrop-blur-xs'
      : 'bg-[#FFF9F0] rounded-3xl p-3 border-2 border-[#D4A373] shadow-sm text-[#4A2810]';

    const subChipClass = isChristmas
      ? 'bg-slate-900/65 border-amber-300/35 text-amber-100'
      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21]';

    return (
      <div className={lobbyRootClass}>
        <SnowfallOverlay active={isChristmas} density="light" contained />

        {/* Header */}
        <header className="relative z-30 w-full max-w-2xl mx-auto px-3 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              gameAudio.playConfirmSelect();
              kidVoice.cancel();
              onExitToHub();
            }}
            className="px-3 py-2 rounded-2xl bg-[#FFF9F0] hover:bg-[#F3E3CF] border-2 border-[#C89666] text-[#5C3A21] font-extrabold text-xs md:text-sm shadow-sm flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Hub</span>
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xs ${
              isChristmas
                ? themePalette.hubHeaderBadgeClass
                : 'bg-[#FFF9F0] border-2 border-pink-400 text-[#5C3A21]'
            }`}
          >
            <span className="text-lg leading-none">🫧</span>
            <h1 className="text-sm md:text-base font-black">
              Fruit Pop Splash
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="bg-[#FFF9F0] px-2.5 py-1.5 rounded-xl border-2 border-[#D4A373] text-xs font-black text-[#8C5832] flex items-center gap-1">
              <span>🪙</span>
              <span>{goldenSeeds}</span>
            </div>
            <button
              type="button"
              onClick={onToggleSfx}
              aria-label="Toggle SFX"
              className="w-9 h-9 rounded-xl bg-[#FFF9F0] border-2 border-[#D4A373] flex items-center justify-center text-[#5C3A21] cursor-pointer active:scale-95"
            >
              {sfxMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </header>

        {/* Scrollable Lobby Content */}
        <main className="relative z-30 flex-1 overflow-y-auto px-3 pb-8 pt-1 touch-auto">
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {/* Best Stats Banner */}
            <section className={cardSurfaceClass}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`rounded-2xl border p-2.5 ${subChipClass}`}>
                  <div className="text-[10px] font-bold uppercase opacity-75">
                    Best Score
                  </div>
                  <div className="text-lg font-black">{save.bestScore}</div>
                </div>
                <div className={`rounded-2xl border p-2.5 ${subChipClass}`}>
                  <div className="text-[10px] font-bold uppercase opacity-75">
                    Best Stars
                  </div>
                  <div className="text-lg font-black text-amber-500 flex items-center justify-center gap-1">
                    <Star size={16} className="fill-amber-400 text-amber-500" />
                    <span>{save.bestStars}/3</span>
                  </div>
                </div>
                <div className={`rounded-2xl border p-2.5 ${subChipClass}`}>
                  <div className="text-[10px] font-bold uppercase opacity-75">
                    Total Popped
                  </div>
                  <div className="text-lg font-black">{save.totalPopped}</div>
                </div>
              </div>
            </section>

            {/* 2-Column Mode Selector */}
            <section className={cardSurfaceClass}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectMode('KID')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                    mode === 'KID'
                      ? 'bg-gradient-to-br from-sky-500 to-indigo-500 border-sky-200 text-white shadow-md'
                      : isChristmas
                      ? 'bg-slate-900/60 border-amber-300/40 text-amber-100 hover:bg-slate-800/70'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-black text-sm">🧸 Kid Mode</span>
                    {mode === 'KID' && <Check size={16} />}
                  </div>
                  <p
                    className={`text-[11px] font-semibold leading-tight ${
                      mode === 'KID'
                        ? 'text-sky-50'
                        : isChristmas
                        ? 'text-amber-100/80'
                        : 'text-[#8C5832]'
                    }`}
                  >
                    Big gentle bubbles, 1–10 counting &amp; KidVoice fruit words!
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMode('ARCADE')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                    mode === 'ARCADE'
                      ? 'bg-gradient-to-br from-pink-500 via-rose-500 to-amber-500 border-amber-200 text-white shadow-md'
                      : isChristmas
                      ? 'bg-slate-900/60 border-amber-300/40 text-amber-100 hover:bg-slate-800/70'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-black text-sm">⚡ Splash Rush</span>
                    {mode === 'ARCADE' && <Check size={16} />}
                  </div>
                  <p
                    className={`text-[11px] font-semibold leading-tight ${
                      mode === 'ARCADE'
                        ? 'text-amber-50'
                        : isChristmas
                        ? 'text-amber-100/80'
                        : 'text-[#8C5832]'
                    }`}
                  >
                    60s rush, 4x combo chains, 1–3 stars &amp; Golden Seeds!
                  </p>
                </button>
              </div>

              {mode === 'KID' && (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      gameAudio.playCrispClick();
                      setKidEndless(false);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                      !kidEndless
                        ? 'bg-sky-500 text-white border-sky-200 shadow-xs'
                        : subChipClass
                    }`}
                  >
                    ⏱️ 45s Joyful Round
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      gameAudio.playCrispClick();
                      setKidEndless(true);
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                      kidEndless
                        ? 'bg-indigo-500 text-white border-indigo-200 shadow-xs'
                        : subChipClass
                    }`}
                  >
                    ♾️ Endless Playground
                  </button>
                </div>
              )}
            </section>

            {/* Bubble Guide */}
            <section className={cardSurfaceClass}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs md:text-sm font-black flex items-center gap-1.5">
                  <Sparkles size={15} className="text-pink-500" />
                  <span>Bubble Guide</span>
                </h2>
                {isChristmas && (
                  <span className="text-[11px] font-extrabold text-amber-300">
                    ❄️ Snowglobe Shimmer Active
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`rounded-2xl border p-2.5 ${subChipClass}`}>
                  <div className="text-2xl leading-none mb-1">🍓</div>
                  <div className="text-[11px] font-black">Fruit Bubbles</div>
                  <div className="text-[10px] opacity-80">Multi-touch pop!</div>
                </div>
                <div className={`rounded-2xl border p-2.5 ${subChipClass}`}>
                  <div className="text-2xl leading-none mb-1">🌈</div>
                  <div className="text-[11px] font-black">Rainbow Pop</div>
                  <div className="text-[10px] opacity-80">Chain-pops nearby!</div>
                </div>
                <div className={`rounded-2xl border p-2.5 ${subChipClass}`}>
                  <div className="text-2xl leading-none mb-1">🪙</div>
                  <div className="text-[11px] font-black">Golden Seed</div>
                  <div className="text-[10px] opacity-80">
                    +{GOLDEN_SEED_BUBBLE_BONUS} Golden Seeds
                  </div>
                </div>
              </div>
            </section>

            {/* Primary Play CTA */}
            <button
              type="button"
              onClick={() => startRun(mode, kidEndless)}
              className="w-full py-4 rounded-3xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:brightness-105 text-white font-black text-lg shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play size={22} className="fill-white" />
              <span>
                {mode === 'KID'
                  ? kidEndless
                    ? 'Open Kid Playground'
                    : 'Play Kid Round (45s)'
                  : 'Start 60s Splash Rush'}
              </span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ===========================================================================
  // IN-GAME PLAYFIELD + HUD + MODALS
  // ===========================================================================
  const timeLeft =
    hud.timeRemainingSec !== null ? Math.ceil(hud.timeRemainingSec) : null;
  const isUrgentTimer = timeLeft !== null && timeLeft <= 10;

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden touch-none">
      {/* 60fps HTML5 2D Canvas */}
      <div ref={canvasHostRef} className="absolute inset-0">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          className="block w-full h-full touch-none"
        />
      </div>

      {/* Top HUD */}
      <header className="absolute top-0 inset-x-0 z-20 p-2.5 md:p-3 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Score & Combo */}
        <div className="bg-black/40 backdrop-blur-xs text-white px-3 py-1.5 rounded-2xl border border-white/25 min-w-[116px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/80">
              Score
            </span>
            {hud.comboMultiplier > 1 && (
              <span className="text-[11px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-[#4A2810]">
                {hud.comboMultiplier}x
              </span>
            )}
          </div>
          <div className="text-base font-black leading-tight">{hud.score}</div>
          {hud.comboCount > 1 && (
            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-pink-400 rounded-full transition-all duration-75"
                style={{ width: `${Math.round(hud.comboTimerRatio * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Center: Timer or Kid Counter */}
        <div className="flex items-center gap-1.5">
          {timeLeft !== null ? (
            <div
              className={`px-3.5 py-1.5 rounded-2xl border text-sm font-black backdrop-blur-xs flex items-center gap-1.5 ${
                isUrgentTimer
                  ? 'bg-rose-600/90 border-rose-200 text-white animate-pulse'
                  : 'bg-black/40 border-white/25 text-white'
              }`}
            >
              <span>⏱️</span>
              <span>{timeLeft}s</span>
            </div>
          ) : (
            <div className="bg-sky-500/85 backdrop-blur-xs text-white px-3 py-1.5 rounded-2xl border border-sky-200 text-xs font-black flex items-center gap-1.5">
              <span>🧸</span>
              <span>Popped: {hud.totalPopped}</span>
            </div>
          )}

          {hud.mode === 'KID' && hud.kidCount1To10 > 0 && (
            <div className="bg-indigo-600/85 backdrop-blur-xs text-white px-2.5 py-1.5 rounded-2xl border border-indigo-200 text-xs font-black hidden sm:flex items-center gap-1">
              <span>#{hud.kidCount1To10}</span>
              {hud.lastFruitName && <span>• {hud.lastFruitName}</span>}
            </div>
          )}
        </div>

        {/* Right: Bonus Seeds & Pause */}
        <div className="flex items-center gap-1.5">
          <div className="bg-black/40 backdrop-blur-xs text-amber-200 px-2.5 py-1.5 rounded-2xl border border-white/25 text-xs font-black flex items-center gap-1">
            <span>🪙</span>
            <span>+{hud.bonusGoldenSeeds}</span>
          </div>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              gameAudio.playConfirmSelect();
              kidVoice.cancel();
              setView('PAUSED');
            }}
            aria-label="Pause"
            className="pointer-events-auto w-10 h-10 rounded-2xl bg-[#FFF9F0]/95 hover:bg-white border-2 border-[#8C5832] text-[#5C3A21] shadow-md flex items-center justify-center active:scale-95 cursor-pointer"
          >
            <Pause size={18} />
          </button>
        </div>
      </header>

      {/* Center Toast Banner */}
      {bannerText && (
        <div className="absolute top-20 inset-x-0 z-25 flex justify-center pointer-events-none px-4">
          <div className="bg-indigo-950/90 text-amber-200 border-2 border-amber-300/80 px-4 py-1.5 rounded-full text-sm font-black shadow-xl animate-bounce">
            {bannerText}
          </div>
        </div>
      )}

      {/* Bottom Tap Hint */}
      {view === 'PLAYING' && (
        <div className="absolute bottom-4 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
          <div className="bg-black/30 backdrop-blur-xs text-white/95 text-[11px] font-bold px-3.5 py-1.5 rounded-full border border-white/20">
            {hud.mode === 'KID'
              ? '👆 Tap bubbles with one or more fingers!'
              : '👆 Multi-tap bubbles to build 4x Splash Combos!'}
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {view === 'PAUSED' && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <SnowfallOverlay active={isChristmas} density="light" contained />

          <div className="relative z-30 w-full max-w-xs bg-[#FFF9F0] border-4 border-[#8C5832] rounded-3xl p-5 shadow-2xl text-center space-y-3">
            <h2 className="text-2xl font-black text-[#5C3A21]">Paused</h2>
            <p className="text-xs font-bold text-[#8C5832]">
              {hud.mode === 'KID' ? '🧸 Kid Mode' : '⚡ Splash Rush'} •{' '}
              {hud.totalPopped} Popped
            </p>

            <button
              type="button"
              onClick={() => {
                gameAudio.playConfirmSelect();
                setView('PLAYING');
              }}
              className="w-full py-3 rounded-2xl bg-[#8C5832] hover:bg-[#724524] text-white font-black text-base shadow flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Play size={18} /> Resume
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleSfx}
                className="py-2 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {sfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                SFX: {sfxMuted ? 'Off' : 'On'}
              </button>
              <button
                type="button"
                onClick={onToggleMusic}
                className="py-2 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {musicMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                Music: {musicMuted ? 'Off' : 'On'}
              </button>
            </div>

            {hud.mode === 'KID' && hud.totalPopped > 0 && (
              <button
                type="button"
                onClick={handleFinishEarly}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold text-sm shadow cursor-pointer"
              >
                🌟 Finish &amp; Collect Seeds
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                commitPartialProgressIfNeeded();
                startRun(mode, kidEndless);
              }}
              className="w-full py-2.5 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#D97706] font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCw size={16} /> Restart
            </button>

            <button
              type="button"
              onClick={returnToLobby}
              className="w-full py-2.5 rounded-2xl bg-red-100 border-2 border-red-300 text-red-700 font-extrabold text-sm cursor-pointer"
            >
              Mode Select
            </button>
          </div>
        </div>
      )}

      {/* RESULTS MODAL */}
      {view === 'RESULTS' && results && (
        <div className="fixed inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <SnowfallOverlay active={isChristmas} density="light" contained />

          <div className="relative z-30 w-full max-w-sm bg-[#FFF9F0] border-4 border-amber-500 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="text-4xl">
              {results.stars >= 3 ? '🎉' : results.stars >= 1 ? '🫧' : '🌈'}
            </div>
            <h2 className="text-2xl font-black text-[#5C3A21]">
              {results.mode === 'KID' ? 'Fruit Pop Party!' : 'Splash Rush Complete!'}
            </h2>

            {/* Stars */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  size={38}
                  className={
                    s <= results.stars
                      ? 'fill-amber-400 text-amber-500 drop-shadow animate-bounce'
                      : 'text-[#E5D3BC]'
                  }
                />
              ))}
            </div>

            <div className="bg-[#FAF3E7] border-2 border-[#D4A373] rounded-2xl p-3 grid grid-cols-2 gap-2.5 text-xs font-extrabold text-[#5C3A21]">
              <div>
                <span className="block text-[10px] text-[#9A6B42]">SCORE</span>
                <span className="text-base font-black">{results.score}</span>
              </div>
              <div>
                <span className="block text-[10px] text-[#9A6B42]">
                  SEEDS EARNED
                </span>
                <span className="text-base font-black text-amber-600">
                  🪙 +{results.goldenSeedsEarned}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-[#9A6B42]">POPPED</span>
                <span className="text-base font-black">
                  {results.totalPopped}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-[#9A6B42]">
                  {results.mode === 'KID' ? 'FRUITS FOUND' : 'MAX COMBO'}
                </span>
                <span className="text-base font-black">
                  {results.mode === 'KID'
                    ? `${results.discoveredCount} types`
                    : `${getComboMultiplier(results.maxCombo)}x (${results.maxCombo})`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startRun(mode, kidEndless)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-base shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <RotateCw size={18} /> Play Again
              </button>

              <button
                type="button"
                onClick={returnToLobby}
                className="w-full py-2.5 rounded-2xl bg-[#8C5832] text-white font-extrabold text-sm cursor-pointer"
              >
                Mode Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FruitPopSplash;
