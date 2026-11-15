// tslint:disable
/* eslint-disable */
import React, {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react';

/**  --- Overlay component ---
 * A full-screen UI overlay component used to display game states
 * such as Start Menus, Pause Screens, Game Over, and Victory screens.
 * It renders a semi-transparent background with a title, optional description,
 * and a primary action button.
 */

type OverlayTone = 'neutral' | 'danger' | 'victory';

interface OverlayProps {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  icon?: ReactNode;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryIcon?: ReactNode;
  stats?: Array<{label: string; value: string | number}>;
  extraFooter?: ReactNode;
  tone?: OverlayTone;
  autoFocus?: boolean;
}

const TONE_CLASS: Record<OverlayTone, string> = {
  neutral: 'bg-black/70',
  danger: 'bg-red-900/80',
  victory: 'bg-emerald-900/80',
};

const BUTTON_CLASS: Record<OverlayTone, string> = {
  neutral: 'hover:bg-yellow-400',
  danger: 'hover:bg-red-400',
  victory: 'hover:bg-emerald-400',
};

/**
 * @param title - The main, large heading text to display (e.g., "GAME OVER").
 * @param description - Optional subtitle text to display below the title (e.g., "Final Score: 42").
 * @param actionLabel - The text to display inside the primary action button (e.g., "PLAY AGAIN").
 * @param onAction - Callback function executed when the user clicks the primary action button.
 * @param icon - Optional React node (like a Lucide icon) rendered inside the action button next to the label.
 * @param tone - The visual theme of the overlay which dictates background and hover colors. Defaults to 'neutral'. ('neutral' | 'danger' | 'victory')
 */
/** Focuses the referenced element on mount to ensure Enter works. */
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    // Only focus if enabled is true
    if (enabled && ref.current) {
      ref.current.focus();
    }
  }, [enabled]);
  return ref;
}

export function Overlay({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryIcon,
  stats,
  extraFooter,
  tone = 'neutral',
  autoFocus = true,
}: OverlayProps) {
  const buttonRef = useAutoFocus<HTMLButtonElement>(autoFocus);

  return (
    <div
      className={`absolute inset-0 z-50 ${TONE_CLASS[tone]} backdrop-blur-xs overflow-y-auto touch-auto pointer-events-auto`}>
      <div className="min-h-full flex flex-col items-center p-4">
        <div className="m-auto flex flex-col items-center w-full max-w-md">
          <h1 className="text-3xl md:text-5xl font-black mb-3 text-yellow-400 text-center drop-shadow-md">
            {title}
          </h1>
          {description && (
            <p className="text-lg md:text-2xl mb-5 text-white/95 font-bold text-center drop-shadow-xs">
              {description}
            </p>
          )}
          {stats && stats.length > 0 && (
            <div
              className={`grid ${
                stats.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
              } gap-2.5 w-full max-w-md mb-7`}>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-black/35 border border-white/20 rounded-2xl px-3 py-2.5 flex flex-col items-center text-center">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-white/70">
                    {stat.label}
                  </span>
                  <span className="text-base md:text-lg font-black text-white mt-0.5 truncate max-w-full">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm">
            <button
              ref={buttonRef}
              autoFocus={autoFocus}
              onClick={onAction}
              data-testid="start-button"
              className={`w-full sm:w-auto bg-white text-black px-6 md:px-8 py-3 rounded-full font-extrabold text-base md:text-lg shadow-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${BUTTON_CLASS[tone]}`}>
              {icon}
              {actionLabel}
            </button>
            {secondaryActionLabel && onSecondaryAction && (
              <button
                onClick={onSecondaryAction}
                className="w-full sm:w-auto bg-white/15 hover:bg-white/25 text-white border-2 border-white/40 px-6 py-3 rounded-full font-bold text-base md:text-lg shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2">
                {secondaryIcon}
                {secondaryActionLabel}
              </button>
            )}
          </div>
          {extraFooter && (
            <div className="mt-4 flex flex-col items-center w-full max-w-sm">
              {extraFooter}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface MenuOverlayProps {
  children: ReactNode;
  tone?: OverlayTone;
  zIndex?: number;
}

/**
 * A highly resilient menu wrapper that statically decouples scrolling from flexbox alignment.
 * It strictly avoids the clipping bug on mobile by preventing flex justify-center from being assigned
 * to the overflow-y-auto boundary. Plugs seamlessly into the AI's generation workflows.
 * The inner children should provide their own box styling (e.g., w-full max-w-md bg-slate-900 rounded).
 */
export function MenuOverlay({
  children,
  tone = 'neutral',
  zIndex = 40,
}: MenuOverlayProps) {
  return (
    <div
      className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto`}
      style={{zIndex}}>
      <div className="min-h-full flex flex-col items-center p-4">
        <div className="m-auto w-full max-w-md flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Actions that can be triggered by the user. */
export type InputAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'confirm'
  | 'cancel'
  | 'tap';

/** Represents the state of the pointer (mouse or touch). */
export interface PointerState {
  /** The X coordinate of the pointer. */
  x: number;
  /** The Y coordinate of the pointer. */
  y: number;
  /** Whether the pointer is currently pressed down. */
  down: boolean;
}

/** A snapshot of the input state at a specific frame. */
export interface InputSnapshot {
  /** Map of actions to their active state. */
  actions: Record<InputAction, boolean>;
  /** The current state of the pointer. */
  pointer: PointerState;
}

interface LogicalSize {
  width: number;
  height: number;
}

const ACTION_KEYS: Record<string, InputAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  Enter: 'confirm',
  ' ': 'confirm',
  Spacebar: 'confirm',
  Escape: 'cancel',
};

/**
 * Initializes all input actions to a default 'false' state.
 */
const createEmptyActions = (): Record<InputAction, boolean> => ({
  left: false,
  right: false,
  up: false,
  down: false,
  confirm: false,
  cancel: false,
  tap: false,
});

/**
 * Calculates the pointer's logical X/Y coordinates on the canvas.
 */
const getPointerPosition = (
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  logicalSize?: LogicalSize,
): {x: number; y: number} => {
  const rect = canvas.getBoundingClientRect();
  const width = logicalSize?.width ?? rect.width;
  const height = logicalSize?.height ?? rect.height;
  if (!rect.width || !rect.height) {
    return {x: width / 2, y: height / 2};
  }
  const x = (clientX - rect.left) * (width / rect.width);
  const y = (clientY - rect.top) * (height / rect.height);
  return {x, y};
};

/**
 * Hook to capture and manage user input (keyboard, mouse, pointer, and touch).
 * @param canvasRef Reference to the game canvas element.
 * @param enabled Whether input capture is enabled.
 * @param logicalSize Optional logical size of the canvas for coordinate scaling.
 * @returns A mutable ref containing the current input snapshot.
 */
export const useInput = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  enabled = true,
  logicalSize?: LogicalSize,
  readyKey?: unknown,
): MutableRefObject<InputSnapshot> => {
  const inputRef = useRef<InputSnapshot>({
    actions: createEmptyActions(),
    pointer: {x: 0, y: 0, down: false},
  });

  useEffect(() => {
    if (!enabled) {
      inputRef.current.actions = createEmptyActions();
      inputRef.current.pointer = {x: 0, y: 0, down: false};
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key];
      if (!action) return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(
          event.key,
        )
      ) {
        event.preventDefault();
      }
      inputRef.current.actions[action] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key];
      if (!action) return;
      inputRef.current.actions[action] = false;
    };

    const canvas = canvasRef.current;

    const handlePointerDown = (event: PointerEvent) => {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) return;
      try {
        if (typeof activeCanvas.setPointerCapture === 'function') {
          activeCanvas.setPointerCapture(event.pointerId);
        }
      } catch {}
      const pos = getPointerPosition(event.clientX, event.clientY, activeCanvas, logicalSize);
      inputRef.current.pointer = {
        ...pos,
        down: true,
      };
      inputRef.current.actions.tap = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) return;
      const pos = getPointerPosition(event.clientX, event.clientY, activeCanvas, logicalSize);
      inputRef.current.pointer = {
        ...pos,
        down: inputRef.current.pointer.down,
      };
    };

    const handlePointerUp = (event: PointerEvent) => {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) {
        inputRef.current.pointer.down = false;
        inputRef.current.actions.tap = false;
        return;
      }
      if (!inputRef.current.pointer.down && event.target !== activeCanvas) {
        return;
      }
      try {
        if (
          typeof activeCanvas.releasePointerCapture === 'function' &&
          activeCanvas.hasPointerCapture(event.pointerId)
        ) {
          activeCanvas.releasePointerCapture(event.pointerId);
        }
      } catch {}
      const pos = getPointerPosition(event.clientX, event.clientY, activeCanvas, logicalSize);
      inputRef.current.pointer = {
        ...pos,
        down: false,
      };
      inputRef.current.actions.tap = false;
    };

    const handleTouchStart = (event: TouchEvent) => {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas || event.touches.length === 0) return;
      const touch = event.touches[0];
      const pos = getPointerPosition(touch.clientX, touch.clientY, activeCanvas, logicalSize);
      inputRef.current.pointer = {
        ...pos,
        down: true,
      };
      inputRef.current.actions.tap = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas || event.touches.length === 0) return;
      const touch = event.touches[0];
      const pos = getPointerPosition(touch.clientX, touch.clientY, activeCanvas, logicalSize);
      inputRef.current.pointer = {
        ...pos,
        down: true,
      };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const activeCanvas = canvasRef.current;
      if (!activeCanvas) {
        inputRef.current.pointer.down = false;
        inputRef.current.actions.tap = false;
        return;
      }
      const touch = event.changedTouches[0];
      if (touch) {
        const pos = getPointerPosition(touch.clientX, touch.clientY, activeCanvas, logicalSize);
        inputRef.current.pointer = {
          ...pos,
          down: false,
        };
      } else {
        inputRef.current.pointer.down = false;
      }
      inputRef.current.actions.tap = false;
    };

    const handleBlur = () => {
      inputRef.current.actions = createEmptyActions();
      if (inputRef.current.pointer) {
        inputRef.current.pointer.down = false;
      }
      inputRef.current.actions.tap = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown, {passive: false});
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (canvas) {
      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointercancel', handlePointerUp);
      canvas.addEventListener('touchstart', handleTouchStart, {passive: true});
      canvas.addEventListener('touchmove', handleTouchMove, {passive: true});
      canvas.addEventListener('touchend', handleTouchEnd, {passive: true});
      canvas.addEventListener('touchcancel', handleTouchEnd, {passive: true});
    }

    // Global window pointerup safeguard so releases outside canvas are never lost
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointerup', handlePointerUp);

      if (canvas) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerUp);
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [canvasRef, enabled, readyKey]);

  return inputRef;
};

/**
 * audio.ts — procedural sound effects via the Web Audio API.
 *
 * No asset files, no network: every sound is synthesized on the fly. Import the
 * shared `gameAudio` singleton, insert required SFX methods, and call them:
 *
 *   import { gameAudio } from './utils/helper';
 *
 *   // After inserting playArcadeLaser:
 *   gameAudio.playArcadeLaser();         // on shoot
 *
 * Autoplay: browsers block audio until the first user gesture. This module
 * unlocks itself on the first pointer/key/touch event, and every play call also
 * resumes the context — so it is safe to call any method at any time; calls made
 * before the first interaction simply no-op instead of throwing.
 *
 * Volume & mute are global (master): gameAudio.setVolume(0.4),
 * gameAudio.toggleMute().
 */

interface Beat {
  ctx: AudioContext;
  out: GainNode;
  now: number;
}

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxMaster: GainNode | null = null;
  private muted = false; // SFX muted
  private volume = 0.6; // master volume, 0..1

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachUnlock();
      window.addEventListener('playground-mute', (e: Event) => {
        const customEvent = e as CustomEvent<{muted?: boolean}>;
        if (typeof customEvent.detail?.muted === 'boolean') {
          this.setMuted(customEvent.detail.muted);
        }
      });
    }
  }

  // --- Context lifecycle -----------------------------------------------------

  /**
   * Lazily create the AudioContext + master gain on first use. Returns null when
   * Web Audio is unavailable (e.g. during SSR), in which case all play calls
   * become no-ops.
   */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const Ctor =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext})
        .webkitAudioContext;
    if (!Ctor) {
      console.warn('[audio] Web Audio API not supported');
      return null;
    }

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfxMaster = this.ctx.createGain();
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.sfxMaster.gain.setValueAtTime(
      this.muted ? 0 : 1,
      this.ctx.currentTime,
    );
    this.sfxMaster.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.attachUnlock();
    return this.ctx;
  }

  /** Resume the context on the first user gesture (one-shot). */
  private attachUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      void this.ctx?.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  /** Manually resume the context — call from a click handler if needed. */
  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }

  /** Prepare to play a one-shot. Returns null when muted or unavailable. */
  private begin(): Beat | null {
    const ctx = this.ensure();
    const out = this.sfxMaster;
    if (!ctx || !out || this.muted) return null;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return {ctx, out, now: ctx.currentTime};
  }

  // --- Master controls -------------------------------------------------------

  /** Set master volume (0..1). Affects SFX. */
  setVolume(v: number) {
    if (!Number.isFinite(v)) return;
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /** Toggle global SFX mute. Returns the new muted state. */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.sfxMaster && this.ctx) {
      this.sfxMaster.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  getMuteState(): boolean {
    return this.muted;
  }

  // --- Synthesis helpers -----------------------------------------------------

  /** Schedule one enveloped oscillator. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private blip(
    b: Beat,
    at: number,
    o: {
      freq: number;
      freqTo?: number;
      dur: number;
      type?: OscillatorType;
      gain?: number;
      glide?: 'exp' | 'lin';
    },
  ) {
    const {ctx, out} = b;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, at);
    if (o.freqTo !== undefined) {
      if ((o.glide ?? 'exp') === 'lin') {
        osc.frequency.linearRampToValueAtTime(o.freqTo, at + o.dur);
      } else {
        // Exponential ramps cannot target 0.
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, o.freqTo),
          at + o.dur,
        );
      }
    }

    const peak = o.gain ?? 0.15;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + o.dur + 0.02);
  }

  /** Schedule a filtered white-noise burst (impacts, explosions). */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private noiseBurst(
    b: Beat,
    at: number,
    o: {dur: number; gain?: number; from?: number; to?: number},
  ) {
    const {ctx, out} = b;
    const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.from ?? 1000, at);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(1, o.to ?? 80),
      at + o.dur,
    );

    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.18, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(at);
    src.stop(at + o.dur);
  }

  /** Small random multiplier so rapid-fire sounds don't feel robotic. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private vary(amount = 0.05): number {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  // --- Sound effects ---------------------------------------------------------

  /** Generic one-shot tone — escape hatch for custom blips. */
  playTone(o: {
    type?: OscillatorType;
    freq: number;
    freqTo?: number;
    dur?: number;
    gain?: number;
  }) {
    const b = this.begin();
    if (!b) return;
    this.blip(b, b.now, {
      type: o.type,
      freq: o.freq,
      freqTo: o.freqTo,
      dur: o.dur ?? 0.15,
      gain: o.gain,
    });
  }

  // INSERT_SFX_HERE
  playArcadeLaser() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const dur = 0.2;
    
    const osc = b.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800 * v, b.now);
    osc.frequency.exponentialRampToValueAtTime(80 * v, b.now + dur);
    
    const filter = b.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(2000 * v, b.now);
    filter.frequency.exponentialRampToValueAtTime(100 * v, b.now + dur);
    
    const gain = b.ctx.createGain();
    gain.gain.setValueAtTime(0.12, b.now);
    gain.gain.exponentialRampToValueAtTime(0.0001, b.now + dur);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(b.out);
    
    osc.start(b.now);
    osc.stop(b.now + dur);
  }

  playErrorBuzz() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sawtooth', freq: 150 * v, dur: 0.2, gain: 0.08 });
    this.blip(b, b.now, { type: 'sawtooth', freq: 159 * v, dur: 0.2, gain: 0.08 });
  }

  playConfirmSelect() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 523.25 * v, dur: 0.1, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'sine', freq: 783.99 * v, dur: 0.15, gain: 0.1 });
  }
  playCoinPickup() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'square', freq: 987.77 * v, dur: 0.1, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'square', freq: 1318.51 * v, dur: 0.2, gain: 0.08 });
  }

  playPowerupChime() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.06, { type: 'sine', freq: freq * v, dur: 0.15, gain: 0.06 });
    });
  }

  playLevelUpStinger() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.07, { type: 'sine', freq: freq * v, dur: 0.25, gain: 0.06 });
    });
    const tailTime = notes.length * 0.07;
    this.noiseBurst(b, b.now + tailTime, { dur: 0.8, gain: 0.05, from: 3000, to: 6000 });
    for (let i = 0; i < 5; i++) {
      this.blip(b, b.now + tailTime + i * 0.1, {
        type: 'sine',
        freq: (2000 + i * 500) * this.vary(0.1),
        dur: 0.2,
        gain: 0.03
      });
    }
  }

  playVictoryFanfare() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.1, { type: 'sawtooth', freq: freq * v, dur: 0.4, gain: 0.06 });
      this.blip(b, b.now + i * 0.1, { type: 'sine', freq: freq * v, dur: 0.4, gain: 0.04 });
    });
    const chordTime = notes.length * 0.1;
    notes.forEach((freq) => {
      this.blip(b, b.now + chordTime, { type: 'triangle', freq: freq * v, dur: 0.8, gain: 0.06 });
    });
  }

  playDefeatMotif() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [311.13, 261.63, 246.94, 196.00];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.15, { type: 'sawtooth', freq: freq * v, dur: 0.3, gain: 0.08 });
      this.blip(b, b.now + i * 0.15, { type: 'sine', freq: freq * 0.5 * v, dur: 0.35, gain: 0.06 });
    });
  }

  playChiptuneExplosion() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.noiseBurst(b, b.now, { dur: 0.4, gain: 0.2, from: 1000, to: 100 });
    this.blip(b, b.now, { type: 'triangle', freq: 160 * v, freqTo: 30 * v, dur: 0.35, gain: 0.25 });
  }

  playCrispClick() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 1200 * v, dur: 0.015, gain: 0.1 });
  }

  playHoverMicroTone() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.02);
    this.blip(b, b.now, { type: 'sine', freq: 880 * v, dur: 0.03, gain: 0.05 });
  }

  playJumpLandingThud() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 140 * v, freqTo: 35 * v, dur: 0.16, gain: 0.15 });
    this.noiseBurst(b, b.now, { dur: 0.12, gain: 0.08, from: 300, to: 60 });
  }

  playComboChime(combo: number) {
    if (!Number.isFinite(combo)) return;
    const b = this.begin();
    if (!b) return;
    const semitones = Math.min(14, Math.max(0, combo - 1));
    const pitchMult = Math.pow(2, semitones / 12) * this.vary(0.015);
    const baseFreq = 587.33; // D5
    this.blip(b, b.now, {
      type: 'triangle',
      freq: baseFreq * pitchMult,
      dur: 0.12,
      gain: 0.085,
    });
    this.blip(b, b.now + 0.055, {
      type: 'sine',
      freq: baseFreq * 1.25 * pitchMult,
      dur: 0.18,
      gain: 0.095,
    });
    if (combo >= 4) {
      this.blip(b, b.now + 0.11, {
        type: 'sine',
        freq: baseFreq * 1.5 * pitchMult,
        dur: 0.22,
        gain: 0.075,
      });
    }
  }

  playSoftBounce(intensity: number, tier: number) {
    if (!Number.isFinite(intensity) || !Number.isFinite(tier)) return;
    const b = this.begin();
    if (!b) return;
    const clampedIntensity = Math.max(0.15, Math.min(1, intensity));
    const tierFactor = Math.max(0.42, 1.15 - tier * 0.055);
    const startFreq = 210 * tierFactor * this.vary(0.06);
    const endFreq = 65 * tierFactor;
    this.blip(b, b.now, {
      type: 'sine',
      freq: startFreq,
      freqTo: endFreq,
      dur: 0.065 + tier * 0.004,
      gain: 0.045 * clampedIntensity,
    });
  }

  playBasketSwap() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.02);
    this.blip(b, b.now, {
      type: 'triangle',
      freq: 698.46 * v,
      freqTo: 880 * v,
      dur: 0.065,
      gain: 0.08,
    });
    this.blip(b, b.now + 0.05, {
      type: 'sine',
      freq: 1046.5 * v,
      dur: 0.09,
      gain: 0.07,
    });
  }

  playMeterReady() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.015);
    this.blip(b, b.now, {
      type: 'sine',
      freq: 880 * v,
      dur: 0.09,
      gain: 0.06,
    });
    this.blip(b, b.now + 0.06, {
      type: 'sine',
      freq: 1318.51 * v,
      dur: 0.16,
      gain: 0.075,
    });
  }

  playWildcardShimmer() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.02);
    const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.045, {
        type: 'sine',
        freq: freq * v,
        dur: 0.22,
        gain: 0.065,
      });
    });
  }

  playFizzPop() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.05);
    this.noiseBurst(b, b.now, {dur: 0.22, gain: 0.11, from: 2600, to: 650});
    const bubbles = [480, 680, 920, 1240];
    bubbles.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.035, {
        type: 'sine',
        freq: freq * v,
        freqTo: freq * 1.45 * v,
        dur: 0.075,
        gain: 0.07,
      });
    });
  }

  playReliefSplash() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.015);
    // Warm calming major-7th descending chord
    const chord = [1046.5, 783.99, 659.25, 523.25];
    chord.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.05, {
        type: 'triangle',
        freq: freq * v,
        dur: 0.32,
        gain: 0.055,
      });
    });
  }

  playOrderCheck() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.015);
    this.blip(b, b.now, {
      type: 'sine',
      freq: 1318.51 * v,
      dur: 0.075,
      gain: 0.075,
    });
    this.blip(b, b.now + 0.05, {
      type: 'triangle',
      freq: 1975.53 * v,
      dur: 0.14,
      gain: 0.07,
    });
  }

  playOrderComplete() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.015);
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.055, {
        type: 'triangle',
        freq: freq * v,
        dur: 0.2,
        gain: 0.08,
      });
    });
  }

  playFeverStart() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.01);
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    fanfare.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.055, {
        type: 'triangle',
        freq: freq * v,
        dur: 0.28,
        gain: 0.095,
      });
      this.blip(b, b.now + i * 0.055, {
        type: 'sine',
        freq: freq * 2 * v,
        dur: 0.18,
        gain: 0.045,
      });
    });
    this.noiseBurst(b, b.now + 0.15, {
      dur: 0.25,
      gain: 0.07,
      from: 3200,
      to: 1200,
    });
  }

  playFeverEnd() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.015);
    const notes = [783.99, 659.25, 523.25];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.065, {
        type: 'sine',
        freq: freq * v,
        dur: 0.24,
        gain: 0.06,
      });
    });
  }
}

/** Shared singleton — import and use anywhere. */
export const gameAudio = new GameAudio();

// ============================================================================
// GENERAL UTILITIES & MATH HELPERS
// ============================================================================

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Deterministic string-seeded PRNG (xfnv1a + mulberry32) for Daily Harvest runs.
 */
export function createSeededRng(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  let state = (h >>> 0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Computes today's local calendar Daily Harvest seed key and sequential puzzle number.
 */
export function getDailyHarvestInfo(now = new Date()): {
  seedKey: string;
  dayNumber: number;
  dateLabel: string;
} {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const seedKey = `${year}-${month}-${day}`;
  const epochUtc = Date.UTC(2026, 6, 1); // July 1, 2026 launch epoch
  const todayUtc = Date.UTC(year, now.getMonth(), now.getDate());
  const dayNumber = Math.max(1, Math.floor((todayUtc - epochUtc) / 86400000) + 1);
  return {
    seedKey,
    dayNumber,
    dateLabel: `${year}-${month}-${day}`,
  };
}

export const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const formatTime = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remaining = clamped % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export const prepareCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const scale = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(width * scale);
  const displayHeight = Math.floor(height * scale);

  if (
    ctx.canvas.width !== displayWidth ||
    ctx.canvas.height !== displayHeight
  ) {
    ctx.canvas.width = displayWidth;
    ctx.canvas.height = displayHeight;
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
};

export const createFixedStepper = (stepMs: number, maxSubSteps = 5) => {
  let lastTime = 0;
  let accumulator = 0;

  return (time: number, onStep: (deltaSeconds: number) => void): void => {
    if (lastTime === 0) {
      lastTime = time;
      return;
    }

    const frameMs = Math.min(time - lastTime, stepMs * maxSubSteps);
    lastTime = time;
    accumulator += frameMs;

    let steps = 0;
    while (accumulator >= stepMs && steps < maxSubSteps) {
      onStep(stepMs / 1000);
      accumulator -= stepMs;
      steps += 1;
    }
  };
};

/**
 * A 2D coordinate representing a position in the game world.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * An entity within the game.
 */
export interface Entity extends Position {
  id: string;
  type: string;
  width: number;
  height: number;
  vx: number;
  vy: number;
  [key: string]: any; // Allow flexible properties
}

/**
 * The current phase of the game.
 */
export type GamePhase =
  | 'START'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'VICTORY'
  | 'LEVEL_COMPLETE';

/**
 * The overall state of the game.
 */
export interface GameState {
  status: GamePhase;
  score: number;
  level: number;
  timer?: number;
  moves?: number;
  lives?: number;
  [key: string]: any; // Allow flexible properties
}

/**
 * The music track to be used in the game.
 */
export interface MusicTrack {
  name: string;
  url: string;
  description: string;
}

declare global {
  interface Window {
    PlaygroundSDK: any;
  }
}

/**
 * Configuration for a sprite sheet.
 */
export interface SpriteConfig {
  url: string;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
}

/**
 * Preloads all assets defined in the manifest.
 * Returns a dictionary of loaded images (keyed by manifest ID) and a loading state.
 *
 * WARNING: Generated sprites already have transparent backgrounds removed server-side.
 * Do not run client-side `ctx.getImageData()` loops to strip backgrounds. If you ever
 * call `ctx.getImageData()`, wrap it in `try / catch` and fall back to raw `ctx.drawImage()`
 * in case an external asset fell back to `no-cors` loading.
 */
export function useAssets(manifest: Record<string, string>) {
  const [assets, setAssets] = useState<Record<string, HTMLImageElement | null>>(
    {},
  );
  const [isReady, setIsReady] = useState(false);

  // Stringify the manifest to prevent infinite re-renders if an inline object is passed
  const manifestStr = JSON.stringify(manifest);

  useEffect(() => {
    const currentManifest = JSON.parse(manifestStr) as Record<string, string>;
    const urls = Object.entries(currentManifest);
    if (urls.length === 0) {
      setIsReady(true);
      return;
    }

    let loadedCount = 0;
    const loadedAssets: Record<string, HTMLImageElement | null> = {};

    urls.forEach(([id, url]) => {
      const img = new Image();
      let retriedWithoutCors = false;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedAssets[id] = img; // Keyed by manifest ID for easy lookup
        loadedCount++;
        if (loadedCount === urls.length) {
          setAssets(loadedAssets);
          setIsReady(true);
        }
      };
      img.onerror = () => {
        if (!retriedWithoutCors) {
          retriedWithoutCors = true;
          img.removeAttribute('crossorigin');
          img.src = url;
          return;
        }
        console.warn(`[AssetPreloader] Failed to load asset: ${id} at ${url}`);
        loadedAssets[id] = null;
        loadedCount++;
        if (loadedCount === urls.length) {
          setAssets(loadedAssets);
          setIsReady(true);
        }
      };
      img.src = url;
    });
  }, [manifestStr]);

  return {assets, isReady};
}

/**
 * Safely draws an entire image asset on the canvas. If the asset failed to load,
 * falls back to rendering a primitive geometric shape to prevent crashing.
 *
 * Note: Draws from top-left (consistent with standard Canvas drawImage).
 *
 * WARNING: This draws the WHOLE source image (5-arg drawImage) and does not support
 * frame extraction. For animated spritesheets, use the `html-sprite-renderer` skill
 * (`SpriteRenderer` class) instead.
 */
export function drawAsset(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallbackDraw: (ctx: CanvasRenderingContext2D) => void,
) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    fallbackDraw(ctx);
  }
}

/**
 * Robust background drawing function.
 * If a background image is provided, it draws it covering the full canvas width and height.
 * If camera coordinates are provided, it can optionally do parallax scrolling.
 * If the image fails to load, it falls back to a solid color.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement | null | undefined,
  canvasWidth: number,
  canvasHeight: number,
  fallbackColor = '#222222',
  camX = 0,
  camY = 0,
) {
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    // Parallax logic: scroll the background slightly slower than the camera
    const parallaxFactor = 0.5;
    const bgX = (camX * parallaxFactor) % canvasWidth;
    const bgY = (camY * parallaxFactor) % canvasHeight;

    // Draw a 2x2 grid of the background image to ensure the whole screen is covered during scrolling
    ctx.drawImage(bgImg, -bgX, -bgY, canvasWidth, canvasHeight);
    ctx.drawImage(bgImg, -bgX + canvasWidth, -bgY, canvasWidth, canvasHeight);
    ctx.drawImage(bgImg, -bgX, -bgY + canvasHeight, canvasWidth, canvasHeight);
    ctx.drawImage(
      bgImg,
      -bgX + canvasWidth,
      -bgY + canvasHeight,
      canvasWidth,
      canvasHeight,
    );
  } else {
    // Fallback to solid color
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

/**
 * Detect mobile/touch devices.
 * Checks user agent, pointer capability, and viewport width.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    const touch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    const small = window.innerWidth < 768;
    return ua || touch || small;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0,
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
