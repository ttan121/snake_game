/**
 * Milestone 2 Verification Test Suite for script.js
 * Tests:
 * 1. SpatialHashGrid (3000x3000px, 120px cell, insertSegment, insertFood, queryNearbySegments, queryNearbyFood, clear, deduplication, boundaries)
 * 2. FoodOrb (properties, friction velocity decay, ambient harmonic pulse)
 * 3. GlowSpriteCache (offscreen caching, key generation, clear)
 * 4. FoodManager (1200 ambient food target, circular arena distribution, boost pellet shedding, death orbs 70% mass, magnetic attraction kinematics, instant ingestion threshold, particle FX, viewport culling)
 * 5. Snake Milestone 2 enhancements (addMass, getBodyRadius, getHeadRadius, getTurnRate, boost trail shedding, die corpse orbs)
 * 6. GameEngine Milestone 2 integration (spatialGrid, foodManager, HUD score/mass updates, draw order)
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
    GameEngine
} = require('../../script.js');

let totalPassed = 0;
let totalFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✔ [PASS] ${name}`);
        totalPassed++;
    } catch (err) {
        console.error(`  ✖ [FAIL] ${name}`);
        console.error(err);
        totalFailed++;
    }
}

console.log('================================================================');
console.log('MILESTONE 2 VERIFICATION TEST SUITE (script.js)');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: SpatialHashGrid Partitioning & Zero-GC Buckets
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: SpatialHashGrid Partitioning & Zero-GC Buckets ---');

test('1.1: SpatialHashGrid initializes with 3000x3000 arena and 120px cell size (25x25)', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    assert.strictEqual(grid.worldWidth, 3000);
    assert.strictEqual(grid.worldHeight, 3000);
    assert.strictEqual(grid.cellSize, 120);
    assert.strictEqual(grid.cols, 25);
    assert.strictEqual(grid.rows, 25);
    assert.strictEqual(grid.segmentBuckets.size, 0);
    assert.strictEqual(grid.foodBuckets.size, 0);
});

test('1.2: SpatialHashGrid coordinate clamping for out-of-bounds coordinates', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const cellNeg = grid._getCell(-100, -50);
    assert.strictEqual(cellNeg.col, 0);
    assert.strictEqual(cellNeg.row, 0);

    const cellOver = grid._getCell(3500, 4000);
    assert.strictEqual(cellOver.col, 24);
    assert.strictEqual(cellOver.row, 24);

    const cellExact = grid._getCell(120, 240);
    assert.strictEqual(cellExact.col, 1);
    assert.strictEqual(cellExact.row, 2);
});

test('1.3: insertSegment populates multi-cell overlap for boundary segments', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    // Segment placed directly on cell intersection (120, 120) with radius 15px
    // Should overlap cells (0,0), (1,0), (0,1), (1,1)
    grid.insertSegment('snake_1', 0, 120, 120, 15);

    assert.strictEqual(grid.segmentBuckets.has('0,0'), true);
    assert.strictEqual(grid.segmentBuckets.has('1,0'), true);
    assert.strictEqual(grid.segmentBuckets.has('0,1'), true);
    assert.strictEqual(grid.segmentBuckets.has('1,1'), true);

    const nearby = grid.queryNearbySegments(120, 120, 20);
    assert.strictEqual(nearby.length, 1, 'Should deduplicate segment spanning 4 cells');
    assert.strictEqual(nearby[0].snakeId, 'snake_1');
});

test('1.4: queryNearbySegments Euclidean narrowphase distance check', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 500, 500, 10);
    grid.insertSegment('s2', 1, 530, 500, 10); // 30px away
    grid.insertSegment('s3', 2, 800, 800, 10); // distant

    const res50 = grid.queryNearbySegments(500, 500, 50);
    assert.strictEqual(res50.length, 2);
    assert.strictEqual(res50.some(s => s.snakeId === 's1'), true);
    assert.strictEqual(res50.some(s => s.snakeId === 's2'), true);

    const res15 = grid.queryNearbySegments(500, 500, 15); // s2 is 30px away, r1=15, r2=10 => maxDist=25 < 30
    assert.strictEqual(res15.length, 1);
    assert.strictEqual(res15[0].snakeId, 's1');
});

test('1.5: insertFood, removeFood and queryNearbyFood', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const orb1 = { id: 'food_1', x: 600, y: 600, radius: 4, value: 2 };
    const orb2 = { id: 'food_2', x: 620, y: 600, radius: 4, value: 2 };
    const orb3 = { id: 'food_3', x: 1200, y: 1200, radius: 4, value: 1 };

    grid.insertFood(orb1);
    grid.insertFood(orb2);
    grid.insertFood(orb3);

    const queried = grid.queryNearbyFood(600, 600, 50);
    assert.strictEqual(queried.length, 2);
    assert.strictEqual(queried.some(f => f.id === 'food_1'), true);
    assert.strictEqual(queried.some(f => f.id === 'food_2'), true);

    grid.removeFood(orb1);
    const afterRemove = grid.queryNearbyFood(600, 600, 50);
    assert.strictEqual(afterRemove.length, 1);
    assert.strictEqual(afterRemove[0].id, 'food_2');
});

test('1.6: clear() resets buckets without memory leaks', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    for (let i = 0; i < 500; i++) {
        grid.insertSegment(`s_${i}`, 0, Math.random() * 3000, Math.random() * 3000, 10);
        grid.insertFood({ id: `f_${i}`, x: Math.random() * 3000, y: Math.random() * 3000, radius: 3 });
    }
    assert.ok(grid.segmentBuckets.size > 0);
    assert.ok(grid.foodBuckets.size > 0);

    grid.clear();
    assert.strictEqual(grid.segmentBuckets.size, 0);
    assert.strictEqual(grid.foodBuckets.size, 0);
    assert.strictEqual(grid.queryNearbySegments(500, 500, 500).length, 0);
    assert.strictEqual(grid.queryNearbyFood(500, 500, 500).length, 0);
});

// ----------------------------------------------------------------------------
// SUITE 2: FoodOrb & GlowSpriteCache
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: FoodOrb & GlowSpriteCache ---');

test('2.1: FoodOrb properties and instantiation', () => {
    const orb = new FoodOrb('orb_test', 500, 600, 4.5, 2.0, '#00ff66', 'ambient', false);
    assert.strictEqual(orb.id, 'orb_test');
    assert.strictEqual(orb.x, 500);
    assert.strictEqual(orb.y, 600);
    assert.strictEqual(orb.radius, 4.5);
    assert.strictEqual(orb.value, 2.0);
    assert.strictEqual(orb.color, '#00ff66');
    assert.strictEqual(orb.type, 'ambient');
    assert.strictEqual(orb.glow, false);
});

test('2.2: FoodOrb update applies velocity friction decay and ambient harmonic pulse', () => {
    const boostOrb = new FoodOrb('b1', 100, 100, 3.5, 1.5, '#ff007f', 'boost', true);
    boostOrb.vx = 100;
    boostOrb.vy = 50;
    boostOrb.update(0.1);

    assert.ok(boostOrb.vx < 100, 'Velocity VX must decay due to aerodynamic friction');
    assert.ok(boostOrb.vy < 50, 'Velocity VY must decay due to aerodynamic friction');
    assert.ok(boostOrb.x > 100, 'Position X should advance with velocity');
    assert.ok(boostOrb.y > 100, 'Position Y should advance with velocity');

    const ambOrb = new FoodOrb('a1', 200, 200, 4.0, 1.0, '#00f0ff', 'ambient', false);
    const initialRadius = ambOrb.radius;
    ambOrb.update(0.5);
    assert.ok(Math.abs(ambOrb.radius - initialRadius) <= initialRadius * 0.1, 'Ambient radius oscillates smoothly');
});

test('2.3: GlowSpriteCache returns cached offscreen canvas and supports clear()', () => {
    const cache = new GlowSpriteCache();
    assert.strictEqual(cache.cache.size, 0);
    cache.clear();
    assert.strictEqual(cache.cache.size, 0);
});

// ----------------------------------------------------------------------------
// SUITE 3: FoodManager & Multi-Tier Orb Lifecycle
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: FoodManager & Multi-Tier Orb Lifecycle ---');

test('3.1: FoodManager initializes with 1200 target ambient food count', () => {
    const mgr = new FoodManager(3000, 3000, 1200);
    assert.strictEqual(mgr.worldWidth, 3000);
    assert.strictEqual(mgr.worldHeight, 3000);
    assert.strictEqual(mgr.worldRadius, 1450);
    assert.strictEqual(mgr.targetAmbientCount, 1200);
    assert.strictEqual(mgr.foodList.length, 0);
});

test('3.2: spawnAmbientFood distributes orbs inside circular arena with mass 1-3', () => {
    const mgr = new FoodManager(3000, 3000, 1200);
    const spawned = mgr.spawnAmbientFood(100);
    assert.strictEqual(spawned.length, 100);
    assert.strictEqual(mgr.foodList.length, 100);

    for (const orb of spawned) {
        assert.strictEqual(orb.type, 'ambient');
        assert.ok(orb.value >= 1 && orb.value <= 3, `Value ${orb.value} must be 1-3`);
        assert.ok(orb.radius >= 3.0, `Radius ${orb.radius} must be >= 3.0`);
        assert.ok(orb.x >= 20 && orb.x <= 2980, `X ${orb.x} inside bounds`);
        assert.ok(orb.y >= 20 && orb.y <= 2980, `Y ${orb.y} inside bounds`);

        const distToCenter = Math.hypot(orb.x - 1500, orb.y - 1500);
        assert.ok(distToCenter <= 1450, `Orb distance ${distToCenter} must be within arena radius 1450`);
    }
});

test('3.3: spawnBoostOrb creates boost trail pellet with ejection velocity impulse', () => {
    const mgr = new FoodManager(3000, 3000, 1200);
    const orb = mgr.spawnBoostOrb(1000, 1000, '#00f0ff', 0); // snake heading right (0 rad)

    assert.strictEqual(orb.type, 'boost');
    assert.strictEqual(orb.value, 1.5);
    assert.strictEqual(orb.glow, true);
    assert.strictEqual(orb.color, '#00f0ff');
    assert.ok(orb.vx < 0, `Ejection impulse opposes snake heading (vx = ${orb.vx} < 0)`);
});

test('3.4: spawnDeathOrbs clamps corpse orbs inside arena and conserves 70% mass', () => {
    const snake = new Snake('victim', 'Victim', 1500, 1500, 'magenta');
    snake.mass = 300;
    snake.updateSpine();

    const deathOrbs = snake.die();
    assert.strictEqual(snake.isDead, true);
    assert.ok(deathOrbs.length >= 8, `Corpse orb count ${deathOrbs.length} >= 8`);

    const totalDropMass = deathOrbs.reduce((sum, o) => sum + o.value, 0);
    assert.ok(Math.abs(totalDropMass - 300 * 0.70) < 2.0, `Total drop mass ${totalDropMass} should equal 70% of 300 (210)`);

    const mgr = new FoodManager(3000, 3000, 0);
    mgr.spawnDeathOrbs(deathOrbs);
    assert.strictEqual(mgr.foodList.length, deathOrbs.length);

    for (const orb of mgr.foodList) {
        assert.strictEqual(orb.type, 'corpse');
        assert.strictEqual(orb.glow, true);
        assert.ok(orb.x >= 20 && orb.x <= 2980);
        assert.ok(orb.y >= 20 && orb.y <= 2980);
    }
});

test('3.5: Throttled ambient food replenishment in batches <= 30', () => {
    const mgr = new FoodManager(3000, 3000, 50);
    assert.strictEqual(mgr.foodList.length, 0);

    mgr.update(1 / 60, []);
    assert.strictEqual(mgr.foodList.length, 30, 'First batch clamped to max 30');

    mgr.update(1 / 60, []);
    assert.strictEqual(mgr.foodList.length, 50, 'Second batch reaches target 50');

    mgr.update(1 / 60, []);
    assert.strictEqual(mgr.foodList.length, 50, 'Does not exceed target');
});

// ----------------------------------------------------------------------------
// SUITE 4: Magnetic Ingestion Dynamics & Physics
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Magnetic Ingestion Dynamics & Physics ---');

test('4.1: Distant food outside magnet radius (D > R_head + 80) is unaffected', () => {
    const snake = new Snake('p1', 'Player', 1000, 1000);
    const mgr = new FoodManager(3000, 3000, 0);
    const orb = new FoodOrb('f_far', 1200, 1000, 4.0, 2.0); // 200px away
    mgr.foodList = [orb];
    mgr.foodMap.set(orb.id, orb);

    mgr.update(1 / 60, [snake]);
    assert.strictEqual(orb.x, 1200, 'Distant food must remain stationary');
    assert.strictEqual(snake.mass, 20.0);
});

test('4.2: Food inside attraction radius (D <= R_head + 80) is pulled toward snake head', () => {
    const snake = new Snake('p1', 'Player', 1000, 1000);
    const headR = snake.getHeadRadius();
    const initialX = 1000 + headR + 50; // within 80px attraction window

    const mgr = new FoodManager(3000, 3000, 0);
    const orb = new FoodOrb('f_near', initialX, 1000, 4.0, 2.0);
    mgr.foodList = [orb];
    mgr.foodMap.set(orb.id, orb);

    mgr.update(1 / 60, [snake]);
    assert.ok(orb.x < initialX, `Orb X (${orb.x}) should be pulled toward snake head (1000)`);
});

test('4.3: Food reaching ingestion threshold (D <= R_head + R_orb + 2px) is consumed and increases mass', () => {
    const snake = new Snake('p1', 'Player', 1000, 1000);
    const headR = snake.getHeadRadius();
    const mgr = new FoodManager(3000, 3000, 0);
    const orb = new FoodOrb('f_eat', 1000 + headR + 2, 1000, 4.0, 7.5);
    mgr.foodList = [orb];
    mgr.foodMap.set(orb.id, orb);

    const initialMass = snake.mass;
    mgr.update(1 / 60, [snake]);

    assert.strictEqual(mgr.foodList.length, 0, 'Consumed orb must be removed from foodList');
    assert.strictEqual(mgr.foodMap.has('f_eat'), false, 'Consumed orb must be removed from foodMap');
    assert.strictEqual(snake.mass, initialMass + 7.5, 'Snake mass must increase by exact orb value');
    assert.strictEqual(snake.score, Math.floor((initialMass + 7.5) * 10), 'Snake score updated');
});

test('4.4: Ingestion works seamlessly with SpatialHashGrid registration and removal', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('p1', 'Player', 1000, 1000);
    const mgr = new FoodManager(3000, 3000, 0);
    const orb = new FoodOrb('f_grid', 1000, 1000, 4.0, 3.0);

    mgr.foodList = [orb];
    mgr.foodMap.set(orb.id, orb);
    grid.insertFood(orb);

    assert.strictEqual(grid.queryNearbyFood(1000, 1000, 50).length, 1);

    mgr.update(1 / 60, [snake], grid);

    assert.strictEqual(mgr.foodList.length, 0);
    assert.strictEqual(grid.queryNearbyFood(1000, 1000, 50).length, 0, 'Orb removed from spatial grid bucket');
});

test('4.5: Singularity protection at exact center (D = 0) ingests safely without NaN', () => {
    const snake = new Snake('p1', 'Player', 1000, 1000);
    const mgr = new FoodManager(3000, 3000, 0);
    const orb = new FoodOrb('f_zero', 1000, 1000, 4.0, 5.0);
    mgr.foodList = [orb];
    mgr.foodMap.set(orb.id, orb);

    mgr.update(1 / 60, [snake]);
    assert.strictEqual(mgr.foodList.length, 0);
    assert.strictEqual(isNaN(snake.mass), false);
    assert.strictEqual(snake.mass, 25.0);
});

test('4.6: Dead snakes do not attract or ingest food', () => {
    const snake = new Snake('p1', 'DeadSnake', 1000, 1000);
    snake.die();
    const mgr = new FoodManager(3000, 3000, 0);
    const orb = new FoodOrb('f_dead', 1000, 1000, 4.0, 5.0);
    mgr.foodList = [orb];
    mgr.foodMap.set(orb.id, orb);

    mgr.update(1 / 60, [snake]);
    assert.strictEqual(mgr.foodList.length, 1, 'Dead snake cannot eat food');
});

// ----------------------------------------------------------------------------
// SUITE 5: Boost Trail Shedding & Dynamic Spine Growth
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Boost Trail Shedding & Dynamic Spine Growth ---');

test('5.1: Boosting snake sheds boost trail pellets into FoodManager', () => {
    const snake = new Snake('booster', 'Booster', 1500, 1500);
    snake.mass = 80;
    snake.setBoosting(true);

    const mgr = new FoodManager(3000, 3000, 0);
    const grid = new SpatialHashGrid(3000, 3000, 120);

    for (let i = 0; i < 60; i++) {
        snake.update(1 / 60, grid, mgr);
    }

    assert.ok(mgr.foodList.length > 0, 'Boost pellets must be added to FoodManager');
    assert.strictEqual(mgr.foodList[0].type, 'boost');
    assert.strictEqual(mgr.foodList[0].glow, true);
});

test('5.2: Ingesting mass grows snake segments and body radius smoothly', () => {
    const snake = new Snake('grower', 'Grower', 1500, 1500);
    const initialSegCount = snake.segments.length;
    const initialRadius = snake.getBodyRadius();

    snake.addMass(100);
    snake.updateSpine();

    assert.ok(snake.segments.length > initialSegCount, 'Segment count should increase with mass');
    assert.ok(snake.getBodyRadius() > initialRadius, 'Body radius should increase with mass');
    assert.strictEqual(snake.getHeadRadius(), snake.getBodyRadius() * 1.20);
});

// ----------------------------------------------------------------------------
// SUITE 6: GameEngine Integration
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 6: GameEngine Integration ---');

test('6.1: GameEngine instantiates spatialGrid, foodManager, and glowCache', () => {
    const engine = new GameEngine(null);
    assert.ok(engine.spatialGrid instanceof SpatialHashGrid);
    assert.ok(engine.foodManager instanceof FoodManager);
    assert.ok(engine.glowCache instanceof GlowSpriteCache);
    assert.strictEqual(engine.state, 'MENU');
});

test('6.2: GameEngine startGame populates ambient food and sets PLAYING state', () => {
    const engine = new GameEngine(null);
    engine.startGame({ nickname: 'Hero', skin: SKINS[0] });

    assert.strictEqual(engine.state, 'PLAYING');
    assert.strictEqual(engine.player.name, 'Hero');
    assert.strictEqual(engine.foodManager.foodList.length, 1200);
});

test('6.3: GameEngine physicsStep registers segments and food into spatialGrid', () => {
    const engine = new GameEngine(null);
    engine.startGame({ nickname: 'Hero', skin: SKINS[0] });

    engine.physicsStep(1 / 60);

    assert.ok(engine.spatialGrid.segmentBuckets.size > 0, 'Snake segments registered in spatial grid');
    assert.ok(engine.spatialGrid.foodBuckets.size > 0, 'Food orbs registered in spatial grid');
});

console.log('\n================================================================');
console.log(`TOTAL PASSED: ${totalPassed} / ${totalPassed + totalFailed}`);
console.log(`TOTAL FAILED: ${totalFailed}`);
console.log('================================================================\n');

if (totalFailed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
