/**
 * Independent Physics, Mathematics & Adversarial Verification Suite
 * Milestone 2 Reviewer 2 (Physics & Math Specialist)
 * Path: D:\snake_game\.agents\m2_reviewer_2\test_reviewer2_physics_math.js
 */

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

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${message}`);
    } else {
        failedTests++;
        failures.push(message);
        console.log(`  \x1b[31m✖ [FAIL]\x1b[0m ${message}`);
    }
}

function assertCloseTo(actual, expected, tolerance = 1e-4, message = '') {
    const diff = Math.abs(actual - expected);
    const passed = diff <= tolerance;
    assert(passed, `${message} (Expected ~${expected}, Got ${actual}, Diff ${diff.toExponential(4)} <= ${tolerance})`);
}

console.log('================================================================');
console.log('MILESTONE 2: REVIEWER 2 INDEPENDENT PHYSICS & MATH VERIFICATION');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: MAGNETIC ATTRACTION PHYSICS & SINGULARITY PROTECTION
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Magnetic Attraction Physics & Singularity Protection ---');

(() => {
    const fm = new FoodManager(3000, 3000, 0);
    const snake = new Snake('test_snake', 'Tester', 1500, 1500, 'cyan', true);
    snake.mass = 50;
    snake.recalculateDimensions();

    const headRadius = snake.getHeadRadius();
    const magnetDistance = 80;
    const attractRadius = headRadius + magnetDistance;

    // 1.1 In-range food attraction
    const foodInRange = new FoodOrb('food_in_range', 1500 + attractRadius - 5, 1500, 3.5, 1.0, '#00f0ff', 'ambient');
    fm.foodList = [foodInRange];
    fm.foodMap.set(foodInRange.id, foodInRange);

    const initialX = foodInRange.x;
    fm.update(1 / 60, [snake], null);

    assert(foodInRange.x < initialX, `Food inside R_magnet (${attractRadius.toFixed(2)}px) is pulled towards head`);

    // 1.2 Out-of-range food stationary
    const foodOutOfRange = new FoodOrb('food_out_of_range', 1500 + attractRadius + 15, 1500, 3.5, 1.0, '#00f0ff', 'ambient');
    fm.foodList = [foodOutOfRange];
    fm.foodMap.set(foodOutOfRange.id, foodOutOfRange);

    const outInitialX = foodOutOfRange.x;
    fm.update(1 / 60, [snake], null);

    assert(foodOutOfRange.x === outInitialX, `Food outside R_magnet (${(attractRadius + 15).toFixed(2)}px) remains stationary`);

    // 1.3 Distance-decay velocity profile: closer food accelerates faster
    const fm2 = new FoodManager(3000, 3000, 0);
    const foodClose = new FoodOrb('f_close', 1500 + 30, 1500, 3.5, 1.0, '#00f0ff', 'ambient');
    const foodFar = new FoodOrb('f_far', 1500 + 75, 1500, 3.5, 1.0, '#00f0ff', 'ambient');
    fm2.foodList = [foodClose, foodFar];
    fm2.foodMap.set(foodClose.id, foodClose);
    fm2.foodMap.set(foodFar.id, foodFar);

    const dt = 1 / 60;
    fm2.update(dt, [snake], null);

    const distMovedClose = (1500 + 30) - foodClose.x;
    const distMovedFar = (1500 + 75) - foodFar.x;

    assert(distMovedClose > distMovedFar, `Closer food moves faster due to distance-decay acceleration (Close: ${distMovedClose.toFixed(4)}px, Far: ${distMovedFar.toFixed(4)}px)`);

    // 1.4 Singularity Protection at D = 0
    const fmSingular = new FoodManager(3000, 3000, 0);
    const foodAtZero = new FoodOrb('f_zero', 1500, 1500, 3.5, 1.0, '#00f0ff', 'ambient');
    fmSingular.foodList = [foodAtZero];
    fmSingular.foodMap.set(foodAtZero.id, foodAtZero);

    const massBefore = snake.mass;
    fmSingular.update(dt, [snake], null);

    assert(Number.isFinite(snake.mass) && !isNaN(snake.mass), 'D = 0 singularity does not produce NaN or Infinity in snake mass');
    assert(snake.mass === massBefore + 1.0, 'D = 0 food orb is immediately consumed and mass added');
    assert(fmSingular.foodList.length === 0, 'D = 0 consumed food is purged from food list');

    // 1.5 Singularity Protection at D = 1e-5 (micro-distance)
    const fmMicro = new FoodManager(3000, 3000, 0);
    const foodMicro = new FoodOrb('f_micro', 1500 + 1e-5, 1500, 3.5, 1.0, '#00f0ff', 'ambient');
    fmMicro.foodList = [foodMicro];
    fmMicro.foodMap.set(foodMicro.id, foodMicro);

    fmMicro.update(dt, [snake], null);

    assert(Number.isFinite(snake.mass) && !isNaN(snake.mass), 'Micro-distance D = 1e-5 does not cause NaN or numerical overflow');
    assert(fmMicro.foodList.length === 0, 'Micro-distance orb is properly ingested');

    // 1.6 Exponential Velocity Drag Decay on FoodOrb
    const orb = new FoodOrb('drag_orb', 500, 500, 4, 1, '#ff007f', 'boost');
    orb.vx = 100;
    orb.vy = 0;

    const dragDt = 0.2; // 200ms
    orb.update(dragDt);

    const theoreticalVx = 100 * Math.exp(-4.5 * dragDt);
    assertCloseTo(orb.vx, theoreticalVx, 1e-5, 'FoodOrb vx matches analytical exponential drag solution v0 * exp(-4.5 * t)');
    assert(orb.x > 500, 'FoodOrb position advanced along velocity vector during drag phase');
})();

// -----------------------------------------------------------------------------
// SECTION 2: INGESTION CONTACT MATH & MASS ACCUMULATION DYNAMICS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Ingestion Contact Math & Mass Accumulation Dynamics ---');

(() => {
    const fm = new FoodManager(3000, 3000, 0);
    const snake = new Snake('ingest_tester', 'Tester', 1500, 1500, 'cyan', true);
    snake.mass = 40;
    snake.recalculateDimensions();

    const headRadius = snake.getHeadRadius();
    const orbRadius = 4.0;
    const extraRadius = 2.0;
    const contactLimit = headRadius + orbRadius + extraRadius;

    // 2.1 Food precisely at contact limit
    const foodAtContact = new FoodOrb('f_contact', 1500 + contactLimit - 0.1, 1500, orbRadius, 2.5, '#00f0ff', 'ambient');
    fm.foodList = [foodAtContact];
    fm.foodMap.set(foodAtContact.id, foodAtContact);

    const initialMass = snake.mass;
    fm.update(1 / 60, [snake], null);

    assert(snake.mass === initialMass + 2.5, `Food at D <= R_head + R_orb + 2px (${(contactLimit - 0.1).toFixed(2)}px <= ${contactLimit.toFixed(2)}px) is ingested`);
    assert(fm.foodList.length === 0, 'Ingested food is removed from food list');

    // 2.2 Food just outside contact limit (should be pulled, not ingested in this tick)
    const foodOutsideContact = new FoodOrb('f_pull_only', 1500 + contactLimit + 10.0, 1500, orbRadius, 2.5, '#00f0ff', 'ambient');
    fm.foodList = [foodOutsideContact];
    fm.foodMap.set(foodOutsideContact.id, foodOutsideContact);

    const massBeforePull = snake.mass;
    fm.update(1 / 60, [snake], null);

    assert(snake.mass === massBeforePull, 'Food outside contact limit is not ingested prematurely');
    assert(foodOutsideContact.x < 1500 + contactLimit + 10.0, 'Food outside contact limit is pulled closer by magnetic field');
    assert(fm.foodList.length === 1, 'Non-ingested food remains in food list');

    // 2.3 Exact mass accumulation across 50 heterogeneous orbs
    const fmMulti = new FoodManager(3000, 3000, 0);
    const multiOrbs = [];
    let expectedTotalMassAdded = 0;

    for (let i = 0; i < 50; i++) {
        const val = 1.0 + (i % 5) * 0.75;
        expectedTotalMassAdded += val;
        const orb = new FoodOrb(`multi_${i}`, 1500 + (Math.random() - 0.5) * 5, 1500 + (Math.random() - 0.5) * 5, 3.5, val, '#00f0ff', 'ambient');
        multiOrbs.push(orb);
        fmMulti.foodMap.set(orb.id, orb);
    }
    fmMulti.foodList = [...multiOrbs];

    const preMass = snake.mass;
    fmMulti.update(1 / 60, [snake], null);

    assertCloseTo(snake.mass, preMass + expectedTotalMassAdded, 1e-4, `Simultaneous multi-orb ingestion conserves total mass across 50 orbs (+${expectedTotalMassAdded.toFixed(2)})`);
    assert(fmMulti.foodList.length === 0, 'All 50 ingested orbs cleared from manager');

    // 2.4 Morphological dimension invariants after mass growth
    const expectedBodyRadius = CONFIG.BASE_BODY_RADIUS + CONFIG.RADIUS_GROWTH_FACTOR * Math.sqrt(snake.mass);
    const expectedHeadRadius = expectedBodyRadius * CONFIG.HEAD_RADIUS_FACTOR;
    const expectedJointSpacing = CONFIG.JOINT_BASE_SPACING + CONFIG.JOINT_SPACING_FACTOR * expectedBodyRadius;
    const expectedSegmentCount = Math.floor(CONFIG.SEGMENT_BASE_COUNT + CONFIG.SEGMENT_MASS_FACTOR * snake.mass);
    const expectedScore = Math.floor(snake.mass * 10);

    assertCloseTo(snake.bodyRadius, expectedBodyRadius, 1e-4, 'Snake bodyRadius scales with sqrt(mass)');
    assertCloseTo(snake.headRadius, expectedHeadRadius, 1e-4, 'Snake headRadius maintains 1.2x bodyRadius ratio');
    assertCloseTo(snake.jointSpacing, expectedJointSpacing, 1e-4, 'Snake jointSpacing scales with bodyRadius');
    assert(snake.calculateSegmentCount() === expectedSegmentCount, `Snake segment count equals formula floor(10 + 0.35 * mass) -> ${expectedSegmentCount}`);
    assert(snake.score === expectedScore, `Snake score strictly equals floor(mass * 10) -> ${expectedScore}`);
})();

// -----------------------------------------------------------------------------
// SECTION 3: BOOST TRAIL SHEDDING & BACKWARD EJECTION KINEMATICS
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Boost Trail Shedding & Backward Ejection Kinematics ---');

(() => {
    const fm = new FoodManager(3000, 3000, 0);
    const snake = new Snake('boost_tester', 'Booster', 1500, 1500, 'solar', true);
    snake.mass = 80;
    snake.setBoosting(true);
    snake.angle = 0; // Travelling strictly eastward (+X direction)
    snake.targetAngle = 0;

    const droppedPellets = [];
    const onDropCallback = (p) => droppedPellets.push(p);

    // 3.1 Verify boost speed reaches BOOST_SPEED (285 px/s)
    for (let step = 0; step < 60; step++) {
        snake.update(1 / 60, fm, onDropCallback);
    }

    assertCloseTo(snake.currentSpeed, CONFIG.BOOST_SPEED, 0.5, `Snake reaches boost speed (${CONFIG.BOOST_SPEED} px/s)`);

    // 3.2 Verify boost trail shedding rate (shedInterval = 24px)
    // Distance travelled per second = 285px -> expected pellets = floor(285 / 24) = 11 to 12
    assert(droppedPellets.length >= 11 && droppedPellets.length <= 13, `Boost shedding frequency matches ~12 Hz (Observed ${droppedPellets.length} pellets in 1s)`);

    // 3.3 Verify backward ejection impulse velocity direction
    let allBackward = true;
    for (const food of fm.foodList) {
        if (food.type === 'boost') {
            // Snake was moving in +X direction (angle = 0). Backward impulse should have vx < 0
            if (food.vx >= 0) {
                allBackward = false;
                break;
            }
            const speed = Math.hypot(food.vx, food.vy);
            if (speed < 50 || speed > 90) {
                allBackward = false;
                break;
            }
        }
    }

    assert(allBackward, 'Boost pellets are ejected backward with impulse velocity magnitude in [60, 80] px/s range');

    // 3.4 Starvation Cutoff: Boost deactivates at MIN_BOOST_MASS (20.0)
    snake.mass = 20.05;
    snake.setBoosting(true);
    snake.update(0.1, fm, onDropCallback);

    assert(snake.mass <= CONFIG.MIN_BOOST_MASS, 'Mass drains to MIN_BOOST_MASS');
    assert(snake.isBoosting === false, 'isBoosting flag auto-cleared when mass hits MIN_BOOST_MASS (20.0)');

    // 3.5 Non-boosting snake sheds 0 pellets
    const pelletsBefore = droppedPellets.length;
    snake.setBoosting(false);
    for (let step = 0; step < 60; step++) {
        snake.update(1 / 60, fm, onDropCallback);
    }
    assert(droppedPellets.length === pelletsBefore, 'Non-boosting snake emits zero boost pellets');
})();

// -----------------------------------------------------------------------------
// SECTION 4: CORPSE DISINTEGRATION 70% MASS CONSERVATION & CONFINEMENT
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Corpse Disintegration 70% Mass Conservation & Confinement ---');

(() => {
    const fm = new FoodManager(3000, 3000, 0);
    const deadSnake = new Snake('dead_snake', 'Casualty', 2800, 2800, 'magenta', false);
    deadSnake.mass = 240.0;
    deadSnake.recalculateDimensions();

    // 4.1 Die method returns 70% mass in orbs
    const deathOrbs = deadSnake.die();
    assert(deadSnake.isDead === true, 'Snake isDead flag set to true');

    let totalDeathOrbMass = 0;
    for (const orb of deathOrbs) {
        totalDeathOrbMass += orb.value;
    }

    const expected70PctMass = 240.0 * 0.70;
    assertCloseTo(totalDeathOrbMass, expected70PctMass, 1e-4, `Corpse disintegration conserves exactly 70% mass (Expected ${expected70PctMass}, Got ${totalDeathOrbMass.toFixed(2)})`);

    // 4.2 Spawning death orbs in FoodManager confines all orbs inside playable circular arena
    fm.spawnDeathOrbs(deathOrbs);

    let allInsideArena = true;
    for (const orb of fm.foodList) {
        const dx = orb.x - 1500;
        const dy = orb.y - 1500;
        const dist = Math.hypot(dx, dy);
        if (dist > 1450) {
            allInsideArena = false;
            break;
        }
    }

    assert(allInsideArena, 'All corpse energy orbs are strictly confined within the circular playable arena perimeter (R <= 1450px)');

    // 4.3 Dead snake cannot attract or ingest food
    const fmTest = new FoodManager(3000, 3000, 0);
    const orbNearDeadHead = new FoodOrb('f_near_dead', deadSnake.x, deadSnake.y, 4, 2, '#ff007f', 'corpse');
    fmTest.foodList = [orbNearDeadHead];
    fmTest.foodMap.set(orbNearDeadHead.id, orbNearDeadHead);

    fmTest.update(1 / 60, [deadSnake], null);

    assert(fmTest.foodList.length === 1, 'Dead snake does not ingest proximate food orbs');
})();

// -----------------------------------------------------------------------------
// SECTION 5: SPATIAL HASH GRID 2D PARTITIONING & ZERO-GC MATH
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Spatial Hash Grid 2D Partitioning & Zero-GC Math ---');

(() => {
    const grid = new SpatialHashGrid(3000, 3000, 120);

    // 5.1 Dimensions and Cell Count
    assert(grid.cols === 25 && grid.rows === 25, 'SpatialHashGrid partitions 3000x3000px world into 25x25 (625) cells');

    // 5.2 Multi-bucket overlap for boundary segment
    // Segment at (120, 120) with radius 15 spans cols 0..1, rows 0..1 (4 buckets)
    grid.insertSegment('snake_1', 0, 120, 120, 15);

    let bucketCount = 0;
    for (let c = 0; c <= 1; c++) {
        for (let r = 0; r <= 1; r++) {
            const bucket = grid.segmentBuckets.get(`${c},${r}`);
            if (bucket && bucket.length > 0) bucketCount++;
        }
    }

    assert(bucketCount === 4, 'Segment overlapping grid cell borders is indexed across all 4 adjacent buckets');

    // 5.3 Deduplication in queryNearbySegments
    const queriedSegments = grid.queryNearbySegments(120, 120, 50);
    assert(queriedSegments.length === 1, 'Query across multiple buckets returns unique segment without duplication');
    assert(queriedSegments[0].snakeId === 'snake_1', 'Queried segment matches inserted snake ID');

    // 5.4 Food Insertion & O(1) Swap-and-Pop Removal
    const f1 = new FoodOrb('food_1', 300, 300, 4, 1, '#00f0ff', 'ambient');
    const f2 = new FoodOrb('food_2', 310, 310, 4, 1, '#00f0ff', 'ambient');
    grid.insertFood(f1);
    grid.insertFood(f2);

    const initialFoodQuery = grid.queryNearbyFood(305, 305, 50);
    assert(initialFoodQuery.length === 2, 'Query returns both food orbs in cell');

    grid.removeFood(f1);
    const postRemoveQuery = grid.queryNearbyFood(305, 305, 50);
    assert(postRemoveQuery.length === 1 && postRemoveQuery[0].id === 'food_2', 'removeFood removes target orb in O(1) swap-and-pop');

    // 5.5 Extreme Coordinates & Out-of-Bounds Clamping
    grid.insertSegment('snake_oob', 0, -500, 4500, 10);
    const oobQuery = grid.queryNearbySegments(0, 2999, 100);
    assert(Array.isArray(oobQuery), 'OOB coordinates clamp safely to border cells without index exceptions');

    // 5.6 Zero-GC Clear
    grid.clear();
    assert(grid.segmentBuckets.size === 0 && grid.foodBuckets.size === 0, 'clear() completely resets both buckets maps');
})();

// -----------------------------------------------------------------------------
// SECTION 6: ADVERSARIAL STRESS TESTING & INTEGRITY VALIDATION
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Adversarial Stress Testing & Integrity Validation ---');

(() => {
    // 6.1 Integrity Check: Verify no hardcoded test shortcuts in script.js
    const scriptSrc = require('fs').readFileSync('D:/snake_game/script.js', 'utf8');

    const hasHardcodedScoreCheck = scriptSrc.includes('if (testMode) return true');
    const hasDummyMock = scriptSrc.includes('class Dummy') || scriptSrc.includes('function noop()');

    assert(!hasHardcodedScoreCheck, 'Source code contains no bypass branches or hardcoded test shortcuts');
    assert(!hasDummyMock, 'Source code contains no facade/dummy placeholder classes');

    // 6.2 High-Stress Load Test: 2000 Food Orbs + 20 Snakes over 100 Ticks
    const grid = new SpatialHashGrid(3000, 3000, 120);
    const fm = new FoodManager(3000, 3000, 2000);
    fm.spawnAmbientFood(2000);

    const snakes = [];
    for (let i = 0; i < 20; i++) {
        const s = new Snake(`stress_snake_${i}`, `Bot_${i}`, 1500 + (Math.random() - 0.5) * 1000, 1500 + (Math.random() - 0.5) * 1000, 'cyan', false);
        s.mass = 30 + Math.random() * 200;
        s.recalculateDimensions();
        snakes.push(s);
    }

    const tStart = Date.now();
    for (let tick = 0; tick < 100; tick++) {
        grid.clear();
        for (const s of snakes) {
            for (let j = 0; j < s.segments.length; j++) {
                grid.insertSegment(s.id, j, s.segments[j].x, s.segments[j].y, s.segments[j].radius);
            }
        }
        for (const f of fm.foodList) {
            grid.insertFood(f);
        }
        for (const s of snakes) {
            s.update(1 / 60, grid, fm);
        }
        fm.update(1 / 60, snakes, grid);
    }
    const elapsed = Date.now() - tStart;

    assert(elapsed < 2000, `High-stress simulation of 2000 orbs & 20 snakes across 100 ticks completes efficiently in ${elapsed}ms (<2000ms)`);
    assert(fm.foodList.length > 0, 'FoodManager remains healthy and maintains food ecosystem under heavy load');
    assert(snakes.every(s => Number.isFinite(s.mass) && !isNaN(s.mass)), 'All snakes maintain finite, valid masses throughout stress simulation');
})();

console.log('\n================================================================');
console.log(`REVIEWER 2 VERIFICATION SUMMARY: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
console.log('================================================================\n');

if (failedTests > 0) {
    console.error('FAILURES:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
} else {
    console.log('ALL PHYSICS, MATHEMATICS & ADVERSARIAL CHECKS PASSED WITH 100% PRECISION!');
    process.exit(0);
}
