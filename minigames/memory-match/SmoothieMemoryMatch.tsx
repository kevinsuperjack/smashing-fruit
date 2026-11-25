import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { FRUIT_TIERS, KID_FRUIT_LABELS } from '../../constants';
import { FruitBadgeIcon } from '../../components/FruitBadgeIcon';
import { SnowfallOverlay } from '../../components/SnowfallOverlay';
import { APP_THEMES } from '../../utils/theme';
import { gameAudio, kidVoice } from '../../utils/helper';
import {
  ArcadeMode,
  MemoryMatchGridId,
  MemoryMatchSaveData,
  addGoldenSeeds,
  getGoldenSeeds,
  getMemoryMatchTotalStars,
  loadMemoryMatchSave,
  persistMemoryMatchSave,
  recordMemoryMatchWin,
} from '../arcadeStorage';
import type {
  MemoryCard,
  MemoryMatchRoundState,
  MemoryMatchScreen,
  MemoryMatchSummary,
  SmoothieMemoryMatchProps,
} from './types';
import {
  KID_HINT_IDLE_MS,
  MISMATCH_REVEAL_MS,
  SMOOTHIE_BLEND_BONUS_SEEDS,
  SMOOTHIE_STREAK_TARGET,
  buildRoundSummary,
  clearMismatch,
  createRoundState,
  findHintPair,
  flipCard,
  getAvailableGridsForMode,
  getDefaultGridForMode,
  getGridPreset,
} from './logic';

export type { SmoothieMemoryMatchProps } from './types';

const MEMORY_MATCH_CSS = `
.jmm-card-slot {
  position: relative;
  perspective: 960px;
  -webkit-perspective: 960px;
  touch-action: manipulation;
}

.jmm-card-button {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
  perspective: 960px;
}

.jmm-card-button:focus-visible .jmm-card-face {
  box-shadow: 0 0 0 3px #F59E0B, 0 0 0 6px rgba(255, 255, 255, 0.85);
}

.jmm-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  transition: transform 0.52s cubic-bezier(0.34, 1.45, 0.64, 1);
  will-change: transform;
}

.jmm-card-inner.is-flipped {
  transform: rotateY(180deg);
}

.jmm-card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  user-select: none;
}

/* Back face (visible at 0deg) */
.jmm-card-back {
  transform: rotateY(0deg) translateZ(1px);
  transition: filter 0.16s ease, transform 0.16s ease;
}

.jmm-card-button:not(:disabled):hover .jmm-card-back {
  filter: brightness(1.05);
}

.jmm-card-button:not(:disabled):active .jmm-card-inner:not(.is-flipped) {
  transform: scale(0.95);
}

/* Front face (revealed at 180deg) */
.jmm-card-front {
  transform: rotateY(180deg) translateZ(1px);
}

/* Orchard Wood-Grain Card Back */
.jmm-back-orchard {
  background-color: #C89666;
  background-image:
    repeating-linear-gradient(
      14deg,
      rgba(140, 88, 50, 0.16) 0px,
      rgba(140, 88, 50, 0.16) 3px,
      rgba(232, 202, 170, 0.14) 3px,
      rgba(232, 202, 170, 0.14) 8px,
      transparent 8px,
      transparent 15px
    ),
    linear-gradient(155deg, #DFB07D 0%, #C89666 52%, #A66E3E 100%);
  border: 3px solid #8C5832;
  box-shadow:
    inset 0 2px 0 rgba(255, 249, 240, 0.45),
    inset 0 -4px 0 rgba(92, 58, 33, 0.45),
    0 4px 0 #724524,
    0 8px 14px rgba(74, 40, 16, 0.22);
}

/* Christmas Holly Gift-Wrap Card Back */
.jmm-back-christmas {
  background-color: #991B1B;
  background-image:
    repeating-linear-gradient(
      -45deg,
      rgba(255, 255, 255, 0.08) 0px,
      rgba(255, 255, 255, 0.08) 6px,
      transparent 6px,
      transparent 14px
    ),
    linear-gradient(155deg, #DC2626 0%, #991B1B 58%, #7F1D1D 100%);
  border: 3px solid #FCD34D;
  box-shadow:
    inset 0 2px 0 rgba(254, 243, 199, 0.55),
    inset 0 -4px 0 rgba(69, 10, 10, 0.55),
    0 4px 0 #78350F,
    0 8px 16px rgba(15, 23, 42, 0.45);
}

.jmm-ribbon-v {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 18%;
  min-width: 8px;
  max-width: 16px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, #F59E0B, #FDE047 50%, #D97706);
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.45);
  pointer-events: none;
}

.jmm-ribbon-h {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 16%;
  min-height: 8px;
  max-height: 14px;
  transform: translateY(-50%);
  background: linear-gradient(180deg, #F59E0B, #FDE047 50%, #D97706);
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.45);
  pointer-events: none;
}

/* Match Pop & Glow (applied to outer slot so rotateY(180deg) stays intact) */
@keyframes jmm-match-pop {
  0% { transform: scale(1); }
  38% { transform: scale(1.09); }
  72% { transform: scale(0.97); }
  100% { transform: scale(1); }
}

.jmm-card-slot.is-matched {
  animation: jmm-match-pop 0.48s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.jmm-card-slot.is-matched .jmm-card-front {
  box-shadow:
    0 0 0 3px rgba(16, 185, 129, 0.65),
    0 0 18px rgba(245, 158, 11, 0.45),
    0 4px 10px rgba(0, 0, 0, 0.14);
}

/* Mismatch Shake */
@keyframes jmm-mismatch-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  20% { transform: translate3d(-6px, 0, 0) rotateZ(-2deg); }
  45% { transform: translate3d(6px, 0, 0) rotateZ(2deg); }
  70% { transform: translate3d(-4px, 0, 0) rotateZ(-1deg); }
  88% { transform: translate3d(3px, 0, 0) rotateZ(1deg); }
}

.jmm-card-slot.is-mismatch {
  animation: jmm-mismatch-shake 0.38s ease-in-out;
}

.jmm-card-slot.is-mismatch .jmm-card-front {
  box-shadow:
    0 0 0 3px rgba(244, 63, 94, 0.7),
    0 0 14px rgba(244, 63, 94, 0.35);
}

/* Kid Mode 8s Idle Sparkle Hint Pulse */
@keyframes jmm-hint-pulse {
  0%, 100% {
    transform: scale(1);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.055);
    filter: brightness(1.12);
  }
}

.jmm-card-slot.is-hinted {
  animation: jmm-hint-pulse 1.25s ease-in-out infinite;
}

.jmm-card-slot.is-hinted .jmm-card-back {
  box-shadow:
    0 0 0 3px #FDE047,
    0 0 20px rgba(251, 191, 36, 0.85),
    0 4px 0 #92400E;
}

@media (prefers-reduced-motion: reduce) {
  .jmm-card-inner {
    transition-duration: 0.01ms !important;
  }
  .jmm-card-slot.is-matched,
  .jmm-card-slot.is-mismatch,
  .jmm-card-slot.is-hinted {
    animation: none !important;
  }
  .jmm-card-slot.is-hinted .jmm-card-back {
    box-shadow: 0 0 0 4px #FDE047, 0 0 12px rgba(251, 191, 36, 0.7);
  }
}
`;

const ChristmasHollyEmblem: React.FC = () => (
  <svg
    viewBox="0 0 48 48"
    className="w-[54%] h-[54%] drop-shadow-sm pointer-events-none"
    aria-hidden="true">
    {/* Left & Right Holly Leaves */}
    <path
      d="M23 26 C16 24, 11 19, 8 13 C14 13, 19 14, 24 20 Z"
      fill="#16A34A"
      stroke="#DCFCE7"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M25 26 C32 24, 37 19, 40 13 C34 13, 29 14, 24 20 Z"
      fill="#15803D"
      stroke="#DCFCE7"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M23 27 C17 31, 12 33, 9 37 C15 38, 20 35, 24 30 Z"
      fill="#15803D"
      stroke="#DCFCE7"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
    <path
      d="M25 27 C31 31, 36 33, 39 37 C33 38, 28 35, 24 30 Z"
      fill="#16A34A"
      stroke="#DCFCE7"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
    {/* Gold Ribbon Bow Knot */}
    <circle
      cx="24"
      cy="24"
      r="6.2"
      fill="#FDE047"
      stroke="#B45309"
      strokeWidth="1.4"
    />
    {/* Three Ruby Berries */}
    <circle cx="21" cy="21" r="3.4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1" />
    <circle cx="27" cy="21" r="3.4" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1" />
    <circle cx="24" cy="26.5" r="3.6" fill="#DC2626" stroke="#7F1D1D" strokeWidth="1" />
    <circle cx="19.9" cy="19.9" r="1" fill="#FFFFFF" opacity="0.85" />
    <circle cx="25.9" cy="19.9" r="1" fill="#FFFFFF" opacity="0.85" />
    <circle cx="22.8" cy="25.3" r="1.1" fill="#FFFFFF" opacity="0.85" />
  </svg>
);

const OrchardMedallionEmblem: React.FC = () => (
  <svg
    viewBox="0 0 48 48"
    className="w-[52%] h-[52%] pointer-events-none"
    aria-hidden="true">
    <circle
      cx="24"
      cy="24"
      r="19"
      fill="rgba(255, 249, 240, 0.25)"
      stroke="rgba(255, 249, 240, 0.65)"
      strokeWidth="2.2"
    />
    <path
      d="M24 12 C29 12, 34 16, 34 22 C34 29, 28 35, 24 36 C20 35, 14 29, 14 22 C14 16, 19 12, 24 12 Z"
      fill="#FDE68A"
      stroke="#7C2D12"
      strokeWidth="1.6"
    />
    <path
      d="M24 12 C25 8, 29 7, 31 9 C29 12, 26 13, 24 12 Z"
      fill="#65A30D"
      stroke="#365314"
      strokeWidth="1.2"
    />
    <circle cx="20.5" cy="21" r="2.2" fill="#FFFFFF" opacity="0.7" />
  </svg>
);

export const SmoothieMemoryMatch: React.FC<SmoothieMemoryMatchProps> = ({
  sfxMuted,
  musicMuted,
  kidVoiceEnabled,
  theme,
  onToggleSfx,
  onToggleMusic,
  onExitToHub,
  backHandlerRef,
}) => {
  const initialSave = useMemo(() => loadMemoryMatchSave(), []);
  const [save, setSave] = useState<MemoryMatchSaveData>(initialSave);
  const [goldenSeeds, setGoldenSeeds] = useState<number>(() => getGoldenSeeds());
  const [mode, setMode] = useState<ArcadeMode>(initialSave.preferredMode);
  const [selectedGridId, setSelectedGridId] = useState<MemoryMatchGridId>(() =>
    getDefaultGridForMode(initialSave.preferredMode),
  );
  const [screen, setScreen] = useState<MemoryMatchScreen>('LOBBY');
  const [roundState, setRoundState] = useState<MemoryMatchRoundState | null>(
    null,
  );
  const [roundEpoch, setRoundEpoch] = useState<number>(0);
  const [hintedCardIds, setHintedCardIds] = useState<string[]>([]);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [summary, setSummary] = useState<MemoryMatchSummary | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [runBlendSeeds, setRunBlendSeeds] = useState<number>(0);

  // Stage container measurement for zero-overflow card sizing
  const stageRef = useRef<HTMLElement | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>(
    () => ({
      width: typeof window !== 'undefined' ? Math.min(640, window.innerWidth) : 360,
      height:
        typeof window !== 'undefined' ? Math.max(260, window.innerHeight - 130) : 480,
    }),
  );

  // Synchronous ref mirrors for stale-closure safety
  const viewRef = useRef<MemoryMatchScreen>(screen);
  viewRef.current = screen;
  const modeRef = useRef<ArcadeMode>(mode);
  modeRef.current = mode;
  const gridIdRef = useRef<MemoryMatchGridId>(selectedGridId);
  gridIdRef.current = selectedGridId;
  const roundStateRef = useRef<MemoryMatchRoundState | null>(roundState);
  roundStateRef.current = roundState;
  const kidVoiceEnabledRef = useRef<boolean>(kidVoiceEnabled);
  kidVoiceEnabledRef.current = kidVoiceEnabled;
  const sfxMutedRef = useRef<boolean>(sfxMuted);
  sfxMutedRef.current = sfxMuted;
  const saveRef = useRef<MemoryMatchSaveData>(save);
  saveRef.current = save;

  const roundCompletedRef = useRef<boolean>(false);
  const winRecordedRef = useRef<boolean>(false);
  const creditedBlendSeedsRef = useRef<number>(0);
  const pendingMismatchIdsRef = useRef<[string, string] | null>(null);

  // 4 explicit timeout refs (zero setInterval)
  const mismatchTimerRef = useRef<number | null>(null);
  const idleHintTimerRef = useRef<number | null>(null);
  const blenderBannerTimerRef = useRef<number | null>(null);
  const victoryDelayTimerRef = useRef<number | null>(null);

  // Stopwatch refs
  const activePlayMsRef = useRef<number>(0);
  const playSegmentStartRef = useRef<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (mismatchTimerRef.current !== null) {
      window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = null;
    }
    if (idleHintTimerRef.current !== null) {
      window.clearTimeout(idleHintTimerRef.current);
      idleHintTimerRef.current = null;
    }
    if (blenderBannerTimerRef.current !== null) {
      window.clearTimeout(blenderBannerTimerRef.current);
      blenderBannerTimerRef.current = null;
    }
    if (victoryDelayTimerRef.current !== null) {
      window.clearTimeout(victoryDelayTimerRef.current);
      victoryDelayTimerRef.current = null;
    }
  }, []);

  const showBanner = useCallback((text: string) => {
    if (blenderBannerTimerRef.current !== null) {
      window.clearTimeout(blenderBannerTimerRef.current);
      blenderBannerTimerRef.current = null;
    }
    setBannerText(text);
    blenderBannerTimerRef.current = window.setTimeout(() => {
      blenderBannerTimerRef.current = null;
      setBannerText(null);
    }, 1600);
  }, []);

  const scheduleIdleHint = useCallback(() => {
    if (idleHintTimerRef.current !== null) {
      window.clearTimeout(idleHintTimerRef.current);
      idleHintTimerRef.current = null;
    }
    if (
      viewRef.current !== 'PLAYING' ||
      modeRef.current !== 'KID' ||
      roundCompletedRef.current ||
      pendingMismatchIdsRef.current !== null
    ) {
      return;
    }

    idleHintTimerRef.current = window.setTimeout(() => {
      idleHintTimerRef.current = null;
      if (
        viewRef.current !== 'PLAYING' ||
        modeRef.current !== 'KID' ||
        roundCompletedRef.current ||
        pendingMismatchIdsRef.current !== null
      ) {
        return;
      }
      const current = roundStateRef.current;
      if (!current) return;
      const hint = findHintPair(current.cards, current.flippedIds);
      if (hint) {
        setHintedCardIds(hint);
        gameAudio.playHoverMicroTone();
        showBanner('✨ Sparkle Hint!');
        if (kidVoiceEnabledRef.current && !sfxMutedRef.current) {
          kidVoice.speakPriority('Look for the sparkles!');
        }
      }
    }, KID_HINT_IDLE_MS);
  }, [showBanner]);

  const resolvePendingMismatch = useCallback(() => {
    if (mismatchTimerRef.current !== null) {
      window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = null;
    }
    pendingMismatchIdsRef.current = null;
    const current = roundStateRef.current;
    if (current) {
      const next = clearMismatch(current);
      roundStateRef.current = next;
      setRoundState(next);
    }
    if (
      viewRef.current === 'PLAYING' &&
      modeRef.current === 'KID' &&
      !roundCompletedRef.current
    ) {
      scheduleIdleHint();
    }
  }, [scheduleIdleHint]);

  const startRound = useCallback(
    (gridId: MemoryMatchGridId, nextMode?: ArcadeMode) => {
      const activeMode = nextMode ?? modeRef.current;
      clearAllTimers();
      kidVoice.cancel();

      pendingMismatchIdsRef.current = null;
      roundCompletedRef.current = false;
      winRecordedRef.current = false;
      creditedBlendSeedsRef.current = 0;

      const freshRound = createRoundState(gridId, activeMode);
      gridIdRef.current = gridId;
      modeRef.current = activeMode;
      roundStateRef.current = freshRound;

      setSelectedGridId(gridId);
      setRoundEpoch((prev) => prev + 1);
      setRoundState(freshRound);
      setHintedCardIds([]);
      setBannerText(null);
      setSummary(null);
      setElapsedSec(0);
      setRunBlendSeeds(0);

      activePlayMsRef.current = 0;
      playSegmentStartRef.current = performance.now();

      viewRef.current = 'PLAYING';
      setScreen('PLAYING');
      gameAudio.playConfirmSelect();

      if (activeMode === 'KID') {
        scheduleIdleHint();
      }
    },
    [clearAllTimers, scheduleIdleHint],
  );

  const pauseGame = useCallback(() => {
    if (viewRef.current !== 'PLAYING' || roundCompletedRef.current) return;
    if (playSegmentStartRef.current !== null) {
      activePlayMsRef.current += Math.max(
        0,
        performance.now() - playSegmentStartRef.current,
      );
      playSegmentStartRef.current = null;
    }
    if (mismatchTimerRef.current !== null) {
      window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = null;
    }
    if (idleHintTimerRef.current !== null) {
      window.clearTimeout(idleHintTimerRef.current);
      idleHintTimerRef.current = null;
    }
    kidVoice.cancel();
    viewRef.current = 'PAUSED';
    setScreen('PAUSED');
  }, []);

  const resumeGame = useCallback(() => {
    if (viewRef.current !== 'PAUSED') return;
    gameAudio.playConfirmSelect();
    playSegmentStartRef.current = performance.now();
    viewRef.current = 'PLAYING';
    setScreen('PLAYING');

    if (pendingMismatchIdsRef.current !== null) {
      mismatchTimerRef.current = window.setTimeout(
        resolvePendingMismatch,
        350,
      );
    } else if (modeRef.current === 'KID' && !roundCompletedRef.current) {
      scheduleIdleHint();
    }
  }, [resolvePendingMismatch, scheduleIdleHint]);

  const returnToLobby = useCallback(() => {
    clearAllTimers();
    kidVoice.cancel();
    pendingMismatchIdsRef.current = null;
    roundCompletedRef.current = false;
    winRecordedRef.current = false;
    playSegmentStartRef.current = null;
    activePlayMsRef.current = 0;

    setHintedCardIds([]);
    setBannerText(null);
    setGoldenSeeds(getGoldenSeeds());
    setSave(loadMemoryMatchSave());

    viewRef.current = 'LOBBY';
    setScreen('LOBBY');
    gameAudio.playConfirmSelect();
  }, [clearAllTimers]);

  const handleSelectMode = useCallback((nextMode: ArcadeMode) => {
    if (nextMode === modeRef.current) return;
    gameAudio.playConfirmSelect();
    modeRef.current = nextMode;
    setMode(nextMode);

    const available = getAvailableGridsForMode(nextMode);
    if (!available.includes(gridIdRef.current)) {
      const fallbackGrid = getDefaultGridForMode(nextMode);
      gridIdRef.current = fallbackGrid;
      setSelectedGridId(fallbackGrid);
    }

    const updatedSave: MemoryMatchSaveData = {
      ...saveRef.current,
      preferredMode: nextMode,
    };
    saveRef.current = updatedSave;
    setSave(updatedSave);
    persistMemoryMatchSave(updatedSave);
  }, []);

  const handleRoundVictory = useCallback(
    (finalState: MemoryMatchRoundState) => {
      if (winRecordedRef.current) return;
      winRecordedRef.current = true;
      roundCompletedRef.current = true;

      if (idleHintTimerRef.current !== null) {
        window.clearTimeout(idleHintTimerRef.current);
        idleHintTimerRef.current = null;
      }
      if (mismatchTimerRef.current !== null) {
        window.clearTimeout(mismatchTimerRef.current);
        mismatchTimerRef.current = null;
      }
      pendingMismatchIdsRef.current = null;

      if (playSegmentStartRef.current !== null) {
        activePlayMsRef.current += Math.max(
          0,
          performance.now() - playSegmentStartRef.current,
        );
        playSegmentStartRef.current = null;
      }
      setElapsedSec(activePlayMsRef.current / 1000);

      const roundSummary = buildRoundSummary(finalState);
      // Credit only completionSeeds here; blenderBonusSeeds were credited live on each 3-streak trigger
      const nextWallet = addGoldenSeeds(roundSummary.payout.completionSeeds);
      const nextSave = recordMemoryMatchWin({
        gridId: roundSummary.gridId,
        stars: roundSummary.stars,
        moves: roundSummary.moves,
        smoothiesBlended: roundSummary.smoothiesBlended,
        mode: roundSummary.mode,
      });

      saveRef.current = nextSave;
      setSave(nextSave);
      setGoldenSeeds(nextWallet);
      setSummary(roundSummary);

      gameAudio.playVictoryFanfare();
      if (
        modeRef.current === 'KID' &&
        kidVoiceEnabledRef.current &&
        !sfxMutedRef.current
      ) {
        kidVoice.speakPriority('Yay! You matched them all! Smoothie party!');
      }

      victoryDelayTimerRef.current = window.setTimeout(() => {
        victoryDelayTimerRef.current = null;
        viewRef.current = 'RESULTS';
        setScreen('RESULTS');
      }, 650);
    },
    [],
  );

  const handleCardTap = useCallback(
    (cardId: string) => {
      if (
        viewRef.current !== 'PLAYING' ||
        roundCompletedRef.current ||
        pendingMismatchIdsRef.current !== null
      ) {
        return;
      }
      const current = roundStateRef.current;
      if (!current) return;

      const result = flipCard(current, cardId);
      if (result.status === 'IGNORED') return;

      roundStateRef.current = result.state;
      setRoundState(result.state);
      setHintedCardIds([]);
      if (idleHintTimerRef.current !== null) {
        window.clearTimeout(idleHintTimerRef.current);
        idleHintTimerRef.current = null;
      }

      gameAudio.playCrispClick();

      const flippedTier = result.flippedCard?.tier;
      const kidLabel =
        flippedTier !== undefined ? KID_FRUIT_LABELS[flippedTier] : undefined;

      if (result.status === 'FIRST_CARD') {
        if (
          modeRef.current === 'KID' &&
          kidVoiceEnabledRef.current &&
          !sfxMutedRef.current &&
          result.flippedCard
        ) {
          kidVoice.speakPriority(
            kidLabel?.spokenPhrase ?? result.flippedCard.fruit.name,
          );
        }
        if (modeRef.current === 'KID') {
          scheduleIdleHint();
        }
        return;
      }

      if (result.status === 'MATCH') {
        if (result.smoothieTriggered) {
          gameAudio.playPowerupChime();
          if (modeRef.current === 'ARCADE') {
            gameAudio.playCoinPickup();
          }
          const nextWallet = addGoldenSeeds(result.bonusSeedsEarned);
          setGoldenSeeds(nextWallet);
          creditedBlendSeedsRef.current += result.bonusSeedsEarned;
          setRunBlendSeeds(creditedBlendSeedsRef.current);
          showBanner(`🍓 Smoothie Blend! +${result.bonusSeedsEarned} 🪙`);

          if (
            modeRef.current === 'KID' &&
            kidVoiceEnabledRef.current &&
            !sfxMutedRef.current
          ) {
            kidVoice.speakPriority('Smoothie time! Yummy!');
          }
        } else {
          gameAudio.playComboChime(result.state.streak);
          if (
            modeRef.current === 'KID' &&
            kidVoiceEnabledRef.current &&
            !sfxMutedRef.current &&
            result.flippedCard
          ) {
            const matchName = kidLabel?.name ?? result.flippedCard.fruit.name;
            kidVoice.speakPriority(`Yay! ${matchName} match!`);
          }
        }

        if (result.isRoundComplete) {
          handleRoundVictory(result.state);
        } else if (modeRef.current === 'KID') {
          scheduleIdleHint();
        }
        return;
      }

      // MISMATCH
      pendingMismatchIdsRef.current = [
        result.state.flippedIds[0],
        result.state.flippedIds[1],
      ];

      if (modeRef.current === 'KID') {
        gameAudio.playSoftBounce(0.55, 4);
        if (
          kidVoiceEnabledRef.current &&
          !sfxMutedRef.current &&
          result.flippedCard
        ) {
          kidVoice.speakPriority(
            kidLabel?.spokenPhrase ?? result.flippedCard.fruit.name,
          );
        }
      } else {
        gameAudio.playTone({
          type: 'sine',
          freq: 320,
          freqTo: 210,
          dur: 0.14,
          gain: 0.06,
        });
      }

      const delay = modeRef.current === 'KID' ? 950 : MISMATCH_REVEAL_MS;
      mismatchTimerRef.current = window.setTimeout(
        resolvePendingMismatch,
        delay,
      );
    },
    [
      handleRoundVictory,
      resolvePendingMismatch,
      scheduleIdleHint,
      showBanner,
    ],
  );

  // Android Hardware Back / Escape via App.tsx backHandlerRef (no duplicate Escape listener)
  useEffect(() => {
    if (!backHandlerRef) return;
    const handleBack = () => {
      const current = viewRef.current;
      if (current === 'PLAYING') {
        if (roundCompletedRef.current) {
          if (victoryDelayTimerRef.current !== null) {
            window.clearTimeout(victoryDelayTimerRef.current);
            victoryDelayTimerRef.current = null;
          }
          viewRef.current = 'RESULTS';
          setScreen('RESULTS');
          return;
        }
        pauseGame();
      } else if (current === 'PAUSED') {
        resumeGame();
      } else if (current === 'RESULTS') {
        returnToLobby();
      } else {
        kidVoice.cancel();
        onExitToHub();
      }
    };
    backHandlerRef.current = handleBack;
    return () => {
      if (backHandlerRef.current === handleBack) {
        backHandlerRef.current = null;
      }
    };
  }, [backHandlerRef, onExitToHub, pauseGame, resumeGame, returnToLobby]);

  // Auto-pause on document visibility hidden or window blur
  useEffect(() => {
    const onAutoPause = () => {
      if (viewRef.current === 'PLAYING' && !roundCompletedRef.current) {
        pauseGame();
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        onAutoPause();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onAutoPause);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onAutoPause);
    };
  }, [pauseGame]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      clearAllTimers();
      kidVoice.cancel();
    };
  }, [clearAllTimers]);

  // Observe playfield stage dimensions for responsive zero-scroll grids
  useEffect(() => {
    if (screen === 'LOBBY') return;
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      const styles = window.getComputedStyle(el);
      const padX =
        (Number.parseFloat(styles.paddingLeft) || 0) +
        (Number.parseFloat(styles.paddingRight) || 0);
      const padY =
        (Number.parseFloat(styles.paddingTop) || 0) +
        (Number.parseFloat(styles.paddingBottom) || 0);
      const width = el.clientWidth - padX;
      const height = el.clientHeight - padY;
      if (width > 0 && height > 0) {
        setStageSize({ width, height });
      }
    };
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setStageSize({ width, height });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [screen]);

  const palette = APP_THEMES[theme];
  const isChristmas = theme === 'CHRISTMAS';
  const availableGrids = getAvailableGridsForMode(mode);
  const totalStars = getMemoryMatchTotalStars(save);

  // =========================================================================
  // LOBBY VIEW (Mode Switcher + Grid Selector + Shared Golden Seeds)
  // =========================================================================
  if (screen === 'LOBBY') {
    return (
      <div
        className={`fixed inset-0 z-40 flex flex-col select-none overflow-hidden ${palette.hubBgClass} ${palette.hubTextClass}`}>
        <style href="juicy-memory-match" precedence="default">
          {MEMORY_MATCH_CSS}
        </style>
        <SnowfallOverlay active={isChristmas} density="light" contained />

        {/* Header */}
        <header className="relative z-10 w-full max-w-2xl mx-auto px-3 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              gameAudio.playConfirmSelect();
              kidVoice.cancel();
              onExitToHub();
            }}
            className={`px-3 py-2 rounded-2xl border-2 font-extrabold text-xs md:text-sm shadow-sm flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
              isChristmas
                ? 'bg-emerald-950/90 hover:bg-emerald-900 border-amber-300/80 text-amber-100'
                : 'bg-[#FFF9F0] hover:bg-[#F3E3CF] border-[#C89666] text-[#5C3A21]'
            }`}>
            <ArrowLeft size={16} />
            <span>Hub</span>
          </button>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xs ${palette.hubHeaderBadgeClass}`}>
            <span className="text-lg leading-none">🥤</span>
            <h1 className="text-sm md:text-base font-black">
              Smoothie Memory
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <div
              className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black flex items-center gap-1 ${
                isChristmas
                  ? 'bg-emerald-950/90 border-amber-300/80 text-amber-200'
                  : 'bg-[#FFF9F0] border-[#D4A373] text-[#8C5832]'
              }`}>
              <span>🪙</span>
              <span>{goldenSeeds}</span>
            </div>
            <button
              type="button"
              onClick={onToggleSfx}
              aria-label="Toggle SFX"
              className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center cursor-pointer active:scale-95 ${
                isChristmas
                  ? 'bg-emerald-950/90 hover:bg-emerald-900 border-amber-300/80 text-amber-100'
                  : 'bg-[#FFF9F0] hover:bg-[#F3E3CF] border-[#D4A373] text-[#5C3A21]'
              }`}>
              {sfxMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </header>

        {/* Scrollable Lobby Content */}
        <main className="relative z-10 flex-1 overflow-y-auto px-3 pb-8 pt-1 touch-auto">
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {/* Mode Switcher */}
            <section
              className={`rounded-3xl p-3 border-2 ${
                isChristmas
                  ? 'bg-slate-900/75 border-amber-300/50 text-amber-50 backdrop-blur-xs shadow-lg'
                  : 'bg-[#FFF9F0] border-[#D4A373] text-[#5C3A21] shadow-sm'
              }`}>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectMode('KID')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                    mode === 'KID'
                      ? 'bg-gradient-to-br from-sky-500 to-indigo-500 border-sky-200 text-white shadow-md'
                      : isChristmas
                      ? 'bg-emerald-950/70 border-emerald-700/80 text-amber-100 hover:bg-emerald-900/80'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                  }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-black text-sm">🧸 Kid Mode</span>
                    {mode === 'KID' && <Check size={16} />}
                  </div>
                  <p
                    className={`text-[11px] font-semibold leading-tight ${
                      mode === 'KID'
                        ? 'text-sky-50'
                        : isChristmas
                        ? 'text-emerald-200'
                        : 'text-[#8C5832]'
                    }`}>
                    3×2 &amp; 4×3 boards, 8s sparkle hints &amp; spoken fruit names!
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectMode('ARCADE')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                    mode === 'ARCADE'
                      ? isChristmas
                        ? 'bg-gradient-to-br from-red-600 to-amber-600 border-amber-200 text-white shadow-md'
                        : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 border-violet-200 text-white shadow-md'
                      : isChristmas
                      ? 'bg-emerald-950/70 border-emerald-700/80 text-amber-100 hover:bg-emerald-900/80'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                  }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-black text-sm">⚡ Arcade</span>
                    {mode === 'ARCADE' && <Check size={16} />}
                  </div>
                  <p
                    className={`text-[11px] font-semibold leading-tight ${
                      mode === 'ARCADE'
                        ? 'text-amber-50'
                        : isChristmas
                        ? 'text-emerald-200'
                        : 'text-[#8C5832]'
                    }`}>
                    Smoothie Blender 3-streak (+5 🪙) &amp; 1–3 star efficiency!
                  </p>
                </button>
              </div>
            </section>

            {/* Board Size Selector */}
            <section
              className={`rounded-3xl p-3 border-2 ${
                isChristmas
                  ? 'bg-slate-900/75 border-amber-300/50 text-amber-50 backdrop-blur-xs shadow-lg'
                  : 'bg-[#FFF9F0] border-[#D4A373] text-[#5C3A21] shadow-sm'
              }`}>
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h2 className="text-xs md:text-sm font-black flex items-center gap-1.5">
                  <Sparkles size={15} className="text-amber-500" />
                  <span>
                    {mode === 'KID' ? 'Pick a Fruit Board' : 'Arcade Boards'}
                  </span>
                </h2>
                <span className="text-xs font-extrabold text-amber-500 flex items-center gap-1">
                  <Star size={13} className="fill-amber-400 text-amber-500" />
                  <span>{totalStars} / 12</span>
                </span>
              </div>

              <div
                className={`grid gap-2.5 ${
                  availableGrids.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-3'
                }`}>
                {availableGrids.map((gId) => {
                  const preset = getGridPreset(gId);
                  const bestStars = save.bestStarsByGrid[gId] ?? 0;
                  const bestMoves = save.bestMovesByGrid[gId];
                  const isSelected = selectedGridId === gId;

                  return (
                    <button
                      key={gId}
                      type="button"
                      onClick={() => startRound(gId, mode)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between min-h-[108px] cursor-pointer active:scale-97 ${
                        isChristmas
                          ? isSelected
                            ? 'bg-gradient-to-br from-emerald-800/95 to-teal-900/95 border-amber-300 text-amber-50 shadow-md'
                            : 'bg-emerald-950/75 border-emerald-700/80 text-amber-100 hover:bg-emerald-900/85'
                          : isSelected
                          ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-amber-500 text-[#4A2810] shadow-md'
                          : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isChristmas
                                ? 'bg-amber-400/20 text-amber-200'
                                : 'bg-[#EAD8C0] text-[#7A502E]'
                            }`}>
                            {preset.totalCards} Cards • {preset.totalPairs} Pairs
                          </span>
                          <div className="text-base md:text-lg font-black leading-tight mt-1.5">
                            {mode === 'KID'
                              ? preset.kidLabel
                              : preset.arcadeLabel}
                          </div>
                        </div>
                        <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow-xs shrink-0">
                          PLAY ▶
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-current/10">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              className={
                                s <= bestStars
                                  ? 'fill-amber-400 text-amber-500'
                                  : isChristmas
                                  ? 'text-white/25'
                                  : 'text-[#CBB091]'
                              }
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-extrabold opacity-85">
                          {bestMoves !== undefined
                            ? `Best: ${bestMoves} moves`
                            : `Up to +${preset.baseCompletionSeeds + 12} 🪙`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Smoothie Blender & Orchard Stats Strip */}
            <section
              className={`rounded-3xl p-3.5 border-2 flex flex-wrap items-center justify-between gap-3 ${
                isChristmas
                  ? 'bg-slate-900/75 border-amber-300/50 text-amber-50 backdrop-blur-xs shadow-lg'
                  : 'bg-[#FFF9F0] border-[#D4A373] text-[#5C3A21] shadow-sm'
              }`}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl ${
                    isChristmas ? 'bg-emerald-900/90' : 'bg-amber-100'
                  }`}>
                  🍓
                </div>
                <div>
                  <div className="text-xs font-black">Smoothie Blender</div>
                  <div className="text-[11px] font-semibold opacity-80">
                    3 matches in a row = +{SMOOTHIE_BLEND_BONUS_SEEDS} Golden Seeds!
                  </div>
                </div>
              </div>
              <div
                className={`px-3 py-1.5 rounded-xl text-xs font-black ${
                  isChristmas
                    ? 'bg-emerald-950/90 border border-amber-300/60 text-amber-200'
                    : 'bg-[#FAF3E7] border border-[#D4A373] text-[#8C5832]'
                }`}>
                Blended: {save.totalSmoothiesBlended} 🥤
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // IN-GAME BOARD + HUD + PAUSE / RESULTS MODALS
  // =========================================================================
  const activeRound = roundState;
  const activePreset = getGridPreset(activeRound?.gridId ?? selectedGridId);
  const innerW = Math.max(220, stageSize.width - 16);
  const innerH = Math.max(200, stageSize.height - 12);
  const gap = activePreset.cols >= 5 || innerW < 400 ? 6 : 10;
  const maxCardW =
    (innerW - gap * (activePreset.cols - 1)) / activePreset.cols;
  const maxCardH =
    (innerH - gap * (activePreset.rows - 1)) / activePreset.rows;
  const cardW = Math.max(
    48,
    Math.floor(Math.min(maxCardW, maxCardH / 1.12, activePreset.maxCardCap)),
  );
  const cardH = Math.floor(cardW * 1.12);
  const iconSize = Math.max(28, Math.min(72, Math.round(cardW * 0.56)));

  const blenderProgress = activeRound?.blenderProgress ?? 0;
  const openMismatchSet = new Set(pendingMismatchIdsRef.current ?? []);
  const hintSet = new Set(hintedCardIds);

  const nextGridForMode = (() => {
    const idx = availableGrids.indexOf(activePreset.id);
    if (idx >= 0 && idx + 1 < availableGrids.length) {
      return availableGrids[idx + 1];
    }
    return null;
  })();

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col select-none overflow-hidden ${palette.hubBgClass} ${palette.hubTextClass}`}>
      <style href="juicy-memory-match" precedence="default">
        {MEMORY_MATCH_CSS}
      </style>
      <SnowfallOverlay active={isChristmas} density="light" contained />

      {/* Top In-Game HUD */}
      <header className="relative z-10 w-full max-w-2xl mx-auto px-1.5 sm:px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-1 sm:gap-2 shrink-0">
        {/* Moves & Pairs */}
        <div
          className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl border-2 text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            isChristmas
              ? 'bg-emerald-950/90 border-amber-300/75 text-amber-100'
              : 'bg-[#FFF9F0] border-[#D4A373] text-[#5C3A21]'
          }`}>
          <span>
            <span className="hidden sm:inline">Moves </span>
            <span className="sm:hidden">M </span>
            {activeRound?.moves ?? 0}
          </span>
          <span className="opacity-45">•</span>
          <span>
            {activeRound?.matchedPairs ?? 0}/{activeRound?.totalPairs ?? 0}
          </span>
        </div>

        {/* Center: Smoothie Blender Meter (Arcade) or Kid Mode Badge + Blender Dots */}
        <div
          className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-2xl border-2 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
            isChristmas
              ? 'bg-slate-900/85 border-amber-300/70 text-amber-100'
              : 'bg-[#FFF9F0] border-[#D4A373] text-[#5C3A21]'
          }`}>
          <span className="text-sm leading-none" aria-hidden="true">
            {mode === 'KID' ? '🧸' : '🥤'}
          </span>
          <div className="flex items-center gap-0.5 sm:gap-1" aria-label={`Smoothie Blender ${blenderProgress} of ${SMOOTHIE_STREAK_TARGET}`}>
            {Array.from({ length: SMOOTHIE_STREAK_TARGET }, (_, idx) => {
              const filled = idx < blenderProgress;
              const readyGlow =
                blenderProgress === SMOOTHIE_STREAK_TARGET - 1 && !filled;
              return (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 sm:w-5 rounded-full transition-all duration-200 ${
                    filled
                      ? 'bg-gradient-to-r from-amber-400 to-rose-500 shadow-xs scale-105'
                      : readyGlow
                      ? 'bg-amber-300/50 animate-pulse border border-amber-400'
                      : isChristmas
                      ? 'bg-white/15'
                      : 'bg-[#E5D3BC]'
                  }`}
                />
              );
            })}
          </div>
          {(activeRound?.streak ?? 0) >= 2 && (
            <span className="text-[10px] font-black text-amber-500">
              🔥{activeRound?.streak}
            </span>
          )}
        </div>

        {/* Right: Golden Seeds + Pause */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div
            className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-2xl border-2 text-[11px] sm:text-xs font-black flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${
              isChristmas
                ? 'bg-emerald-950/90 border-amber-300/80 text-amber-200'
                : 'bg-[#FFF9F0] border-[#D4A373] text-[#8C5832]'
            }`}>
            <span>🪙</span>
            <span>+{runBlendSeeds}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              gameAudio.playConfirmSelect();
              pauseGame();
            }}
            aria-label="Pause"
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-2xl border-2 shadow-sm flex items-center justify-center active:scale-95 cursor-pointer whitespace-nowrap shrink-0 ${
              isChristmas
                ? 'bg-emerald-950/90 hover:bg-emerald-900 border-amber-300/80 text-amber-100'
                : 'bg-[#FFF9F0] hover:bg-white border-[#8C5832] text-[#5C3A21]'
            }`}>
            <Pause size={17} />
          </button>
        </div>
      </header>

      {/* Transient Smoothie / Hint Banner */}
      {bannerText && (
        <div className="absolute top-16 inset-x-0 z-25 flex justify-center pointer-events-none px-4">
          <div className="bg-indigo-950/90 text-amber-200 border-2 border-amber-300/80 px-4 py-1.5 rounded-full text-sm font-black shadow-xl animate-bounce">
            {bannerText}
          </div>
        </div>
      )}

      {/* Card Grid Playfield */}
      <main
        ref={stageRef}
        className="relative z-10 flex-1 min-h-0 w-full max-w-2xl mx-auto px-2.5 sm:px-4 pb-2 flex items-center justify-center">
        {activeRound && (
          <div
            key={roundEpoch}
            className="grid mx-auto"
            style={{
              gridTemplateColumns: `repeat(${activePreset.cols}, ${cardW}px)`,
              gridTemplateRows: `repeat(${activePreset.rows}, ${cardH}px)`,
              gap: `${gap}px`,
            }}>
            {activeRound.cards.map((card: MemoryCard) => {
              const tierObj = FRUIT_TIERS[card.tier - 1] ?? card.fruit;
              const displayLabel =
                mode === 'KID'
                  ? (KID_FRUIT_LABELS[tierObj.tier]?.name ?? tierObj.name)
                  : tierObj.name;
              const isMismatch =
                !card.matched && openMismatchSet.has(card.id);
              const isHinted =
                !card.matched && !card.flipped && hintSet.has(card.id);
              const isDisabled =
                screen !== 'PLAYING' ||
                card.matched ||
                card.flipped ||
                roundCompletedRef.current ||
                pendingMismatchIdsRef.current !== null;

              return (
                <div
                  key={card.id}
                  className={`jmm-card-slot ${
                    card.matched ? 'is-matched' : ''
                  } ${isMismatch ? 'is-mismatch' : ''} ${
                    isHinted ? 'is-hinted' : ''
                  }`}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleCardTap(card.id)}
                    aria-label={
                      card.flipped || card.matched
                        ? `${displayLabel}${card.matched ? ' (Matched)' : ''}`
                        : 'Hidden fruit card'
                    }
                    className="jmm-card-button">
                    <div
                      className={`jmm-card-inner ${
                        card.flipped || card.matched ? 'is-flipped' : ''
                      }`}>
                      {/* Card Back */}
                      <div
                        className={`jmm-card-face jmm-card-back ${
                          isChristmas
                            ? 'jmm-back-christmas'
                            : 'jmm-back-orchard'
                        }`}>
                        {isChristmas ? (
                          <>
                            <span className="jmm-ribbon-v" aria-hidden="true" />
                            <span className="jmm-ribbon-h" aria-hidden="true" />
                            <div
                              className="absolute inset-1.5 rounded-xl border border-amber-200/45 pointer-events-none"
                              aria-hidden="true"
                            />
                            <ChristmasHollyEmblem />
                          </>
                        ) : (
                          <>
                            <div
                              className="absolute inset-1.5 rounded-xl border border-[#FFF9F0]/40 pointer-events-none"
                              aria-hidden="true"
                            />
                            <OrchardMedallionEmblem />
                          </>
                        )}
                        {isHinted && (
                          <span
                            className="absolute top-1 right-1.5 text-sm leading-none animate-bounce pointer-events-none"
                            aria-hidden="true">
                            ✨
                          </span>
                        )}
                      </div>

                      {/* Card Front */}
                      <div
                        className="jmm-card-face jmm-card-front border-[3px] px-1"
                        style={{
                          backgroundColor: isChristmas ? '#FFFDF7' : '#FFF9F0',
                          borderColor: card.matched
                            ? isChristmas
                              ? '#34D399'
                              : '#10B981'
                            : isChristmas
                            ? '#F59E0B'
                            : tierObj.color,
                          boxShadow: isChristmas
                            ? 'inset 0 -3px 0 rgba(226, 232, 240, 0.65), 0 4px 12px rgba(15, 23, 42, 0.35)'
                            : 'inset 0 -3px 0 rgba(212, 163, 115, 0.45), 0 4px 10px rgba(74, 40, 16, 0.14)',
                        }}>
                        <FruitBadgeIcon
                          tier={tierObj}
                          assetUrl={
                            tierObj.proceduralOnly
                              ? undefined
                              : `assets/images/${tierObj.assetKey}.png`
                          }
                          size={iconSize}
                        />
                        {cardW >= 78 && (
                          <span className="mt-1 text-[10px] font-black leading-none truncate max-w-full px-1 text-[#4A2810]">
                            {displayLabel}
                          </span>
                        )}
                        {card.matched && (
                          <span
                            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs pointer-events-none"
                            aria-hidden="true">
                            <Check size={10} strokeWidth={3.5} />
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Compact Footer Tip */}
      <footer className="relative z-10 shrink-0 pb-2 px-3 text-center">
        <p className="text-[11px] font-bold opacity-80">
          {mode === 'KID'
            ? '✨ Tap two cards to match! Sparkle hints appear if you wait.'
            : `🥤 Match ${SMOOTHIE_STREAK_TARGET} pairs in a row for a +${SMOOTHIE_BLEND_BONUS_SEEDS} 🪙 Smoothie Blend!`}
        </p>
      </footer>

      {/* PAUSE OVERLAY */}
      {screen === 'PAUSED' && (
        <div className="fixed inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-xs overflow-y-auto max-h-[calc(100dvh-2rem)] border-4 rounded-3xl p-5 shadow-2xl text-center space-y-3 ${
              isChristmas
                ? 'bg-slate-900/95 border-amber-400 text-amber-50'
                : 'bg-[#FFF9F0] border-[#8C5832] text-[#5C3A21]'
            }`}>
            <h2 className="text-2xl font-black">Paused</h2>
            <p className="text-xs font-bold opacity-80">
              {mode === 'KID' ? activePreset.kidLabel : activePreset.arcadeLabel}
            </p>

            <button
              type="button"
              onClick={resumeGame}
              className="w-full py-3 rounded-2xl bg-[#8C5832] hover:bg-[#724524] text-white font-black text-base shadow flex items-center justify-center gap-2 cursor-pointer active:scale-98">
              <Play size={18} /> Resume
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleSfx}
                className={`py-2 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  isChristmas
                    ? 'bg-emerald-950/80 border-amber-300/60 text-amber-100'
                    : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21]'
                }`}>
                {sfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                SFX: {sfxMuted ? 'Off' : 'On'}
              </button>
              <button
                type="button"
                onClick={onToggleMusic}
                className={`py-2 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                  isChristmas
                    ? 'bg-emerald-950/80 border-amber-300/60 text-amber-100'
                    : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21]'
                }`}>
                {musicMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                Music: {musicMuted ? 'Off' : 'On'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => startRound(activePreset.id, mode)}
              className={`w-full py-2.5 rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                isChristmas
                  ? 'bg-emerald-950/80 border-amber-300/60 text-amber-300'
                  : 'bg-[#FAF3E7] border-[#D4A373] text-[#D97706]'
              }`}>
              <RotateCw size={16} /> Restart Board
            </button>

            <button
              type="button"
              onClick={returnToLobby}
              className="w-full py-2.5 rounded-2xl bg-red-100 border-2 border-red-300 text-red-700 font-extrabold text-sm cursor-pointer">
              Board Select
            </button>
          </div>
        </div>
      )}

      {/* RESULTS OVERLAY */}
      {screen === 'RESULTS' && summary && (
        <div className="fixed inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm overflow-y-auto max-h-[calc(100dvh-2rem)] border-4 rounded-3xl p-6 shadow-2xl text-center space-y-4 ${
              isChristmas
                ? 'bg-slate-900/95 border-amber-400 text-amber-50'
                : 'bg-[#FFF9F0] border-amber-500 text-[#5C3A21]'
            }`}>
            <div className="text-4xl">🥤🎉</div>
            <h2 className="text-2xl font-black">
              {summary.mode === 'KID' ? 'Smoothie Party!' : 'Board Cleared!'}
            </h2>

            {/* Stars */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  size={38}
                  className={
                    s <= summary.stars
                      ? 'fill-amber-400 text-amber-500 drop-shadow animate-bounce'
                      : isChristmas
                      ? 'text-white/20'
                      : 'text-[#E5D3BC]'
                  }
                />
              ))}
            </div>

            {/* Stats Grid */}
            <div
              className={`border-2 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs font-extrabold ${
                isChristmas
                  ? 'bg-emerald-950/75 border-amber-300/50 text-amber-100'
                  : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21]'
              }`}>
              <div>
                <span className="block text-[10px] opacity-75">SEEDS EARNED</span>
                <span className="text-base font-black text-amber-500">
                  🪙 +{summary.payout.totalSeeds}
                </span>
              </div>
              <div>
                <span className="block text-[10px] opacity-75">MOVES</span>
                <span className="text-base font-black">{summary.moves}</span>
              </div>
              <div>
                <span className="block text-[10px] opacity-75">SMOOTHIES</span>
                <span className="text-base font-black">
                  {summary.smoothiesBlended} 🥤
                </span>
              </div>
              <div>
                <span className="block text-[10px] opacity-75">TIME</span>
                <span className="text-base font-black">
                  {elapsedSec.toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {nextGridForMode && (
                <button
                  type="button"
                  onClick={() => startRound(nextGridForMode, mode)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-base shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                  <Play size={18} /> Next Board ({getGridPreset(nextGridForMode).label})
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startRound(activePreset.id, mode)}
                  className={`py-2.5 rounded-2xl border-2 font-extrabold text-sm flex items-center justify-center gap-1 cursor-pointer ${
                    isChristmas
                      ? 'bg-emerald-950/80 border-amber-300/60 text-amber-100'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21]'
                  }`}>
                  <RotateCw size={15} /> Play Again
                </button>
                <button
                  type="button"
                  onClick={returnToLobby}
                  className="py-2.5 rounded-2xl bg-[#8C5832] text-white font-extrabold text-sm cursor-pointer">
                  Boards
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmoothieMemoryMatch;
