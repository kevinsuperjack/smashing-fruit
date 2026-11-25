import React from 'react';
import { ArrowLeft, Gamepad2, Lock, Play, Sparkles, Star } from 'lucide-react';
import { MINIGAMES_REGISTRY, MinigameId } from '../minigames/registry';
import { getTotalStars, loadSkyRollSave } from '../minigames/sky-roll/storage';
import {
  getFruitPopBestStars,
  getGoldenSeeds,
  getMemoryMatchTotalStars,
  loadFruitPopSave,
  loadMemoryMatchSave,
} from '../minigames/arcadeStorage';
import { APP_THEMES, type AppTheme } from '../utils/theme';
import { gameAudio } from '../utils/helper';
import { SnowfallOverlay } from './SnowfallOverlay';

export interface MinigamesHubProps {
  theme: AppTheme;
  onToggleTheme: () => void;
  onSelectMinigame: (id: MinigameId) => void;
  onBack: () => void;
}

export const MinigamesHub: React.FC<MinigamesHubProps> = ({
  theme,
  onToggleTheme,
  onSelectMinigame,
  onBack,
}) => {
  const isChristmas = theme === 'CHRISTMAS';
  const palette = APP_THEMES[theme];

  const goldenSeeds = getGoldenSeeds();
  const skySave = loadSkyRollSave();
  const skyTotalStars = getTotalStars(skySave);
  const fruitPopSave = loadFruitPopSave();
  const fruitPopBestStars = getFruitPopBestStars(fruitPopSave);
  const memorySave = loadMemoryMatchSave();
  const memoryTotalStars = getMemoryMatchTotalStars(memorySave);

  return (
    <div
      className={`fixed inset-0 z-40 flex flex-col ${palette.hubBgClass} ${palette.hubTextClass} select-none overflow-hidden`}>
      <SnowfallOverlay active={isChristmas} density="light" contained />

      {/* Top Header */}
      <header className="relative z-30 w-full max-w-2xl mx-auto px-2.5 sm:px-4 pt-3 sm:pt-4 pb-2.5 sm:pb-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            gameAudio.playConfirmSelect();
            onBack();
          }}
          className={`${palette.hubHeaderBadgeClass} ${
            isChristmas ? 'hover:bg-emerald-900' : 'hover:bg-[#F3E3CF]'
          } px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl font-extrabold text-xs sm:text-sm shadow-sm flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer`}>
          <ArrowLeft size={17} />
          <span>Title</span>
        </button>

        <div className="order-last sm:order-none w-full sm:w-auto flex justify-center min-w-0">
          <div
            className={`${palette.hubHeaderBadgeClass} flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-xs max-w-full`}>
            <Gamepad2
              size={18}
              className={
                isChristmas
                  ? 'text-amber-300 shrink-0'
                  : 'text-[#D97706] shrink-0'
              }
            />
            <h1 className="text-sm sm:text-base md:text-lg font-black tracking-wide truncate">
              Minigames Arcade
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              gameAudio.playConfirmSelect();
              onToggleTheme();
            }}
            aria-label={`Switch theme (current: ${palette.label})`}
            className={`${palette.hubHeaderBadgeClass} ${
              isChristmas ? 'hover:bg-emerald-900' : 'hover:bg-[#F3E3CF]'
            } px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1 shadow-xs whitespace-nowrap active:scale-95 transition-all cursor-pointer`}>
            <span>{palette.emoji}</span>
            <span>{palette.shortLabel}</span>
          </button>

          <div
            className={`${palette.hubHeaderBadgeClass} px-2.5 sm:px-3 py-1.5 rounded-2xl text-xs font-black flex items-center gap-1 shadow-xs whitespace-nowrap`}>
            <span>🪙</span>
            <span>{goldenSeeds}</span>
          </div>
        </div>
      </header>

      {/* Scrollable Minigame Cards */}
      <main className="relative z-30 flex-1 overflow-y-auto px-3 sm:px-4 pb-8 pt-1 touch-auto">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <p
            className={`text-center text-xs md:text-sm font-bold ${
              isChristmas ? 'text-amber-100/90' : 'text-[#8C5832]'
            }`}>
            Pick a fun fruit adventure! Earn Golden Seeds &amp; unlock cute 3D
            fruit characters. ✨
          </p>

          <div className="grid grid-cols-1 gap-3.5">
            {MINIGAMES_REGISTRY.map((game) => {
              const isPlayable = game.status === 'playable';
              return (
                <button
                  key={game.id}
                  type="button"
                  disabled={!isPlayable}
                  onClick={() => {
                    if (!isPlayable) return;
                    gameAudio.playConfirmSelect();
                    onSelectMinigame(game.id);
                  }}
                  className={`w-full text-left rounded-3xl p-4 md:p-5 border-4 shadow-lg transition-all relative overflow-hidden ${
                    isPlayable
                      ? `bg-gradient-to-br ${game.gradient} ${
                          isChristmas
                            ? palette.cardBorderAccent
                            : game.borderColor
                        } text-white hover:brightness-105 active:scale-98 cursor-pointer`
                      : isChristmas
                      ? 'bg-slate-900/75 border-amber-300/30 text-amber-100/80 opacity-80 cursor-not-allowed'
                      : 'bg-[#FFF9F0]/85 border-[#D4A373]/70 text-[#7A502E] opacity-80 cursor-not-allowed'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-inner shrink-0 ${
                          isPlayable
                            ? 'bg-white/25 backdrop-blur-xs border-2 border-white/40'
                            : isChristmas
                            ? 'bg-slate-800 border-2 border-amber-300/40'
                            : 'bg-[#EAD8C0] border-2 border-[#D4A373]'
                        }`}>
                        {game.emoji}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isPlayable
                                ? 'bg-amber-300 text-[#4A2810]'
                                : isChristmas
                                ? 'bg-slate-800 text-amber-200'
                                : 'bg-[#EAD8C0] text-[#8C5832]'
                            }`}>
                            {game.badge}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPlayable
                                ? 'bg-black/20 text-white'
                                : isChristmas
                                ? 'bg-slate-800/80 text-amber-100/80'
                                : 'bg-[#F5E6D3] text-[#8C5832]'
                            }`}>
                            {game.ageTag}
                          </span>
                        </div>

                        <h2 className="text-xl md:text-2xl font-black leading-tight">
                          {game.title}
                        </h2>
                        <p
                          className={`text-xs md:text-sm font-semibold mt-1 leading-snug ${
                            isPlayable
                              ? 'text-white/95'
                              : isChristmas
                              ? 'text-amber-100/75'
                              : 'text-[#8C5832]'
                          }`}>
                          {game.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 self-center">
                      {isPlayable ? (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-sky-600 flex items-center justify-center shadow-md">
                          <Play size={22} className="fill-sky-600 ml-0.5" />
                        </div>
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isChristmas
                              ? 'bg-slate-800 text-amber-200'
                              : 'bg-[#EAD8C0] text-[#8C5832]'
                          }`}>
                          <Lock size={18} />
                        </div>
                      )}
                    </div>
                  </div>

                  {isPlayable && game.id === 'sky-roll' && (
                    <div className="mt-3.5 pt-3 border-t border-white/25 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                      <span className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full">
                        <Star size={13} className="fill-amber-300 text-amber-300" />
                        <span>{skyTotalStars} / 30 Stars</span>
                      </span>
                      <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-full">
                        <Sparkles size={13} className="text-amber-200" />
                        <span>10 Sky Courses • 6 3D Fruit Balls</span>
                      </span>
                    </div>
                  )}

                  {isPlayable && game.id === 'fruit-pop' && (
                    <div className="mt-3.5 pt-3 border-t border-white/25 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                      <span className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full">
                        <Star size={13} className="fill-amber-300 text-amber-300" />
                        <span>
                          Best: {fruitPopSave.bestScore} • {fruitPopBestStars}/3 ★
                        </span>
                      </span>
                      <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-full">
                        <Sparkles size={13} className="text-amber-200" />
                        <span>{fruitPopSave.totalPopped} Popped</span>
                      </span>
                    </div>
                  )}

                  {isPlayable && game.id === 'memory-match' && (
                    <div className="mt-3.5 pt-3 border-t border-white/25 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                      <span className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full">
                        <Star size={13} className="fill-amber-300 text-amber-300" />
                        <span>{memoryTotalStars} / 12 ★</span>
                      </span>
                      <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-full">
                        <Sparkles size={13} className="text-amber-200" />
                        <span>
                          {memorySave.totalSmoothiesBlended} Smoothies Blended
                        </span>
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MinigamesHub;
