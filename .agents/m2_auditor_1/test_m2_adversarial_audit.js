/**
 * Milestone 2 Forensic Auditor - Independent Adversarial & Integrity Test Suite
 * Targets: script.js (SpatialHashGrid, FoodOrb, GlowSpriteCache, FoodManager, Snake, GameEngine)
 */

const assert = require('assert');
const path = require('path');

// Load script.js classes directly
const scriptPath = path.resolve(__dirname, '../../script.js');
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
} = require(scriptPath);

let totalPassed = 0;
let totalFailed = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`  ✔ [PASS] ${name}`);
        totalPassed++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${name}`);
        console.error(`     Error: ${err.message}`);
        if (err.stack) {
            console.error(`     Stack: ${err.stack.split('\n')[1]}`);
        }
        totalFailed++;
    }
}

console.log('================================================================');
console.log('FORENSIC AUDITOR INDEPENDENT ADVERSARIAL INTEGRITY SUITE');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SUITE 1: SPATIAL HASH GRID MATHEMATICAL FIDELITY & ADVERSARIAL STRESS
// ----------------------------------------------------------------------------
console.log('--- SUITE 1: SpatialHashGrid Partitioning & Boundary Hardening ---');

runTest('S1.1: SpatialHashGrid grid dimension calculation and bucket bounds', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    assert.strictEqual(grid.cols, 25);
    assert.strictEqual(grid.rows, 25);
    assert.strictEqual(grid.cellSize, 120);
});

runTest('S1.2: SpatialHashGrid coordinate clamping for extreme boundary values (-1e6, +1e6)', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const c1 = grid._getCell(-99999, -500);
    assert.strictEqual(c1.col, 0);
    assert.strictEqual(c1.row, 0);

    const c2 = grid._getCell(99999, 99999);
    assert.strictEqual(c2.col, 24);
    assert.strictEqual(c2.row, 24);
});

runTest('S1.3: Multi-cell overlap registration for segment crossing 4 grid buckets', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    // Cell boundary is at x=120, y=120. Segment at (120, 120) with radius 10 touches (110..130, 110..130) -> cols 0..1, rows 0..1
    grid.insertSegment('snake_1', 0, 120, 120, 10);
    
    // Querying at (60, 60) with radius 80 (dist = 84.85 <= 80 + 10 = 90) finds it via cell 0,0
    const q1 = grid.queryNearbySegments(60, 60, 80);
    assert.strictEqual(q1.length, 1);
    assert.strictEqual(q1[0].snakeId, 'snake_1');

    // Querying at (180, 180) with radius 80 finds it via cell 1,1
    const q2 = grid.queryNearbySegments(180, 180, 80);
    assert.strictEqual(q2.length, 1);
    assert.strictEqual(q2[0].snakeId, 'snake_1');

    // Querying at (120, 120) with large radius spanning all 4 cells returns exactly 1 deduplicated item
    const qAll = grid.queryNearbySegments(120, 120, 100);
    assert.strictEqual(qAll.length, 1);
});

runTest('S1.4: Zero-radius query returns exact point intersections only', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('snake_1', 0, 500, 500, 0); // point radius 0
    grid.insertSegment('snake_1', 1, 505, 505, 0);

    const qExact = grid.queryNearbySegments(500, 500, 0);
    assert.strictEqual(qExact.length, 1);
    assert.strictEqual(qExact[0].segIndex, 0);

    const qMiss = grid.queryNearbySegments(501, 501, 0);
    assert.strictEqual(qMiss.length, 0);
});

runTest('S1.5: Food swap-and-pop removal preserves remaining bucket elements', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const f1 = { id: 'f1', x: 100, y: 100, radius: 4 };
    const f2 = { id: 'f2', x: 105, y: 105, radius: 4 };
    const f3 = { id: 'f3', x: 110, y: 110, radius: 4 };

    grid.insertFood(f1);
    grid.insertFood(f2);
    grid.insertFood(f3);

    // Remove middle element
    grid.removeFood(f2);
    const q = grid.queryNearbyFood(100, 100, 50);
    assert.strictEqual(q.length, 2);
    const ids = q.map(f => f.id);
    assert.ok(ids.includes('f1'));
    assert.ok(ids.includes('f3'));
    assert.ok(!ids.includes('f2'));

    // Remove remaining elements
    grid.removeFood(f1);
    grid.removeFood(f3);
    const qEmpty = grid.queryNearbyFood(100, 100, 50);
    assert.strictEqual(qEmpty.length, 0);
});

runTest('S1.6: Deduplication stress test with 2000 overlapping entities', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    for (let i = 0; i < 2000; i++) {
        grid.insertSegment(`snake_${i}`, 0, 1500 + (i % 20) * 5, 1500 + Math.floor(i / 20) * 5, 12);
    }
    const results = grid.queryNearbySegments(1500, 1500, 300);
    const uniqueIds = new Set(results.map(r => `${r.snakeId}_${r.segIndex}`));
    assert.strictEqual(results.length, uniqueIds.size, 'No duplicates permitted in query results');
});

runTest('S1.7: Clear() completely empties all segment and food buckets', () => {
    const grid = new SpatialHashGrid(3000, 3000, 120);
    grid.insertSegment('s1', 0, 500, 500, 10);
    grid.insertFood({ id: 'f1', x: 500, y: 500, radius: 4 });
    grid.clear();
    assert.strictEqual(grid.queryNearbySegments(500, 500, 1000).length, 0);
    assert.strictEqual(grid.queryNearbyFood(500, 500, 1000).length, 0);
});

// ----------------------------------------------------------------------------
// SUITE 2: FOOD ORB & GLOW SPRITE CACHE
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 2: FoodOrb Kinematics & Offscreen Cache ---');

runTest('S2.1: FoodOrb physical velocity exponential drag decay', () => {
    const orb = new FoodOrb('orb_test', 100, 100, 4, 2, '#00f0ff', 'boost');
    orb.vx = 100;
    orb.vy = 0;
    const dt = 0.1;
    orb.update(dt);
    const expectedVx = 100 * Math.exp(-4.5 * dt);
    assert.ok(Math.abs(orb.vx - expectedVx) < 1e-4, `Expected vx ~ ${expectedVx}, got ${orb.vx}`);
    assert.ok(orb.x > 100, 'Orb moved along positive X');
});

runTest('S2.2: Ambient FoodOrb harmonic pulse oscillates around base radius', () => {
    const orb = new FoodOrb('amb_test', 100, 100, 10, 1, '#ff007f', 'ambient');
    const radii = [];
    for (let t = 0; t < 100; t++) {
        orb.update(0.02);
        radii.push(orb.radius);
    }
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    assert.ok(minR >= 10 * 0.90, 'Pulse min should not drop below 90%');
    assert.ok(maxR <= 10 * 1.10, 'Pulse max should not exceed 110%');
    assert.ok(maxR > minR, 'Radius must oscillate');
});

runTest('S2.3: GlowSpriteCache returns identical cached instance for same key and clears cleanly', () => {
    const cache = new GlowSpriteCache();
    const s1 = cache.getGlowSprite('#00f0ff', 5, 12);
    const s2 = cache.getGlowSprite('#00f0ff', 5, 12);
    assert.strictEqual(s1, s2);
    cache.clear();
    assert.strictEqual(cache.cache.size, 0);
});

// ----------------------------------------------------------------------------
// SUITE 3: FOOD MANAGER & MULTI-TIER ENERGY LIFECYCLE
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 3: FoodManager & Multi-Tier Energy Lifecycle ---');

runTest('S3.1: Ambient food spawning generates orbs strictly inside circular arena (R=1410px)', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const orbs = fm.spawnAmbientFood(500);
    assert.strictEqual(orbs.length, 500);
    assert.strictEqual(fm.foodList.length, 500);

    for (const orb of orbs) {
        const dx = orb.x - 1500;
        const dy = orb.y - 1500;
        const dist = Math.hypot(dx, dy);
        assert.ok(dist <= 1450, `Orb spawned outside arena radius: dist=${dist}`);
        assert.ok(orb.value >= 1 && orb.value <= 3, `Orb value out of range [1,3]: ${orb.value}`);
        assert.strictEqual(orb.type, 'ambient');
    }
});

runTest('S3.2: Boost trail orb has backward ejection impulse opposite heading angle', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const orb = fm.spawnBoostOrb(1500, 1500, '#00f0ff', 0.0);
    assert.strictEqual(orb.type, 'boost');
    assert.ok(orb.vx < 0, `Ejection impulse vx should be negative for angle 0, got ${orb.vx}`);
});

runTest('S3.3: Corpse disintegration accurately scatters 70% mass into death orbs within arena', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const segments = [];
    for (let i = 0; i < 30; i++) {
        segments.push({ x: 1500 + i * 10, y: 1500 });
    }
    const deadMass = 200.0;
    fm.spawnDeathOrbs(segments, deadMass, '#ffea00');

    let totalCorpseMass = 0;
    let deathOrbCount = 0;
    for (const f of fm.foodList) {
        if (f.type === 'corpse') {
            totalCorpseMass += f.value;
            deathOrbCount++;
            assert.ok(f.glow === true);
            const dx = f.x - 1500;
            const dy = f.y - 1500;
            assert.ok(Math.hypot(dx, dy) <= 1450, 'Death orb must stay within arena bounds');
        }
    }

    const expectedMass = deadMass * 0.70; // 140.0
    assert.ok(Math.abs(totalCorpseMass - expectedMass) < 1e-4, `Expected 70% mass (${expectedMass}), got ${totalCorpseMass}`);
    assert.ok(deathOrbCount >= 8 && deathOrbCount <= 60, `Death orb count out of bounds: ${deathOrbCount}`);
});

runTest('S3.4: Throttled ambient replenishment caps spawning rate to <= 30 per tick', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    fm.update(1/60, [], null);
    assert.strictEqual(fm.foodList.length, 30, 'Single update tick must spawn at most 30 orbs');
});

// ----------------------------------------------------------------------------
// SUITE 4: TWO-TIER MAGNETIC ATTRACTION & INGESTION DYNAMICS
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Magnetic Attraction & Ingestion Dynamics ---');

runTest('S4.1: Food outside magnetic radius (D > R_head + 80) experiences zero attraction force', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    const headRadius = snake.getHeadRadius();
    const attractDist = headRadius + 80;

    const farFood = new FoodOrb('far_1', 1500 + attractDist + 5, 1500, 4, 1, '#00f0ff');
    fm.foodList.push(farFood);
    fm.foodMap.set('far_1', farFood);

    const initialX = farFood.x;
    fm.update(1/60, [snake], null);
    assert.strictEqual(farFood.x, initialX, 'Food outside attraction range must not move');
});

runTest('S4.2: Food inside magnetic radius (D <= R_head + 80) is pulled toward snake head', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    const headRadius = snake.getHeadRadius();
    const attractDist = headRadius + 80;

    const nearFood = new FoodOrb('near_1', 1500 + attractDist - 10, 1500, 4, 1, '#00f0ff');
    fm.foodList.push(nearFood);
    fm.foodMap.set('near_1', nearFood);

    const initialX = nearFood.x;
    fm.update(1/60, [snake], null);
    assert.ok(nearFood.x < initialX, `Food should be pulled toward head (dx < 0). initialX=${initialX}, newX=${nearFood.x}`);
});

runTest('S4.3: Ingestion threshold (D <= R_head + R_orb + 2px) ingests food and increases snake mass', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    const initialMass = snake.mass;

    const ingestFood = new FoodOrb('ingest_1', 1500 + 10, 1500, 4, 3.5, '#00f0ff');
    fm.foodList.push(ingestFood);
    fm.foodMap.set('ingest_1', ingestFood);
    grid.insertFood(ingestFood);

    fm.update(1/60, [snake], grid);

    assert.strictEqual(snake.mass, initialMass + 3.5, 'Snake mass must increase by exact food value');
    assert.strictEqual(fm.foodMap.has('ingest_1'), false, 'Food map must delete ingested orb');
    assert.strictEqual(fm.foodList.some(f => f.id === 'ingest_1'), false, 'Food list must not contain ingested orb');
    assert.strictEqual(grid.queryNearbyFood(1500, 1500, 100).some(f => f.id === 'ingest_1'), false, 'Spatial grid must not return ingested orb');
});

runTest('S4.4: Singularity protection at exact center (D = 0) ingests safely without NaN or infinite velocity', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    const initialMass = snake.mass;

    const centerFood = new FoodOrb('center_1', 1500, 1500, 4, 2.0, '#00f0ff');
    fm.foodList.push(centerFood);
    fm.foodMap.set('center_1', centerFood);

    fm.update(1/60, [snake], null);
    assert.strictEqual(snake.mass, initialMass + 2.0);
    assert.strictEqual(isNaN(snake.x), false);
    assert.strictEqual(isNaN(snake.y), false);
    assert.strictEqual(isNaN(snake.mass), false);
});

runTest('S4.5: Dead snakes do not attract or ingest food', () => {
    const fm = new FoodManager(3000, 3000, 1200);
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    snake.isDead = true;

    const food = new FoodOrb('dead_test', 1500 + 5, 1500, 4, 2.0, '#00f0ff');
    fm.foodList.push(food);
    fm.foodMap.set('dead_test', food);

    fm.update(1/60, [snake], null);
    assert.strictEqual(snake.mass, 20.0, 'Dead snake mass must not change');
    assert.strictEqual(fm.foodMap.has('dead_test'), true, 'Dead snake must not consume food');
    assert.strictEqual(food.x, 1505, 'Dead snake must not pull food');
});

// ----------------------------------------------------------------------------
// SUITE 5: SNAKE MORPHOLOGY & BOOST TRAIL SHEDDING
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Snake Morphology & Boost Shedding ---');

runTest('S5.1: Morphological dimensions scale smoothly with mass', () => {
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    snake.mass = 20.0;
    snake.recalculateDimensions();
    const r20 = snake.bodyRadius;
    const h20 = snake.headRadius;
    const seg20 = snake.calculateSegmentCount();

    snake.mass = 200.0;
    snake.recalculateDimensions();
    const r200 = snake.bodyRadius;
    const h200 = snake.headRadius;
    const seg200 = snake.calculateSegmentCount();

    assert.ok(r200 > r20, 'Body radius must grow with mass');
    assert.ok(h200 > h20, 'Head radius must grow with mass');
    assert.ok(seg200 > seg20, 'Segment count must increase with mass');
    assert.ok(Math.abs(h200 - r200 * 1.20) < 1e-6, 'Head radius must remain 1.2x body radius');
});

runTest('S5.2: Boosting snake sheds pellets into FoodManager at 24px intervals and drains mass', () => {
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    const fm = new FoodManager(3000, 3000, 1200);
    const grid = new SpatialHashGrid(3000, 3000, 120);
    snake.mass = 50.0;
    snake.setBoosting(true);

    const initialMass = snake.mass;
    let droppedCount = 0;
    snake.onPelletDrop = () => { droppedCount++; };

    for (let step = 0; step < 60; step++) {
        snake.update(1/60, grid, fm);
    }

    assert.ok(snake.mass < initialMass, 'Boosting snake must drain mass');
    assert.ok(Math.abs(snake.mass - (initialMass - 4.0)) < 0.1, `Mass drain rate ~4.0 mass/s. Got mass=${snake.mass}`);
    assert.ok(fm.foodList.length > 0, 'FoodManager must contain shed boost orbs');
    assert.ok(droppedCount > 0, 'onPelletDrop callback must fire during boost travel');
});

runTest('S5.3: Boosting deactivates and mass clamps at MIN_BOOST_MASS (20.0)', () => {
    const snake = new Snake('p1', 'Player', 1500, 1500, 'cyan', true);
    snake.mass = 21.0;
    snake.setBoosting(true);

    for (let step = 0; step < 120; step++) {
        snake.update(1/60);
    }

    assert.strictEqual(snake.mass, 20.0, 'Mass must clamp at exactly 20.0');
    assert.strictEqual(snake.isBoosting, false, 'Boost must deactivate below or at 20.0');
});

// ----------------------------------------------------------------------------
// SUITE 6: GAME ENGINE RUNTIME INTEGRATION
// ----------------------------------------------------------------------------
console.log('\n--- SUITE 6: GameEngine State Machine & Loop Integration ---');

runTest('S6.1: GameEngine instantiates M2 SpatialHashGrid, FoodManager and GlowSpriteCache', () => {
    const engine = new GameEngine(null, {});
    assert.ok(engine.spatialGrid instanceof SpatialHashGrid);
    assert.ok(engine.foodManager instanceof FoodManager);
    assert.ok(engine.glowCache instanceof GlowSpriteCache);
    assert.strictEqual(engine.state, 'MENU');
});

runTest('S6.2: GameEngine startGame resets and populates M2 entities in PLAYING state', () => {
    const engine = new GameEngine(null, {});
    engine.startGame({ nickname: 'NeoViper', skin: SKINS[1] });
    assert.strictEqual(engine.state, 'PLAYING');
    assert.strictEqual(engine.player.name, 'NeoViper');
    assert.strictEqual(engine.foodManager.foodList.length, 1200);
});

runTest('S6.3: GameEngine physicsStep runs M2 grid clear, registration, snake update and food ingestion', () => {
    const engine = new GameEngine(null, {});
    engine.startGame({ nickname: 'TestViper', skin: SKINS[0] });

    const orb = new FoodOrb('test_ingest', engine.player.x, engine.player.y, 4, 5.0, '#00f0ff');
    engine.foodManager.foodList.push(orb);
    engine.foodManager.foodMap.set('test_ingest', orb);

    const startMass = engine.player.mass;
    engine.physicsStep(1/60);

    const segs = engine.spatialGrid.queryNearbySegments(engine.player.x, engine.player.y, 100);
    assert.ok(segs.length > 0, 'Player segments must be registered in spatial grid');

    assert.strictEqual(engine.player.mass, startMass + 5.0, 'Player must have ingested orb during physicsStep');
});

// ----------------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`AUDITOR TEST RESULTS: ${totalPassed} Passed, ${totalFailed} Failed`);
console.log('================================================================\n');

if (totalFailed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
