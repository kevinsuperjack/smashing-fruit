import assert from 'node:assert/strict';
import { SKY_ROLL_LEVELS } from '../minigames/sky-roll/levels.ts';
import {
  BALL_RADIUS,
  createInitialBallState,
  FIXED_DT,
  GRAVITY_DOWN,
  GRAVITY_UP,
  JUMP_VELOCITY,
  MAX_FORWARD_SPEED,
  stepSkyRollPhysics,
} from '../minigames/sky-roll/physics.ts';

function computeJumpReach(vy0: number, vz0: number, deltaY: number): number {
  // Time to apex + descent from apex to deltaY
  const tUp = vy0 / GRAVITY_UP;
  const peakY = (vy0 * vy0) / (2 * GRAVITY_UP);
  assert.ok(
    peakY > deltaY + 0.15,
    `Jump peak (${peakY.toFixed(2)}) cannot clear elevation rise (${deltaY.toFixed(2)})`,
  );
  const fallDist = peakY - deltaY;
  const tDown = Math.sqrt((2 * fallDist) / GRAVITY_DOWN);
  return Math.abs(vz0) * (tUp + tDown);
}

console.log('🧪 Running Fruit Sky Roll Physics & 10-Level Solvability Suite...\n');

// 1. Validate all 10 handcrafted levels structurally & mathematically
assert.equal(SKY_ROLL_LEVELS.length, 10, 'Expected exactly 10 handcrafted sky levels');

for (const lvl of SKY_ROLL_LEVELS) {
  assert.ok(lvl.segments.length >= 4, `Lv ${lvl.id}: expected >= 4 segments`);
  const firstSeg = lvl.segments[0];
  const lastSeg = lvl.segments[lvl.segments.length - 1];
  assert.equal(lastSeg.kind, 'finish', `Lv ${lvl.id}: last segment must be finish`);
  assert.ok(
    lvl.spawn.z <= firstSeg.zStart && lvl.spawn.z >= firstSeg.zEnd,
    `Lv ${lvl.id}: spawn Z must lie on first segment`,
  );
  assert.ok(
    lvl.finishZ <= lastSeg.zStart && lvl.finishZ >= lastSeg.zEnd,
    `Lv ${lvl.id}: finishZ must lie on finish segment`,
  );

  // Every level must have at least 1 mid-course checkpoint
  const checkpoints = lvl.segments.filter((s) => s.checkpointAtZ !== undefined);
  assert.ok(checkpoints.length >= 1, `Lv ${lvl.id}: must have >= 1 checkpoint`);

  // Validate every consecutive segment transition (gaps & elevation jumps)
  for (let i = 0; i < lvl.segments.length - 1; i++) {
    const a = lvl.segments[i];
    const b = lvl.segments[i + 1];
    const gapZ = a.zEnd - b.zStart; // > 0 means open gap along -Z
    const deltaY = b.yStart - a.yEnd;

    if (gapZ > 0.05) {
      const hasBouncePad = a.bouncePadAtZ !== undefined;
      const maxReach = hasBouncePad
        ? computeJumpReach(
            a.bounceVelocityY ?? 15.0,
            a.bounceVelocityZ ?? -13.0,
            deltaY,
          )
        : computeJumpReach(JUMP_VELOCITY, -MAX_FORWARD_SPEED * 0.85, deltaY);

      assert.ok(
        gapZ < maxReach * 0.82,
        `Lv ${lvl.id} gap ${a.id}->${b.id} (${gapZ.toFixed(2)}u, dy=${deltaY.toFixed(2)}) exceeds safe 82% reach (${(maxReach * 0.82).toFixed(2)}u)`,
      );
    }
  }
  console.log(
    `  ✅ Lv ${lvl.id.toString().padStart(2, ' ')} (${lvl.name}) — ${lvl.segments.length} segments, ${lvl.obstacles.length} obstacles, ${lvl.coins.length} coins — SOLVABLE`,
  );
}

// 2. Test continuous seam rolling on Level 1 (no ghost-edge upward bounce across ramp seam)
{
  const lv1 = SKY_ROLL_LEVELS[0];
  const state = createInitialBallState(lv1, 'ARCADE');
  let maxUnexpectedVy = 0;
  for (let i = 0; i < 60 * 12; i++) {
    // Steer gently toward center of current/upcoming track
    const steerX = state.z < -25 && state.z > -52 ? (1.8 - state.x) * 0.6 : state.z <= -52 && state.z > -80 ? (-1.4 - state.x) * 0.6 : -state.x * 0.6;
    stepSkyRollPhysics(state, lv1, 'ARCADE', {
      steerX: Math.max(-1, Math.min(1, steerX)),
      throttle: 0.85,
      jumpRequested: false,
    });
    if (state.vy > maxUnexpectedVy) maxUnexpectedVy = state.vy;
    if (state.status === 'VICTORY') break;
  }
  assert.equal(state.status, 'VICTORY', 'Simulated ball should complete Level 1 smoothly');
  assert.ok(
    maxUnexpectedVy <= 0.05,
    `Expected zero ghost-edge seam bounce on Level 1, got vy=${maxUnexpectedVy}`,
  );
  console.log('  ✅ Continuous ramp & seam physics verified (zero seam snagging)');
}

// 3. Test moving platform carry-over on Level 6 (resting ball stays centered on oscillating bridge)
{
  const lv6 = SKY_ROLL_LEVELS[5];
  const movingSeg = lv6.segments.find((s) => s.kind === 'moving')!;
  const state = createInitialBallState(lv6, 'ARCADE');
  state.x = movingSeg.x;
  state.y = movingSeg.yStart + BALL_RADIUS;
  state.z = (movingSeg.zStart + movingSeg.zEnd) * 0.5;
  state.grounded = true;
  state.groundSegmentId = movingSeg.id;

  for (let i = 0; i < 180; i++) {
    stepSkyRollPhysics(state, lv6, 'ARCADE', {
      steerX: 0,
      throttle: 0,
      jumpRequested: false,
    });
    assert.equal(
      state.grounded,
      true,
      `Ball slipped off moving platform at step ${i} (x=${state.x.toFixed(2)})`,
    );
  }
  console.log('  ✅ Moving platform carry-over verified (ball rides full oscillation cleanly)');
}

// 4. Test Kid Mode soft guardrails & Bubble-Float Rescue (zero Game Over)
{
  const lv2 = SKY_ROLL_LEVELS[1];
  const state = createInitialBallState(lv2, 'KID');
  // Push hard right on guardrailed segment 1
  for (let i = 0; i < 90; i++) {
    stepSkyRollPhysics(state, lv2, 'KID', {
      steerX: 1.0,
      throttle: 0,
      jumpRequested: false,
    });
  }
  assert.equal(state.grounded, true, 'Kid Mode guardrails should keep ball on track');

  // Force a fall to verify Bubble-Float Rescue returns ball to checkpoint with zero heart loss
  state.y = state.minTrackY - 6.0;
  const events = stepSkyRollPhysics(state, lv2, 'KID', {
    steerX: 0,
    throttle: 0,
    jumpRequested: false,
  });
  assert.ok(
    events.some((e) => e.type === 'BUBBLE_RESCUE'),
    'Falling in Kid Mode must emit BUBBLE_RESCUE',
  );
  assert.equal(state.status, 'PLAYING', 'Kid Mode must never Game Over');
  for (let i = 0; i < 65; i++) {
    stepSkyRollPhysics(state, lv2, 'KID', { steerX: 0, throttle: 0, jumpRequested: false }, FIXED_DT);
  }
  assert.ok(
    Math.abs(state.z - state.checkpoint.z) < 0.5,
    'Bubble rescue must float ball back onto checkpoint',
  );
  console.log('  ✅ Kid Mode guardrails & Bubble-Float Rescue verified');
}

console.log('\n🎉 ALL FRUIT SKY ROLL PHYSICS & SOLVABILITY TESTS PASSED!');
