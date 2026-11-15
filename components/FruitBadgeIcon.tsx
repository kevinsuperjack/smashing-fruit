import React, {useEffect, useId, useState} from 'react';
import {FruitTier, SpecialDropKind} from '../constants';

export interface FruitBadgeIconProps {
  tier: FruitTier;
  special?: SpecialDropKind;
  assetUrl?: string;
  imageLoaded?: boolean;
  size?: number;
}

interface SpikePolygon {
  points: string;
  fill: string;
}

const CUCUMBER_STRIPES: readonly string[] = [
  'M 17.1 8.8 Q 13.0 32 17.1 55.2',
  'M 24.7 7.4 Q 22.7 32 24.7 56.6',
  'M 32.0 6.8 Q 32.0 32 32.0 57.2',
  'M 39.3 7.4 Q 41.3 32 39.3 56.6',
  'M 46.9 8.8 Q 51.0 32 46.9 55.2',
];

const CUCUMBER_BUMPS: ReadonlyArray<{cx: number; cy: number; r: number}> = [
  {cx: 19.8, cy: 20.4, r: 2.1},
  {cx: 27.6, cy: 15.0, r: 2.0},
  {cx: 41.6, cy: 19.4, r: 2.1},
  {cx: 17.6, cy: 39.4, r: 2.0},
  {cx: 44.6, cy: 40.2, r: 2.1},
  {cx: 26.2, cy: 48.0, r: 2.0},
  {cx: 37.2, cy: 48.8, r: 2.1},
];

// Precomputed 20-spike alternating golden/lime crown ring around King Durian center (32, 35)
const DURIAN_SPIKES: readonly SpikePolygon[] = (() => {
  const spikeCount = 20;
  const cx = 32;
  const cy = 35;
  const innerR = 18.8;
  const outerR = 25.6;
  const spikes: SpikePolygon[] = [];

  for (let i = 0; i < spikeCount; i++) {
    const a1 = (i / spikeCount) * Math.PI * 2;
    const aMid = ((i + 0.5) / spikeCount) * Math.PI * 2;
    const a2 = ((i + 1) / spikeCount) * Math.PI * 2;

    const x1 = (cx + Math.cos(a1) * innerR).toFixed(2);
    const y1 = (cy + Math.sin(a1) * innerR).toFixed(2);
    const xTip = (cx + Math.cos(aMid) * outerR).toFixed(2);
    const yTip = (cy + Math.sin(aMid) * outerR).toFixed(2);
    const x2 = (cx + Math.cos(a2) * innerR).toFixed(2);
    const y2 = (cy + Math.sin(a2) * innerR).toFixed(2);

    spikes.push({
      points: `${x1},${y1} ${xTip},${yTip} ${x2},${y2}`,
      fill: i % 2 === 0 ? '#E9D846' : '#9EF01A',
    });
  }

  return spikes;
})();

function buildFourPointStarPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = (cx + Math.cos(angle) * r).toFixed(2);
    const y = (cy + Math.sin(angle) * r).toFixed(2);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }
  return `${pts.join(' ')} Z`;
}

const LEFT_EYE_STAR = buildFourPointStarPath(23.6, 33.1, 2.35, 0.85);
const RIGHT_EYE_STAR = buildFourPointStarPath(38.6, 33.1, 2.35, 0.85);

export function FruitBadgeIcon({
  tier,
  special = 'none',
  assetUrl,
  imageLoaded,
  size = 24,
}: FruitBadgeIconProps): React.ReactElement {
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [assetUrl]);

  // Special 1: Rainbow Dewdrop Wildcard SVG
  if (special === 'rainbow') {
    const rainbowGradId = `rainbow-dew-${safeId}`;
    const rainbowRingId = `rainbow-ring-${safeId}`;
    const starPath = buildFourPointStarPath(44, 19, 6.5, 2.2);

    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{width: size, height: size}}
        role="img"
        aria-label="Rainbow Dewdrop"
        className="pointer-events-none select-none shrink-0"
      >
        <defs>
          <linearGradient id={rainbowGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF595E" />
            <stop offset="25%" stopColor="#FFCA3A" />
            <stop offset="50%" stopColor="#8AC926" />
            <stop offset="75%" stopColor="#1982C4" />
            <stop offset="100%" stopColor="#B5179E" />
          </linearGradient>
          <linearGradient id={rainbowRingId} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F472B6" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r="27"
          fill={`url(#${rainbowGradId})`}
          stroke={`url(#${rainbowRingId})`}
          strokeWidth="3.5"
        />
        <ellipse
          cx="23"
          cy="20"
          rx="8.5"
          ry="5"
          transform="rotate(-28 23 20)"
          fill="#FFFFFF"
          fillOpacity="0.65"
        />
        <path d={starPath} fill="#FFFFFF" />
        <circle cx="24" cy="34" r="3" fill="#2C1810" />
        <circle cx="40" cy="34" r="3" fill="#2C1810" />
        <circle cx="23" cy="33" r="1.2" fill="#FFFFFF" />
        <circle cx="39" cy="33" r="1.2" fill="#FFFFFF" />
        <path
          d="M 27.5 39 Q 32 43.5 36.5 39"
          fill="none"
          stroke="#2C1810"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Special 2: Fizz Berry Catalyst SVG
  if (special === 'fizz') {
    const fizzGradId = `fizz-berry-${safeId}`;

    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{width: size, height: size}}
        role="img"
        aria-label="Fizz Berry"
        className="pointer-events-none select-none shrink-0"
      >
        <defs>
          <radialGradient id={fizzGradId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="55%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#0E7490" />
          </radialGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r="27"
          fill={`url(#${fizzGradId})`}
          stroke="#67E8F9"
          strokeWidth="3.5"
          strokeDasharray="6 3"
        />
        {/* Effervescent internal bubbles */}
        <circle cx="20" cy="21" r="4" fill="#FFFFFF" fillOpacity="0.55" />
        <circle cx="44" cy="22" r="3" fill="#FEF08A" fillOpacity="0.7" />
        <circle cx="18" cy="43" r="2.6" fill="#FFFFFF" fillOpacity="0.5" />
        <circle cx="45" cy="44" r="3.4" fill="#A7F3D0" fillOpacity="0.65" />
        <circle cx="32" cy="16" r="2.2" fill="#FFFFFF" fillOpacity="0.7" />
        {/* Cute energetic face */}
        <circle cx="24" cy="33" r="3.1" fill="#083344" />
        <circle cx="40" cy="33" r="3.1" fill="#083344" />
        <circle cx="23" cy="32" r="1.2" fill="#FFFFFF" />
        <circle cx="39" cy="32" r="1.2" fill="#FFFFFF" />
        <path
          d="M 27 38.5 Q 32 44 37 38.5 Z"
          fill="#F43F5E"
          stroke="#083344"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  // Tier 6: Procedural Cucumber SVG
  if (tier.tier === 6) {
    const cucumberClipId = `cucumber-clip-${safeId}`;
    const cucumberSheenId = `cucumber-sheen-${safeId}`;

    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{width: size, height: size}}
        role="img"
        aria-label={tier.name}
        className="pointer-events-none select-none shrink-0"
      >
        <defs>
          <clipPath id={cucumberClipId}>
            <circle cx="32" cy="32" r="27" />
          </clipPath>
          <radialGradient id={cucumberSheenId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#52D616" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#38B000" stopOpacity="0" />
            <stop offset="100%" stopColor="#195703" stopOpacity="0.22" />
          </radialGradient>
        </defs>

        {/* Rich cucumber green base */}
        <circle cx="32" cy="32" r="27" fill="#38B000" />

        {/* Clipped stripes, sheen, and lime bumps */}
        <g clipPath={`url(#${cucumberClipId})`}>
          <circle cx="32" cy="32" r="27" fill={`url(#${cucumberSheenId})`} />

          {/* Curved longitudinal stripes */}
          {CUCUMBER_STRIPES.map((d, idx) => (
            <path
              key={idx}
              d={d}
              fill="none"
              stroke="#1F7A00"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          ))}

          {/* Bright lime bumpy dots */}
          {CUCUMBER_BUMPS.map((bump, idx) => (
            <circle
              key={idx}
              cx={bump.cx}
              cy={bump.cy}
              r={bump.r}
              fill="#70E000"
            />
          ))}

          {/* Soft glossy top-left highlight */}
          <ellipse
            cx="21.5"
            cy="16.5"
            rx="5.6"
            ry="2.8"
            transform="rotate(-32 21.5 16.5)"
            fill="#FFFFFF"
            fillOpacity="0.32"
          />
        </g>

        {/* Crisp dark green outer outline */}
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="#195703"
          strokeWidth="3.2"
        />

        {/* Rosy kawaii cheeks */}
        <ellipse cx="20.2" cy="35.2" rx="4.2" ry="2.7" fill="#FF788C" fillOpacity="0.6" />
        <ellipse cx="43.8" cy="35.2" rx="4.2" ry="2.7" fill="#FF788C" fillOpacity="0.6" />

        {/* Cute sparkling eyes */}
        <circle cx="24" cy="31" r="3.4" fill="#2C1810" />
        <circle cx="40" cy="31" r="3.4" fill="#2C1810" />
        <circle cx="22.8" cy="29.7" r="1.35" fill="#FFFFFF" />
        <circle cx="38.8" cy="29.7" r="1.35" fill="#FFFFFF" />
        <circle cx="25.1" cy="32.2" r="0.65" fill="#FFFFFF" />
        <circle cx="41.1" cy="32.2" r="0.65" fill="#FFFFFF" />

        {/* Happy bouncy smile */}
        <path
          d="M 28.4 34.2 A 3.6 3.6 0 0 0 35.6 34.2 Z"
          fill="#C84B31"
          stroke="#2C1810"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Tier 13: Procedural King Durian SVG
  if (tier.tier === 13) {
    const durianBodyGradId = `durian-body-${safeId}`;

    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{width: size, height: size}}
        role="img"
        aria-label={tier.name}
        className="pointer-events-none select-none shrink-0"
      >
        <defs>
          <radialGradient id={durianBodyGradId} cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#D4F754" />
            <stop offset="60%" stopColor="#9EF01A" />
            <stop offset="100%" stopColor="#539E00" />
          </radialGradient>
        </defs>

        {/* Alternating golden/lime spiky crown ring */}
        <g stroke="#70B800" strokeWidth="1.6" strokeLinejoin="round">
          {DURIAN_SPIKES.map((spike, idx) => (
            <polygon key={idx} points={spike.points} fill={spike.fill} />
          ))}
        </g>

        {/* Radial golden-green body */}
        <circle
          cx="32"
          cy="35"
          r="21.2"
          fill={`url(#${durianBodyGradId})`}
          stroke="#3A7000"
          strokeWidth="2.8"
        />

        {/* Subtle glossy sheen */}
        <ellipse
          cx="23.5"
          cy="23.5"
          rx="5.2"
          ry="2.5"
          transform="rotate(-30 23.5 23.5)"
          fill="#FFFFFF"
          fillOpacity="0.3"
        />

        {/* Rosy royal cheeks */}
        <ellipse cx="20.8" cy="38.2" rx="3.8" ry="2.4" fill="#FF788C" fillOpacity="0.55" />
        <ellipse cx="43.2" cy="38.2" rx="3.8" ry="2.4" fill="#FF788C" fillOpacity="0.55" />

        {/* Confident brows */}
        <path
          d="M 21.2 29.2 Q 24.5 27.8 27.5 29.6"
          fill="none"
          stroke="#2C1810"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M 42.8 29.2 Q 39.5 27.8 36.5 29.6"
          fill="none"
          stroke="#2C1810"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Confident kawaii eyes with golden star highlights */}
        <circle cx="24.5" cy="34" r="3.6" fill="#2C1810" />
        <circle cx="39.5" cy="34" r="3.6" fill="#2C1810" />
        <path d={LEFT_EYE_STAR} fill="#FFD700" />
        <path d={RIGHT_EYE_STAR} fill="#FFD700" />
        <circle cx="25.8" cy="35.3" r="0.65" fill="#FFFFFF" />
        <circle cx="40.8" cy="35.3" r="0.65" fill="#FFFFFF" />

        {/* Regal happy smile */}
        <path
          d="M 28.2 37.4 A 3.8 3.8 0 0 0 35.8 37.4 Z"
          fill="#C84B31"
          stroke="#2C1810"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />

        {/* Royal golden crown on top */}
        <g>
          <polygon
            points="22.5,17.2 21.2,8.4 27.2,12.6 32,5.0 36.8,12.6 42.8,8.4 41.5,17.2"
            fill="#FFD700"
            stroke="#B45309"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <line
            x1="23.2"
            y1="15.0"
            x2="40.8"
            y2="15.0"
            stroke="#B45309"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeOpacity="0.55"
          />
          {/* Ruby crown jewels */}
          <circle cx="21.2" cy="7.8" r="1.9" fill="#E63946" stroke="#B45309" strokeWidth="0.9" />
          <circle cx="32" cy="4.5" r="2.2" fill="#E63946" stroke="#B45309" strokeWidth="0.9" />
          <circle cx="42.8" cy="7.8" r="1.9" fill="#E63946" stroke="#B45309" strokeWidth="0.9" />
          <circle cx="32" cy="12.8" r="1.5" fill="#E63946" />
        </g>
      </svg>
    );
  }

  // Standard tiers (1..5, 7..12): Render sprite image when available and loaded
  if (assetUrl && imageLoaded !== false && !imgError) {
    return (
      <img
        src={assetUrl}
        alt={tier.name}
        style={{width: size, height: size}}
        className="object-contain pointer-events-none select-none"
        onError={() => setImgError(true)}
      />
    );
  }

  // Glossy kawaii fallback SVG circle in tier.color
  const fallbackGlossId = `fallback-gloss-${safeId}`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{width: size, height: size}}
      role="img"
      aria-label={tier.name}
      className="pointer-events-none select-none shrink-0"
    >
      <defs>
        <radialGradient id={fallbackGlossId} cx="34%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.42" />
          <stop offset="52%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
        </radialGradient>
      </defs>

      {/* Subtle outer shadow ring for contrast on pastel backgrounds */}
      <circle cx="32" cy="32" r="28" fill="rgba(44, 24, 16, 0.22)" />

      {/* Main fruit-colored body + 3D gloss */}
      <circle
        cx="32"
        cy="32"
        r="26.5"
        fill={tier.color}
        stroke="#FFFFFF"
        strokeWidth="2.8"
      />
      <circle cx="32" cy="32" r="25.2" fill={`url(#${fallbackGlossId})`} />

      {/* Specular highlight */}
      <ellipse
        cx="22"
        cy="18.5"
        rx="6.2"
        ry="3.2"
        transform="rotate(-32 22 18.5)"
        fill="#FFFFFF"
        fillOpacity="0.55"
      />
      <circle cx="16.8" cy="24.8" r="1.7" fill="#FFFFFF" fillOpacity="0.45" />

      {/* Rosy kawaii cheeks */}
      <ellipse cx="20.5" cy="35.5" rx="4.0" ry="2.6" fill="#FF788C" fillOpacity="0.55" />
      <ellipse cx="43.5" cy="35.5" rx="4.0" ry="2.6" fill="#FF788C" fillOpacity="0.55" />

      {/* Cute kawaii eyes + sparkles */}
      <circle cx="24.2" cy="31.5" r="3.2" fill="#2C1810" />
      <circle cx="39.8" cy="31.5" r="3.2" fill="#2C1810" />
      <circle cx="23.1" cy="30.3" r="1.25" fill="#FFFFFF" />
      <circle cx="38.7" cy="30.3" r="1.25" fill="#FFFFFF" />

      {/* Sweet smile */}
      <path
        d="M 28.6 34.8 Q 32 38.4 35.4 34.8"
        fill="none"
        stroke="#2C1810"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default FruitBadgeIcon;
