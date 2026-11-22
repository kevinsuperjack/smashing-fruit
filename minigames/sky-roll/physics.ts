import type {
  ObstacleDef,
  SkyLevelDef,
  SkyRollDifficulty,
  TrackSegment,
} from './types';

export const BALL_RADIUS = 0.65;
export const FIXED_DT = 1 / 60;
export const GRAVITY_UP = 28.0;
export const GRAVITY_DOWN = 33.0;
export const JUMP_VELOCITY = 11.4;
export const COYOTE_TIME_SEC = 0.13;
export const JUMP_BUFFER_SEC = 0.13;
export const MAX_FORWARD_SPEED = 11.8;
export const MAX_BOOST_SPEED = 17.8;
export const KID_CRUISE_SPEED = 6.2;

export interface SkyInputState {
  /** Horizontal steering in [-1, 1] (-1 = left, +1 = right). */
  steerX: number;
  /** Forward/backward throttle in [-1, 1] (+1 = roll forward along -Z, -1 = brake/reverse). */
  throttle: number;
  /** Set true on jump edge; consumed by physics step. */
  jumpRequested: boolean;
}

export type PhysicsEvent =
  | { type: 'JUMP' }
  | { type: 'BOUNCE_PAD'; x: number; y: number; z: number }
  | { type: 'BOOST'; x: number; y: number; z: number }
  | { type: 'COIN'; coinId: string; x: number; y: number; z: number; streak: number }
  | { type: 'CHECKPOINT'; x: number; y: number; z: number }
  | { type: 'BUBBLE_RESCUE'; x: number; y: number; z: number }
  | { type: 'HEART_LOST'; heartsRemaining: number }
  | { type: 'BUMP_OBSTACLE'; x: number; y: number; z: number }
  | { type: 'VICTORY'; stars: number; elapsedSec: number }
  | { type: 'GAME_OVER' };

export interface SkyBallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  groundY: number;
  groundSegmentId: string | null;
  coyoteTimer: number;
  jumpBufferTimer: number;
  boostTimer: number;
  /** Non-zero while Kid Mode bubble floats ball back to checkpoint. */
  bubbleRescueTimer: number;
  rescueStart: { x: number; y: number; z: number };
  checkpoint: { x: number; y: number; z: number };
  activatedCheckpoints: Set<string>;
  collectedCoins: Set<string>;
  coinStreak: number;
  lastCoinTime: number;
  hearts: number;
  maxHearts: number;
  elapsedSec: number;
  time: number;
  status: 'PLAYING' | 'VICTORY' | 'GAME_OVER';
  /** Cooldown to prevent repeated boost/bounce/obstacle triggers on same frame. */
  padCooldown: number;
  bumpCooldown: number;
  minTrackY: number;
  progress: number;
}

export function getSegmentWidthForDifficulty(
  seg: TrackSegment,
  difficulty: SkyRollDifficulty,
): number {
  if (difficulty === 'KID' && seg.kind !== 'finish') {
    return seg.width * 1.35;
  }
  return seg.width;
}

export function getSegmentPoseAtTime(
  seg: TrackSegment,
  time: number,
  difficulty: SkyRollDifficulty,
): { x: number; zStart: number; zEnd: number; width: number } {
  const speedScale = difficulty === 'KID' ? 0.65 : 1.0;
  let dx = 0;
  let dz = 0;
  if (seg.moveAxis && seg.moveRange && seg.moveSpeed) {
    const offset =
      Math.sin(time * seg.moveSpeed * speedScale + (seg.movePhase ?? 0)) *
      seg.moveRange;
    if (seg.moveAxis === 'x') dx = offset;
    if (seg.moveAxis === 'z') dz = offset;
  }
  return {
    x: seg.x + dx,
    zStart: seg.zStart + dz,
    zEnd: seg.zEnd + dz,
    width: getSegmentWidthForDifficulty(seg, difficulty),
  };
}

export function getObstaclePoseAtTime(
  obs: ObstacleDef,
  time: number,
  difficulty: SkyRollDifficulty,
): { x: number; y: number; z: number; angleY: number } {
  const speedScale = difficulty === 'KID' ? 0.65 : 1.0;
  if (obs.kind === 'slider') {
    const offsetX =
      Math.sin(time * obs.speed * speedScale + (obs.phase ?? 0)) * obs.range;
    return { x: obs.x + offsetX, y: obs.y, z: obs.z, angleY: 0 };
  }
  if (obs.kind === 'windmill') {
    const angleY = time * obs.speed * speedScale + (obs.phase ?? 0);
    return { x: obs.x, y: obs.y, z: obs.z, angleY };
  }
  return { x: obs.x, y: obs.y, z: obs.z, angleY: 0 };
}

export function getSurfaceYOnSegment(
  seg: TrackSegment,
  z: number,
  zStart: number,
  zEnd: number,
): number {
  const span = zStart - zEnd;
  if (Math.abs(span) < 0.0001) return seg.yStart;
  const t = Math.max(0, Math.min(1, (zStart - z) / span));
  return seg.yStart + (seg.yEnd - seg.yStart) * t;
}

export function createInitialBallState(
  level: SkyLevelDef,
  difficulty: SkyRollDifficulty,
): SkyBallState {
  const minTrackY = level.segments.reduce(
    (min, s) => Math.min(min, s.yStart, s.yEnd),
    0,
  );
  const maxHearts = difficulty === 'KID' ? 99 : 3;
  return {
    x: level.spawn.x,
    y: level.spawn.y,
    z: level.spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    groundY: level.spawn.y - BALL_RADIUS,
    groundSegmentId: level.segments[0]?.id ?? null,
    coyoteTimer: COYOTE_TIME_SEC,
    jumpBufferTimer: 0,
    boostTimer: 0,
    bubbleRescueTimer: 0,
    rescueStart: { ...level.spawn },
    checkpoint: { ...level.spawn },
    activatedCheckpoints: new Set<string>(),
    collectedCoins: new Set<string>(),
    coinStreak: 0,
    lastCoinTime: -10,
    hearts: maxHearts,
    maxHearts,
    elapsedSec: 0,
    time: 0,
    status: 'PLAYING',
    padCooldown: 0,
    bumpCooldown: 0,
    minTrackY,
    progress: 0,
  };
}

/**
 * Queries the highest valid walkable surface underneath (x, y, z) within step-up
 * tolerance so connected straight/ramp segments NEVER snag on seams.
 */
function findSupportSurface(
  level: SkyLevelDef,
  difficulty: SkyRollDifficulty,
  time: number,
  x: number,
  ballBottomY: number,
  prevBottomY: number,
  z: number,
): { segment: TrackSegment; surfaceY: number; pose: ReturnType<typeof getSegmentPoseAtTime> } | null {
  let best: {
    segment: TrackSegment;
    surfaceY: number;
    pose: ReturnType<typeof getSegmentPoseAtTime>;
  } | null = null;

  const edgeForgiveness = difficulty === 'KID' ? 0.35 : 0.22;
  const stepUpTolerance = 0.48;

  for (const seg of level.segments) {
    const pose = getSegmentPoseAtTime(seg, time, difficulty);
    const halfW = pose.width * 0.5 + edgeForgiveness;
    if (x < pose.x - halfW || x > pose.x + halfW) continue;
    if (z > pose.zStart + 0.35 || z < pose.zEnd - 0.35) continue;

    const surfaceY = getSurfaceYOnSegment(seg, z, pose.zStart, pose.zEnd);
    // Ball must have been at or above (surfaceY - stepUpTolerance) and now at/below (surfaceY + 0.25)
    const wasAboveOrNear = prevBottomY >= surfaceY - stepUpTolerance;
    const isLandingOrOn = ballBottomY <= surfaceY + 0.22;

    if (wasAboveOrNear && isLandingOrOn) {
      if (!best || surfaceY > best.surfaceY) {
        best = { segment: seg, surfaceY, pose };
      }
    }
  }
  return best;
}

/**
 * Computes shadow ground height strictly below the ball (for 3D contact shadow).
 */
export function queryShadowGroundY(
  level: SkyLevelDef,
  difficulty: SkyRollDifficulty,
  time: number,
  x: number,
  ballY: number,
  z: number,
): number | null {
  let bestY: number | null = null;
  for (const seg of level.segments) {
    const pose = getSegmentPoseAtTime(seg, time, difficulty);
    const halfW = pose.width * 0.5 + 0.15;
    if (x < pose.x - halfW || x > pose.x + halfW) continue;
    if (z > pose.zStart + 0.2 || z < pose.zEnd - 0.2) continue;
    const sy = getSurfaceYOnSegment(seg, z, pose.zStart, pose.zEnd);
    if (sy <= ballY - BALL_RADIUS + 0.35) {
      if (bestY === null || sy > bestY) {
        bestY = sy;
      }
    }
  }
  return bestY;
}

export function stepSkyRollPhysics(
  state: SkyBallState,
  level: SkyLevelDef,
  difficulty: SkyRollDifficulty,
  input: SkyInputState,
  dt: number = FIXED_DT,
): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  if (state.status !== 'PLAYING') return events;

  const prevTime = state.time;
  state.time += dt;
  state.elapsedSec += dt;
  state.padCooldown = Math.max(0, state.padCooldown - dt);
  state.bumpCooldown = Math.max(0, state.bumpCooldown - dt);
  state.boostTimer = Math.max(0, state.boostTimer - dt);

  // 1. Kid Mode Bubble-Float Rescue Animation
  if (state.bubbleRescueTimer > 0) {
    state.bubbleRescueTimer = Math.max(0, state.bubbleRescueTimer - dt);
    const t = 1 - state.bubbleRescueTimer / 0.85;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    state.x = state.rescueStart.x + (state.checkpoint.x - state.rescueStart.x) * ease;
    state.z = state.rescueStart.z + (state.checkpoint.z - state.rescueStart.z) * ease;
    state.y =
      state.rescueStart.y +
      (state.checkpoint.y + 0.35 - state.rescueStart.y) * ease +
      Math.sin(t * Math.PI) * 2.4;
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
    state.grounded = false;
    if (state.bubbleRescueTimer === 0) {
      state.x = state.checkpoint.x;
      state.y = state.checkpoint.y + 0.2;
      state.z = state.checkpoint.z;
      state.grounded = true;
      state.coyoteTimer = COYOTE_TIME_SEC;
    }
    return events;
  }

  // 2. Carry-over displacement from moving platform if currently grounded on one
  if (state.grounded && state.groundSegmentId) {
    const seg = level.segments.find((s) => s.id === state.groundSegmentId);
    if (seg && seg.moveAxis && seg.moveRange && seg.moveSpeed) {
      const prevPose = getSegmentPoseAtTime(seg, prevTime, difficulty);
      const currPose = getSegmentPoseAtTime(seg, state.time, difficulty);
      state.x += currPose.x - prevPose.x;
      state.z += currPose.zStart - prevPose.zStart;
    }
  }

  // 3. Jump Buffer & Coyote Time
  if (input.jumpRequested) {
    state.jumpBufferTimer = JUMP_BUFFER_SEC;
    input.jumpRequested = false;
  } else {
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  }

  if (state.grounded) {
    state.coyoteTimer = COYOTE_TIME_SEC;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  }

  // 4. Steering & Forward Throttle Acceleration
  const accelX = state.grounded ? 34.0 : 21.0;
  const accelZ = state.grounded ? 26.0 : 14.0;
  const maxLatSpeed = difficulty === 'KID' ? 7.8 : 9.2;
  const maxFwdSpeed =
    state.boostTimer > 0 ? MAX_BOOST_SPEED : MAX_FORWARD_SPEED;

  // Horizontal steering
  if (Math.abs(input.steerX) > 0.04) {
    state.vx += input.steerX * accelX * dt;
  } else {
    const dragX = state.grounded ? 10.5 : 3.2;
    state.vx -= state.vx * Math.min(1, dragX * dt);
  }
  state.vx = Math.max(-maxLatSpeed, Math.min(maxLatSpeed, state.vx));

  // Forward / brake throttle (forward is -Z)
  let effectiveThrottle = input.throttle;
  if (difficulty === 'KID' && effectiveThrottle >= -0.05 && effectiveThrottle < 0.35) {
    // Gentle forward auto-cruise assist in Kid Mode unless actively braking
    const targetVz = -KID_CRUISE_SPEED;
    if (state.vz > targetVz) {
      effectiveThrottle = Math.max(effectiveThrottle, 0.45);
    }
  }

  if (effectiveThrottle > 0.04) {
    state.vz -= effectiveThrottle * accelZ * dt;
  } else if (effectiveThrottle < -0.04) {
    state.vz -= effectiveThrottle * (accelZ * 1.15) * dt;
  } else {
    const dragZ = state.grounded ? 3.8 : 0.8;
    state.vz -= state.vz * Math.min(1, dragZ * dt);
  }

  if (state.boostTimer > 0) {
    state.vz = Math.min(state.vz, -15.5);
  }
  // Clamp forward (-maxFwdSpeed) and gentle reverse (+4.5)
  state.vz = Math.max(-maxFwdSpeed, Math.min(4.5, state.vz));

  // 5. Execute Buffered Jump if within Coyote Time
  if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
    state.vy = JUMP_VELOCITY;
    state.grounded = false;
    state.groundSegmentId = null;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    events.push({ type: 'JUMP' });
  }

  // 6. Gravity & Position Integration
  const prevBottomY = state.y - BALL_RADIUS;
  if (!state.grounded) {
    const g = state.vy >= 0 ? GRAVITY_UP : GRAVITY_DOWN;
    state.vy -= g * dt;
  }

  state.x += state.vx * dt;
  state.y += state.vy * dt;
  state.z += state.vz * dt;

  // 7. Continuous Swept Surface Support Resolution
  const newBottomY = state.y - BALL_RADIUS;
  const support =
    state.vy <= 0.8
      ? findSupportSurface(
          level,
          difficulty,
          state.time,
          state.x,
          newBottomY,
          prevBottomY,
          state.z,
        )
      : null;

  if (support) {
    state.y = support.surfaceY + BALL_RADIUS;
    state.vy = 0;
    state.grounded = true;
    state.groundY = support.surfaceY;
    state.groundSegmentId = support.segment.id;

    const seg = support.segment;
    const pose = support.pose;

    // Kid Mode soft rainbow guardrails along straight/ramp segments
    if (difficulty === 'KID' && !seg.noGuardrails && seg.kind !== 'finish') {
      const railHalf = pose.width * 0.5 - BALL_RADIUS * 0.65;
      if (state.x < pose.x - railHalf) {
        state.x = pose.x - railHalf;
        state.vx = Math.abs(state.vx) * 0.45;
      } else if (state.x > pose.x + railHalf) {
        state.x = pose.x + railHalf;
        state.vx = -Math.abs(state.vx) * 0.45;
      }
    }

    // Boost pad trigger
    if (
      seg.boostAtZ !== undefined &&
      state.padCooldown <= 0 &&
      Math.abs(state.z - (seg.boostAtZ + (pose.zStart - seg.zStart))) < 1.65
    ) {
      state.boostTimer = 1.35;
      state.vz = Math.min(state.vz, -16.0);
      state.padCooldown = 0.45;
      events.push({ type: 'BOOST', x: state.x, y: state.y, z: state.z });
    }

    // Bounce pad trigger (explicit or Kid Mode auto-bounce at gap edge)
    const bounceZ =
      seg.bouncePadAtZ !== undefined
        ? seg.bouncePadAtZ
        : difficulty === 'KID'
        ? seg.kidAutoBounceAtZ
        : undefined;
    if (
      bounceZ !== undefined &&
      state.padCooldown <= 0 &&
      Math.abs(state.z - (bounceZ + (pose.zStart - seg.zStart))) < 1.45
    ) {
      state.vy = seg.bounceVelocityY ?? 12.2;
      state.vz = Math.min(state.vz, seg.bounceVelocityZ ?? -10.8);
      state.grounded = false;
      state.groundSegmentId = null;
      state.padCooldown = 0.35;
      events.push({ type: 'BOUNCE_PAD', x: state.x, y: state.y, z: state.z });
    }

    // Checkpoint gate trigger
    if (
      seg.checkpointAtZ !== undefined &&
      !state.activatedCheckpoints.has(seg.id) &&
      state.z <= seg.checkpointAtZ + 1.0
    ) {
      state.activatedCheckpoints.add(seg.id);
      const cpY =
        getSurfaceYOnSegment(seg, seg.checkpointAtZ, pose.zStart, pose.zEnd) +
        BALL_RADIUS +
        0.1;
      state.checkpoint = { x: pose.x, y: cpY, z: seg.checkpointAtZ };
      events.push({
        type: 'CHECKPOINT',
        x: pose.x,
        y: cpY,
        z: seg.checkpointAtZ,
      });
    }
  } else {
    state.grounded = false;
    state.groundSegmentId = null;
  }

  // 8. Obstacle Collisions (Sliders, Windmills, Bumpers)
  if (state.bumpCooldown <= 0) {
    for (const obs of level.obstacles) {
      const pose = getObstaclePoseAtTime(obs, state.time, difficulty);

      if (obs.kind === 'bumper') {
        const dx = state.x - pose.x;
        const dz = state.z - pose.z;
        const dy = state.y - (pose.y + obs.height * 0.5);
        const minDist = BALL_RADIUS + obs.range;
        if (Math.abs(dy) < obs.height * 0.75 + BALL_RADIUS) {
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const nz = dz / dist;
            state.x = pose.x + nx * (minDist + 0.05);
            state.z = pose.z + nz * (minDist + 0.05);
            const push = difficulty === 'KID' ? 5.5 : 8.0;
            state.vx = nx * push;
            state.vz = nz * push;
            state.bumpCooldown = 0.22;
            events.push({ type: 'BUMP_OBSTACLE', x: state.x, y: state.y, z: state.z });
            break;
          }
        }
      } else if (obs.kind === 'slider') {
        const halfW = obs.size * 0.5 + BALL_RADIUS;
        const halfD = 0.45 + BALL_RADIUS;
        const withinY =
          state.y - BALL_RADIUS < pose.y + obs.height &&
          state.y + BALL_RADIUS > pose.y;
        if (
          withinY &&
          Math.abs(state.x - pose.x) < halfW &&
          Math.abs(state.z - pose.z) < halfD
        ) {
          const pushDirZ = state.z >= pose.z ? 1 : -1;
          state.z = pose.z + pushDirZ * (halfD + 0.06);
          state.vz = pushDirZ * (difficulty === 'KID' ? 4.5 : 6.8);
          state.vx += (state.x >= pose.x ? 1 : -1) * 3.5;
          state.bumpCooldown = 0.24;
          events.push({ type: 'BUMP_OBSTACLE', x: state.x, y: state.y, z: state.z });
          break;
        }
      } else if (obs.kind === 'windmill') {
        // Rotating horizontal bar centered at (pose.x, pose.y + 0.55, pose.z)
        const barY = pose.y + 0.55;
        if (Math.abs(state.y - barY) < BALL_RADIUS + obs.height * 0.45) {
          // Transform ball position into windmill local space (inverse of Three.js rotation.y = +angleY)
          const relX = state.x - pose.x;
          const relZ = state.z - pose.z;
          const cos = Math.cos(pose.angleY);
          const sin = Math.sin(pose.angleY);
          const localX = relX * cos - relZ * sin;
          const localZ = relX * sin + relZ * cos;
          const halfLen = obs.size * 0.5 + BALL_RADIUS * 0.8;
          const halfThick = 0.34 + BALL_RADIUS * 0.8;
          if (Math.abs(localX) < halfLen && Math.abs(localZ) < halfThick) {
            const kickSign = localZ >= 0 ? 1 : -1;
            const push = difficulty === 'KID' ? 5.2 : 8.2;
            state.vx += Math.sin(pose.angleY) * kickSign * push;
            state.vz += Math.cos(pose.angleY) * kickSign * push;
            state.vy = Math.max(state.vy, 3.8);
            state.grounded = false;
            state.bumpCooldown = 0.26;
            events.push({ type: 'BUMP_OBSTACLE', x: state.x, y: state.y, z: state.z });
            break;
          }
        }
      }
    }
  }

  // 9. Golden Seed Coin Pickups
  const coinPickupRadius = BALL_RADIUS + (difficulty === 'KID' ? 0.95 : 0.75);
  const coinPickupSq = coinPickupRadius * coinPickupRadius;
  for (const coin of level.coins) {
    if (state.collectedCoins.has(coin.id)) continue;
    const dx = state.x - coin.x;
    const dy = state.y - coin.y;
    const dz = state.z - coin.z;
    if (dx * dx + dy * dy + dz * dz <= coinPickupSq) {
      state.collectedCoins.add(coin.id);
      if (state.time - state.lastCoinTime < 1.4) {
        state.coinStreak += 1;
      } else {
        state.coinStreak = 1;
      }
      state.lastCoinTime = state.time;
      events.push({
        type: 'COIN',
        coinId: coin.id,
        x: coin.x,
        y: coin.y,
        z: coin.z,
        streak: state.coinStreak,
      });
    }
  }

  // 10. Progress Calculation
  const totalDist = Math.max(1, level.spawn.z - level.finishZ);
  state.progress = Math.max(
    0,
    Math.min(1, (level.spawn.z - state.z) / totalDist),
  );

  // 11. Finish Line Victory Check
  if (state.z <= level.finishZ && state.y >= state.minTrackY - 2) {
    state.status = 'VICTORY';
    const coinRatio =
      level.coins.length > 0
        ? state.collectedCoins.size / level.coins.length
        : 1;
    let stars = 1;
    if (coinRatio >= 0.45 || state.elapsedSec <= level.parTimeSec * 1.25) {
      stars = 2;
    }
    if (
      (coinRatio >= 0.7 && state.elapsedSec <= level.parTimeSec * 1.15) ||
      (difficulty === 'KID' && coinRatio >= 0.65)
    ) {
      stars = 3;
    }
    events.push({ type: 'VICTORY', stars, elapsedSec: state.elapsedSec });
    return events;
  }

  // 12. Fall Detection (Bubble Rescue in Kid Mode vs Heart Loss in Sky Escape)
  if (state.y < state.minTrackY - 4.8) {
    if (difficulty === 'KID') {
      state.rescueStart = { x: state.x, y: state.y, z: state.z };
      state.bubbleRescueTimer = 0.85;
      state.vx = 0;
      state.vy = 0;
      state.vz = 0;
      events.push({
        type: 'BUBBLE_RESCUE',
        x: state.checkpoint.x,
        y: state.checkpoint.y,
        z: state.checkpoint.z,
      });
    } else {
      state.hearts = Math.max(0, state.hearts - 1);
      events.push({ type: 'HEART_LOST', heartsRemaining: state.hearts });
      if (state.hearts <= 0) {
        state.status = 'GAME_OVER';
        events.push({ type: 'GAME_OVER' });
      } else {
        // Respawn cleanly at last checkpoint
        state.x = state.checkpoint.x;
        state.y = state.checkpoint.y + 0.4;
        state.z = state.checkpoint.z;
        state.vx = 0;
        state.vy = 0;
        state.vz = 0;
        state.grounded = false;
        state.boostTimer = 0;
      }
    }
  }

  return events;
}
