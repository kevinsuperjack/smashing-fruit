import assert from 'node:assert/strict';
import {
  ARCADE_STAR_THRESHOLDS,
  COMBO_DECAY_SEC,
  GOLDEN_SEED_BUBBLE_BONUS,
  KID_STAR_THRESHOLDS,
  computeFruitPopGoldenSeeds,
  computeFruitPopStars,
  createDeterministicRng,
  createFruitPopState,
  getComboMultiplier,
  popAtPoint,
  popAtPoints,
  setFruitPopTheme,
  spawnFruitPopBubble,
  stepFruitPop,
} from '../minigames/fruit-pop/engine.ts';
import {
  MEMORY_MATCH_GRID_ORDER,
  SMOOTHIE_BLEND_BONUS_SEEDS,
  SMOOTHIE_STREAK_TARGET,
  buildRoundSummary,
  clearMismatch,
  computeRoundPayout,
  computeStars,
  createDeck,
  createRoundState,
  createSeededRng,
  findHintPair,
  flipCard,
  getGridPreset,
} from '../minigames/memory-match/logic.ts';
import {
  APP_THEMES,
  APP_THEME_STORAGE_KEY,
  loadAppTheme,
  saveAppTheme,
} from '../utils/theme.ts';
import {
  FRUIT_POP_STORAGE_KEY,
  MEMORY_MATCH_STORAGE_KEY,
  SKY_ROLL_STORAGE_KEY,
  addGoldenSeeds,
  getGoldenSeeds,
  loadFruitPopSave,
  loadMemoryMatchSave,
  recordFruitPopRun,
  recordMemoryMatchWin,
} from '../minigames/arcadeStorage.ts';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function createThrowingStorage(): Storage {
  const fail = () => {
    throw new Error('SecurityError: storage disabled');
  };
  return {
    get length() {
      return 0;
    },
    clear: fail,
    getItem: fail,
    key: () => null,
    removeItem: fail,
    setItem: fail,
  };
}

function testFruitPopEngine() {
  const rng = createDeterministicRng(42);
  const state = createFruitPopState({
    mode: 'ARCADE',
    theme: 'ORCHARD',
    bounds: { width: 420, height: 760 },
    initialBubbles: 4,
    rng,
  });

  // 1. Spawning & upward drift
  assert.equal(state.bubbles.length, 4, 'Initial bubbles should spawn');
  const initialY = state.bubbles[0].y;
  stepFruitPop(state, 0.5, rng);
  assert.ok(
    state.bubbles.some((b) => b.y < initialY) || state.bubbles.length >= 4,
    'Bubbles should drift upward over time',
  );

  // 2. Multi-touch hit-test (pop 2 bubbles simultaneously)
  const b1 = spawnFruitPopBubble(state, { kind: 'fruit', x: 110, y: 400, rng });
  const b2 = spawnFruitPopBubble(state, { kind: 'fruit', x: 310, y: 420, rng });
  const multiRes = popAtPoints(
    state,
    [
      { x: b1.x, y: b1.y },
      { x: b2.x, y: b2.y },
    ],
    rng,
  );
  assert.equal(multiRes.poppedCount, 2, 'Multi-touch should pop both targeted bubbles');
  assert.ok(multiRes.pointsAwarded > 0, 'Popping bubbles should award points');

  // 3. Rainbow chain-pop blast
  const center = spawnFruitPopBubble(state, { kind: 'rainbow', x: 200, y: 360, rng });
  const neighbor = spawnFruitPopBubble(state, { kind: 'fruit', x: 245, y: 360, rng });
  const farAway = spawnFruitPopBubble(state, { kind: 'fruit', x: 20, y: 720, rng });
  const rainbowRes = popAtPoint(state, center.x, center.y, rng);
  assert.ok(
    rainbowRes.poppedCount >= 2,
    `Rainbow bubble should chain-pop nearby bubble (popped=${rainbowRes.poppedCount})`,
  );
  assert.ok(
    !state.bubbles.some((b) => b.id === neighbor.id),
    'Nearby bubble should be removed by rainbow chain-pop',
  );
  assert.ok(
    state.bubbles.some((b) => b.id === farAway.id),
    'Far-away bubble should not be popped by rainbow chain-pop',
  );

  // 4. Golden Seed bonus bubble
  const golden = spawnFruitPopBubble(state, { kind: 'golden', x: 210, y: 500, rng });
  const goldenBefore = state.bonusGoldenSeeds;
  const goldenRes = popAtPoint(state, golden.x, golden.y, rng);
  assert.equal(
    goldenRes.goldenSeedsAwarded,
    GOLDEN_SEED_BUBBLE_BONUS,
    'Golden bubble should award GOLDEN_SEED_BUBBLE_BONUS seeds',
  );
  assert.equal(
    state.bonusGoldenSeeds,
    goldenBefore + GOLDEN_SEED_BUBBLE_BONUS,
    'State should accumulate bonus golden seeds',
  );

  // 5. Combo scaling & decay
  assert.equal(getComboMultiplier(0), 1);
  assert.equal(getComboMultiplier(3), 2);
  assert.equal(getComboMultiplier(6), 3);
  assert.equal(getComboMultiplier(12), 4);
  assert.ok(state.comboCount > 0, 'Combo count should be active after pops');
  stepFruitPop(state, COMBO_DECAY_SEC + 0.25, rng);
  assert.equal(state.comboCount, 0, 'Combo count should decay to 0 after COMBO_DECAY_SEC');
  assert.equal(state.comboMultiplier, 1, 'Combo multiplier should reset to 1 after decay');

  // 6. Christmas theme switch updates active bubbles
  setFruitPopTheme(state, 'CHRISTMAS');
  assert.equal(state.theme, 'CHRISTMAS');
  assert.ok(
    state.bubbles.every((b) => b.ornament === 'snowglobe'),
    'Switching to CHRISTMAS theme should update active bubbles',
  );

  // 7. 1-3 star grading & golden seeds calculation
  assert.equal(computeFruitPopStars(0, 0, 'ARCADE'), 0);
  assert.equal(computeFruitPopStars(ARCADE_STAR_THRESHOLDS.one, 5, 'ARCADE'), 1);
  assert.equal(computeFruitPopStars(ARCADE_STAR_THRESHOLDS.two, 15, 'ARCADE'), 2);
  assert.equal(computeFruitPopStars(ARCADE_STAR_THRESHOLDS.three, 30, 'ARCADE'), 3);
  assert.equal(computeFruitPopStars(0, 0, 'KID'), 1);
  assert.equal(computeFruitPopStars(0, KID_STAR_THRESHOLDS.two, 'KID'), 2);
  assert.equal(computeFruitPopStars(0, KID_STAR_THRESHOLDS.three, 'KID'), 3);
  assert.ok(computeFruitPopGoldenSeeds(1200, 3, 6, 35, 'ARCADE') > 20);
  assert.ok(computeFruitPopGoldenSeeds(0, 2, 3, 18, 'KID') >= 9);

  console.log('  ✅ Fruit Pop Splash engine verified (spawn, drift, multi-touch, rainbow chain, golden seeds, combo decay, stars, Christmas theme)');
}

function testMemoryMatchLogic() {
  // 1. Deck invariants across all 4 grid sizes
  for (const gridId of MEMORY_MATCH_GRID_ORDER) {
    const preset = getGridPreset(gridId);
    const rng = createSeededRng(100 + preset.totalCards);
    const deck = createDeck(gridId, rng);
    assert.equal(deck.length, preset.totalCards, `${gridId} should have ${preset.totalCards} cards`);
    const counts = new Map<number, number>();
    for (const card of deck) {
      counts.set(card.tier, (counts.get(card.tier) ?? 0) + 1);
    }
    assert.equal(counts.size, preset.totalPairs, `${gridId} should have ${preset.totalPairs} distinct pairs`);
    for (const [tier, count] of counts) {
      assert.equal(count, 2, `${gridId} tier ${tier} must appear exactly twice`);
    }
  }

  // 2. Match, mismatch, clearMismatch, Smoothie Blender streak bonus, and completion
  const rng = createSeededRng(777);
  let state = createRoundState('4x3', 'ARCADE', rng);
  assert.equal(state.totalPairs, 6);

  // Force a mismatch first
  const firstCard = state.cards[0];
  const nonMatchingCard = state.cards.find((c) => c.tier !== firstCard.tier)!;
  let res = flipCard(state, firstCard.id);
  assert.equal(res.status, 'FIRST_CARD');
  state = res.state;

  // Test hint pair while 1 card is flipped
  const hint = findHintPair(state.cards, state.flippedIds);
  assert.ok(hint !== null && hint[0] === firstCard.id, 'Hint should pair the currently flipped card');

  res = flipCard(state, nonMatchingCard.id);
  assert.equal(res.status, 'MISMATCH');
  assert.equal(res.state.streak, 0);
  state = clearMismatch(res.state);
  assert.equal(state.flippedIds.length, 0);
  assert.ok(state.cards.every((c) => !c.flipped), 'clearMismatch should close unmatched cards');

  // Now match all 6 pairs consecutively to trigger Smoothie Blender streak bonuses (at streak 3 & 6)
  const tiers = Array.from(new Set(state.cards.map((c) => c.tier)));
  let blendsTriggered = 0;
  for (const tier of tiers) {
    const [a, b] = state.cards.filter((c) => c.tier === tier);
    const r1 = flipCard(state, a.id);
    assert.equal(r1.status, 'FIRST_CARD');
    const r2 = flipCard(r1.state, b.id);
    assert.equal(r2.status, 'MATCH');
    if (r2.smoothieTriggered) {
      blendsTriggered += 1;
      assert.equal(r2.bonusSeedsEarned, SMOOTHIE_BLEND_BONUS_SEEDS);
    }
    state = r2.state;
  }

  assert.equal(state.isCompleted, true, 'All pairs matched should complete the round');
  assert.equal(
    blendsTriggered,
    Math.floor(tiers.length / SMOOTHIE_STREAK_TARGET),
    'Smoothie Blender should trigger every SMOOTHIE_STREAK_TARGET consecutive matches',
  );
  assert.equal(state.smoothiesBlended, 2);

  // 3. Star grading & payout
  const preset4x3 = getGridPreset('4x3');
  assert.equal(computeStars('4x3', preset4x3.threeStarMaxMoves), 3);
  assert.equal(computeStars('4x3', preset4x3.twoStarMaxMoves), 2);
  assert.equal(computeStars('4x3', preset4x3.twoStarMaxMoves + 5), 1);
  const summary = buildRoundSummary(state);
  const payout = computeRoundPayout('4x3', summary.stars, summary.smoothiesBlended);
  assert.equal(summary.payout.totalSeeds, payout.totalSeeds);
  assert.equal(payout.blenderBonusSeeds, 2 * SMOOTHIE_BLEND_BONUS_SEEDS);

  console.log('  ✅ Smoothie Memory Match logic verified (3x2/4x3/4x4/5x4 decks, match/mismatch, Smoothie Blender streak, hints, star grading)');
}

function testThemeAndStorageSafety() {
  const g = globalThis as { localStorage?: Storage };
  const prevStorage = g.localStorage;

  try {
    // 1. Missing localStorage fallback
    delete g.localStorage;
    assert.equal(loadAppTheme(), 'ORCHARD');
    saveAppTheme('CHRISTMAS'); // must not throw
    assert.equal(getGoldenSeeds(), 0);
    assert.equal(addGoldenSeeds(15), 15);
    assert.equal(loadFruitPopSave().bestScore, 0);
    assert.equal(loadMemoryMatchSave().totalSmoothiesBlended, 0);

    // 2. Throwing localStorage fallback (private browsing / SecurityError)
    g.localStorage = createThrowingStorage();
    assert.equal(loadAppTheme(), 'ORCHARD');
    saveAppTheme('CHRISTMAS'); // must not throw
    assert.equal(getGoldenSeeds(), 0);
    assert.equal(addGoldenSeeds(10), 10);

    // 3. Normal persistence + shared Golden Seeds wallet across all games
    const mem = createMemoryStorage();
    g.localStorage = mem;
    assert.ok(APP_THEMES.ORCHARD && APP_THEMES.CHRISTMAS);
    saveAppTheme('CHRISTMAS');
    assert.equal(mem.getItem(APP_THEME_STORAGE_KEY), 'CHRISTMAS');
    assert.equal(loadAppTheme(), 'CHRISTMAS');
    saveAppTheme('ORCHARD');
    assert.equal(loadAppTheme(), 'ORCHARD');

    // Credit seeds via Fruit Pop + Memory Match and verify shared SKY_ROLL_STORAGE_KEY balance
    const fpSave = recordFruitPopRun({
      score: 1200,
      stars: 3,
      popped: 25,
      mode: 'ARCADE',
    });
    assert.equal(fpSave.bestScore, 1200);
    assert.equal(fpSave.bestStars, 3);
    assert.equal(addGoldenSeeds(18), 18);
    assert.equal(getGoldenSeeds(), 18);

    const mmSave = recordMemoryMatchWin({
      gridId: '4x3',
      stars: 3,
      moves: 7,
      smoothiesBlended: 2,
      mode: 'ARCADE',
    });
    assert.equal(mmSave.bestStarsByGrid['4x3'], 3);
    assert.equal(mmSave.totalSmoothiesBlended, 2);
    assert.equal(addGoldenSeeds(22), 40);
    assert.equal(getGoldenSeeds(), 40);

    const rawSkyRoll = JSON.parse(mem.getItem(SKY_ROLL_STORAGE_KEY) ?? '{}');
    assert.equal(rawSkyRoll.coins, 40, 'Shared Golden Seeds must persist into Sky Roll wallet');
    assert.ok(mem.getItem(FRUIT_POP_STORAGE_KEY), 'Fruit Pop save must persist');
    assert.ok(mem.getItem(MEMORY_MATCH_STORAGE_KEY), 'Memory Match save must persist');
  } finally {
    if (prevStorage === undefined) {
      delete g.localStorage;
    } else {
      g.localStorage = prevStorage;
    }
  }

  console.log('  ✅ Theme & Arcade Storage verified (missing/throwing localStorage fallback + shared Golden Seeds wallet)');
}

console.log('🧪 Running Minigames Arcade & Christmas Theme Verification Suite...\n');
testFruitPopEngine();
testMemoryMatchLogic();
testThemeAndStorageSafety();
console.log('\n🎉 ALL MINIGAMES & THEME VERIFICATION TESTS PASSED!');
