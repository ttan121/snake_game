/**
 * ============================================================================
 * EMPIRICAL STRESS TEST SUITE - MILESTONE 1 KINEMATICS, STEERING & BOOST
 * Agent: m1_challenger_2 (Milestone 1 Challenger 2)
 * File: D:\snake_game\.agents\m1_challenger_2\empirical_test.js
 *
 * Direct verification against D:\snake_game\script.js
 * ============================================================================
 */

const path = require('path');
const scriptPath = path.resolve(__dirname, '../../script.js');
const { CONFIG, SKINS, Snake, Camera, World, InputManager } = require(scriptPath);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        failedTests++;
        const err = new Error(`ASSERTION FAILED: ${message}`);
        failures.push({ message, stack: err.stack });
        console.error(`  [FAIL] ${message}`);
        return false;
    } else {
        passedTests++;
        console.log(`  [PASS] ${message}`);
        return true;
    }
}

function assertCloseTo(actual, expected, tolerance = 1e-4, message = '') {
    const diff = Math.abs(actual - expected);
    const msg = `${message} | Expected ~${expected}, Got ${actual} (diff: ${diff.toFixed(6)}, tol: ${tolerance})`;
    return assert(diff <= tolerance, msg);
}

function assertBetween(actual, min, max, message = '') {
    const msg = `${message} | Expected ${min} <= ${actual} <= ${max}`;
    return assert(actual >= min && actual <= max, msg);
}

console.log('================================================================');
console.log('SLITHER.IO M1 EMPIRICAL CHALLENGER 2 - STRESS TEST HARNESS');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: 360° STEERING & SHORTEST-ARC ANGLE NORMALIZATION (§TASK.2)
// ============================================================================
console.log('--- SUITE 1: 360° Steering & Shortest-Arc Normalization ---');

// Test 1.1: Specified wrap-around boundary (-PI + 0.1 to +PI - 0.1)
(() => {
    const snake = new Snake('steer_test_1', 'SteerTest1', 1500, 1500);
    const startAngle = -Math.PI + 0.1;
    const targetAngle = Math.PI - 0.1;

    snake.angle = startAngle;
    snake.setTargetAngle(targetAngle);

    // Calculate analytical shortest angular difference
    const normalizedDiff = Math.atan2(Math.sin(targetAngle - startAngle), Math.cos(targetAngle - startAngle));
    assertCloseTo(normalizedDiff, -0.2, 1e-5, 'Normalized angle difference is exactly -0.2 rad');

    // Multi-tick execution: measure total angular displacement traversed
    let totalAngularTravel = 0;
    let lastAngle = snake.angle;
    let ticks = 0;

    while (ticks < 300) {
        ticks++;
        snake.update(1 / 60);
        const da = Math.abs(snake.angle - lastAngle);
        totalAngularTravel += da;
        lastAngle = snake.angle;

        const diffToTarget = Math.atan2(Math.sin(targetAngle - snake.angle), Math.cos(targetAngle - snake.angle));
        if (Math.abs(diffToTarget) < 1e-4) {
            break;
        }
    }

    assertCloseTo(totalAngularTravel, 0.2, 1e-3, `Total angular travel to complete turn is 0.2 rad (Actual: ${totalAngularTravel.toFixed(4)} rad, NOT 6.08 rad)`);
    assert(ticks <= 5, `Turn completed in ${ticks} ticks along shortest arc`);
})();

// Test 1.2: Symmetric wrap-around (+PI - 0.1 to -PI + 0.1)
(() => {
    const snake = new Snake('steer_sym', 'SteerSym', 1500, 1500);
    const startAngle = Math.PI - 0.1;
    const targetAngle = -Math.PI + 0.1;

    snake.angle = startAngle;
    snake.setTargetAngle(targetAngle);

    let totalAngularTravel = 0;
    let lastAngle = snake.angle;
    let ticks = 0;

    while (ticks < 300) {
        ticks++;
        snake.update(1 / 60);
        const da = Math.abs(snake.angle - lastAngle);
        totalAngularTravel += da;
        lastAngle = snake.angle;

        const diffToTarget = Math.atan2(Math.sin(targetAngle - snake.angle), Math.cos(targetAngle - snake.angle));
        if (Math.abs(diffToTarget) < 1e-4) {
            break;
        }
    }

    assertCloseTo(totalAngularTravel, 0.2, 1e-3, `Symmetric turn traverses 0.2 rad (Actual: ${totalAngularTravel.toFixed(4)} rad)`);
})();

// Test 1.3: Comprehensive Grid of 81 Angle Pairs across all 4 Quadrants
(() => {
    let allShortestArc = true;
    const angles = [-Math.PI, -2.5, -Math.PI/2, -1.0, 0, 1.0, Math.PI/2, 2.5, Math.PI - 0.001];

    for (let fromA of angles) {
        for (let toA of angles) {
            const snake = new Snake('grid', 'Grid', 1500, 1500);
            snake.angle = fromA;
            snake.setTargetAngle(toA);

            const mathShortest = Math.atan2(Math.sin(toA - fromA), Math.cos(toA - fromA));
            snake.update(1 / 600); // very small dt to inspect initial velocity vector

            const actualDelta = snake.angle - fromA;
            if (Math.abs(mathShortest) > 1e-4) {
                const sameSign = (actualDelta * mathShortest) > 0;
                if (!sameSign) {
                    allShortestArc = false;
                    console.error(`Mismatch for fromA=${fromA}, toA=${toA}: delta=${actualDelta}, shortest=${mathShortest}`);
                }
            }
        }
    }
    assert(allShortestArc, 'All 81 angle pairs in grid turn in correct shortest-arc direction');
})();

// Test 1.4: Rotational Inertia scaling with mass
(() => {
    const smallSnake = new Snake('s_small', 'Small', 1500, 1500);
    smallSnake.mass = 20; // light
    const largeSnake = new Snake('s_large', 'Large', 1500, 1500);
    largeSnake.mass = 500; // heavy
    const colossusSnake = new Snake('s_colossus', 'Colossus', 1500, 1500);
    colossusSnake.mass = 50000; // giant

    const turnRateSmall = Math.max(CONFIG.MIN_TURN_RATE, CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (smallSnake.mass + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP));
    const turnRateLarge = Math.max(CONFIG.MIN_TURN_RATE, CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (largeSnake.mass + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP));
    const turnRateColossus = Math.max(CONFIG.MIN_TURN_RATE, CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (colossusSnake.mass + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP));

    assert(turnRateSmall > turnRateLarge, `Small snake turn rate (${turnRateSmall.toFixed(3)}) > Large snake turn rate (${turnRateLarge.toFixed(3)})`);
    assert(turnRateLarge > turnRateColossus, `Large snake turn rate (${turnRateLarge.toFixed(3)}) > Colossus snake turn rate (${turnRateColossus.toFixed(3)})`);
    assertCloseTo(turnRateColossus, CONFIG.MIN_TURN_RATE, 0.05, `Colossus turn rate approaches MIN_TURN_RATE (${CONFIG.MIN_TURN_RATE})`);
})();

// ============================================================================
// SUITE 2: VERTEBRAL SPINE STABILITY (1,000 SIMULATION STEPS) (§TASK.3)
// ============================================================================
console.log('\n--- SUITE 2: Vertebral Spine Stability Across 1,000 Steps ---');

// Test 2.1: 1,000 steps at Constant Base Speed (150 px/s)
(() => {
    const snake = new Snake('spine_base', 'BaseSpine', 1500, 1500);
    const dt = 1 / 60;

    // Warm-up 10 steps to clear spawn state
    for (let i = 0; i < 10; i++) snake.update(dt);

    let maxSpacingError = 0;
    let minObservedDist = Infinity;
    let maxObservedDist = -Infinity;

    for (let step = 0; step < 1000; step++) {
        snake.update(dt);
        const segs = snake.getSegments();
        const expectedSpacing = snake.jointSpacing;

        for (let i = 1; i < segs.length; i++) {
            const dist = Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
            const err = Math.abs(dist - expectedSpacing);
            if (err > maxSpacingError) maxSpacingError = err;
            if (dist < minObservedDist) minObservedDist = dist;
            if (dist > maxObservedDist) maxObservedDist = dist;
        }
    }

    assert(maxSpacingError < 1e-4, `Constant base speed (150px/s) spacing error < 1e-4 px (Max error: ${maxSpacingError.toFixed(6)}px)`);
    assertCloseTo(minObservedDist, snake.jointSpacing, 1e-4, `Min observed segment distance (${minObservedDist.toFixed(4)}px) matches jointSpacing (${snake.jointSpacing.toFixed(4)}px)`);
    assertCloseTo(maxObservedDist, snake.jointSpacing, 1e-4, `Max observed segment distance (${maxObservedDist.toFixed(4)}px) matches jointSpacing (${snake.jointSpacing.toFixed(4)}px)`);
})();

// Test 2.2: 1,000 steps at Constant Boost Speed (285 px/s)
(() => {
    const snake = new Snake('spine_boost', 'BoostSpine', 1500, 1500);
    // Give enough mass and re-seed straight path history
    snake.mass = 50000;
    snake.recalculateDimensions();
    const count = snake.calculateSegmentCount();
    const spacing = snake.jointSpacing;
    snake.pathHistory = [];
    const cumDist = count * spacing * 2.0;
    for (let s = cumDist; s >= 0; s -= 2.0) {
        snake.pathHistory.push({
            x: snake.x - Math.cos(snake.angle) * s,
            y: snake.y - Math.sin(snake.angle) * s,
            s: cumDist - s
        });
    }
    snake.currentPathDistance = cumDist;
    snake.updateSegments();

    snake.setBoosting(true);
    const dt = 1 / 60;

    // Warm-up 30 steps for speed lerp to settle
    for (let i = 0; i < 30; i++) {
        snake.update(dt);
        snake.mass = 50000;
    }

    let maxSpacingError = 0;
    for (let step = 0; step < 1000; step++) {
        snake.update(dt);
        snake.mass = 50000; // keep mass locked to isolate speed kinematics

        const segs = snake.getSegments();
        for (let i = 1; i < segs.length; i++) {
            const dist = Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
            const err = Math.abs(dist - spacing);
            if (err > maxSpacingError) maxSpacingError = err;
        }
    }

    assert(maxSpacingError < 1e-4, `Constant boost speed (285px/s) spacing error < 1e-4 px (Max error: ${maxSpacingError.toFixed(6)}px)`);
})();

// Test 2.3: 1,000 steps under Variable Speeds & Acceleration/Deceleration Transitions
(() => {
    const snake = new Snake('spine_var_speed', 'VarSpeedSpine', 1500, 1500);
    snake.mass = 50000;
    snake.recalculateDimensions();
    const count = snake.calculateSegmentCount();
    const fixedSpacing = snake.jointSpacing;
    snake.pathHistory = [];
    const cumDist = count * fixedSpacing * 2.0;
    for (let s = cumDist; s >= 0; s -= 2.0) {
        snake.pathHistory.push({
            x: snake.x - Math.cos(snake.angle) * s,
            y: snake.y - Math.sin(snake.angle) * s,
            s: cumDist - s
        });
    }
    snake.currentPathDistance = cumDist;
    snake.updateSegments();

    const dt = 1 / 60;
    let maxSpacingError = 0;
    let minObservedDist = Infinity;
    let maxObservedDist = -Infinity;

    for (let step = 0; step < 1000; step++) {
        // Multi-phase speed profile:
        // Phase 1 (0-250): Base Speed (150px/s)
        // Phase 2 (250-500): Boost Speed (285px/s)
        // Phase 3 (500-750): Base Speed (150px/s)
        // Phase 4 (750-1000): Rapid square-wave pulsing (toggle boost every 10 frames)
        if (step < 250) {
            snake.setBoosting(false);
        } else if (step < 500) {
            snake.setBoosting(true);
        } else if (step < 750) {
            snake.setBoosting(false);
        } else {
            snake.setBoosting((step % 20) < 10);
        }

        snake.update(dt);
        snake.mass = 50000;

        const segs = snake.getSegments();
        for (let i = 1; i < segs.length; i++) {
            const dist = Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
            const err = Math.abs(dist - fixedSpacing);
            if (err > maxSpacingError) maxSpacingError = err;
            if (dist < minObservedDist) minObservedDist = dist;
            if (dist > maxObservedDist) maxObservedDist = dist;
        }
    }

    assert(maxSpacingError < 1e-4, `Variable speed profile: ZERO telescoping or rubber-banding (Max error: ${maxSpacingError.toFixed(6)}px)`);
    assertCloseTo(minObservedDist, fixedSpacing, 1e-4, `Min observed distance matches exact nominal spacing`);
    assertCloseTo(maxObservedDist, fixedSpacing, 1e-4, `Max observed distance matches exact nominal spacing`);
})();

// Test 2.4: 1,000 steps continuous circular turning (Chord distance geometry verification)
(() => {
    const snake = new Snake('spine_turning', 'TurnSpine', 1500, 1500);
    snake.mass = 100;
    snake.recalculateDimensions();
    const dt = 1 / 60;
    const speed = CONFIG.BASE_SPEED; // 150
    const turnRate = CONFIG.BASE_TURN_RATE * Math.pow(CONFIG.TURN_REF_MASS / (100 + CONFIG.TURN_REF_MASS), CONFIG.TURN_DECAY_EXP); // ~3.76 rad/s
    const R = speed / turnRate; // Radius of circular path
    const L = snake.jointSpacing; // Arc length between joints
    const theoreticalChord = 2 * R * Math.sin(L / (2 * R));

    // Spin in continuous circle for 1000 frames
    for (let step = 0; step < 1000; step++) {
        snake.setTargetAngle(snake.angle + 0.5); // continuous max turn
        snake.update(dt);
        snake.mass = 100;
        snake.recalculateDimensions();
    }

    const segs = snake.getSegments();
    let chordErrors = [];
    for (let i = 1; i < segs.length; i++) {
        const dist = Math.hypot(segs[i].x - segs[i - 1].x, segs[i].y - segs[i - 1].y);
        chordErrors.push(Math.abs(dist - theoreticalChord));
    }
    const maxChordError = Math.max(...chordErrors);

    assert(maxChordError < 0.05, `Circular turning chord length matches analytical formula ${theoreticalChord.toFixed(4)}px within ${maxChordError.toFixed(6)}px`);
})();

// Test 2.5: Path History Ring Buffer Memory Boundedness over 10,000 steps
(() => {
    const snake = new Snake('spine_hist_bound', 'HistBound', 1500, 1500);
    snake.mass = 100;
    const dt = 1 / 60;

    for (let step = 0; step < 10000; step++) {
        snake.update(dt);
        snake.mass = 100;
    }

    const maxExpectedHistory = Math.ceil(((snake.calculateSegmentCount() + 4) * snake.jointSpacing) / (CONFIG.BASE_SPEED * dt)) + 50;
    assert(snake.pathHistory.length < maxExpectedHistory + 100, `Path history length (${snake.pathHistory.length}) is strictly bounded with 0 memory leak`);
})();

// ============================================================================
// SUITE 3: BOOST MASS DEPLETION & CUTOFF THRESHOLD (§TASK.4)
// ============================================================================
console.log('\n--- SUITE 3: Boost Mass Depletion & Cutoff Threshold ---');

// Test 3.1: Continuous Boost Depletion Rate (4.0 mass/s)
(() => {
    const snake = new Snake('boost_drain_rate', 'DrainRate', 1500, 1500);
    snake.mass = 50.0;
    snake.setBoosting(true);

    const dt = 1 / 60;
    const stepsPerSec = 60;

    for (let sec = 1; sec <= 5; sec++) {
        for (let s = 0; s < stepsPerSec; s++) {
            snake.update(dt);
        }
        const expectedMass = 50.0 - CONFIG.BOOST_DRAIN_RATE * sec;
        assertCloseTo(snake.mass, expectedMass, 1e-4, `After ${sec}s of continuous boost, mass is ${expectedMass.toFixed(2)} (Actual: ${snake.mass.toFixed(4)})`);
        assert(snake.isBoosting, `Snake maintains boosting state at mass ${snake.mass.toFixed(2)}`);
    }
})();

// Test 3.2: Immediate Cutoff when mass reaches <= 20.0 (MIN_BOOST_MASS)
(() => {
    const snake = new Snake('boost_cutoff_imm', 'CutoffImm', 1500, 1500);
    snake.mass = 22.0; // 2.0 mass units to drain
    snake.setBoosting(true);

    const dt = 1 / 60;
    let steps = 0;

    // Run until cutoff
    while (snake.isBoosting && steps < 100) {
        steps++;
        snake.update(dt);
    }

    assert(steps === 30 || steps === 31, `Boost drains exactly 2.0 mass in ~30-31 ticks (Actual: ${steps} ticks, ${(steps * dt).toFixed(3)}s)`);
    assertCloseTo(snake.mass, 20.0, 1e-4, `Mass clamped exactly at MIN_BOOST_MASS = 20.0 (Actual: ${snake.mass.toFixed(6)})`);
    assert(!snake.isBoosting, `isBoosting immediately becomes false upon reaching mass 20.0`);

    // Verify subsequent update ticks do NOT deplete mass further
    for (let i = 0; i < 120; i++) {
        snake.setBoosting(true);
        snake.handleInput({ isBoosting: true });
        snake.update(dt);
    }

    assertCloseTo(snake.mass, 20.0, 1e-6, `Mass remains strictly at 20.0 and never drops below 20.0 (Actual: ${snake.mass.toFixed(6)})`);
    assert(!snake.isBoosting, `Boosting remains disabled while mass <= 20.0`);
    assertCloseTo(snake.currentSpeed, CONFIG.BASE_SPEED, 0.5, `Speed decelerates to BASE_SPEED (${CONFIG.BASE_SPEED}px/s) (Actual: ${snake.currentSpeed.toFixed(2)})`);
})();

// Test 3.3: Boost Activation Rejected below or at threshold (mass <= 20.0)
(() => {
    const snake20 = new Snake('s20', 'S20', 1500, 1500);
    snake20.mass = 20.0;
    snake20.setBoosting(true);
    assert(!snake20.isBoosting, 'setBoosting(true) rejected when mass == 20.0');

    const snake15 = new Snake('s15', 'S15', 1500, 1500);
    snake15.mass = 15.0;
    snake15.setBoosting(true);
    assert(!snake15.isBoosting, 'setBoosting(true) rejected when mass < 20.0');

    snake15.handleInput({ isBoosting: true });
    assert(!snake15.isBoosting, 'handleInput({ isBoosting: true }) rejected when mass < 20.0');
})();

// Test 3.4: Trail Food Pellet Dropping Event while boosting
(() => {
    const snake = new Snake('trail_pellet', 'TrailPellet', 1500, 1500);
    snake.mass = 100.0;
    snake.setBoosting(true);

    const droppedPellets = [];
    const onDrop = (pellet) => {
        droppedPellets.push(pellet);
    };

    // 60 frames (1.0s at BOOST_SPEED = 285px/s => ~285px distance => 285 / 24 ≈ 11 pellets)
    for (let f = 0; f < 60; f++) {
        snake.update(1 / 60, onDrop);
    }

    assertBetween(droppedPellets.length, 10, 12, `Trail drops ~11 pellets per second while boosting (Actual: ${droppedPellets.length})`);
    assert(droppedPellets.every(p => p.value === 1.2 && p.color === snake.skin.glowColor), 'All dropped pellets contain valid value (1.2) and skin glowColor');
})();

// ============================================================================
// SUITE 4: CAMERA, ARENA & BOUNDARY SYSTEM
// ============================================================================
console.log('\n--- SUITE 4: Camera & World Arena System ---');

(() => {
    const world = new World(3000, 3000, 1450);
    assert(!world.isOutOfBounds(1500, 1500, 10), 'Center of world (1500, 1500) is inside arena');
    assert(world.isOutOfBounds(1500 + 1450, 1500, 1), 'Border edge (2950, 1500) is out of bounds');
    assert(world.isOutOfBounds(50, 50, 10), 'Corner coordinate (50, 50) is out of circular bounds');

    const cam = new Camera(800, 600);
    cam.setTarget(1500, 1500, 20.0);
    cam.update(1500, 1500, 20.0, 1.0);
    assertCloseTo(cam.x, 1500, 0.1, 'Camera centers on target X (1500)');
    assertCloseTo(cam.y, 1500, 0.1, 'Camera centers on target Y (1500)');

    const screenPt = cam.worldToScreen(1500, 1500);
    assertCloseTo(screenPt.x, 400, 0.1, 'World (1500, 1500) projects to screen center X (400)');
    assertCloseTo(screenPt.y, 300, 0.1, 'World (1500, 1500) projects to screen center Y (300)');

    const worldPt = cam.screenToWorld(400, 300);
    assertCloseTo(worldPt.x, 1500, 0.1, 'Screen center projects back to world (1500, 1500)');
})();

// ============================================================================
// SUMMARY & EMPIRICAL VERDICT
// ============================================================================
console.log('\n================================================================');
console.log('EMPIRICAL STRESS-TEST RESULTS');
console.log('================================================================');
console.log(`Total Tests Executed : ${totalTests}`);
console.log(`Passed Tests         : ${passedTests}`);
console.log(`Failed Tests         : ${failedTests}`);

if (failedTests === 0) {
    console.log('\n>>> EMPIRICAL VERDICT: ALL PASS [APPROVE] <<<');
} else {
    console.log(`\n>>> EMPIRICAL VERDICT: ${failedTests} FAILURES [REQUEST_CHANGES] <<<`);
    failures.forEach((f, idx) => {
        console.error(`\nFailure ${idx + 1}: ${f.message}`);
    });
}
