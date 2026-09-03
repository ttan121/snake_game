/**
 * Milestone 2 Challenger 2 - Empirical Stress-Test Suite
 * Targeted validation of:
 * 1. Food Ecosystem & Spatial Partitioning
 * 2. Two-tier Magnetic Ingestion & Pull Dynamics
 * 3. Mass Accumulation & Morphological Spine Kinematics
 * 4. Speed Boost Mass Dissipation & Trail Pellet Shedding
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
} = require('../script.js');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message, details) {
    totalTests++;
    if (!condition) {
        failedTests++;
        const failMsg = '[FAIL] ' + message + (details ? ' (' + details + ')' : '');
        failures.push(failMsg);
        console.error('  ✖ ' + failMsg);
    } else {
        passedTests++;
        console.log('  ✔ [PASS] ' + message);
    }
}

function assertNear(actual, expected, tolerance, message) {
    if (tolerance === undefined) tolerance = 1e-4;
    const diff = Math.abs(actual - expected);
    assert(diff <= tolerance, message, 'actual: ' + actual + ', expected: ' + expected + ', diff: ' + diff + ', tol: ' + tolerance);
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, message, 'actual: ' + actual + ', expected: ' + expected);
}

function assertGreaterThan(actual, expected, message) {
    assert(actual > expected, message, 'actual: ' + actual + ' <= expected: ' + expected);
}

function assertLessThan(actual, expected, message) {
    assert(actual < expected, message, 'actual: ' + actual + ' >= expected: ' + expected);
}

console.log('================================================================================');
console.log('   M2 CHALLENGER 2: EMPIRICAL STRESS TESTS & DYNAMICS VALIDATION                ');
console.log('================================================================================\n');

// ============================================================================
// SUITE 1: MAGNETIC ATTRACTION & INGESTION DYNAMICS
// ============================================================================
console.log('▶ Suite 1: Magnetic Attraction & Ingestion Dynamics');

// 1.1: Distance > R_magnet has zero attraction
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const snake = new Snake('s1', 'TestSnake', 1500, 1500);
    const headRadius = snake.getHeadRadius(); // ~12.366
    const attractRadius = headRadius + CONFIG.MAGNET_DISTANCE; // ~92.366

    const orbOutside = new FoodOrb('orb_out', 1500 + attractRadius + 5, 1500, 4, 2, '#00f0ff', 'ambient');
    foodManager.foodList.push(orbOutside);
    foodManager.foodMap.set(orbOutside.id, orbOutside);

    const initialX = orbOutside.x;
    const initialY = orbOutside.y;

    foodManager.update(1 / 60, [snake]);

    assertEqual(orbOutside.x, initialX, '1.1.1: Orb outside R_attract X position remains static');
    assertEqual(orbOutside.y, initialY, '1.1.2: Orb outside R_attract Y position remains static');
    assertEqual(snake.mass, CONFIG.BASE_MASS, '1.1.3: Snake mass unmodified when food is outside attraction range');
    assertEqual(foodManager.foodList.length, 1, '1.1.4: Food list retains orb outside attraction range');
}

// 1.2: Distance < R_magnet moves toward head
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const snake = new Snake('s1', 'TestSnake', 1500, 1500);
    const headRadius = snake.getHeadRadius();
    const attractRadius = headRadius + CONFIG.MAGNET_DISTANCE;

    const orbInside = new FoodOrb('orb_in', 1500 + attractRadius - 5, 1500, 4, 2, '#00f0ff', 'ambient');
    foodManager.foodList.push(orbInside);
    foodManager.foodMap.set(orbInside.id, orbInside);

    const initialX = orbInside.x;

    foodManager.update(1 / 60, [snake]);

    assertLessThan(orbInside.x, initialX, '1.2.1: Orb inside R_attract moves toward snake head (-X direction)');
    assertEqual(orbInside.y, 1500, '1.2.2: Orb on horizontal axis maintains Y=1500 trajectory');
}

// 1.3: Pull velocity profile & acceleration gradient across pull zone
{
    const snake = new Snake('s1', 'TestSnake', 1500, 1500);
    const headRadius = snake.getHeadRadius(); // ~12.366
    const attractRadius = headRadius + CONFIG.MAGNET_DISTANCE; // ~92.366

    // Test distances inside pull zone (above contact threshold ~18.4px): Far (85%), Mid (55%), Near (30%)
    const testPoints = [0.85, 0.55, 0.30];
    const measuredVelocities = [];

    for (let p of testPoints) {
        const fm = new FoodManager(3000, 3000, 0);
        const dist = attractRadius * p;
        const orb = new FoodOrb('orb_' + p, 1500 + dist, 1500, 3.0, 1);
        fm.foodList.push(orb);
        fm.foodMap.set(orb.id, orb);
        const x0 = orb.x;
        fm.update(1 / 60, [snake]);
        const v = (x0 - orb.x) / (1 / 60);
        measuredVelocities.push({ p, dist, v });

        const expectedPullFactor = 1.0 - p;
        const expectedSpeed = 400 * (0.30 + expectedPullFactor * 0.70);
        assertNear(v, expectedSpeed, 1.0, '1.3.1: Velocity at ' + (p * 100) + '% of R_attract matches theoretical formula (' + expectedSpeed.toFixed(1) + ' px/s)');
    }

    assertGreaterThan(measuredVelocities[1].v, measuredVelocities[0].v, '1.3.2: Velocity increases as distance decreases (55% vs 85%)');
    assertGreaterThan(measuredVelocities[2].v, measuredVelocities[1].v, '1.3.3: Velocity increases further as orb gets closer (30% vs 55%)');
}

// 1.4: Ingestion threshold boundary condition
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const snake = new Snake('s1', 'TestSnake', 1500, 1500);
    const headRadius = snake.getHeadRadius();

    // Place orb on contact limit: headRadius + orbRadius + ingestExtraRadius
    const orb = new FoodOrb('contact_orb', 1500 + headRadius + 4 + 1.0, 1500, 4, 7.5, '#ff007f');
    foodManager.foodList.push(orb);
    foodManager.foodMap.set(orb.id, orb);

    foodManager.update(1 / 60, [snake]);

    assertNear(snake.mass, CONFIG.BASE_MASS + 7.5, 1e-4, '1.4.1: Snake mass increases by exact orb value (7.5)');
    assertEqual(foodManager.foodList.length, 0, '1.4.2: Ingested orb removed from foodList');
    assert(!foodManager.foodMap.has(orb.id), '1.4.3: Ingested orb removed from foodMap');
    assertGreaterThan(foodManager.particles.length, 0, '1.4.4: Ingestion sparks spawned upon ingestion');
}

// 1.5: Complete multi-tick convergence and absorption arc
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const spatialGrid = new SpatialHashGrid(3000, 3000, 120);
    const snake = new Snake('s1', 'TestSnake', 1500, 1500);
    const headRadius = snake.getHeadRadius();
    const attractRadius = headRadius + CONFIG.MAGNET_DISTANCE;

    const orb = new FoodOrb('arc_orb', 1500 + attractRadius - 5, 1500, 3.5, 4.0, '#ffea00');
    foodManager.foodList.push(orb);
    foodManager.foodMap.set(orb.id, orb);
    spatialGrid.insertFood(orb);

    let ingested = false;
    let ticks = 0;
    let prevDist = Math.hypot(orb.x - 1500, orb.y - 1500);

    while (ticks < 60) {
        spatialGrid.clear();
        for (const f of foodManager.foodList) spatialGrid.insertFood(f);

        foodManager.update(1 / 60, [snake], spatialGrid);
        ticks++;

        if (foodManager.foodList.length === 0) {
            ingested = true;
            break;
        }

        const curDist = Math.hypot(orb.x - 1500, orb.y - 1500);
        assertLessThan(curDist, prevDist, '1.5.1: Distance strictly decreases on tick ' + ticks);
        prevDist = curDist;
    }

    assert(ingested, '1.5.2: Orb completely ingested into snake mouth within 60 ticks (took ' + ticks + ' ticks)');
    assertNear(snake.mass, CONFIG.BASE_MASS + 4.0, 1e-4, '1.5.3: Snake mass credited upon absorption');
    assertEqual(spatialGrid.queryNearbyFood(1500, 1500, 200).length, 0, '1.5.4: SpatialGrid query returns 0 after ingestion');
}

// 1.6: Dynamic chasing / moving head magnetic ingestion
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const snake = new Snake('s1', 'ChaseSnake', 1500, 1500);
    snake.angle = 0;
    snake.targetAngle = 0;

    const orb = new FoodOrb('chase_orb', 1580, 1500, 3.5, 3.0);
    foodManager.foodList.push(orb);
    foodManager.foodMap.set(orb.id, orb);

    for (let i = 0; i < 15; i++) {
        snake.update(1 / 60);
        foodManager.update(1 / 60, [snake]);
    }

    assertGreaterThan(snake.x, 1500, '1.6.1: Snake moves forward along +X');
    assertNear(snake.mass, CONFIG.BASE_MASS + 3.0, 1e-4, '1.6.2: Orb ingested during forward snake movement');
}

// 1.7: Competitive ingestion race between two converging snakes
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const snakeA = new Snake('sA', 'SnakeA', 1490, 1500);
    const snakeB = new Snake('sB', 'SnakeB', 1510, 1500);

    const orb = new FoodOrb('shared_orb', 1500, 1500, 4.0, 10.0);
    foodManager.foodList.push(orb);
    foodManager.foodMap.set(orb.id, orb);

    foodManager.update(1 / 60, [snakeA, snakeB]);

    const deltaA = snakeA.mass - CONFIG.BASE_MASS;
    const deltaB = snakeB.mass - CONFIG.BASE_MASS;

    assert((deltaA === 10.0 && deltaB === 0) || (deltaA === 0 && deltaB === 10.0), '1.7.1: Exactly one snake receives the mass (no duplicate consumption)', 'deltaA=' + deltaA + ', deltaB=' + deltaB);
    assertEqual(foodManager.foodList.length, 0, '1.7.2: Contested orb purged from foodList');
}

// ============================================================================
// SUITE 2: MASS ACCUMULATION & MORPHOLOGICAL SPINE KINEMATICS
// ============================================================================
console.log('\n▶ Suite 2: Mass Accumulation & Morphology Scaling');

// 2.1: Baseline morphology at M = 20
{
    const snake = new Snake('s1', 'Player', 1500, 1500);

    assertEqual(snake.mass, 20.0, '2.1.1: Base mass is 20.0');
    assertEqual(snake.score, 200, '2.1.2: Base score is 200');

    const expectedBodyR = CONFIG.BASE_BODY_RADIUS + CONFIG.RADIUS_GROWTH_FACTOR * Math.sqrt(20.0);
    assertNear(snake.bodyRadius, expectedBodyR, 1e-4, '2.1.3: Base body radius is ' + expectedBodyR.toFixed(4));

    const expectedHeadR = expectedBodyR * CONFIG.HEAD_RADIUS_FACTOR;
    assertNear(snake.headRadius, expectedHeadR, 1e-4, '2.1.4: Base head radius is ' + expectedHeadR.toFixed(4));

    const expectedSegs = Math.floor(CONFIG.SEGMENT_BASE_COUNT + CONFIG.SEGMENT_MASS_FACTOR * 20.0);
    assertEqual(snake.calculateSegmentCount(), expectedSegs, '2.1.5: Segment count formula gives 17');
    assertEqual(snake.segments.length, expectedSegs, '2.1.6: Segments array has length 17');
}

// 2.2: Incremental consumption of 100 orbs
{
    const snake = new Snake('s1', 'Player', 1500, 1500);
    const initialMass = snake.mass;

    let totalAddedMass = 0;
    for (let i = 0; i < 100; i++) {
        const val = 1.0 + (i % 3); // 1, 2, or 3
        snake.addMass(val);
        totalAddedMass += val;

        // Verify intermediate invariants every 20 orbs
        if ((i + 1) % 20 === 0) {
            const currentExpectedMass = initialMass + totalAddedMass;
            assertNear(snake.mass, currentExpectedMass, 1e-4, '2.2.1: Mass invariant at orb ' + (i + 1));
            assertEqual(snake.score, Math.floor(currentExpectedMass * 10), '2.2.2: Score invariant at orb ' + (i + 1));
            const expectedR = CONFIG.BASE_BODY_RADIUS + CONFIG.RADIUS_GROWTH_FACTOR * Math.sqrt(currentExpectedMass);
            assertNear(snake.bodyRadius, expectedR, 1e-4, '2.2.3: Body radius invariant at orb ' + (i + 1));
        }
    }

    const finalExpectedMass = initialMass + totalAddedMass;
    assertNear(snake.mass, finalExpectedMass, 1e-4, '2.2.4: Final mass after 100 orbs is ' + finalExpectedMass);
    assertEqual(snake.score, Math.floor(finalExpectedMass * 10), '2.2.5: Final score is ' + Math.floor(finalExpectedMass * 10));

    const expectedFinalSegs = Math.floor(CONFIG.SEGMENT_BASE_COUNT + CONFIG.SEGMENT_MASS_FACTOR * finalExpectedMass);
    assertEqual(snake.calculateSegmentCount(), expectedFinalSegs, '2.2.6: Target segment count after 100 orbs is ' + expectedFinalSegs);

    snake.updateSpine();
    assertEqual(snake.segments.length, expectedFinalSegs, '2.2.7: Segments array expanded to ' + expectedFinalSegs + ' segments');
}

// 2.3: Mathematical formula fidelity across continuous mass spectrum (M = 20 to 5000)
{
    const testMasses = [20, 50, 100, 250, 500, 1000, 2500, 5000];
    const snake = new Snake('s1', 'Scaler', 1500, 1500);

    for (let m of testMasses) {
        snake.mass = m;
        snake.recalculateDimensions();

        const expectedBodyR = CONFIG.BASE_BODY_RADIUS + CONFIG.RADIUS_GROWTH_FACTOR * Math.sqrt(m);
        const expectedHeadR = expectedBodyR * CONFIG.HEAD_RADIUS_FACTOR;
        const expectedJointSpacing = CONFIG.JOINT_BASE_SPACING + CONFIG.JOINT_SPACING_FACTOR * expectedBodyR;
        const expectedSegs = Math.floor(CONFIG.SEGMENT_BASE_COUNT + CONFIG.SEGMENT_MASS_FACTOR * m);
        const expectedTurnRate = Math.max(
            CONFIG.MIN_TURN_RATE,
            CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (m + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP)
        );

        assertNear(snake.bodyRadius, expectedBodyR, 1e-4, '2.3.1: bodyRadius at mass ' + m);
        assertNear(snake.headRadius, expectedHeadR, 1e-4, '2.3.2: headRadius at mass ' + m);
        assertNear(snake.jointSpacing, expectedJointSpacing, 1e-4, '2.3.3: jointSpacing at mass ' + m);
        assertEqual(snake.calculateSegmentCount(), expectedSegs, '2.3.4: segmentCount at mass ' + m);
        assertNear(snake.getTurnRate(), expectedTurnRate, 1e-4, '2.3.5: turnRate at mass ' + m);
    }
}

// 2.4: Vertebrae radii tapering geometry
{
    const snake = new Snake('s1', 'TaperTester', 1500, 1500);
    snake.mass = 300; // ~115 segments
    snake.updateSpine();

    const segs = snake.segments;
    const segCount = segs.length;
    assertGreaterThan(segCount, 50, '2.4.1: Segment count sufficient for tapering test');

    assertNear(segs[0].radius, snake.headRadius, 1e-3, '2.4.2: Segment 0 radius equals headRadius');
    assertGreaterThan(segs[1].radius, segs[2].radius, '2.4.3: Neck segment 1 is larger than neck segment 2');
    assertGreaterThan(segs[2].radius, segs[3].radius, '2.4.4: Neck segment 2 is larger than body segment 3');

    const midIdx = Math.floor(segCount / 2);
    assertNear(segs[midIdx].radius, snake.bodyRadius, 1e-3, '2.4.5: Mid-body segment radius equals bodyRadius');

    const lastSeg = segs[segCount - 1];
    assertNear(lastSeg.radius, snake.bodyRadius * 0.45, 0.5, '2.4.6: Tail segment radius tapers to ~45% of bodyRadius');
    assert(lastSeg.radius >= 2.0, '2.4.7: Tail segment radius clamped at >= 2.0px minimum');
}

// 2.5: Kinematics stability and no NaN coordinates during movement
{
    const snake = new Snake('s1', 'KinematicsHero', 1500, 1500);
    snake.mass = 150;
    snake.setTargetAngle(Math.PI / 4);

    let hasNaN = false;
    for (let frame = 0; frame < 120; frame++) {
        if (frame === 40) snake.setTargetAngle(-Math.PI / 2);
        if (frame === 80) snake.setTargetAngle(Math.PI);
        snake.update(1 / 60);

        for (let i = 0; i < snake.segments.length; i++) {
            const s = snake.segments[i];
            if (isNaN(s.x) || isNaN(s.y) || isNaN(s.radius)) {
                hasNaN = true;
                break;
            }
        }
    }
    assert(!hasNaN, '2.5.1: 120 frames of continuous steering produces zero NaN coordinates');
}

// 2.6: Behemoth snake scaling (M = 5,000 and M = 15,000)
{
    const snake = new Snake('s1', 'Leviathan', 1500, 1500);
    snake.mass = 5000;
    snake.updateSpine();

    assertEqual(snake.calculateSegmentCount(), 1760, '2.6.1: 1760 segments calculated for M=5000');
    assertEqual(snake.segments.length, 1760, '2.6.2: Segments array correctly allocates 1760 vertebrae');
    const expectedTurn5000 = 4.8 * Math.pow(150 / (5000 + 150), 0.35); // 1.392 rad/s
    assertNear(snake.getTurnRate(), expectedTurn5000, 1e-4, '2.6.3: Turn rate at M=5000 matches dynamic formula (1.392 rad/s)');

    // Test extreme mass M = 15,000 where clamp activates
    snake.mass = 15000;
    assertEqual(snake.getTurnRate(), CONFIG.MIN_TURN_RATE, '2.6.4: Turn rate at extreme mass M=15000 strictly clamped at MIN_TURN_RATE (1.2 rad/s)');

    for (let i = 0; i < 10; i++) {
        snake.update(1 / 60);
    }
    assert(!isNaN(snake.segments[snake.segments.length - 1].x), '2.6.5: Tail coordinate is valid number after movement');
}

// ============================================================================
// SUITE 3: BOOST TRAIL SHEDDING & MASS DISSIPATION
// ============================================================================
console.log('\n▶ Suite 3: Boost Trail Shedding & Mass Dissipation');

// 3.1: Mass drainage rate at 4.0 mass/sec
{
    const snake = new Snake('s1', 'Booster', 1500, 1500);
    snake.mass = 100.0;
    snake.setBoosting(true);

    assert(snake.isBoosting, '3.1.1: isBoosting flag set to true');

    for (let i = 0; i < 60; i++) {
        snake.update(1 / 60);
    }

    const expectedMass = 100.0 - CONFIG.BOOST_DRAIN_RATE * 1.0; // 96.0
    assertNear(snake.mass, expectedMass, 1e-4, '3.1.2: Mass drains exactly 4.0 units over 1 second (100 -> 96)');
    assertGreaterThan(snake.currentSpeed, CONFIG.BASE_SPEED, '3.1.3: Speed accelerates beyond BASE_SPEED');
}

// 3.2: Trail pellet drop distance interval & properties
{
    const snake = new Snake('s1', 'Booster', 1500, 1500);
    snake.mass = 100.0;
    snake.setBoosting(true);

    const droppedPellets = [];
    const onPelletDrop = (pellet) => droppedPellets.push(pellet);

    for (let i = 0; i < 60; i++) {
        snake.update(1 / 60, onPelletDrop);
    }

    assert(droppedPellets.length >= 10 && droppedPellets.length <= 13, '3.2.1: Dropped ' + droppedPellets.length + ' pellets over 1s of boosting (~280px / 24px = 11.6)');

    let allValid = true;
    for (let p of droppedPellets) {
        if (!p.glow || p.type !== 'boost' || p.value <= 0) {
            allValid = false;
            break;
        }
    }
    assert(allValid, '3.2.2: All dropped pellets have glow=true, type=boost, value > 0');
}

// 3.3: Boost pellet backwards impulse and friction decay
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const headingAngle = 0; // +X

    const orb = foodManager.spawnBoostOrb(1500, 1500, '#00f0ff', headingAngle);
    assertLessThan(orb.vx, -50, '3.3.1: Boost pellet has negative VX impulse (backwards against snake heading)');
    assertNear(orb.vy, 0, 30, '3.3.2: VY impulse is close to 0 with small jitter');

    const initialVx = orb.vx;
    for (let i = 0; i < 10; i++) {
        orb.update(1 / 60);
    }
    assertLessThan(Math.abs(orb.vx), Math.abs(initialVx), '3.3.3: Velocity decays over time via friction');
}

// 3.4: Trailing snake ingesting shed boost pellets
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const leadSnake = new Snake('lead', 'Leader', 1600, 1500);
    leadSnake.angle = 0;
    leadSnake.targetAngle = 0;
    leadSnake.mass = 80;
    leadSnake.setBoosting(true);

    const followerSnake = new Snake('follower', 'Follower', 1500, 1500);
    followerSnake.angle = 0;
    followerSnake.targetAngle = 0;
    followerSnake.mass = 20;

    for (let i = 0; i < 30; i++) {
        leadSnake.update(1 / 60, foodManager);
    }
    assertGreaterThan(foodManager.foodList.length, 0, '3.4.1: FoodManager populated with dropped boost pellets');

    const followerInitialMass = followerSnake.mass;
    for (let i = 0; i < 50; i++) {
        followerSnake.update(1 / 60);
        foodManager.update(1 / 60, [followerSnake]);
    }

    assertGreaterThan(followerSnake.mass, followerInitialMass, '3.4.2: Follower snake grows by eating boost pellets from lead snake trail');
}

// 3.5: Boost cutoff threshold clamp at M = 20.0
{
    const snake = new Snake('s1', 'StarvingBooster', 1500, 1500);
    snake.mass = 21.0;
    snake.setBoosting(true);

    assert(snake.isBoosting, '3.5.1: Boost initially enabled at mass 21.0');

    for (let i = 0; i < 30; i++) {
        snake.update(1 / 60);
    }

    assertEqual(snake.mass, CONFIG.MIN_BOOST_MASS, '3.5.2: Mass strictly clamped at MIN_BOOST_MASS (20.0)');
    assert(!snake.isBoosting, '3.5.3: isBoosting auto-cancelled upon hitting mass 20.0');
    assertEqual(snake.boostDistAccumulator, 0, '3.5.4: boostDistAccumulator reset to 0');
}

// 3.6: Boost invocation when M <= 20.0 is rejected
{
    const snake = new Snake('s1', 'MinMassSnake', 1500, 1500);
    snake.mass = 20.0;
    snake.setBoosting(true);

    assert(!snake.isBoosting, '3.6.1: setBoosting(true) rejected when mass <= 20.0');

    snake.handleInput({ targetAngle: 0, isBoosting: true });
    assert(!snake.isBoosting, '3.6.2: handleInput(isBoosting: true) rejected when mass <= 20.0');
}

// ============================================================================
// SUITE 4: FOOD ECOSYSTEM & SPATIAL PARTITIONING
// ============================================================================
console.log('\n▶ Suite 4: Food Ecosystem & Spatial Partitioning');

// 4.1: Ambient food circular arena distribution
{
    const foodManager = new FoodManager(3000, 3000, 500);
    foodManager.spawnAmbientFood(500);

    assertEqual(foodManager.foodList.length, 500, '4.1.1: 500 ambient orbs spawned');

    let allInside = true;
    for (let orb of foodManager.foodList) {
        const dx = orb.x - 1500;
        const dy = orb.y - 1500;
        if (Math.hypot(dx, dy) > foodManager.worldRadius - 39) {
            allInside = false;
            break;
        }
    }
    assert(allInside, '4.1.2: All ambient orbs spawned within circular arena boundary');
}

// 4.2: Throttled replenishment
{
    const foodManager = new FoodManager(3000, 3000, 1200);
    assertEqual(foodManager.foodList.length, 0, '4.2.1: Food list starts empty');

    foodManager.update(1 / 60, []);
    assertEqual(foodManager.foodList.length, 30, '4.2.2: First tick spawns exactly 30 orbs (throttled)');

    for (let i = 0; i < 39; i++) {
        foodManager.update(1 / 60, []);
    }
    assertEqual(foodManager.foodList.length, 1200, '4.2.3: Reaches target 1200 ambient food over 40 ticks');

    foodManager.update(1 / 60, []);
    assertEqual(foodManager.foodList.length, 1200, '4.2.4: Does not exceed target count on subsequent ticks');
}

// 4.3: Corpse disintegration 70% drop rule
{
    const foodManager = new FoodManager(3000, 3000, 0);
    const snake = new Snake('s1', 'DeadSnake', 1500, 1500);
    snake.mass = 400.0;
    snake.updateSpine();

    const deathOrbs = snake.die();
    assert(snake.isDead, '4.3.1: Snake marked dead');
    assertGreaterThan(deathOrbs.length, 0, '4.3.2: Generated death orbs array');

    let totalCorpseMass = 0;
    for (let orb of deathOrbs) {
        totalCorpseMass += orb.value;
    }

    const expectedDropMass = 400.0 * 0.70; // 280.0
    assertNear(totalCorpseMass, expectedDropMass, 1e-4, '4.3.3: Total corpse mass dropped equals 70% of dead snake mass (280.0)');

    foodManager.spawnDeathOrbs(deathOrbs);
    assertEqual(foodManager.foodList.length, deathOrbs.length, '4.3.4: All death orbs registered in FoodManager');
}

// 4.4: SpatialHashGrid partitioning 120px cell query accuracy
{
    const grid = new SpatialHashGrid(3000, 3000, 120);

    const orbCenter = new FoodOrb('c1', 120, 120, 4, 1);
    const orbEdge = new FoodOrb('e1', 150, 120, 4, 1);
    const orbFar = new FoodOrb('f1', 400, 400, 4, 1);

    grid.insertFood(orbCenter);
    grid.insertFood(orbEdge);
    grid.insertFood(orbFar);

    const nearOrbs = grid.queryNearbyFood(120, 120, 40);
    const ids = nearOrbs.map(o => o.id);

    assert(ids.includes('c1'), '4.4.1: Query includes center orb (dist 0)');
    assert(ids.includes('e1'), '4.4.2: Query includes edge orb (dist 30)');
    assert(!ids.includes('f1'), '4.4.3: Query excludes far orb (dist 395)');
}

// 4.5: High-concurrency stress test (1500 Orbs + 20 Snakes for 300 Ticks)
{
    const foodManager = new FoodManager(3000, 3000, 1500);
    foodManager.spawnAmbientFood(1500);
    const spatialGrid = new SpatialHashGrid(3000, 3000, 120);

    const snakes = [];
    for (let i = 0; i < 20; i++) {
        const theta = (i / 20) * Math.PI * 2;
        const r = 500;
        const s = new Snake('bot_' + i, 'Bot' + i, 1500 + Math.cos(theta) * r, 1500 + Math.sin(theta) * r);
        s.angle = theta + Math.PI / 2;
        s.targetAngle = s.angle;
        snakes.push(s);
    }

    let invariantFailed = false;
    for (let tick = 0; tick < 300; tick++) {
        spatialGrid.clear();
        for (const f of foodManager.foodList) spatialGrid.insertFood(f);

        for (const s of snakes) {
            s.update(1 / 60, spatialGrid, foodManager);
        }
        foodManager.update(1 / 60, snakes, spatialGrid);

        if (tick % 50 === 0) {
            for (const s of snakes) {
                if (isNaN(s.x) || isNaN(s.y) || isNaN(s.mass) || s.mass < 20.0) {
                    invariantFailed = true;
                    break;
                }
            }
        }
    }

    assert(!invariantFailed, '4.5.1: All entity invariants hold throughout 300 multi-agent simulation ticks');
    assertGreaterThan(foodManager.foodList.length, 500, '4.5.2: Food count maintains healthy density');
    const averageMass = snakes.reduce((acc, s) => acc + s.mass, 0) / snakes.length;
    assertGreaterThan(averageMass, 20.0, '4.5.3: Snakes grow organically from consuming food (avg mass: ' + averageMass.toFixed(2) + ')');
}

console.log('\n================================================================================');
console.log('TEST SUMMARY: ' + passedTests + '/' + totalTests + ' tests passed (' + failedTests + ' failures)');
console.log('================================================================================\n');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}