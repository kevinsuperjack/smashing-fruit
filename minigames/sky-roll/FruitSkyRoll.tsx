import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Heart,
  Lock,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { gameAudio, kidVoice } from '../../utils/helper';
import { getSkyRollLevel, SKY_ROLL_LEVELS } from './levels';
import { PhysicsEvent } from './physics';
import { HudSnapshot, SkyRollEngine } from './SkyRollEngine';
import {
  getStarBonusCoins,
  getTotalStars,
  loadSkyRollSave,
  persistSkyRollSave,
} from './storage';
import {
  FRUIT_SKINS,
  FruitSkinId,
  SKY_THEME_PALETTES,
  SkyRollDifficulty,
  SkyRollSaveData,
} from './types';

export interface FruitSkyRollProps {
  sfxMuted: boolean;
  musicMuted: boolean;
  kidVoiceEnabled: boolean;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onExitToHub: () => void;
  /** Optional ref populated with a back-action handler for Android hardware back / Esc. */
  backHandlerRef?: React.MutableRefObject<(() => void) | null>;
}

type SkyView = 'LOBBY' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER';

interface VictorySummary {
  stars: number;
  coinsFromTrack: number;
  starBonusCoins: number;
  elapsedSec: number;
  unlockedNext: boolean;
}

export const FruitSkyRoll: React.FC<FruitSkyRollProps> = ({
  sfxMuted,
  musicMuted,
  kidVoiceEnabled,
  onToggleSfx,
  onToggleMusic,
  onExitToHub,
  backHandlerRef,
}) => {
  const [save, setSave] = useState<SkyRollSaveData>(() => loadSkyRollSave());
  const [view, setView] = useState<SkyView>('LOBBY');
  const [activeLevelId, setActiveLevelId] = useState<number>(1);
  const [runNonce, setRunNonce] = useState<number>(0);
  const [hud, setHud] = useState<HudSnapshot>({
    progress: 0,
    coinsCollected: 0,
    totalCoins: 0,
    hearts: 3,
    maxHearts: 3,
    elapsedSec: 0,
    isBubbleRescue: false,
    isBoosted: false,
  });
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [victory, setVictory] = useState<VictorySummary | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    ox: number;
    oy: number;
    cx: number;
    cy: number;
  } | null>(null);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SkyRollEngine | null>(null);
  const bannerTimerRef = useRef<number | null>(null);
  const runCoinsBankedRef = useRef<boolean>(false);

  // Isolated multi-touch & keyboard state
  const steerPointerIdRef = useRef<number | null>(null);
  const steerOriginRef = useRef<{ x: number; y: number; time: number }>({
    x: 0,
    y: 0,
    time: 0,
  });
  const touchInputRef = useRef<{ steerX: number; throttle: number }>({
    steerX: 0,
    throttle: 0,
  });
  const keysHeldRef = useRef<Set<string>>(new Set());

  const saveRef = useRef(save);
  saveRef.current = save;
  const viewRef = useRef(view);
  viewRef.current = view;
  const activeLevelIdRef = useRef(activeLevelId);
  activeLevelIdRef.current = activeLevelId;
  const kidVoiceEnabledRef = useRef(kidVoiceEnabled);
  kidVoiceEnabledRef.current = kidVoiceEnabled;

  const difficulty = save.preferredDifficulty;
  const activeLevel = getSkyRollLevel(activeLevelId);

  const updateSave = useCallback(
    (updater: (prev: SkyRollSaveData) => SkyRollSaveData) => {
      setSave((prev) => {
        const next = updater(prev);
        persistSkyRollSave(next);
        return next;
      });
    },
    [],
  );

  const showBanner = useCallback((text: string, durationMs = 1500) => {
    setBannerText(text);
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerText(null);
    }, durationMs);
  }, []);

  /** Banks any collected Golden Seeds from a partial run so kids never lose earned coins. */
  const bankPartialCoinsIfNeeded = useCallback(() => {
    if (runCoinsBankedRef.current) return;
    const collected = engineRef.current?.getCollectedCoinCount() ?? 0;
    runCoinsBankedRef.current = true;
    if (collected > 0) {
      updateSave((prev) => ({ ...prev, coins: prev.coins + collected }));
    }
  }, [updateSave]);

  const syncCombinedInput = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const keys = keysHeldRef.current;
    let kx = 0;
    let kt = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) kx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) kx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) kt += 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) kt -= 1;

    const steerX =
      Math.abs(touchInputRef.current.steerX) > 0.02
        ? touchInputRef.current.steerX
        : kx;
    const throttle =
      Math.abs(touchInputRef.current.throttle) > 0.02
        ? touchInputRef.current.throttle
        : kt;
    engine.setInput(steerX, throttle);
  }, []);

  const startLevel = useCallback((levelId: number) => {
    gameAudio.playConfirmSelect();
    runCoinsBankedRef.current = false;
    setVictory(null);
    setBannerText(null);
    setActiveLevelId(levelId);
    setView('PLAYING');
    setRunNonce((n) => n + 1);
  }, []);

  const returnToLobby = useCallback(() => {
    bankPartialCoinsIfNeeded();
    setView('LOBBY');
    setDragVisual(null);
    steerPointerIdRef.current = null;
    touchInputRef.current = { steerX: 0, throttle: 0 };
  }, [bankPartialCoinsIfNeeded]);

  // Wire unified Back button handler (Android Hardware Back & Escape)
  useEffect(() => {
    if (!backHandlerRef) return;
    backHandlerRef.current = () => {
      const current = viewRef.current;
      if (current === 'PLAYING') {
        engineRef.current?.setPaused(true);
        setView('PAUSED');
      } else if (current === 'PAUSED') {
        engineRef.current?.setPaused(false);
        setView('PLAYING');
      } else if (current === 'VICTORY' || current === 'GAME_OVER') {
        returnToLobby();
      } else {
        onExitToHub();
      }
    };
    return () => {
      backHandlerRef.current = null;
    };
  }, [backHandlerRef, onExitToHub, returnToLobby]);

  // Auto-pause on phone lock / tab switch (visibilitychange & blur)
  useEffect(() => {
    const handleAutoPause = () => {
      if (viewRef.current === 'PLAYING') {
        engineRef.current?.setPaused(true);
        setView('PAUSED');
      }
    };
    const onVisChange = () => {
      if (document.hidden) handleAutoPause();
    };
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', handleAutoPause);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', handleAutoPause);
    };
  }, []);

  // Desktop keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (viewRef.current !== 'PLAYING') return;
      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }
      if (e.code === 'Space' && !e.repeat) {
        engineRef.current?.requestJump();
      }
      keysHeldRef.current.add(e.code);
      syncCombinedInput();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
      syncCombinedInput();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [syncCombinedInput]);

  // Mount & Dispose Three.js SkyRollEngine for active run
  useEffect(() => {
    if (view === 'LOBBY') {
      engineRef.current?.dispose();
      engineRef.current = null;
      return;
    }
    const host = canvasHostRef.current;
    if (!host) return;

    const levelDef = getSkyRollLevel(activeLevelId);
    const currentDiff = saveRef.current.preferredDifficulty;
    const currentSkin = saveRef.current.selectedSkin;

    const handlePhysicsEvent = (ev: PhysicsEvent) => {
      if (ev.type === 'JUMP') {
        gameAudio.playSkyJump();
      } else if (ev.type === 'BOUNCE_PAD') {
        gameAudio.playSkyBouncePad();
        showBanner('✨ BOING!', 900);
      } else if (ev.type === 'BOOST') {
        gameAudio.playPowerupChime();
        showBanner('🚀 SPEED BOOST!', 1100);
      } else if (ev.type === 'COIN') {
        gameAudio.playSkyCoin(ev.streak);
      } else if (ev.type === 'CHECKPOINT') {
        gameAudio.playSkyCheckpoint();
        showBanner('🚩 CHECKPOINT SAVED!', 1500);
        if (currentDiff === 'KID' && kidVoiceEnabledRef.current) {
          kidVoice.speakPriority('Great job! Checkpoint!');
        }
      } else if (ev.type === 'BUBBLE_RESCUE') {
        gameAudio.playSkyBubbleRescue();
        showBanner('🫧 BUBBLE RESCUE!', 1400);
        if (kidVoiceEnabledRef.current) {
          kidVoice.speakPriority('Whoopsie! Bubble float back!');
        }
      } else if (ev.type === 'HEART_LOST') {
        gameAudio.playSkyFall();
        if (ev.heartsRemaining > 0) {
          showBanner(`❤️ ${ev.heartsRemaining} Hearts Left!`, 1300);
        }
      } else if (ev.type === 'BUMP_OBSTACLE') {
        gameAudio.playErrorBuzz();
      } else if (ev.type === 'VICTORY') {
        gameAudio.playSkyVictory();
        const trackCoins = engineRef.current?.getCollectedCoinCount() ?? 0;
        const starBonus = getStarBonusCoins(ev.stars);
        runCoinsBankedRef.current = true;

        let unlockedNext = false;
        updateSave((prev) => {
          const prevStars = prev.starsByLevel[levelDef.id] ?? 0;
          const nextUnlock = Math.min(10, Math.max(prev.highestUnlockedLevel, levelDef.id + 1));
          unlockedNext = nextUnlock > prev.highestUnlockedLevel;
          return {
            ...prev,
            highestUnlockedLevel: nextUnlock,
            starsByLevel: {
              ...prev.starsByLevel,
              [levelDef.id]: Math.max(prevStars, ev.stars),
            },
            coins: prev.coins + trackCoins + starBonus,
          };
        });

        setVictory({
          stars: ev.stars,
          coinsFromTrack: trackCoins,
          starBonusCoins: starBonus,
          elapsedSec: ev.elapsedSec,
          unlockedNext,
        });
        setView('VICTORY');

        if (currentDiff === 'KID' && kidVoiceEnabledRef.current) {
          kidVoice.speakPriority('Yay! You did it! Super rolling!');
        }
      } else if (ev.type === 'GAME_OVER') {
        bankPartialCoinsIfNeeded();
        setView('GAME_OVER');
      }
    };

    const engine = new SkyRollEngine(
      host,
      levelDef,
      currentDiff,
      currentSkin,
      {
        onHudUpdate: (snapshot) => setHud(snapshot),
        onEvent: handlePhysicsEvent,
        onWebGLContextLost: () => {
          setView('PAUSED');
          showBanner('Graphics paused — tap Resume!', 2000);
        },
      },
    );
    engineRef.current = engine;

    if (currentDiff === 'KID' && kidVoiceEnabledRef.current) {
      kidVoice.speakPriority(`Let's roll! ${levelDef.name}!`);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runNonce, activeLevelId]);

  // Cleanup banner timeout
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  // Multi-touch Playfield Steering Handlers (strict pointerId isolation)
  const handleSteerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (view !== 'PLAYING') return;
    if (steerPointerIdRef.current !== null) return;
    steerPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    steerOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
    };
    setDragVisual({ ox: e.clientX, oy: e.clientY, cx: e.clientX, cy: e.clientY });
  };

  const handleSteerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== steerPointerIdRef.current) return;
    const dx = e.clientX - steerOriginRef.current.x;
    const dy = e.clientY - steerOriginRef.current.y;
    const maxRadius = 64;
    const steerX = Math.max(-1, Math.min(1, dx / maxRadius));
    const throttle = Math.max(-1, Math.min(1, -dy / maxRadius));
    touchInputRef.current = { steerX, throttle };
    syncCombinedInput();

    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    setDragVisual({
      ox: steerOriginRef.current.x,
      oy: steerOriginRef.current.y,
      cx: steerOriginRef.current.x + Math.cos(angle) * clampedDist,
      cy: steerOriginRef.current.y + Math.sin(angle) * clampedDist,
    });
  };

  const handleSteerPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== steerPointerIdRef.current) return;
    const dx = e.clientX - steerOriginRef.current.x;
    const dy = e.clientY - steerOriginRef.current.y;
    const dtMs = performance.now() - steerOriginRef.current.time;

    // Quick-tap-to-jump for effortless one-handed play!
    if (dtMs < 190 && Math.hypot(dx, dy) < 12 && viewRef.current === 'PLAYING') {
      engineRef.current?.requestJump();
    }

    steerPointerIdRef.current = null;
    touchInputRef.current = { steerX: 0, throttle: 0 };
    syncCombinedInput();
    setDragVisual(null);
  };

  const handleJumpButtonDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (view !== 'PLAYING') return;
    engineRef.current?.requestJump();
  };

  const handleSelectDifficulty = (diff: SkyRollDifficulty) => {
    gameAudio.playConfirmSelect();
    updateSave((prev) => ({ ...prev, preferredDifficulty: diff }));
  };

  const handleSkinTap = (skinId: FruitSkinId) => {
    const skinDef = FRUIT_SKINS.find((s) => s.id === skinId);
    if (!skinDef) return;

    if (save.unlockedSkins.includes(skinId)) {
      gameAudio.playConfirmSelect();
      updateSave((prev) => ({ ...prev, selectedSkin: skinId }));
      return;
    }

    if (save.coins >= skinDef.price) {
      gameAudio.playSkyVictory();
      updateSave((prev) => ({
        ...prev,
        coins: prev.coins - skinDef.price,
        unlockedSkins: [...prev.unlockedSkins, skinId],
        selectedSkin: skinId,
      }));
      if (kidVoiceEnabled) {
        kidVoice.speakPriority(`Yay! Unlocked ${skinDef.name}!`);
      }
    } else {
      gameAudio.playErrorBuzz();
    }
  };

  const totalStars = getTotalStars(save);

  // =========================================================================
  // LOBBY VIEW (Mode Switcher + 6-Skin Fruit Shop + 10-Level Sky Map)
  // =========================================================================
  if (view === 'LOBBY') {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-sky-200 via-[#FDF6E3] to-[#EAD8C0] text-[#4A2810] select-none overflow-hidden">
        {/* Top Bar */}
        <header className="w-full max-w-2xl mx-auto px-3 pt-3 pb-2 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              gameAudio.playConfirmSelect();
              onExitToHub();
            }}
            className="px-3 py-2 rounded-2xl bg-[#FFF9F0] hover:bg-[#F3E3CF] border-2 border-[#C89666] text-[#5C3A21] font-extrabold text-xs md:text-sm shadow-sm flex items-center gap-1 active:scale-95 transition-all cursor-pointer">
            <ArrowLeft size={16} />
            <span>Hub</span>
          </button>

          <div className="flex items-center gap-1.5 bg-[#FFF9F0] px-3 py-1.5 rounded-full border-2 border-sky-400 shadow-xs">
            <span className="text-lg leading-none">🍊</span>
            <h1 className="text-sm md:text-base font-black text-[#5C3A21]">
              Fruit Sky Roll
            </h1>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="bg-[#FFF9F0] px-2.5 py-1.5 rounded-xl border-2 border-[#D4A373] text-xs font-black text-[#8C5832] flex items-center gap-1">
              <span>🪙</span>
              <span>{save.coins}</span>
            </div>
            <button
              type="button"
              onClick={onToggleSfx}
              aria-label="Toggle SFX"
              className="w-9 h-9 rounded-xl bg-[#FFF9F0] border-2 border-[#D4A373] flex items-center justify-center text-[#5C3A21] cursor-pointer active:scale-95">
              {sfxMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </header>

        {/* Scrollable Lobby Content */}
        <main className="flex-1 overflow-y-auto px-3 pb-8 pt-1 touch-auto">
          <div className="w-full max-w-2xl mx-auto space-y-4">
            {/* Mode Switcher */}
            <section className="bg-[#FFF9F0] rounded-3xl p-3 border-2 border-[#D4A373] shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectDifficulty('KID')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                    difficulty === 'KID'
                      ? 'bg-gradient-to-br from-sky-500 to-indigo-500 border-sky-200 text-white shadow-md'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                  }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-black text-sm">🧸 Kid Mode</span>
                    {difficulty === 'KID' && <Check size={16} />}
                  </div>
                  <p
                    className={`text-[11px] font-semibold leading-tight ${
                      difficulty === 'KID' ? 'text-sky-50' : 'text-[#8C5832]'
                    }`}>
                    Wide rails, Bubble Rescue, all 10 courses open!
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectDifficulty('ARCADE')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                    difficulty === 'ARCADE'
                      ? 'bg-gradient-to-br from-orange-500 to-rose-500 border-amber-200 text-white shadow-md'
                      : 'bg-[#FAF3E7] border-[#D4A373] text-[#5C3A21] hover:bg-[#F3E3CF]'
                  }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-black text-sm">⚡ Sky Escape</span>
                    {difficulty === 'ARCADE' && <Check size={16} />}
                  </div>
                  <p
                    className={`text-[11px] font-semibold leading-tight ${
                      difficulty === 'ARCADE' ? 'text-amber-50' : 'text-[#8C5832]'
                    }`}>
                    Classic narrow tracks, 3 hearts &amp; full speed!
                  </p>
                </button>
              </div>
            </section>

            {/* 3D Fruit Ball Skin Shop */}
            <section className="bg-[#FFF9F0] rounded-3xl p-3 border-2 border-[#D4A373] shadow-sm">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-xs md:text-sm font-black text-[#5C3A21] flex items-center gap-1.5">
                  <Sparkles size={15} className="text-amber-500" />
                  <span>3D Fruit Ball Skins</span>
                </h2>
                <span className="text-[11px] font-bold text-[#8C5832]">
                  {save.unlockedSkins.length}/{FRUIT_SKINS.length} Unlocked
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {FRUIT_SKINS.map((skin) => {
                  const unlocked = save.unlockedSkins.includes(skin.id);
                  const selected = save.selectedSkin === skin.id;
                  const canAfford = save.coins >= skin.price;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => handleSkinTap(skin.id)}
                      className={`p-2 rounded-2xl border-2 flex flex-col items-center text-center transition-all cursor-pointer active:scale-95 ${
                        selected
                          ? 'bg-amber-100 border-amber-500 shadow-sm ring-2 ring-amber-300'
                          : unlocked
                          ? 'bg-[#FAF3E7] border-[#D4A373] hover:bg-[#F3E3CF]'
                          : canAfford
                          ? 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100'
                          : 'bg-[#F5ECE0]/70 border-[#D4A373]/50 opacity-75'
                      }`}>
                      <span className="text-2xl leading-none mb-1">
                        {skin.emoji}
                      </span>
                      <span className="text-[10px] font-extrabold text-[#5C3A21] leading-tight">
                        {skin.name}
                      </span>
                      <span
                        className={`mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          selected
                            ? 'bg-amber-500 text-white'
                            : unlocked
                            ? 'bg-[#EAD8C0] text-[#5C3A21]'
                            : canAfford
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                        {selected
                          ? 'EQUIPPED'
                          : unlocked
                          ? 'SELECT'
                          : `🪙 ${skin.price}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 10-Level Sky Course Map */}
            <section className="bg-[#FFF9F0] rounded-3xl p-3 border-2 border-[#D4A373] shadow-sm">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <h2 className="text-xs md:text-sm font-black text-[#5C3A21]">
                  ☁️ 10 Sky Courses
                </h2>
                <span className="text-xs font-extrabold text-amber-600 flex items-center gap-1">
                  <Star size={13} className="fill-amber-400 text-amber-500" />
                  <span>{totalStars} / 30</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5">
                {SKY_ROLL_LEVELS.map((lvl) => {
                  const palette = SKY_THEME_PALETTES[lvl.theme];
                  const unlocked =
                    difficulty === 'KID' ||
                    lvl.id <= save.highestUnlockedLevel;
                  const stars = save.starsByLevel[lvl.id] ?? 0;

                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => startLevel(lvl.id)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between min-h-[96px] ${
                        unlocked
                          ? `bg-gradient-to-br ${palette.badgeBg} border-white/60 text-white shadow-md hover:brightness-105 active:scale-97 cursor-pointer`
                          : 'bg-[#EFE4D4] border-[#D4A373]/70 text-[#8C5832] opacity-70 cursor-not-allowed'
                      }`}>
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              unlocked
                                ? 'bg-black/20 text-white'
                                : 'bg-[#DFC9AE] text-[#7A502E]'
                            }`}>
                            Lv {lvl.id} • {palette.name}
                          </span>
                          <div className="text-sm md:text-base font-black leading-tight mt-1">
                            {lvl.name}
                          </div>
                        </div>
                        {!unlocked && <Lock size={15} className="shrink-0 mt-0.5" />}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              size={13}
                              className={
                                s <= stars
                                  ? 'fill-amber-300 text-amber-200'
                                  : unlocked
                                  ? 'text-white/35'
                                  : 'text-[#B89774]'
                              }
                            />
                          ))}
                        </div>
                        {unlocked && (
                          <span className="text-[10px] font-black bg-white/25 px-2 py-0.5 rounded-full">
                            PLAY ▶
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // IN-GAME 3D PLAYFIELD + HUD + MULTI-TOUCH CONTROLS
  // =========================================================================
  return (
    <div className="fixed inset-0 z-40 bg-sky-300 select-none overflow-hidden touch-none">
      {/* Three.js WebGL Container */}
      <div ref={canvasHostRef} className="absolute inset-0" />

      {/* Full-Screen Multi-Touch Steering Layer (strict pointerId isolation) */}
      <div
        onPointerDown={handleSteerPointerDown}
        onPointerMove={handleSteerPointerMove}
        onPointerUp={handleSteerPointerEnd}
        onPointerCancel={handleSteerPointerEnd}
        className="absolute inset-0 z-10 touch-none"
      />

      {/* Subtle Visual Drag Ring under Steering Finger */}
      {dragVisual && view === 'PLAYING' && (
        <div className="pointer-events-none fixed inset-0 z-15">
          <div
            className="absolute w-24 h-24 -ml-12 -mt-12 rounded-full border-2 border-white/55 bg-white/15"
            style={{ left: dragVisual.ox, top: dragVisual.oy }}
          />
          <div
            className="absolute w-11 h-11 -ml-5.5 -mt-5.5 rounded-full bg-white/70 shadow-md border-2 border-sky-400"
            style={{ left: dragVisual.cx, top: dragVisual.cy }}
          />
        </div>
      )}

      {/* TOP IN-GAME HUD */}
      <header className="absolute top-0 inset-x-0 z-20 p-2.5 md:p-3 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Level & Progress */}
        <div className="bg-black/35 backdrop-blur-xs text-white px-3 py-1.5 rounded-2xl border border-white/25 flex flex-col min-w-[130px] max-w-[190px]">
          <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider">
            <span className="truncate">
              Lv {activeLevel.id}: {activeLevel.name}
            </span>
            <span>{Math.round(hud.progress * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-white/25 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-amber-300 to-emerald-400 rounded-full transition-all duration-100"
              style={{ width: `${Math.round(hud.progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Center: Coins & Hearts / Bubble Badge */}
        <div className="flex items-center gap-1.5">
          <div className="bg-black/35 backdrop-blur-xs text-amber-200 px-2.5 py-1.5 rounded-2xl border border-white/25 text-xs font-black flex items-center gap-1">
            <span>🪙</span>
            <span>
              {hud.coinsCollected}/{hud.totalCoins}
            </span>
          </div>

          {difficulty === 'KID' ? (
            <div className="bg-sky-500/85 backdrop-blur-xs text-white px-2.5 py-1.5 rounded-2xl border border-sky-200 text-[11px] font-black flex items-center gap-1">
              <span>🫧</span>
              <span className="hidden sm:inline">Bubble Safe</span>
            </div>
          ) : (
            <div className="bg-black/35 backdrop-blur-xs px-2.5 py-1.5 rounded-2xl border border-white/25 flex items-center gap-0.5">
              {[0, 1, 2].map((i) => (
                <Heart
                  key={i}
                  size={14}
                  className={
                    i < hud.hearts
                      ? 'fill-rose-500 text-rose-400'
                      : 'text-white/30'
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Pause Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            gameAudio.playConfirmSelect();
            engineRef.current?.setPaused(true);
            setView('PAUSED');
          }}
          aria-label="Pause"
          className="pointer-events-auto w-10 h-10 rounded-2xl bg-[#FFF9F0]/95 hover:bg-white border-2 border-[#8C5832] text-[#5C3A21] shadow-md flex items-center justify-center active:scale-95 cursor-pointer">
          <Pause size={18} />
        </button>
      </header>

      {/* Center Toast Banner (Checkpoint / Bubble Rescue / Boost) */}
      {bannerText && (
        <div className="absolute top-20 inset-x-0 z-25 flex justify-center pointer-events-none px-4">
          <div className="bg-indigo-950/90 text-amber-200 border-2 border-amber-300/80 px-4 py-1.5 rounded-full text-sm font-black shadow-xl animate-bounce">
            {bannerText}
          </div>
        </div>
      )}

      {/* Bottom Controls Hint + Dedicated Ergonomic JUMP Button */}
      {view === 'PLAYING' && (
        <>
          <div className="absolute bottom-4 left-3 z-20 pointer-events-none">
            <div className="bg-black/30 backdrop-blur-xs text-white/95 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
              👆 Drag to Roll &amp; Steer • Tap or JUMP to Hop
            </div>
          </div>

          <button
            type="button"
            onPointerDown={handleJumpButtonDown}
            aria-label="Jump"
            className="absolute bottom-5 right-5 z-25 w-20 h-20 md:w-22 md:h-22 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border-4 border-white shadow-2xl flex flex-col items-center justify-center text-[#4A2810] font-black active:scale-90 transition-transform cursor-pointer touch-none">
            <ArrowUp size={28} strokeWidth={3.2} />
            <span className="text-[11px] leading-none tracking-wide">JUMP</span>
          </button>
        </>
      )}

      {/* PAUSE OVERLAY */}
      {view === 'PAUSED' && (
        <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#FFF9F0] border-4 border-[#8C5832] rounded-3xl p-5 shadow-2xl text-center space-y-3">
            <h2 className="text-2xl font-black text-[#5C3A21]">Paused</h2>
            <p className="text-xs font-bold text-[#8C5832]">
              Lv {activeLevel.id}: {activeLevel.name}
            </p>

            <button
              type="button"
              onClick={() => {
                gameAudio.playConfirmSelect();
                engineRef.current?.setPaused(false);
                setView('PLAYING');
              }}
              className="w-full py-3 rounded-2xl bg-[#8C5832] hover:bg-[#724524] text-white font-black text-base shadow flex items-center justify-center gap-2 cursor-pointer active:scale-98">
              <Play size={18} /> Resume
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onToggleSfx}
                className="py-2 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                {sfxMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                SFX: {sfxMuted ? 'Off' : 'On'}
              </button>
              <button
                type="button"
                onClick={onToggleMusic}
                className="py-2 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                {musicMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                Music: {musicMuted ? 'Off' : 'On'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                bankPartialCoinsIfNeeded();
                startLevel(activeLevelId);
              }}
              className="w-full py-2.5 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#D97706] font-extrabold text-sm flex items-center justify-center gap-1.5 cursor-pointer">
              <RotateCw size={16} /> Restart Level
            </button>

            <button
              type="button"
              onClick={returnToLobby}
              className="w-full py-2.5 rounded-2xl bg-red-100 border-2 border-red-300 text-red-700 font-extrabold text-sm cursor-pointer">
              Course Select
            </button>
          </div>
        </div>
      )}

      {/* COURSE CLEAR VICTORY OVERLAY */}
      {view === 'VICTORY' && victory && (
        <div className="fixed inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FFF9F0] border-4 border-amber-500 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-2xl font-black text-[#5C3A21]">
              Course Clear!
            </h2>

            {/* Stars */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  size={38}
                  className={
                    s <= victory.stars
                      ? 'fill-amber-400 text-amber-500 drop-shadow animate-bounce'
                      : 'text-[#E5D3BC]'
                  }
                />
              ))}
            </div>

            <div className="bg-[#FAF3E7] border-2 border-[#D4A373] rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs font-extrabold text-[#5C3A21]">
              <div>
                <span className="block text-[10px] text-[#9A6B42]">
                  SEEDS EARNED
                </span>
                <span className="text-base font-black text-amber-600">
                  🪙 +{victory.coinsFromTrack + victory.starBonusCoins}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-[#9A6B42]">TIME</span>
                <span className="text-base font-black">
                  {victory.elapsedSec.toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {activeLevelId < SKY_ROLL_LEVELS.length && (
                <button
                  type="button"
                  onClick={() => startLevel(activeLevelId + 1)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-base shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                  <Play size={18} /> Next Course (Lv {activeLevelId + 1})
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startLevel(activeLevelId)}
                  className="py-2.5 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#5C3A21] font-extrabold text-sm flex items-center justify-center gap-1 cursor-pointer">
                  <RotateCw size={15} /> Replay
                </button>
                <button
                  type="button"
                  onClick={returnToLobby}
                  className="py-2.5 rounded-2xl bg-[#8C5832] text-white font-extrabold text-sm cursor-pointer">
                  Courses
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SKY ESCAPE GAME OVER OVERLAY */}
      {view === 'GAME_OVER' && (
        <div className="fixed inset-0 z-30 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FFF9F0] border-4 border-rose-400 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="text-4xl">☁️</div>
            <h2 className="text-2xl font-black text-[#5C3A21]">
              Oops! Fell into the Clouds!
            </h2>
            <p className="text-xs font-bold text-[#8C5832]">
              You kept all {hud.coinsCollected} Golden Seeds you collected! Want
              to try again?
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startLevel(activeLevelId)}
                className="w-full py-3 rounded-2xl bg-[#8C5832] hover:bg-[#724524] text-white font-black text-base shadow flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                <RotateCw size={18} /> Try Again
              </button>

              <button
                type="button"
                onClick={() => {
                  updateSave((prev) => ({ ...prev, preferredDifficulty: 'KID' }));
                  startLevel(activeLevelId);
                }}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-extrabold text-sm cursor-pointer">
                🧸 Switch to Kid Mode (No-Fail!)
              </button>

              <button
                type="button"
                onClick={returnToLobby}
                className="w-full py-2 rounded-2xl bg-[#FAF3E7] border-2 border-[#D4A373] text-[#5C3A21] font-bold text-sm cursor-pointer">
                Course Select
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FruitSkyRoll;
