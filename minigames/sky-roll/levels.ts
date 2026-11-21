import type { CoinDef, SkyLevelDef } from './types';

function makeCoinLine(
  prefix: string,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
  zStart: number,
  zEnd: number,
  count: number,
  arcHeight = 0,
): CoinDef[] {
  const coins: CoinDef[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const arc = arcHeight > 0 ? Math.sin(t * Math.PI) * arcHeight : 0;
    coins.push({
      id: `${prefix}_${i}`,
      x: xStart + (xEnd - xStart) * t,
      y: yStart + (yEnd - yStart) * t + 0.95 + arc,
      z: zStart + (zEnd - zStart) * t,
    });
  }
  return coins;
}

export const SKY_ROLL_LEVELS: SkyLevelDef[] = [
  // =========================================================================
  // LEVEL 1 — SUNNY STARTER (Sunny Meadow)
  // Wide planks, gentle turns, coin lines, intro checkpoint, zero deadly gaps
  // =========================================================================
  {
    id: 1,
    name: 'Sunny Starter',
    theme: 'meadow',
    subtitle: 'Roll & steer along the sunny meadow skyway!',
    parTimeSec: 28,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -116,
    segments: [
      { id: 'l1_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -28, width: 6.4, yStart: 0, yEnd: 0 },
      { id: 'l1_s2', kind: 'straight', x: 1.8, zStart: -26, zEnd: -54, width: 6.0, yStart: 0, yEnd: 0, checkpointAtZ: -44 },
      { id: 'l1_s3', kind: 'straight', x: -1.4, zStart: -52, zEnd: -82, width: 5.8, yStart: 0, yEnd: 0, boostAtZ: -64 },
      { id: 'l1_s4', kind: 'ramp', x: 0, zStart: -80, zEnd: -102, width: 5.8, yStart: 0, yEnd: 1.6 },
      { id: 'l1_fin', kind: 'finish', x: 0, zStart: -100, zEnd: -124, width: 7.4, yStart: 1.6, yEnd: 1.6 },
    ],
    obstacles: [
      { id: 'l1_b1', kind: 'bumper', x: 0, y: 0, z: -38, size: 1.1, height: 1.2, range: 0.75, speed: 0 },
      { id: 'l1_b2', kind: 'bumper', x: -1.6, y: 0, z: -72, size: 1.1, height: 1.2, range: 0.75, speed: 0 },
    ],
    coins: [
      ...makeCoinLine('l1_c1', 0, 0, 0, 0, -4, -22, 6),
      ...makeCoinLine('l1_c2', 1.8, 1.8, 0, 0, -30, -50, 5),
      ...makeCoinLine('l1_c3', -1.4, -1.4, 0, 0, -58, -76, 5),
      ...makeCoinLine('l1_c4', 0, 0, 0.2, 1.6, -84, -108, 6),
    ],
  },

  // =========================================================================
  // LEVEL 2 — HOP & ROLL (Sunny Meadow)
  // Introduces short jumps & golden bounce pads with clear coin arcs
  // =========================================================================
  {
    id: 2,
    name: 'Hop & Roll',
    theme: 'meadow',
    subtitle: 'Tap JUMP or hit golden bounce pads to hop over gaps!',
    parTimeSec: 32,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -126,
    segments: [
      { id: 'l2_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -24, width: 5.8, yStart: 0, yEnd: 0, kidAutoBounceAtZ: -22.2 },
      // 3.2 unit gap
      { id: 'l2_s2', kind: 'straight', x: 0, zStart: -27.2, zEnd: -54, width: 5.6, yStart: 0, yEnd: 0, bouncePadAtZ: -51.8, bounceVelocityY: 14.5, bounceVelocityZ: -12.5 },
      // 5.8 unit bounce gap
      { id: 'l2_s3', kind: 'straight', x: 1.4, zStart: -59.8, zEnd: -88, width: 5.4, yStart: 0.8, yEnd: 0.8, checkpointAtZ: -64, kidAutoBounceAtZ: -86.2 },
      // 3.4 unit gap
      { id: 'l2_s4', kind: 'straight', x: -1.0, zStart: -91.4, zEnd: -112, width: 5.4, yStart: 0.8, yEnd: 0.8, boostAtZ: -102 },
      { id: 'l2_fin', kind: 'finish', x: 0, zStart: -110, zEnd: -134, width: 7.4, yStart: 0.8, yEnd: 0.8 },
    ],
    obstacles: [
      { id: 'l2_b1', kind: 'bumper', x: 1.4, y: 0.8, z: -74, size: 1.1, height: 1.2, range: 0.8, speed: 0 },
    ],
    coins: [
      ...makeCoinLine('l2_c1', 0, 0, 0, 0, -5, -19, 5),
      ...makeCoinLine('l2_c2', 0, 0, 0, 0, -23.5, -28, 3, 1.3),
      ...makeCoinLine('l2_c3', 0, 1.4, 0, 0.8, -52.5, -60, 4, 2.5),
      ...makeCoinLine('l2_c4', 1.4, -1.0, 0.8, 0.8, -70, -84, 4),
      ...makeCoinLine('l2_c5', -1.0, 0, 0.8, 0.8, -96, -118, 5),
    ],
  },

  // =========================================================================
  // LEVEL 3 — RAINBOW SLIDE (Rainbow Bridges)
  // Speed boosts, colorful ramps, elevated sky bridge
  // =========================================================================
  {
    id: 3,
    name: 'Rainbow Slide',
    theme: 'rainbow',
    subtitle: 'Zoom across rainbow ramps and glowing speed strips!',
    parTimeSec: 34,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -138,
    segments: [
      { id: 'l3_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -20, width: 5.6, yStart: 0, yEnd: 0, boostAtZ: -14, color: '#F9A8D4' },
      { id: 'l3_s2', kind: 'ramp', x: 0, zStart: -18, zEnd: -44, width: 5.4, yStart: 0, yEnd: 3.4, color: '#FDE047' },
      { id: 'l3_s3', kind: 'straight', x: 2.2, zStart: -42, zEnd: -70, width: 5.2, yStart: 3.4, yEnd: 3.4, checkpointAtZ: -52, color: '#86EFAC', kidAutoBounceAtZ: -68.2 },
      // 3.5 unit gap descending
      { id: 'l3_s4', kind: 'ramp', x: -1.4, zStart: -73.5, zEnd: -100, width: 5.2, yStart: 3.0, yEnd: 0.6, color: '#93C5FD', boostAtZ: -86 },
      { id: 'l3_s5', kind: 'straight', x: 0, zStart: -98, zEnd: -122, width: 5.0, yStart: 0.6, yEnd: 0.6, color: '#C4B5FD' },
      { id: 'l3_fin', kind: 'finish', x: 0, zStart: -120, zEnd: -146, width: 7.4, yStart: 0.6, yEnd: 0.6 },
    ],
    obstacles: [
      { id: 'l3_b1', kind: 'bumper', x: 2.2, y: 3.4, z: -60, size: 1.1, height: 1.3, range: 0.8, speed: 0 },
      { id: 'l3_b2', kind: 'bumper', x: -1.4, y: 0.6, z: -108, size: 1.1, height: 1.3, range: 0.8, speed: 0 },
      { id: 'l3_b3', kind: 'bumper', x: 1.4, y: 0.6, z: -115, size: 1.1, height: 1.3, range: 0.8, speed: 0 },
    ],
    coins: [
      ...makeCoinLine('l3_c1', 0, 0, 0, 3.2, -16, -40, 6),
      ...makeCoinLine('l3_c2', 2.2, 2.2, 3.4, 3.4, -48, -66, 5),
      ...makeCoinLine('l3_c3', -1.4, -1.4, 2.8, 0.8, -76, -96, 5),
      ...makeCoinLine('l3_c4', 0, 0, 0.6, 0.6, -104, -128, 6),
    ],
  },

  // =========================================================================
  // LEVEL 4 — PEEK-A-BOO GATES (Rainbow Bridges)
  // Introduces gentle sliding wooden barriers
  // =========================================================================
  {
    id: 4,
    name: 'Peek-a-Boo Gates',
    theme: 'rainbow',
    subtitle: 'Time your roll past the sliding rainbow gates!',
    parTimeSec: 36,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -136,
    segments: [
      { id: 'l4_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -36, width: 5.6, yStart: 0, yEnd: 0, color: '#FDE68A' },
      { id: 'l4_s2', kind: 'straight', x: 0, zStart: -34, zEnd: -68, width: 5.4, yStart: 0, yEnd: 0, checkpointAtZ: -54, color: '#A7F3D0', kidAutoBounceAtZ: -66.2 },
      // 3.6 unit gap
      { id: 'l4_s3', kind: 'straight', x: 0, zStart: -71.6, zEnd: -118, width: 5.4, yStart: 0, yEnd: 0, boostAtZ: -108, color: '#BFDBFE' },
      { id: 'l4_fin', kind: 'finish', x: 0, zStart: -116, zEnd: -144, width: 7.4, yStart: 0, yEnd: 0 },
    ],
    obstacles: [
      { id: 'l4_o1', kind: 'slider', x: 0, y: 0, z: -18, size: 2.2, height: 1.5, range: 1.9, speed: 1.5, phase: 0 },
      { id: 'l4_o2', kind: 'slider', x: 0, y: 0, z: -42, size: 2.3, height: 1.5, range: 1.9, speed: 1.7, phase: 2.1 },
      { id: 'l4_o3', kind: 'slider', x: 0, y: 0, z: -84, size: 2.3, height: 1.5, range: 2.0, speed: 1.8, phase: 1.0 },
      { id: 'l4_o4', kind: 'slider', x: 0, y: 0, z: -98, size: 2.2, height: 1.5, range: 2.0, speed: 1.9, phase: 3.4 },
    ],
    coins: [
      ...makeCoinLine('l4_c1', 0, 0, 0, 0, -6, -30, 6),
      ...makeCoinLine('l4_c2', 0, 0, 0, 0, -48, -64, 5),
      ...makeCoinLine('l4_c3', 0, 0, 0, 0, -76, -112, 7),
    ],
  },

  // =========================================================================
  // LEVEL 5 — CLOUD HOPPER (Bouncy Clouds)
  // High-flying bounce pads launching across tiered sky cloud islands!
  // =========================================================================
  {
    id: 5,
    name: 'Cloud Hopper',
    theme: 'clouds',
    subtitle: 'Boing from cloud island to cloud island high in the sky!',
    parTimeSec: 36,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -142,
    segments: [
      { id: 'l5_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -22, width: 5.6, yStart: 0, yEnd: 0, bouncePadAtZ: -19.8, bounceVelocityY: 15.0, bounceVelocityZ: -13.0 },
      // 6.2 unit bounce gap -> +1.5 elevation
      { id: 'l5_s2', kind: 'straight', x: 0, zStart: -28.2, zEnd: -54, width: 5.4, yStart: 1.5, yEnd: 1.5, bouncePadAtZ: -51.8, bounceVelocityY: 15.2, bounceVelocityZ: -13.2 },
      // 6.4 unit bounce gap -> +1.5 elevation
      { id: 'l5_s3', kind: 'straight', x: 1.6, zStart: -60.4, zEnd: -88, width: 5.6, yStart: 3.0, yEnd: 3.0, checkpointAtZ: -66, bouncePadAtZ: -85.8, bounceVelocityY: 15.0, bounceVelocityZ: -13.2 },
      // 6.5 unit bounce gap -> down to 2.0
      { id: 'l5_s4', kind: 'straight', x: -1.2, zStart: -94.5, zEnd: -124, width: 5.2, yStart: 2.0, yEnd: 2.0, boostAtZ: -112 },
      { id: 'l5_fin', kind: 'finish', x: 0, zStart: -122, zEnd: -150, width: 7.4, yStart: 2.0, yEnd: 2.0 },
    ],
    obstacles: [
      { id: 'l5_o1', kind: 'slider', x: 1.6, y: 3.0, z: -76, size: 2.0, height: 1.5, range: 1.8, speed: 1.6, phase: 0.5 },
      { id: 'l5_o2', kind: 'bumper', x: -1.2, y: 2.0, z: -104, size: 1.2, height: 1.3, range: 0.85, speed: 0 },
    ],
    coins: [
      ...makeCoinLine('l5_c1', 0, 0, 0, 1.5, -20.5, -28.5, 4, 2.8),
      ...makeCoinLine('l5_c2', 0, 1.6, 1.5, 3.0, -52.5, -60.5, 4, 2.8),
      ...makeCoinLine('l5_c3', 1.6, -1.2, 3.0, 2.0, -86.5, -94.5, 4, 2.8),
      ...makeCoinLine('l5_c4', -1.2, 0, 2.0, 2.0, -100, -132, 6),
    ],
  },

  // =========================================================================
  // LEVEL 6 — MOVING BRIDGES (Bouncy Clouds)
  // Introduces smooth gliding lateral & forward moving sky platforms
  // =========================================================================
  {
    id: 6,
    name: 'Moving Bridges',
    theme: 'clouds',
    subtitle: 'Ride the gliding sky bridges across the clouds!',
    parTimeSec: 40,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -136,
    segments: [
      { id: 'l6_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -22, width: 5.4, yStart: 0, yEnd: 0, kidAutoBounceAtZ: -20.4 },
      // Lateral moving bridge (small 2.2 gap on each end)
      { id: 'l6_m1', kind: 'moving', x: 0, zStart: -24.2, zEnd: -44, width: 5.0, yStart: 0, yEnd: 0, moveAxis: 'x', moveRange: 2.6, moveSpeed: 1.25, movePhase: 0, noGuardrails: true },
      { id: 'l6_s2', kind: 'straight', x: 0, zStart: -46.2, zEnd: -74, width: 5.4, yStart: 0, yEnd: 0, checkpointAtZ: -56, kidAutoBounceAtZ: -72.4 },
      // Second lateral moving bridge
      { id: 'l6_m2', kind: 'moving', x: 0, zStart: -76.2, zEnd: -96, width: 4.8, yStart: 0, yEnd: 0, moveAxis: 'x', moveRange: 3.0, moveSpeed: 1.4, movePhase: 1.5, noGuardrails: true },
      { id: 'l6_s3', kind: 'straight', x: 0, zStart: -98.2, zEnd: -120, width: 5.2, yStart: 0, yEnd: 0, boostAtZ: -108 },
      { id: 'l6_fin', kind: 'finish', x: 0, zStart: -118, zEnd: -144, width: 7.4, yStart: 0, yEnd: 0 },
    ],
    obstacles: [
      { id: 'l6_o1', kind: 'slider', x: 0, y: 0, z: -64, size: 2.1, height: 1.4, range: 1.8, speed: 1.6, phase: 0 },
    ],
    coins: [
      ...makeCoinLine('l6_c1', 0, 0, 0, 0, -6, -18, 4),
      ...makeCoinLine('l6_c2', 0, 0, 0, 0, -28, -40, 4),
      ...makeCoinLine('l6_c3', 0, 0, 0, 0, -52, -70, 5),
      ...makeCoinLine('l6_c4', 0, 0, 0, 0, -80, -92, 4),
      ...makeCoinLine('l6_c5', 0, 0, 0, 0, -104, -126, 5),
    ],
  },

  // =========================================================================
  // LEVEL 7 — SPINNY WINDMILLS (Windmill Towers)
  // Introduces rotating candy-striped windmill sweeper bars!
  // =========================================================================
  {
    id: 7,
    name: 'Spinny Windmills',
    theme: 'windmill',
    subtitle: 'Hop over the spinning golden windmill arms!',
    parTimeSec: 40,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -140,
    segments: [
      { id: 'l7_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -44, width: 5.6, yStart: 0, yEnd: 0 },
      { id: 'l7_s2', kind: 'ramp', x: 0, zStart: -42, zEnd: -66, width: 5.2, yStart: 0, yEnd: 2.2, checkpointAtZ: -58 },
      { id: 'l7_s3', kind: 'straight', x: 0, zStart: -64, zEnd: -122, width: 5.6, yStart: 2.2, yEnd: 2.2, boostAtZ: -112 },
      { id: 'l7_fin', kind: 'finish', x: 0, zStart: -120, zEnd: -148, width: 7.4, yStart: 2.2, yEnd: 2.2 },
    ],
    obstacles: [
      { id: 'l7_w1', kind: 'windmill', x: 0, y: 0, z: -22, size: 5.0, height: 0.75, range: 0, speed: 1.35, phase: 0 },
      { id: 'l7_w2', kind: 'windmill', x: 0, y: 2.2, z: -80, size: 5.2, height: 0.75, range: 0, speed: -1.5, phase: 0.8 },
      { id: 'l7_w3', kind: 'windmill', x: 0, y: 2.2, z: -100, size: 5.2, height: 0.75, range: 0, speed: 1.65, phase: 1.6 },
    ],
    coins: [
      ...makeCoinLine('l7_c1', 0, 0, 0, 0, -6, -16, 4),
      ...makeCoinLine('l7_c2', 0, 0, 0, 2.0, -32, -56, 6),
      ...makeCoinLine('l7_c3', 0, 0, 2.2, 2.2, -70, -114, 8),
    ],
  },

  // =========================================================================
  // LEVEL 8 — ZIG-ZAG SKYWAY (Windmill Towers)
  // Narrow balance paths (guardrailed in Kid Mode), quick turns & boosts
  // =========================================================================
  {
    id: 8,
    name: 'Zig-Zag Skyway',
    theme: 'windmill',
    subtitle: 'Steer smoothly along the zig-zag sky beams!',
    parTimeSec: 42,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -146,
    segments: [
      { id: 'l8_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -24, width: 4.8, yStart: 0, yEnd: 0 },
      { id: 'l8_s2', kind: 'straight', x: 2.4, zStart: -22, zEnd: -48, width: 4.0, yStart: 0, yEnd: 0 },
      { id: 'l8_s3', kind: 'straight', x: -1.6, zStart: -46, zEnd: -74, width: 4.0, yStart: 0, yEnd: 0, checkpointAtZ: -58, kidAutoBounceAtZ: -72.2 },
      // 3.8 unit gap
      { id: 'l8_s4', kind: 'straight', x: 1.8, zStart: -77.8, zEnd: -104, width: 3.8, yStart: 0, yEnd: 0, boostAtZ: -92 },
      { id: 'l8_s5', kind: 'ramp', x: 0, zStart: -102, zEnd: -128, width: 4.4, yStart: 0, yEnd: 2.4 },
      { id: 'l8_fin', kind: 'finish', x: 0, zStart: -126, zEnd: -154, width: 7.4, yStart: 2.4, yEnd: 2.4 },
    ],
    obstacles: [
      { id: 'l8_o1', kind: 'bumper', x: 2.4, y: 0, z: -36, size: 1.0, height: 1.2, range: 0.7, speed: 0 },
      { id: 'l8_o2', kind: 'slider', x: -1.6, y: 0, z: -64, size: 1.8, height: 1.4, range: 1.3, speed: 1.8, phase: 0.3 },
      { id: 'l8_o3', kind: 'windmill', x: 1.8, y: 0, z: -88, size: 4.0, height: 0.75, range: 0, speed: 1.55, phase: 0 },
    ],
    coins: [
      ...makeCoinLine('l8_c1', 0, 2.4, 0, 0, -8, -32, 5),
      ...makeCoinLine('l8_c2', 2.4, -1.6, 0, 0, -40, -68, 5),
      ...makeCoinLine('l8_c3', 1.8, 1.8, 0, 0, -82, -100, 5),
      ...makeCoinLine('l8_c4', 0, 0, 0.2, 2.4, -106, -134, 6),
    ],
  },

  // =========================================================================
  // LEVEL 9 — ROYAL GAUNTLET (King Durian Castle)
  // Combines moving platforms, bounce pads, sliding gates & twin windmills
  // =========================================================================
  {
    id: 9,
    name: 'Royal Gauntlet',
    theme: 'castle',
    subtitle: 'Master moving bridges, windmills & royal bounce pads!',
    parTimeSec: 46,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -156,
    segments: [
      { id: 'l9_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -28, width: 5.0, yStart: 0, yEnd: 0, kidAutoBounceAtZ: -26.2 },
      { id: 'l9_m1', kind: 'moving', x: 0, zStart: -30.2, zEnd: -50, width: 4.6, yStart: 0, yEnd: 0, moveAxis: 'x', moveRange: 2.8, moveSpeed: 1.5, movePhase: 0, noGuardrails: true },
      { id: 'l9_s2', kind: 'straight', x: 0, zStart: -52.2, zEnd: -84, width: 5.0, yStart: 0, yEnd: 0, checkpointAtZ: -60, bouncePadAtZ: -81.8, bounceVelocityY: 15.4, bounceVelocityZ: -13.4 },
      // 6.6 unit bounce gap -> +2.0 elevation
      { id: 'l9_s3', kind: 'straight', x: 0, zStart: -90.6, zEnd: -136, width: 5.0, yStart: 2.0, yEnd: 2.0, boostAtZ: -124 },
      { id: 'l9_fin', kind: 'finish', x: 0, zStart: -134, zEnd: -164, width: 7.6, yStart: 2.0, yEnd: 2.0 },
    ],
    obstacles: [
      { id: 'l9_o1', kind: 'slider', x: 0, y: 0, z: -16, size: 2.1, height: 1.5, range: 1.8, speed: 1.9, phase: 0 },
      { id: 'l9_o2', kind: 'windmill', x: 0, y: 0, z: -72, size: 4.8, height: 0.75, range: 0, speed: 1.6, phase: 0.4 },
      { id: 'l9_o3', kind: 'slider', x: 0, y: 2.0, z: -102, size: 2.2, height: 1.5, range: 1.9, speed: 2.0, phase: 1.2 },
      { id: 'l9_o4', kind: 'windmill', x: 0, y: 2.0, z: -116, size: 4.8, height: 0.75, range: 0, speed: -1.75, phase: 2.0 },
    ],
    coins: [
      ...makeCoinLine('l9_c1', 0, 0, 0, 0, -6, -24, 5),
      ...makeCoinLine('l9_c2', 0, 0, 0, 0, -34, -46, 4),
      ...makeCoinLine('l9_c3', 0, 0, 0, 2.0, -82.5, -91, 4, 2.8),
      ...makeCoinLine('l9_c4', 0, 0, 2.0, 2.0, -96, -142, 8),
    ],
  },

  // =========================================================================
  // LEVEL 10 — KING DURIAN SUMMIT (King Durian Castle)
  // Grand finale climb with rainbow boost ramp & royal castle finish!
  // =========================================================================
  {
    id: 10,
    name: 'King Durian Summit',
    theme: 'castle',
    subtitle: 'The grand sky finale — race to King Durian’s Castle!',
    parTimeSec: 50,
    spawn: { x: 0, y: 0.7, z: 2 },
    finishZ: -168,
    segments: [
      { id: 'l10_s1', kind: 'straight', x: 0, zStart: 5, zEnd: -28, width: 4.8, yStart: 0, yEnd: 0, boostAtZ: -18, kidAutoBounceAtZ: -26.2 },
      // 3.8 unit gap
      { id: 'l10_s2', kind: 'ramp', x: 1.2, zStart: -31.8, zEnd: -60, width: 4.6, yStart: 0, yEnd: 3.0 },
      { id: 'l10_m1', kind: 'moving', x: 0, zStart: -62.2, zEnd: -82, width: 4.6, yStart: 3.0, yEnd: 3.0, moveAxis: 'x', moveRange: 3.0, moveSpeed: 1.6, movePhase: 0.7, noGuardrails: true },
      { id: 'l10_s3', kind: 'straight', x: 0, zStart: -84.2, zEnd: -114, width: 4.8, yStart: 3.0, yEnd: 3.0, checkpointAtZ: -92, bouncePadAtZ: -111.8, bounceVelocityY: 15.6, bounceVelocityZ: -13.6 },
      // 6.8 unit bounce gap -> +2.0 elevation
      { id: 'l10_s4', kind: 'ramp', x: 0, zStart: -120.8, zEnd: -148, width: 4.6, yStart: 5.0, yEnd: 7.2, boostAtZ: -136 },
      { id: 'l10_fin', kind: 'finish', x: 0, zStart: -146, zEnd: -178, width: 8.4, yStart: 7.2, yEnd: 7.2 },
    ],
    obstacles: [
      { id: 'l10_o1', kind: 'windmill', x: 1.2, y: 1.4, z: -45, size: 4.4, height: 0.75, range: 0, speed: 1.65, phase: 0 },
      { id: 'l10_o2', kind: 'slider', x: 0, y: 3.0, z: -102, size: 2.2, height: 1.5, range: 1.8, speed: 2.0, phase: 0.6 },
      { id: 'l10_o3', kind: 'windmill', x: 0, y: 6.1, z: -134, size: 4.6, height: 0.75, range: 0, speed: -1.8, phase: 1.2 },
    ],
    coins: [
      ...makeCoinLine('l10_c1', 0, 0, 0, 0, -5, -24, 5),
      ...makeCoinLine('l10_c2', 1.2, 1.2, 0.2, 2.8, -36, -56, 5),
      ...makeCoinLine('l10_c3', 0, 0, 3.0, 3.0, -66, -78, 4),
      ...makeCoinLine('l10_c4', 0, 0, 3.0, 5.0, -112.5, -121, 4, 2.9),
      ...makeCoinLine('l10_c5', 0, 0, 5.2, 7.2, -124, -156, 8),
    ],
  },
];

export function getSkyRollLevel(levelId: number): SkyLevelDef {
  return (
    SKY_ROLL_LEVELS.find((l) => l.id === levelId) || SKY_ROLL_LEVELS[0]
  );
}
