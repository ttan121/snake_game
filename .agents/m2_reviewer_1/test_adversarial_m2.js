/**
 * Independent Adversarial Stress Test Suite for Milestone 2
 * Reviewer 1 (teamwork_preview_reviewer)
 * D:\snake_game\.agents\m2_reviewer_1\test_adversarial_m2.js
 */

const assert = require('assert');
const {
    CONFIG,
    SKINS,
    Camera,
    World,
    SpatialHashGrid,
    FoodOrb,
    GlowSpriteCache,
    FoodManager,
    Snake,
    MouseInputAdapter,
    KeyboardInputAdapter,
    TouchInputAdapter,
    InputManager,
    UIController,
    GameEngine
} = require('../../script.js');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    try {
        fn();
        passedTests++;
        console.log(`  ✔ [PASS] ${name}`);
    } catch (err) {
        failedTests++;
        console.error(`  ✖ [FAIL] ${name}`);
        console.error(`    Error: ${err.message}`);
    }
}

console.log('================================================================');
console.log('MILESTONE 2: REVIEWER 1 INDEPENDENT ADVERSARIAL STRESS SUITE');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: SpatialHashGrid Adversarial Stress & Correctness
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: SpatialHashGrid Partitioning & Broadphase ---');

test('1.1: Grid Dimensions and Bucket Configuration', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    assert.strictEqual(grid.cols, 25);
    assert.strictEqual(grid.rows, 25);
    assert.strictEqual(grid.cellSize, 120);
});

test('1.2: Extreme Out-of-Bounds Coordinate Clamping', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const cellNeg = grid._getCell(-500, -1000);
    assert.strictEqual(cellNeg.col, 0);
    assert.strictEqual(cellNeg.row, 0);

    const cellOverflow = grid._getCell(5000, 10000);
    assert.strictEqual(cellOverflow.col, 24);
    assert.strictEqual(cellOverflow.row, 24);

    const cellBoundary = grid._getCell(0, 0);
    assert.strictEqual(cellBoundary.col, 0);
    assert.strictEqual(cellBoundary.row, 0);

    const cellMax = grid._getCell(2999.9, 2999.9);
    assert.strictEqual(cellMax.col, 24);
    assert.strictEqual(cellMax.row, 24);
});

test('1.3: Multi-Bucket Registration on 4-Cell Junction Intersection', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    // Point at junction (120, 120) with radius 10 touches (0,0), (1,0), (0,1), (1,1)
    grid.insertSegment('snake_1', 0, 120, 120, 10);

    // Query centers at distance sqrt(60^2 + 60^2) = 84.85px from (120,120)
    // Query radius 75px + radius 10px = 85px > 84.85px
    const q00 = grid.queryNearbySegments(60, 60, 75);
    const q10 = grid.queryNearbySegments(180, 60, 75);
    const q01 = grid.queryNearbySegments(60, 180, 75);
    const q11 = grid.queryNearbySegments(180, 180, 75);

    assert.strictEqual(q00.length, 1, 'Should be visible from bucket (0,0)');
    assert.strictEqual(q10.length, 1, 'Should be visible from bucket (1,0)');
    assert.strictEqual(q01.length, 1, 'Should be visible from bucket (0,1)');
    assert.strictEqual(q11.length, 1, 'Should be visible from bucket (1,1)');
});

test('1.4: Strict Deduplication Across Multi-Bucket Query Windows', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('snake_1', 0, 120, 120, 30); // Spans 4 cells

    // Query covering all 4 cells
    const results = grid.queryNearbySegments(120, 120, 100);
    assert.strictEqual(results.length, 1, 'Deduplication must return segment exactly once');
    assert.strictEqual(results[0].snakeId, 'snake_1');
    assert.strictEqual(results[0].segIndex, 0);
});

test('1.5: Euclidean Narrowphase Distance Rejection', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    // Put segment in same 120px cell at (50, 50) radius 5
    grid.insertSegment('snake_1', 0, 50, 50, 5);

    // Query at (100, 100) with radius 10 -> distance is sqrt(50^2 + 50^2) = 70.71 > 15 (5+10)
    // Even though in same cell, narrowphase must cull it!
    const results = grid.queryNearbySegments(100, 100, 10);
    assert.strictEqual(results.length, 0, 'Distant object in same cell must be culled by narrowphase');

    // Query with radius 60 -> distance 70.71 <= 65 (5+60) -> still culled
    const results2 = grid.queryNearbySegments(100, 100, 60);
    assert.strictEqual(results2.length, 0);

    // Query with radius 70 -> distance 70.71 <= 75 (5+70) -> included!
    const results3 = grid.queryNearbySegments(100, 100, 70);
    assert.strictEqual(results3.length, 1);
});

test('1.6: Food Insertion, O(1) Swap-and-Pop Removal & Query', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const orb1 = new FoodOrb('orb_1', 200, 200, 4, 1);
    const orb2 = new FoodOrb('orb_2', 205, 205, 4, 2);
    const orb3 = new FoodOrb('orb_3', 210, 210, 4, 3);

    grid.insertFood(orb1);
    grid.insertFood(orb2);
    grid.insertFood(orb3);

    let query = grid.queryNearbyFood(200, 200, 30);
    assert.strictEqual(query.length, 3);

    // Remove middle orb
    grid.removeFood(orb2);
    query = grid.queryNearbyFood(200, 200, 30);
    assert.strictEqual(query.length, 2);
    assert(query.find(o => o.id === 'orb_1'));
    assert(!query.find(o => o.id === 'orb_2'));
    assert(query.find(o => o.id === 'orb_3'));

    // Remove non-existent orb (no error)
    grid.removeFood({ id: 'non_existent', x: 200, y: 200 });
    assert.strictEqual(grid.queryNearbyFood(200, 200, 30).length, 2);

    // Clear grid
    grid.clear();
    assert.strictEqual(grid.queryNearbyFood(200, 200, 30).length, 0);
    assert.strictEqual(grid.segmentBuckets.size, 0);
    assert.strictEqual(grid.foodBuckets.size, 0);
});

test('1.7: High-Load Stress: 5,000 Entities Rapid Insert & Clear', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const start = Date.now();

    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 3000;
        const y = Math.random() * 3000;
        grid.insertFood(new FoodOrb(`f_${i}`, x, y, 4, 1));
        grid.insertSegment(`s_${i % 50}`, i % 20, x, y, 10);
    }

    const qFood = grid.queryNearbyFood(1500, 1500, 200);
    const qSeg = grid.queryNearbySegments(1500, 1500, 200);
    assert(Array.isArray(qFood));
    assert(Array.isArray(qSeg));

    grid.clear();
    assert.strictEqual(grid.segmentBuckets.size, 0);
    assert.strictEqual(grid.foodBuckets.size, 0);

    const elapsed = Date.now() - start;
    assert(elapsed < 100, `5,000 entity stress took ${elapsed}ms (expected < 100ms)`);
});

// ----------------------------------------------------------------------------
// SUITE 2: FoodOrb & GlowSpriteCache
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: FoodOrb Kinematics & Glow Sprite Cache ---');

test('2.1: FoodOrb Drag Damping & Exponential Friction', () => {
    const orb = new FoodOrb('orb_drag', 100, 100, 4, 1);
    orb.vx = 100;
    orb.vy = 0;

    orb.update(1.0); // 1 second of decay at mu = 4.5
    // expected vx after 1s: 100 * exp(-4.5) ~ 1.11
    assert(Math.abs(orb.vx - 100 * Math.exp(-4.5)) < 0.1, `Expected vx ~ 1.11, got ${orb.vx}`);
    assert(orb.x > 100, 'Orb must have moved forward during decay');
});

test('2.2: Ambient Breathing Harmonic Pulse', () => {
    const orb = new FoodOrb('orb_pulse', 100, 100, 10, 1, '#00f0ff', 'ambient');
    const baseR = orb.radius;
    let minR = Infinity;
    let maxR = -Infinity;

    for (let t = 0; t < 100; t++) {
        orb.update(0.05);
        minR = Math.min(minR, orb.radius);
        maxR = Math.max(maxR, orb.radius);
    }

    assert(minR < baseR, 'Pulse must oscillate below base radius');
    assert(maxR > baseR, 'Pulse must oscillate above base radius');
    assert(Math.abs(minR - 10 * 0.92) < 0.05, `Min radius should be ~9.2, got ${minR}`);
    assert(Math.abs(maxR - 10 * 1.08) < 0.05, `Max radius should be ~10.8, got ${maxR}`);
});

test('2.3: GlowSpriteCache Offscreen Canvas Stamping & Cache Hits', () => {
    const cache = new GlowSpriteCache();
    // In node environment without DOM, getGlowSprite returns canvas if MockHTMLElement or null
    const sprite1 = cache.getGlowSprite('#00f0ff', 5, 12);
    const sprite2 = cache.getGlowSprite('#00f0ff', 5, 12);

    if (sprite1) {
        assert.strictEqual(sprite1, sprite2, 'Cache must return identical instance for same key');
        assert.strictEqual(cache.cache.size, 1);
    }

    cache.clear();
    assert.strictEqual(cache.cache.size, 0);
});

// ----------------------------------------------------------------------------
// SUITE 3: FoodManager Ecosystem & Conservation Laws
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: FoodManager Lifecycle & Conservation Laws ---');

test('3.1: Ambient Food Uniform Spatial Distribution within Arena Perimeter', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const spawned = fm.spawnAmbientFood(500);
    assert.strictEqual(spawned.length, 500);
    assert.strictEqual(fm.foodList.length, 500);

    for (const orb of spawned) {
        const dx = orb.x - 1500;
        const dy = orb.y - 1500;
        const distFromCenter = Math.hypot(dx, dy);
        assert(distFromCenter <= fm.worldRadius, `Orb at (${orb.x}, ${orb.y}) is outside arena radius (dist=${distFromCenter})`);
        assert(orb.value >= 1 && orb.value <= 3, `Orb value ${orb.value} must be between 1 and 3`);
        assert(orb.radius >= 3.0, 'Orb radius must be >= 3.0');
    }
});

test('3.2: Throttled Replenishment Rate Limiting (<= 30 orbs/frame)', () => {
    const fm = new FoodManager(3000, 3000, 100);
    // Starts with 0 orbs. Update tick should only spawn at most 30 orbs!
    fm.update(1 / 60, [], null);
    assert.strictEqual(fm.foodList.length, 30, `Expected 30 orbs spawned in tick 1, got ${fm.foodList.length}`);

    fm.update(1 / 60, [], null);
    assert.strictEqual(fm.foodList.length, 60, `Expected 60 orbs in tick 2, got ${fm.foodList.length}`);

    fm.update(1 / 60, [], null);
    assert.strictEqual(fm.foodList.length, 90, `Expected 90 orbs in tick 3, got ${fm.foodList.length}`);

    fm.update(1 / 60, [], null);
    assert.strictEqual(fm.foodList.length, 100, `Expected clamped to target 100 in tick 4, got ${fm.foodList.length}`);

    fm.update(1 / 60, [], null);
    assert.strictEqual(fm.foodList.length, 100, 'Must not exceed target count');
});

test('3.3: Boost Trail Pellet Shedding Direction Vector (Opposing Heading)', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const heading = Math.PI / 4; // 45 degrees
    const orb = fm.spawnBoostOrb(1500, 1500, '#00f0ff', heading);

    assert.strictEqual(orb.type, 'boost');
    assert.strictEqual(orb.value, 1.5);
    // Velocity vector must oppose heading (heading + PI)
    const velAngle = Math.atan2(orb.vy, orb.vx);
    const expectedAngle = Math.atan2(-Math.sin(heading), -Math.cos(heading));
    const angleDiff = Math.abs(Math.atan2(Math.sin(velAngle - expectedAngle), Math.cos(velAngle - expectedAngle)));
    assert(angleDiff < 0.4, `Ejection impulse must oppose heading within jitter bound (diff=${angleDiff})`);
});

test('3.4: Corpse Disintegration 70% Mass Conservation Law', () => {
    const snake = new Snake('dead_snake', 'Ghost', 1500, 1500, 'cyan', false);
    snake.mass = 500.0;
    snake.recalculateDimensions();

    const deathOrbs = snake.die();
    assert.strictEqual(snake.isDead, true);

    const totalDropMass = deathOrbs.reduce((acc, o) => acc + o.value, 0);
    const expectedDropMass = 500.0 * 0.70; // 350.0
    assert(Math.abs(totalDropMass - expectedDropMass) < 1e-4, `Total dropped mass (${totalDropMass}) must equal 70% dead mass (${expectedDropMass})`);

    const fm = new FoodManager(3000, 3000, 0);
    fm.spawnDeathOrbs(deathOrbs);
    assert.strictEqual(fm.foodList.length, deathOrbs.length);

    for (const orb of fm.foodList) {
        assert.strictEqual(orb.type, 'corpse');
        assert.strictEqual(orb.glow, true);
        const dist = Math.hypot(orb.x - 1500, orb.y - 1500);
        assert(dist <= fm.worldRadius, 'All corpse orbs must stay inside arena perimeter');
    }
});

// ----------------------------------------------------------------------------
// SUITE 4: Two-Tier Magnetic Attraction & Ingestion Physics
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Two-Tier Magnetic Attraction & Ingestion Physics ---');

test('4.1: Far Food Outside Attraction Radius (D > R_head + 80) Remains Stationary', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('player', 'Tester', 1500, 1500, 'cyan', true);

    const headRadius = snake.getHeadRadius();
    const farDistance = headRadius + 85.0; // 5px outside magnetic field
    const orb = new FoodOrb('far_orb', 1500 + farDistance, 1500, 4, 2);
    fm.foodList.push(orb);
    fm.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    fm.update(1 / 60, [snake], grid);
    assert.strictEqual(orb.x, 1500 + farDistance, 'Far food must not move');
    assert.strictEqual(snake.mass, CONFIG.BASE_MASS, 'Snake mass must not change');
    assert.strictEqual(fm.foodList.length, 1, 'Orb must not be consumed');
});

test('4.2: Food Inside Magnetic Field (D <= R_head + 80) Accelerates Toward Head', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('player', 'Tester', 1500, 1500, 'cyan', true);

    const headRadius = snake.getHeadRadius();
    const attractDist = headRadius + 50.0;
    const orb = new FoodOrb('attract_orb', 1500 + attractDist, 1500, 4, 2);
    fm.foodList.push(orb);
    fm.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    fm.update(1 / 60, [snake], grid);
    assert(orb.x < 1500 + attractDist, `Food should be pulled toward head. New x: ${orb.x}`);
    assert.strictEqual(fm.foodList.length, 1, 'Orb not yet within contact limit');
});

test('4.3: Food Reaching Contact Limit (D <= R_head + R_orb + 2px) Ingests and Grows Snake', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('player', 'Tester', 1500, 1500, 'cyan', true);
    const initialMass = snake.mass;

    const headRadius = snake.getHeadRadius();
    const orbRadius = 4.0;
    const contactDist = headRadius + orbRadius + 1.0; // Inside contact limit
    const orb = new FoodOrb('ingest_orb', 1500 + contactDist, 1500, orbRadius, 5.0);
    fm.foodList.push(orb);
    fm.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    fm.update(1 / 60, [snake], grid);
    assert.strictEqual(fm.foodList.length, 0, 'Consumed orb must be removed from foodList');
    assert.strictEqual(fm.foodMap.size, 0, 'Consumed orb must be removed from foodMap');
    assert.strictEqual(grid.queryNearbyFood(1500, 1500, 100).length, 0, 'Consumed orb must be removed from spatial grid');
    assert.strictEqual(snake.mass, initialMass + 5.0, 'Snake mass must increase by exact food value');
    assert.strictEqual(snake.score, Math.floor((initialMass + 5.0) * 10), 'Score must sync with mass');
    assert(fm.particles.length > 0, 'Ingestion spark FX particles must be spawned');
});

test('4.4: Singularity Protection: Food at Exact Snake Center (D = 0) Ingests Safely Without NaN', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('player', 'Tester', 1500, 1500, 'cyan', true);

    const orb = new FoodOrb('center_orb', 1500, 1500, 4.0, 10.0);
    fm.foodList.push(orb);
    fm.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    fm.update(1 / 60, [snake], grid);
    assert.strictEqual(fm.foodList.length, 0);
    assert(!isNaN(snake.mass));
    assert(!isNaN(snake.x));
    assert(!isNaN(snake.y));
    assert.strictEqual(snake.mass, CONFIG.BASE_MASS + 10.0);
});

test('4.5: Multi-Snake Competition: Exactly One Snake Ingests Contested Food', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake1 = new Snake('snake_1', 'One', 1490, 1500, 'cyan', true);
    const snake2 = new Snake('snake_2', 'Two', 1510, 1500, 'magenta', false);

    const orb = new FoodOrb('shared_orb', 1500, 1500, 4.0, 10.0);
    fm.foodList.push(orb);
    fm.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    fm.update(1 / 60, [snake1, snake2], grid);
    assert.strictEqual(fm.foodList.length, 0, 'Orb must be consumed');
    const totalMassGained = (snake1.mass - CONFIG.BASE_MASS) + (snake2.mass - CONFIG.BASE_MASS);
    assert.strictEqual(totalMassGained, 10.0, 'Total mass gained across snakes must equal exactly 10.0 (no double consumption)');
});

test('4.6: Dead Snakes Cannot Attract or Ingest Food', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('dead_snake', 'Ghost', 1500, 1500, 'cyan', false);
    snake.isDead = true;

    const orb = new FoodOrb('test_orb', 1500, 1500, 4.0, 10.0);
    fm.foodList.push(orb);
    fm.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    fm.update(1 / 60, [snake], grid);
    assert.strictEqual(fm.foodList.length, 1, 'Dead snake must not consume food');
    assert.strictEqual(snake.mass, CONFIG.BASE_MASS);
});

// ----------------------------------------------------------------------------
// SUITE 5: Dynamic Morphological Growth & Kinematics Scaling
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Morphological Growth & Dynamic Spine Scaling ---');

test('5.1: Monotonic Dimension Growth with Ingestion', () => {
    const snake = new Snake('grower', 'Player', 1500, 1500, 'cyan', true);
    const r0 = snake.getBodyRadius();
    const seg0 = snake.getTargetSegmentCount();
    const turn0 = snake.getTurnRate();

    snake.addMass(100);
    const r1 = snake.getBodyRadius();
    const seg1 = snake.getTargetSegmentCount();
    const turn1 = snake.getTurnRate();

    assert(r1 > r0, `Body radius must grow with mass (${r0} -> ${r1})`);
    assert(seg1 > seg0, `Segment count must grow with mass (${seg0} -> ${seg1})`);
    assert(turn1 < turn0, `Turn rate must decrease with mass (${turn0} -> ${turn1})`);
});

test('5.2: Boosting Pellet Shedding Callback Integration', () => {
    const fm = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('booster', 'Speedy', 1500, 1500, 'cyan', true);
    snake.mass = 50.0;
    snake.setBoosting(true);

    let pelletsDropped = 0;
    snake.onPelletDrop = (pellet) => {
        pelletsDropped++;
        assert.strictEqual(pellet.value, 1.2);
    };

    // Run 1 second of boosting
    for (let i = 0; i < 60; i++) {
        snake.update(1 / 60, grid, fm);
    }

    assert(pelletsDropped > 0, `Boosting snake must have dropped pellets (dropped ${pelletsDropped})`);
    assert(fm.foodList.length > 0, 'FoodManager must have received boost pellets');
    assert(snake.mass < 50.0, 'Snake mass must have drained while boosting');
});

// ----------------------------------------------------------------------------
// SUITE 6: GameEngine Integration & Loop Verification
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 6: GameEngine Loop Integration ---');

test('6.1: GameEngine Instantiation and Initial Subsystems', () => {
    const engine = new GameEngine(null, {});
    assert(engine.spatialGrid instanceof SpatialHashGrid);
    assert(engine.foodManager instanceof FoodManager);
    assert(engine.glowCache instanceof GlowSpriteCache);
    assert.strictEqual(engine.state, 'MENU');
});

test('6.2: GameEngine startGame Initializes Grid and Ambient Food', () => {
    const engine = new GameEngine(null, {});
    engine.startGame({ nickname: 'TestRunner', skin: SKINS[0] });

    assert.strictEqual(engine.state, 'PLAYING');
    assert(engine.player instanceof Snake);
    assert.strictEqual(engine.player.name, 'TestRunner');
    assert.strictEqual(engine.foodManager.foodList.length, CONFIG.TARGET_AMBIENT_FOOD);
});

test('6.3: GameEngine physicsStep Runs Complete Lifecycle without Errors', () => {
    const engine = new GameEngine(null, {});
    engine.startGame({ nickname: 'TestRunner', skin: SKINS[0] });

    for (let step = 0; step < 120; step++) {
        engine.physicsStep(1 / 60);
    }

    assert(!isNaN(engine.player.x));
    assert(!isNaN(engine.player.y));
    assert(engine.player.segments.length >= 10);
    assert(engine.foodManager.foodList.length >= 1000);
});

test('6.4: Boundary Collision Death Disintegrates into FoodManager', () => {
    const engine = new GameEngine(null, {});
    engine.startGame({ nickname: 'Doomed', skin: SKINS[0] });
    engine.player.mass = 200;
    engine.player.x = 2950; // Outside circular arena
    engine.player.y = 1500;

    engine.physicsStep(1 / 60);
    assert.strictEqual(engine.state, 'GAMEOVER');
    assert.strictEqual(engine.player.isDead, true);

    const corpseOrbs = engine.foodManager.foodList.filter(f => f.type === 'corpse');
    assert(corpseOrbs.length > 0, 'Corpse orbs must be spawned into foodManager upon death');
});

// ----------------------------------------------------------------------------
// SUITE 7: Integrity & Anti-Cheat Validation
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 7: Integrity & Anti-Cheat Verification ---');

test('7.1: Zero Hardcoded Test Return Patterns in script.js', () => {
    const fs = require('fs');
    const content = fs.readFileSync('D:/snake_game/script.js', 'utf8');

    // Check for dummy or hardcoded branches
    assert(!content.includes('__MOCK_RESULT__'), 'No mock results in production script.js');
    assert(!content.includes('return 55;'), 'No hardcoded test score returns');
    assert(!content.includes('return 25;'), 'No hardcoded test counts');
    assert(!content.includes('return 250;'), 'No hardcoded test counts');
});

console.log('\n================================================================');
console.log(`EXECUTION SUMMARY: ${passedTests} Passed, ${failedTests} Failed`);
console.log('================================================================');

if (failedTests > 0) {
    process.exit(1);
}
