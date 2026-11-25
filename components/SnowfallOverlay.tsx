import React from 'react';

export interface SnowfallOverlayProps {
  active?: boolean;
  density?: 'light' | 'medium';
  contained?: boolean;
}

interface SnowflakeSpec {
  id: number;
  leftPct: number;
  sizePx: number;
  opacity: number;
  blurPx: number;
  fallDurationSec: number;
  fallDelaySec: number;
  swayDurationSec: number;
  swayDelaySec: number;
  swayVariant: 'a' | 'b';
}

const MEDIUM_FLAKE_COUNT = 34;
const LIGHT_FLAKE_COUNT = 18;

const ALL_FLAKES: readonly SnowflakeSpec[] = Array.from(
  { length: MEDIUM_FLAKE_COUNT },
  (_, index) => {
    const sizePx = 3 + ((index * 5) % 6); // 3px..8px
    const fallDurationSec = Number((6.5 + ((index * 7) % 10) * 0.75).toFixed(2));
    const swayDurationSec = Number((2.6 + ((index * 3) % 7) * 0.45).toFixed(2));
    const progressOffset = ((index * 11 + 3) % MEDIUM_FLAKE_COUNT) / MEDIUM_FLAKE_COUNT;
    const swayOffset = ((index * 5 + 1) % 10) / 10;

    return {
      id: index,
      leftPct: Number((((index * 29 + 7) % 98) + 1).toFixed(2)),
      sizePx,
      opacity: Number((0.4 + ((index * 7) % 6) * 0.09).toFixed(2)),
      blurPx: index % 4 === 0 ? 0.6 : 0,
      fallDurationSec,
      fallDelaySec: Number((-progressOffset * fallDurationSec).toFixed(2)),
      swayDurationSec,
      swayDelaySec: Number((-swayOffset * swayDurationSec).toFixed(2)),
      swayVariant: index % 2 === 0 ? 'a' : 'b',
    };
  },
);

const LIGHT_FLAKES: readonly SnowflakeSpec[] = ALL_FLAKES.slice(0, LIGHT_FLAKE_COUNT);

const SNOWFALL_CSS = `
@keyframes juicy-snowfall-fall {
  0% {
    transform: translate3d(0, -24px, 0);
  }
  100% {
    transform: translate3d(0, calc(100% + 24px), 0);
  }
}

@keyframes juicy-snowfall-sway-a {
  0% {
    transform: translate3d(-10px, 0, 0);
  }
  100% {
    transform: translate3d(10px, 0, 0);
  }
}

@keyframes juicy-snowfall-sway-b {
  0% {
    transform: translate3d(16px, 0, 0);
  }
  100% {
    transform: translate3d(-16px, 0, 0);
  }
}

.juicy-snowfall-track {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  pointer-events: none;
  will-change: transform;
  animation-name: juicy-snowfall-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.juicy-snowfall-flake {
  display: block;
  border-radius: 9999px;
  background: radial-gradient(
    circle at 35% 35%,
    rgba(255, 255, 255, 0.98),
    rgba(224, 242, 254, 0.78) 70%,
    rgba(255, 255, 255, 0) 100%
  );
  box-shadow:
    0 0 6px rgba(255, 255, 255, 0.68),
    0 1px 2px rgba(15, 23, 42, 0.14);
  will-change: transform;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}

.juicy-snowfall-flake-a {
  animation-name: juicy-snowfall-sway-a;
}

.juicy-snowfall-flake-b {
  animation-name: juicy-snowfall-sway-b;
}

@media (prefers-reduced-motion: reduce) {
  .juicy-snowfall-root {
    display: none;
  }
  .juicy-snowfall-track,
  .juicy-snowfall-flake {
    animation: none !important;
  }
}
`;

export const SnowfallOverlay: React.FC<SnowfallOverlayProps> = ({
  active = true,
  density = 'medium',
  contained = false,
}) => {
  if (!active) {
    return null;
  }

  const flakes = density === 'light' ? LIGHT_FLAKES : ALL_FLAKES;

  return (
    <div
      aria-hidden="true"
      className={`juicy-snowfall-root pointer-events-none select-none overflow-hidden z-20 ${
        contained ? 'absolute inset-0' : 'fixed inset-0'
      }`}
    >
      <style href="juicy-snowfall" precedence="default">
        {SNOWFALL_CSS}
      </style>
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="juicy-snowfall-track"
          style={{
            left: `${flake.leftPct}%`,
            animationDuration: `${flake.fallDurationSec}s`,
            animationDelay: `${flake.fallDelaySec}s`,
          }}
        >
          <span
            className={`juicy-snowfall-flake ${
              flake.swayVariant === 'a'
                ? 'juicy-snowfall-flake-a'
                : 'juicy-snowfall-flake-b'
            }`}
            style={{
              width: `${flake.sizePx}px`,
              height: `${flake.sizePx}px`,
              opacity: flake.opacity,
              filter: flake.blurPx > 0 ? `blur(${flake.blurPx}px)` : undefined,
              animationDuration: `${flake.swayDurationSec}s`,
              animationDelay: `${flake.swayDelaySec}s`,
            }}
          />
        </span>
      ))}
    </div>
  );
};

export default SnowfallOverlay;
