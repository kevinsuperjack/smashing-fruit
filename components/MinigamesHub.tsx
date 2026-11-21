import React from 'react';
import { ArrowLeft, Gamepad2, Lock, Play, Sparkles, Star } from 'lucide-react';
import { MINIGAMES_REGISTRY, MinigameId } from '../minigames/registry';
import { getTotalStars, loadSkyRollSave } from '../minigames/sky-roll/storage';
import { gameAudio } from '../utils/helper';

interface MinigamesHubProps {
  onSelectMinigame: (id: MinigameId) => void;
  onBack: () => void;
}

export const MinigamesHub: React.FC<MinigamesHubProps> = ({
  onSelectMinigame,
  onBack,
}) => {
  const skySave = loadSkyRollSave();
  const totalStars = getTotalStars(skySave);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gradient-to-b from-[#FDF6E3] via-[#F7EFE2] to-[#EAD8C0] text-[#4A2810] select-none overflow-hidden">
      {/* Top Header */}
      <header className="w-full max-w-2xl mx-auto px-4 pt-4 pb-3 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            gameAudio.playConfirmSelect();
            onBack();
          }}
          className="px-3.5 py-2 rounded-2xl bg-[#FFF9F0] hover:bg-[#F3E3CF] border-2 border-[#C89666] text-[#5C3A21] font-extrabold text-sm shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer">
          <ArrowLeft size={17} />
          <span>Title</span>
        </button>

        <div className="flex items-center gap-2 bg-[#FFF9F0] px-4 py-1.5 rounded-full border-2 border-[#C89666] shadow-xs">
          <Gamepad2 size={18} className="text-[#D97706]" />
          <h1 className="text-base md:text-lg font-black tracking-wide text-[#5C3A21]">
            Minigames Arcade
          </h1>
        </div>

        <div className="bg-[#FFF9F0] px-3 py-1.5 rounded-2xl border-2 border-[#D4A373] text-xs font-black text-[#8C5832] flex items-center gap-1 shadow-xs">
          <span>🪙</span>
          <span>{skySave.coins}</span>
        </div>
      </header>

      {/* Scrollable Minigame Cards */}
      <main className="flex-1 overflow-y-auto px-4 pb-8 pt-1 touch-auto">
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <p className="text-center text-xs md:text-sm font-bold text-[#8C5832]">
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
                      ? `bg-gradient-to-br ${game.gradient} ${game.borderColor} text-white hover:brightness-105 active:scale-98 cursor-pointer`
                      : 'bg-[#FFF9F0]/85 border-[#D4A373]/70 text-[#7A502E] opacity-80 cursor-not-allowed'
                  }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-inner shrink-0 ${
                          isPlayable
                            ? 'bg-white/25 backdrop-blur-xs border-2 border-white/40'
                            : 'bg-[#EAD8C0] border-2 border-[#D4A373]'
                        }`}>
                        {game.emoji}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isPlayable
                                ? 'bg-amber-300 text-[#4A2810]'
                                : 'bg-[#EAD8C0] text-[#8C5832]'
                            }`}>
                            {game.badge}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPlayable
                                ? 'bg-black/20 text-white'
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
                            isPlayable ? 'text-white/95' : 'text-[#8C5832]'
                          }`}>
                          {game.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 self-center">
                      {isPlayable ? (
                        <div className="w-11 h-11 rounded-full bg-white text-sky-600 flex items-center justify-center shadow-md">
                          <Play size={22} className="fill-sky-600 ml-0.5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#EAD8C0] text-[#8C5832] flex items-center justify-center">
                          <Lock size={18} />
                        </div>
                      )}
                    </div>
                  </div>

                  {isPlayable && game.id === 'sky-roll' && (
                    <div className="mt-3.5 pt-3 border-t border-white/25 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
                      <span className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full">
                        <Star size={13} className="fill-amber-300 text-amber-300" />
                        <span>{totalStars} / 30 Stars</span>
                      </span>
                      <span className="flex items-center gap-1 bg-black/20 px-2.5 py-1 rounded-full">
                        <Sparkles size={13} className="text-amber-200" />
                        <span>10 Sky Courses • 6 3D Fruit Balls</span>
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
